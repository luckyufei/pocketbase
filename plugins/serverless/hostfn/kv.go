// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// KVSetOptions KV 设置选项
type KVSetOptions struct {
	TTL int // 过期时间（秒）
}

// kvEntry KV 存储条目（用于 fallback 内存存储）
type kvEntry struct {
	Value     interface{}
	ExpiresAt time.Time
}

// KVStore KV 存储服务
// 优先使用 core.KVStore，如果不可用则回退到内存存储
type KVStore struct {
	app      core.App
	coreKV   core.KVStore // 桥接到 core.KVStore
	fallback map[string]kvEntry
	mutex    sync.RWMutex
}

// NewKVStore 创建 KV 存储服务
func NewKVStore(app core.App) *KVStore {
	kv := &KVStore{
		app:      app,
		fallback: make(map[string]kvEntry),
	}

	// 尝试获取 core.KVStore
	if app != nil {
		kv.coreKV = app.KV()
	}

	return kv
}

// useCoreKV 检查是否应该使用 core.KVStore
func (kv *KVStore) useCoreKV() bool {
	return kv.coreKV != nil
}

// Get 获取值
func (kv *KVStore) Get(key string) (interface{}, error) {
	if kv.useCoreKV() {
		val, err := kv.coreKV.Get(key)
		if err == core.ErrKVNotFound {
			return nil, nil
		}
		return val, err
	}

	// Fallback 到内存存储
	kv.mutex.RLock()
	defer kv.mutex.RUnlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return nil, nil
	}

	// 检查是否过期
	if !entry.ExpiresAt.IsZero() && time.Now().After(entry.ExpiresAt) {
		return nil, nil
	}

	return entry.Value, nil
}

// Set 设置值
func (kv *KVStore) Set(key string, value interface{}, ttl int) error {
	if kv.useCoreKV() {
		if ttl > 0 {
			return kv.coreKV.SetEx(key, value, time.Duration(ttl)*time.Second)
		}
		return kv.coreKV.Set(key, value)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	entry := kvEntry{Value: value}
	if ttl > 0 {
		entry.ExpiresAt = time.Now().Add(time.Duration(ttl) * time.Second)
	}

	kv.fallback[key] = entry
	return nil
}

// SetWithOptions 使用选项设置值
func (kv *KVStore) SetWithOptions(key string, value interface{}, opts KVSetOptions) error {
	return kv.Set(key, value, opts.TTL)
}

// Delete 删除键
func (kv *KVStore) Delete(key string) error {
	if kv.useCoreKV() {
		return kv.coreKV.Delete(key)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	delete(kv.fallback, key)
	return nil
}

// Exists 检查键是否存在
func (kv *KVStore) Exists(key string) (bool, error) {
	if kv.useCoreKV() {
		return kv.coreKV.Exists(key)
	}

	// Fallback 到内存存储
	kv.mutex.RLock()
	defer kv.mutex.RUnlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return false, nil
	}

	// 检查是否过期
	if !entry.ExpiresAt.IsZero() && time.Now().After(entry.ExpiresAt) {
		return false, nil
	}

	return true, nil
}

// TTL 获取键的剩余过期时间
func (kv *KVStore) TTL(key string) (time.Duration, error) {
	if kv.useCoreKV() {
		return kv.coreKV.TTL(key)
	}

	// Fallback 到内存存储
	kv.mutex.RLock()
	defer kv.mutex.RUnlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return 0, core.ErrKVNotFound
	}

	if entry.ExpiresAt.IsZero() {
		return -1, nil // 永不过期
	}

	remaining := time.Until(entry.ExpiresAt)
	if remaining <= 0 {
		return 0, core.ErrKVNotFound
	}

	return remaining, nil
}

// Expire 更新键的过期时间
func (kv *KVStore) Expire(key string, ttl time.Duration) error {
	if kv.useCoreKV() {
		return kv.coreKV.Expire(key, ttl)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return core.ErrKVNotFound
	}

	entry.ExpiresAt = time.Now().Add(ttl)
	kv.fallback[key] = entry
	return nil
}

// Incr 原子递增
func (kv *KVStore) Incr(key string) (int64, error) {
	if kv.useCoreKV() {
		return kv.coreKV.Incr(key)
	}

	return kv.IncrBy(key, 1)
}

// IncrBy 原子递增指定值
func (kv *KVStore) IncrBy(key string, delta int64) (int64, error) {
	if kv.useCoreKV() {
		return kv.coreKV.IncrBy(key, delta)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	var current int64
	entry, exists := kv.fallback[key]
	if exists {
		if v, ok := entry.Value.(int64); ok {
			current = v
		} else if v, ok := entry.Value.(float64); ok {
			current = int64(v)
		}
	}

	newValue := current + delta
	kv.fallback[key] = kvEntry{Value: newValue}
	return newValue, nil
}

// Decr 原子递减
func (kv *KVStore) Decr(key string) (int64, error) {
	if kv.useCoreKV() {
		return kv.coreKV.Decr(key)
	}

	return kv.IncrBy(key, -1)
}

// HSet 设置 Hash 字段的值
func (kv *KVStore) HSet(key, field string, value interface{}) error {
	if kv.useCoreKV() {
		return kv.coreKV.HSet(key, field, value)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	entry, exists := kv.fallback[key]
	var hash map[string]interface{}
	if exists {
		if h, ok := entry.Value.(map[string]interface{}); ok {
			hash = h
		}
	}
	if hash == nil {
		hash = make(map[string]interface{})
	}

	hash[field] = value
	kv.fallback[key] = kvEntry{Value: hash}
	return nil
}

// HGet 获取 Hash 字段的值
func (kv *KVStore) HGet(key, field string) (interface{}, error) {
	if kv.useCoreKV() {
		return kv.coreKV.HGet(key, field)
	}

	// Fallback 到内存存储
	kv.mutex.RLock()
	defer kv.mutex.RUnlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return nil, core.ErrKVNotFound
	}

	hash, ok := entry.Value.(map[string]interface{})
	if !ok {
		return nil, core.ErrKVNotFound
	}

	val, exists := hash[field]
	if !exists {
		return nil, core.ErrKVNotFound
	}

	return val, nil
}

// HGetAll 获取 Hash 所有字段
func (kv *KVStore) HGetAll(key string) (map[string]interface{}, error) {
	if kv.useCoreKV() {
		return kv.coreKV.HGetAll(key)
	}

	// Fallback 到内存存储
	kv.mutex.RLock()
	defer kv.mutex.RUnlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return nil, core.ErrKVNotFound
	}

	hash, ok := entry.Value.(map[string]interface{})
	if !ok {
		return nil, core.ErrKVNotFound
	}

	// 返回副本
	result := make(map[string]interface{})
	for k, v := range hash {
		result[k] = v
	}
	return result, nil
}

// HDel 删除 Hash 字段
func (kv *KVStore) HDel(key string, fields ...string) error {
	if kv.useCoreKV() {
		return kv.coreKV.HDel(key, fields...)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	entry, exists := kv.fallback[key]
	if !exists {
		return nil
	}

	hash, ok := entry.Value.(map[string]interface{})
	if !ok {
		return nil
	}

	for _, field := range fields {
		delete(hash, field)
	}
	return nil
}

// HIncrBy Hash 字段原子递增
func (kv *KVStore) HIncrBy(key, field string, delta int64) (int64, error) {
	if kv.useCoreKV() {
		return kv.coreKV.HIncrBy(key, field, delta)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	entry, exists := kv.fallback[key]
	var hash map[string]interface{}
	if exists {
		if h, ok := entry.Value.(map[string]interface{}); ok {
			hash = h
		}
	}
	if hash == nil {
		hash = make(map[string]interface{})
	}

	var current int64
	if v, ok := hash[field].(int64); ok {
		current = v
	} else if v, ok := hash[field].(float64); ok {
		current = int64(v)
	}

	newValue := current + delta
	hash[field] = newValue
	kv.fallback[key] = kvEntry{Value: hash}
	return newValue, nil
}

// Lock 尝试获取分布式锁
func (kv *KVStore) Lock(key string, ttl time.Duration) (bool, error) {
	if kv.useCoreKV() {
		return kv.coreKV.Lock(key, ttl)
	}

	// Fallback 到内存存储（简单实现）
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	lockKey := "__lock:" + key
	entry, exists := kv.fallback[lockKey]
	if exists && !entry.ExpiresAt.IsZero() && time.Now().Before(entry.ExpiresAt) {
		return false, nil // 锁已被持有
	}

	kv.fallback[lockKey] = kvEntry{
		Value:     true,
		ExpiresAt: time.Now().Add(ttl),
	}
	return true, nil
}

// Unlock 释放分布式锁
func (kv *KVStore) Unlock(key string) error {
	if kv.useCoreKV() {
		return kv.coreKV.Unlock(key)
	}

	// Fallback 到内存存储
	kv.mutex.Lock()
	defer kv.mutex.Unlock()

	lockKey := "__lock:" + key
	delete(kv.fallback, lockKey)
	return nil
}

// HostFunctions KV 方法扩展

// KVGet 获取 KV 值
func (hf *HostFunctions) KVGet(key string) (interface{}, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Get(key)
}

// KVSet 设置 KV 值
func (hf *HostFunctions) KVSet(key string, value interface{}, ttl int) error {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Set(key, value, ttl)
}

// KVDelete 删除 KV 键
func (hf *HostFunctions) KVDelete(key string) error {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Delete(key)
}

// KVExists 检查 KV 键是否存在
func (hf *HostFunctions) KVExists(key string) (bool, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Exists(key)
}

// KVIncr 原子递增
func (hf *HostFunctions) KVIncr(key string) (int64, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Incr(key)
}

// KVIncrBy 原子递增指定值
func (hf *HostFunctions) KVIncrBy(key string, delta int64) (int64, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.IncrBy(key, delta)
}

// KVHSet 设置 Hash 字段
func (hf *HostFunctions) KVHSet(key, field string, value interface{}) error {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.HSet(key, field, value)
}

// KVHGet 获取 Hash 字段
func (hf *HostFunctions) KVHGet(key, field string) (interface{}, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.HGet(key, field)
}

// KVHGetAll 获取 Hash 所有字段
func (hf *HostFunctions) KVHGetAll(key string) (map[string]interface{}, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.HGetAll(key)
}

// KVLock 尝试获取分布式锁
func (hf *HostFunctions) KVLock(key string, ttl time.Duration) (bool, error) {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Lock(key, ttl)
}

// KVUnlock 释放分布式锁
func (hf *HostFunctions) KVUnlock(key string) error {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv.Unlock(key)
}
