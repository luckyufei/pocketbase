package kv

import (
	"encoding/json"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// kvStore 是 Store 接口的实现
// 采用两级缓存架构：L1 进程内缓存 + L2 数据库
type kvStore struct {
	app    core.App
	config Config
	l1     *l1Cache
	l2     *l2DB

	// 锁持有者标识（用于分布式锁）
	lockOwner string
}

// newKVStore 创建 Store 实例
func newKVStore(app core.App, config Config) *kvStore {
	return &kvStore{
		app:       app,
		config:    config,
		l1:        newL1CacheWithMaxSize(int(config.L1MaxSize)),
		l2:        newL2DB(app),
		lockOwner: core.GenerateDefaultRandomId(),
	}
}

// validateValueSize 验证 value 大小是否超过限制
func (kv *kvStore) validateValueSize(value any) error {
	// 快速路径：字符串直接检查长度
	if s, ok := value.(string); ok {
		if len(s) > int(kv.config.MaxValueSize) {
			return ErrValueTooLarge
		}
		return nil
	}

	// 快速路径：[]byte 直接检查长度
	if b, ok := value.([]byte); ok {
		if len(b) > int(kv.config.MaxValueSize) {
			return ErrValueTooLarge
		}
		return nil
	}

	// 其他类型：序列化后检查大小
	data, err := json.Marshal(value)
	if err != nil {
		return nil // 序列化失败时不阻止，让后续操作处理
	}

	if len(data) > int(kv.config.MaxValueSize) {
		return ErrValueTooLarge
	}

	return nil
}

// ==================== 基础操作实现 ====================

func (kv *kvStore) Get(key string) (any, error) {
	// 1. 检查 L1 缓存（如果启用）
	if kv.config.L1Enabled {
		if value, found := kv.l1.Get(key); found {
			return value, nil
		}
	}

	// 2. 查询 L2 数据库
	value, err := kv.l2.Get(key)
	if err != nil {
		return nil, err
	}

	// 3. 获取 L2 中的 TTL，确保 L1 缓存不会超过 L2 的过期时间
	if kv.config.L1Enabled {
		l1TTL := kv.config.L1TTL
		if ttl, err := kv.l2.TTL(key); err == nil && ttl > 0 && ttl < l1TTL {
			l1TTL = ttl
		}

		// 4. 写入 L1 缓存
		kv.l1.Set(key, value, l1TTL)
	}

	return value, nil
}

func (kv *kvStore) Set(key string, value any) error {
	// 验证 Key 长度
	if len(key) > kv.config.MaxKeyLength {
		return ErrKeyTooLong
	}

	// 验证 Value 大小
	if err := kv.validateValueSize(value); err != nil {
		return err
	}

	// 写入 L2
	if err := kv.l2.Set(key, value); err != nil {
		return err
	}

	// 清除 L1 缓存（保证一致性）
	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}

	return nil
}

func (kv *kvStore) SetEx(key string, value any, ttl time.Duration) error {
	// 验证 Key 长度
	if len(key) > kv.config.MaxKeyLength {
		return ErrKeyTooLong
	}

	// 验证 Value 大小
	if err := kv.validateValueSize(value); err != nil {
		return err
	}

	// 写入 L2
	if err := kv.l2.SetEx(key, value, ttl); err != nil {
		return err
	}

	// 清除 L1 缓存
	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}

	return nil
}

func (kv *kvStore) Delete(key string) error {
	// 删除 L2
	if err := kv.l2.Delete(key); err != nil {
		return err
	}

	// 清除 L1 缓存
	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}

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
	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}

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
	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}

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

	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}
	return nil
}

func (kv *kvStore) HGet(key, field string) (any, error) {
	// 检查 L1 缓存（缓存整个 hash）
	if kv.config.L1Enabled {
		if cached, found := kv.l1.Get(key); found {
			if m, ok := cached.(map[string]any); ok {
				if v, exists := m[field]; exists {
					return v, nil
				}
				return nil, ErrNotFound
			}
		}
	}

	// 从 L2 获取整个 hash 并缓存
	all, err := kv.l2.HGetAll(key)
	if err != nil {
		return nil, err
	}

	// 缓存整个 hash
	if kv.config.L1Enabled {
		kv.l1.Set(key, all, kv.config.L1TTL)
	}

	v, exists := all[field]
	if !exists {
		return nil, ErrNotFound
	}
	return v, nil
}

func (kv *kvStore) HGetAll(key string) (map[string]any, error) {
	// 检查 L1 缓存
	if kv.config.L1Enabled {
		if cached, found := kv.l1.Get(key); found {
			if m, ok := cached.(map[string]any); ok {
				return m, nil
			}
		}
	}

	// 从 L2 获取
	result, err := kv.l2.HGetAll(key)
	if err != nil {
		return nil, err
	}

	// 缓存结果
	if kv.config.L1Enabled {
		kv.l1.Set(key, result, kv.config.L1TTL)
	}

	return result, nil
}

func (kv *kvStore) HDel(key string, fields ...string) error {
	if err := kv.l2.HDel(key, fields...); err != nil {
		return err
	}

	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}
	return nil
}

func (kv *kvStore) HIncrBy(key, field string, delta int64) (int64, error) {
	value, err := kv.l2.HIncrBy(key, field, delta)
	if err != nil {
		return 0, err
	}

	if kv.config.L1Enabled {
		kv.l1.Invalidate(key)
	}
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
	if kv.config.L1Enabled {
		for key := range pairs {
			kv.l1.Invalidate(key)
		}
	}

	return nil
}

func (kv *kvStore) MGet(keys ...string) (map[string]any, error) {
	if len(keys) == 0 {
		return map[string]any{}, nil
	}

	result := make(map[string]any)
	var missedKeys []string

	// 先从 L1 缓存获取
	if kv.config.L1Enabled {
		for _, key := range keys {
			if value, found := kv.l1.Get(key); found {
				result[key] = value
			} else {
				missedKeys = append(missedKeys, key)
			}
		}
	} else {
		missedKeys = keys
	}

	// 从 L2 获取未命中的 keys
	if len(missedKeys) > 0 {
		l2Result, err := kv.l2.MGet(missedKeys...)
		if err != nil {
			return nil, err
		}

		// 合并结果并缓存
		for k, v := range l2Result {
			result[k] = v
			if kv.config.L1Enabled {
				kv.l1.Set(k, v, kv.config.L1TTL)
			}
		}
	}

	return result, nil
}

// ==================== 其他操作实现 ====================

func (kv *kvStore) Keys(pattern string) ([]string, error) {
	return kv.l2.Keys(pattern)
}
