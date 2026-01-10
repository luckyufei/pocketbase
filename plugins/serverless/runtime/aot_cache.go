package runtime

import (
	"crypto/sha256"
	"encoding/gob"
	"encoding/hex"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

// CompiledModule 表示编译后的模块
type CompiledModule struct {
	Key        string    // 缓存键
	Bytecode   []byte    // 编译后的字节码
	SourceHash string    // 源代码哈希
	CompiledAt time.Time // 编译时间
}

// AOTCacheConfig AOT 缓存配置
type AOTCacheConfig struct {
	CacheDir    string        // 缓存目录
	MaxEntries  int           // 最大缓存条目数
	TTL         time.Duration // 缓存过期时间
	PersistDisk bool          // 是否持久化到磁盘
}

// DefaultAOTCacheConfig 返回默认配置
func DefaultAOTCacheConfig() AOTCacheConfig {
	return AOTCacheConfig{
		CacheDir:    filepath.Join(os.TempDir(), "pocketbase_aot_cache"),
		MaxEntries:  1000,
		TTL:         24 * time.Hour,
		PersistDisk: true,
	}
}

// cacheEntry 缓存条目（带过期时间）
type cacheEntry struct {
	Module    *CompiledModule
	ExpiresAt time.Time
}

// AOTCacheStats AOT 缓存统计
type AOTCacheStats struct {
	Hits      int64 // 命中次数
	Misses    int64 // 未命中次数
	Entries   int   // 当前条目数
	Evictions int64 // 驱逐次数
}

// AOTCache AOT 编译缓存
type AOTCache struct {
	config  AOTCacheConfig
	entries map[string]*cacheEntry
	mu      sync.RWMutex
	hits    int64
	misses  int64
	evicts  int64
	closed  bool
}

// NewAOTCache 创建新的 AOT 缓存
func NewAOTCache(config AOTCacheConfig) (*AOTCache, error) {
	// 确保缓存目录存在
	if config.PersistDisk && config.CacheDir != "" {
		if err := os.MkdirAll(config.CacheDir, 0755); err != nil {
			return nil, err
		}
	}

	cache := &AOTCache{
		config:  config,
		entries: make(map[string]*cacheEntry),
	}

	// 从磁盘加载缓存
	if config.PersistDisk {
		cache.loadFromDisk()
	}

	return cache, nil
}

// ComputeKey 计算缓存键（SHA256）
func (c *AOTCache) ComputeKey(source []byte) string {
	hash := sha256.Sum256(source)
	return hex.EncodeToString(hash[:])
}

// Get 获取缓存的编译结果
func (c *AOTCache) Get(key string) (*CompiledModule, bool) {
	c.mu.RLock()
	entry, exists := c.entries[key]
	c.mu.RUnlock()

	if !exists {
		atomic.AddInt64(&c.misses, 1)
		return nil, false
	}

	// 检查是否过期
	if time.Now().After(entry.ExpiresAt) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		atomic.AddInt64(&c.misses, 1)
		return nil, false
	}

	atomic.AddInt64(&c.hits, 1)
	return entry.Module, true
}

// Put 存储编译结果
func (c *AOTCache) Put(key string, module *CompiledModule) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 检查是否需要驱逐
	if len(c.entries) >= c.config.MaxEntries {
		c.evictOldest()
	}

	c.entries[key] = &cacheEntry{
		Module:    module,
		ExpiresAt: time.Now().Add(c.config.TTL),
	}
}

// GetOrCompile 获取缓存或编译
func (c *AOTCache) GetOrCompile(source []byte, compiler func([]byte) (*CompiledModule, error)) (*CompiledModule, error) {
	key := c.ComputeKey(source)

	// 尝试从缓存获取
	if module, hit := c.Get(key); hit {
		return module, nil
	}

	// 编译
	module, err := compiler(source)
	if err != nil {
		return nil, err
	}

	// 存入缓存
	c.Put(key, module)

	return module, nil
}

// Invalidate 使缓存失效
func (c *AOTCache) Invalidate(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}

// Clear 清空缓存
func (c *AOTCache) Clear() {
	c.mu.Lock()
	c.entries = make(map[string]*cacheEntry)
	c.mu.Unlock()
}

// Stats 获取统计信息
func (c *AOTCache) Stats() AOTCacheStats {
	c.mu.RLock()
	entries := len(c.entries)
	c.mu.RUnlock()

	return AOTCacheStats{
		Hits:      atomic.LoadInt64(&c.hits),
		Misses:    atomic.LoadInt64(&c.misses),
		Entries:   entries,
		Evictions: atomic.LoadInt64(&c.evicts),
	}
}

// Flush 刷新缓存到磁盘
func (c *AOTCache) Flush() error {
	if !c.config.PersistDisk || c.config.CacheDir == "" {
		return nil
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	cacheFile := filepath.Join(c.config.CacheDir, "aot_cache.gob")
	file, err := os.Create(cacheFile)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := gob.NewEncoder(file)
	return encoder.Encode(c.entries)
}

// Close 关闭缓存
func (c *AOTCache) Close() error {
	c.mu.Lock()
	c.closed = true
	c.mu.Unlock()

	// 保存到磁盘
	if c.config.PersistDisk {
		return c.Flush()
	}
	return nil
}

// evictOldest 驱逐最旧的条目（LRU 简化版）
func (c *AOTCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time

	for key, entry := range c.entries {
		if oldestKey == "" || entry.Module.CompiledAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.Module.CompiledAt
		}
	}

	if oldestKey != "" {
		delete(c.entries, oldestKey)
		atomic.AddInt64(&c.evicts, 1)
	}
}

// loadFromDisk 从磁盘加载缓存
func (c *AOTCache) loadFromDisk() {
	cacheFile := filepath.Join(c.config.CacheDir, "aot_cache.gob")
	file, err := os.Open(cacheFile)
	if err != nil {
		return // 文件不存在是正常的
	}
	defer file.Close()

	decoder := gob.NewDecoder(file)
	var entries map[string]*cacheEntry
	if err := decoder.Decode(&entries); err != nil {
		return
	}

	// 过滤过期条目
	now := time.Now()
	for key, entry := range entries {
		if now.Before(entry.ExpiresAt) {
			c.entries[key] = entry
		}
	}
}
