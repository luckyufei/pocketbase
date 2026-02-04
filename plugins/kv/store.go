package kv

import "time"

// Store 定义键值存储接口
// 提供类 Redis 的 API，支持 String、Hash、计数器、分布式锁等操作
type Store interface {
	// ==================== 基础操作 ====================

	// Get 获取 Key 对应的值
	// 如果 Key 不存在或已过期，返回 nil 和 ErrNotFound
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
	// 如果 Key 不存在，返回 ErrNotFound
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
