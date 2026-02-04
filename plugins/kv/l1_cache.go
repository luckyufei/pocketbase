package kv

import (
	"container/list"
	"sync"
	"time"
)

// l1Cache L1 进程内缓存
// 支持 LRU 淘汰策略和容量控制
type l1Cache struct {
	mu       sync.RWMutex
	data     map[string]*list.Element
	lruList  *list.List // LRU 链表，最近访问的在前
	maxSize  int        // 最大条目数，0 表示无限制
}

// cacheEntry 缓存条目
type cacheEntry struct {
	key      string
	value    any
	expireAt time.Time
}

// newL1Cache 创建 L1 缓存实例（无容量限制）
func newL1Cache() *l1Cache {
	return newL1CacheWithMaxSize(0)
}

// newL1CacheWithMaxSize 创建带容量限制的 L1 缓存实例
func newL1CacheWithMaxSize(maxSize int) *l1Cache {
	return &l1Cache{
		data:    make(map[string]*list.Element),
		lruList: list.New(),
		maxSize: maxSize,
	}
}

// Get 从缓存获取值
func (c *l1Cache) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.data[key]
	if !ok {
		return nil, false
	}

	entry := elem.Value.(*cacheEntry)

	// 检查是否过期
	if !entry.expireAt.IsZero() && time.Now().After(entry.expireAt) {
		c.removeElement(elem)
		return nil, false
	}

	// 移动到 LRU 链表头部（最近访问）
	c.lruList.MoveToFront(elem)

	return entry.value, true
}

// Set 写入缓存
func (c *l1Cache) Set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var expireAt time.Time
	if ttl > 0 {
		expireAt = time.Now().Add(ttl)
	}

	entry := &cacheEntry{
		key:      key,
		value:    value,
		expireAt: expireAt,
	}

	// 如果 key 已存在，更新并移到头部
	if elem, ok := c.data[key]; ok {
		elem.Value = entry
		c.lruList.MoveToFront(elem)
		return
	}

	// 检查容量限制，淘汰最久未使用的
	if c.maxSize > 0 && len(c.data) >= c.maxSize {
		c.evictOldest()
	}

	// 添加新条目到头部
	elem := c.lruList.PushFront(entry)
	c.data[key] = elem
}

// Invalidate 清除缓存
func (c *l1Cache) Invalidate(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.data[key]; ok {
		c.removeElement(elem)
	}
}

// Clear 清空所有缓存
func (c *l1Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data = make(map[string]*list.Element)
	c.lruList.Init()
}

// Size 返回当前缓存条目数
func (c *l1Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.data)
}

// removeElement 从缓存中移除元素（内部方法，需持有锁）
func (c *l1Cache) removeElement(elem *list.Element) {
	entry := elem.Value.(*cacheEntry)
	delete(c.data, entry.key)
	c.lruList.Remove(elem)
}

// evictOldest 淘汰最久未使用的条目（内部方法，需持有锁）
func (c *l1Cache) evictOldest() {
	elem := c.lruList.Back()
	if elem != nil {
		c.removeElement(elem)
	}
}
