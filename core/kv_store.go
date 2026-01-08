package core

import (
	"errors"
	"time"
)

// KV 相关错误
var (
	// ErrKVNotFound 表示 Key 不存在
	ErrKVNotFound = errors.New("key not found")

	// ErrKVKeyTooLong 表示 Key 长度超过限制
	ErrKVKeyTooLong = errors.New("key too long (max 256 characters)")

	// ErrKVValueTooLarge 表示 Value 大小超过限制
	ErrKVValueTooLarge = errors.New("value too large (max 1MB)")
)

// KV 相关常量
const (
	// KVMaxKeyLength Key 最大长度
	KVMaxKeyLength = 256

	// KVMaxValueSize Value 最大大小 (1MB)
	KVMaxValueSize = 1 << 20

	// KVDefaultL1TTL L1 缓存默认 TTL
	KVDefaultL1TTL = 5 * time.Second

	// KVCleanupInterval 过期数据清理间隔
	KVCleanupInterval = 1 * time.Minute
)

// KVStore 定义键值存储接口
// 提供类 Redis 的 API，支持 String、Hash、计数器、分布式锁等操作
type KVStore interface {
	// ==================== 基础操作 ====================

	// Get 获取 Key 对应的值
	// 如果 Key 不存在或已过期，返回 nil 和 ErrKVNotFound
	Get(key string) (any, error)

	// Set 设置 Key 的值（永不过期）
	Set(key string, value any) error

	// SetEx 设置 Key 的值，并指定过期时间
	SetEx(key string, value any, ttl time.Duration) error

	// Delete 删除 Key
	Delete(key string) error

	// Exists 检查 Key 是否存在
	Exists(key string) (bool, error)

	// ==================== TTL 操作 ====================

	// TTL 获取 Key 的剩余过期时间
	// 如果 Key 不存在，返回 ErrKVNotFound
	// 如果 Key 永不过期，返回 -1
	TTL(key string) (time.Duration, error)

	// Expire 更新 Key 的过期时间
	Expire(key string, ttl time.Duration) error

	// ==================== 计数器操作 ====================

	// Incr 原子递增，返回递增后的值
	// 如果 Key 不存在，自动初始化为 0 后递增
	Incr(key string) (int64, error)

	// IncrBy 原子递增指定值，返回递增后的值
	IncrBy(key string, delta int64) (int64, error)

	// Decr 原子递减，返回递减后的值
	Decr(key string) (int64, error)

	// ==================== Hash 操作 ====================

	// HSet 设置 Hash 字段的值
	HSet(key, field string, value any) error

	// HGet 获取 Hash 字段的值
	HGet(key, field string) (any, error)

	// HGetAll 获取 Hash 所有字段
	HGetAll(key string) (map[string]any, error)

	// HDel 删除 Hash 字段
	HDel(key string, fields ...string) error

	// HIncrBy Hash 字段原子递增
	HIncrBy(key, field string, delta int64) (int64, error)

	// ==================== 分布式锁 ====================

	// Lock 尝试获取分布式锁
	// 返回 true 表示获取成功，false 表示锁已被持有
	Lock(key string, ttl time.Duration) (bool, error)

	// Unlock 释放分布式锁
	// 只有锁的持有者才能释放
	Unlock(key string) error

	// ==================== 批量操作 ====================

	// MSet 批量设置键值对
	MSet(pairs map[string]any) error

	// MGet 批量获取值
	MGet(keys ...string) (map[string]any, error)

	// ==================== 其他操作 ====================

	// Keys 按模式匹配查询 Key 列表
	// 支持 * 通配符，如 "user:*"
	Keys(pattern string) ([]string, error)
}

// kvStore 是 KVStore 接口的实现
// 采用两级缓存架构：L1 进程内缓存 + L2 PostgreSQL
type kvStore struct {
	app App
	l1  *kvL1Cache
	l2  *kvL2Postgres

	// 锁持有者标识（用于分布式锁）
	lockOwner string
}

// newKVStore 创建 KVStore 实例
func newKVStore(app App) *kvStore {
	return &kvStore{
		app:       app,
		l1:        newKVL1Cache(),
		l2:        newKVL2Postgres(app),
		lockOwner: generateLockOwner(),
	}
}

// generateLockOwner 生成锁持有者标识
func generateLockOwner() string {
	// 使用随机 ID 作为锁持有者标识
	return GenerateDefaultRandomId()
}

// ==================== 基础操作实现 ====================

func (kv *kvStore) Get(key string) (any, error) {
	// 1. 检查 L1 缓存
	if value, found := kv.l1.Get(key); found {
		return value, nil
	}

	// 2. 查询 L2 PostgreSQL
	value, err := kv.l2.Get(key)
	if err != nil {
		return nil, err
	}

	// 3. 获取 L2 中的 TTL，确保 L1 缓存不会超过 L2 的过期时间
	l1TTL := KVDefaultL1TTL
	if ttl, err := kv.l2.TTL(key); err == nil && ttl > 0 && ttl < l1TTL {
		l1TTL = ttl
	}

	// 4. 写入 L1 缓存
	kv.l1.Set(key, value, l1TTL)

	return value, nil
}

func (kv *kvStore) Set(key string, value any) error {
	// 验证 Key 长度
	if len(key) > KVMaxKeyLength {
		return ErrKVKeyTooLong
	}

	// 写入 L2
	if err := kv.l2.Set(key, value); err != nil {
		return err
	}

	// 清除 L1 缓存（保证一致性）
	kv.l1.Invalidate(key)

	return nil
}

func (kv *kvStore) SetEx(key string, value any, ttl time.Duration) error {
	// 验证 Key 长度
	if len(key) > KVMaxKeyLength {
		return ErrKVKeyTooLong
	}

	// 写入 L2
	if err := kv.l2.SetEx(key, value, ttl); err != nil {
		return err
	}

	// 清除 L1 缓存
	kv.l1.Invalidate(key)

	return nil
}

func (kv *kvStore) Delete(key string) error {
	// 删除 L2
	if err := kv.l2.Delete(key); err != nil {
		return err
	}

	// 清除 L1 缓存
	kv.l1.Invalidate(key)

	return nil
}

func (kv *kvStore) Exists(key string) (bool, error) {
	return kv.l2.Exists(key)
}

// ==================== TTL 操作实现 ====================

func (kv *kvStore) TTL(key string) (time.Duration, error) {
	return kv.l2.TTL(key)
}

func (kv *kvStore) Expire(key string, ttl time.Duration) error {
	if err := kv.l2.Expire(key, ttl); err != nil {
		return err
	}

	// 清除 L1 缓存
	kv.l1.Invalidate(key)

	return nil
}

// ==================== 计数器操作实现 ====================

func (kv *kvStore) Incr(key string) (int64, error) {
	return kv.IncrBy(key, 1)
}

func (kv *kvStore) IncrBy(key string, delta int64) (int64, error) {
	value, err := kv.l2.IncrBy(key, delta)
	if err != nil {
		return 0, err
	}

	// 清除 L1 缓存
	kv.l1.Invalidate(key)

	return value, nil
}

func (kv *kvStore) Decr(key string) (int64, error) {
	return kv.IncrBy(key, -1)
}

// ==================== Hash 操作实现 ====================

func (kv *kvStore) HSet(key, field string, value any) error {
	if err := kv.l2.HSet(key, field, value); err != nil {
		return err
	}

	kv.l1.Invalidate(key)
	return nil
}

func (kv *kvStore) HGet(key, field string) (any, error) {
	return kv.l2.HGet(key, field)
}

func (kv *kvStore) HGetAll(key string) (map[string]any, error) {
	return kv.l2.HGetAll(key)
}

func (kv *kvStore) HDel(key string, fields ...string) error {
	if err := kv.l2.HDel(key, fields...); err != nil {
		return err
	}

	kv.l1.Invalidate(key)
	return nil
}

func (kv *kvStore) HIncrBy(key, field string, delta int64) (int64, error) {
	value, err := kv.l2.HIncrBy(key, field, delta)
	if err != nil {
		return 0, err
	}

	kv.l1.Invalidate(key)
	return value, nil
}

// ==================== 分布式锁实现 ====================

func (kv *kvStore) Lock(key string, ttl time.Duration) (bool, error) {
	lockKey := "_lock:" + key
	return kv.l2.Lock(lockKey, kv.lockOwner, ttl)
}

func (kv *kvStore) Unlock(key string) error {
	lockKey := "_lock:" + key
	return kv.l2.Unlock(lockKey, kv.lockOwner)
}

// ==================== 批量操作实现 ====================

func (kv *kvStore) MSet(pairs map[string]any) error {
	if err := kv.l2.MSet(pairs); err != nil {
		return err
	}

	// 清除所有相关 L1 缓存
	for key := range pairs {
		kv.l1.Invalidate(key)
	}

	return nil
}

func (kv *kvStore) MGet(keys ...string) (map[string]any, error) {
	return kv.l2.MGet(keys...)
}

// ==================== 其他操作实现 ====================

func (kv *kvStore) Keys(pattern string) ([]string, error) {
	return kv.l2.Keys(pattern)
}
