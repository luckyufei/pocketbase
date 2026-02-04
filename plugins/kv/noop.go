package kv

import "time"

// NoopStore 是 Store 接口的空实现
// 所有操作都是 no-op，用于未注册 KV 插件时的默认行为
type NoopStore struct{}

// NewNoopStore 创建 NoopStore 实例
func NewNoopStore() *NoopStore {
	return &NoopStore{}
}

// ==================== 基础操作 ====================

func (n *NoopStore) Get(key string) (any, error) {
	return nil, ErrNotFound
}

func (n *NoopStore) Set(key string, value any) error {
	return nil
}

func (n *NoopStore) SetEx(key string, value any, ttl time.Duration) error {
	return nil
}

func (n *NoopStore) Delete(key string) error {
	return nil
}

func (n *NoopStore) Exists(key string) (bool, error) {
	return false, nil
}

// ==================== TTL 操作 ====================

func (n *NoopStore) TTL(key string) (time.Duration, error) {
	return 0, ErrNotFound
}

func (n *NoopStore) Expire(key string, ttl time.Duration) error {
	return ErrNotFound
}

// ==================== 计数器操作 ====================

func (n *NoopStore) Incr(key string) (int64, error) {
	return 0, nil
}

func (n *NoopStore) IncrBy(key string, delta int64) (int64, error) {
	return 0, nil
}

func (n *NoopStore) Decr(key string) (int64, error) {
	return 0, nil
}

// ==================== Hash 操作 ====================

func (n *NoopStore) HSet(key, field string, value any) error {
	return nil
}

func (n *NoopStore) HGet(key, field string) (any, error) {
	return nil, ErrNotFound
}

func (n *NoopStore) HGetAll(key string) (map[string]any, error) {
	return nil, ErrNotFound
}

func (n *NoopStore) HDel(key string, fields ...string) error {
	return nil
}

func (n *NoopStore) HIncrBy(key, field string, delta int64) (int64, error) {
	return 0, nil
}

// ==================== 分布式锁 ====================

func (n *NoopStore) Lock(key string, ttl time.Duration) (bool, error) {
	return true, nil // NoopStore 总是成功获取锁
}

func (n *NoopStore) Unlock(key string) error {
	return nil
}

// ==================== 批量操作 ====================

func (n *NoopStore) MSet(pairs map[string]any) error {
	return nil
}

func (n *NoopStore) MGet(keys ...string) (map[string]any, error) {
	return map[string]any{}, nil
}

// ==================== 其他操作 ====================

func (n *NoopStore) Keys(pattern string) ([]string, error) {
	return []string{}, nil
}
