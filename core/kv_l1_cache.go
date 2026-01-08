package core

import (
	"sync"
	"time"
)

// kvL1Cache L1 进程内缓存
// 使用简单的 sync.Map + 过期时间实现
// TODO: 后续可替换为 Ristretto 以获得更好的性能和 LRU 淘汰
type kvL1Cache struct {
	data sync.Map
}

// kvCacheEntry 缓存条目
type kvCacheEntry struct {
	value    any
	expireAt time.Time
}

// newKVL1Cache 创建 L1 缓存实例
func newKVL1Cache() *kvL1Cache {
	return &kvL1Cache{}
}

// Get 从缓存获取值
func (c *kvL1Cache) Get(key string) (any, bool) {
	v, ok := c.data.Load(key)
	if !ok {
		return nil, false
	}

	entry := v.(*kvCacheEntry)

	// 检查是否过期
	if !entry.expireAt.IsZero() && time.Now().After(entry.expireAt) {
		c.data.Delete(key)
		return nil, false
	}

	return entry.value, true
}

// Set 写入缓存
func (c *kvL1Cache) Set(key string, value any, ttl time.Duration) {
	var expireAt time.Time
	if ttl > 0 {
		expireAt = time.Now().Add(ttl)
	}

	c.data.Store(key, &kvCacheEntry{
		value:    value,
		expireAt: expireAt,
	})
}

// Invalidate 清除缓存
func (c *kvL1Cache) Invalidate(key string) {
	c.data.Delete(key)
}

// Clear 清空所有缓存
func (c *kvL1Cache) Clear() {
	c.data.Range(func(key, value any) bool {
		c.data.Delete(key)
		return true
	})
}
