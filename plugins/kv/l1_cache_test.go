package kv

import (
	"testing"
	"time"
)

// ==================== T007: L1 缓存测试 ====================

func TestL1Cache_SetAndGet(t *testing.T) {
	cache := newL1Cache()

	cache.Set("key1", "value1", 5*time.Second)

	value, found := cache.Get("key1")
	if !found {
		t.Error("expected to find key1")
	}
	if value != "value1" {
		t.Errorf("expected 'value1', got '%v'", value)
	}
}

func TestL1Cache_GetNotFound(t *testing.T) {
	cache := newL1Cache()

	_, found := cache.Get("nonexistent")
	if found {
		t.Error("expected not to find nonexistent key")
	}
}

func TestL1Cache_Expiration(t *testing.T) {
	cache := newL1Cache()

	// 设置一个很短的 TTL
	cache.Set("expire_key", "value", 10*time.Millisecond)

	// 立即读取应该成功
	_, found := cache.Get("expire_key")
	if !found {
		t.Error("expected to find key before expiration")
	}

	// 等待过期
	time.Sleep(20 * time.Millisecond)

	// 过期后应该找不到
	_, found = cache.Get("expire_key")
	if found {
		t.Error("expected not to find key after expiration")
	}
}

func TestL1Cache_NoExpiration(t *testing.T) {
	cache := newL1Cache()

	// TTL=0 表示永不过期
	cache.Set("no_expire", "value", 0)

	_, found := cache.Get("no_expire")
	if !found {
		t.Error("expected to find key with no expiration")
	}
}

func TestL1Cache_Invalidate(t *testing.T) {
	cache := newL1Cache()

	cache.Set("to_invalidate", "value", 5*time.Second)

	// 验证存在
	_, found := cache.Get("to_invalidate")
	if !found {
		t.Error("expected to find key before invalidation")
	}

	// 使缓存失效
	cache.Invalidate("to_invalidate")

	// 验证不存在
	_, found = cache.Get("to_invalidate")
	if found {
		t.Error("expected not to find key after invalidation")
	}
}

func TestL1Cache_Clear(t *testing.T) {
	cache := newL1Cache()

	cache.Set("key1", "value1", 5*time.Second)
	cache.Set("key2", "value2", 5*time.Second)
	cache.Set("key3", "value3", 5*time.Second)

	// 清空所有缓存
	cache.Clear()

	// 验证全部不存在
	_, found1 := cache.Get("key1")
	_, found2 := cache.Get("key2")
	_, found3 := cache.Get("key3")

	if found1 || found2 || found3 {
		t.Error("expected all keys to be cleared")
	}
}

func TestL1Cache_Overwrite(t *testing.T) {
	cache := newL1Cache()

	cache.Set("overwrite_key", "value1", 5*time.Second)
	cache.Set("overwrite_key", "value2", 5*time.Second)

	value, found := cache.Get("overwrite_key")
	if !found {
		t.Error("expected to find key")
	}
	if value != "value2" {
		t.Errorf("expected 'value2', got '%v'", value)
	}
}

func TestL1Cache_DifferentTypes(t *testing.T) {
	cache := newL1Cache()

	// 测试不同类型的值
	cache.Set("string_key", "string_value", 5*time.Second)
	cache.Set("int_key", 123, 5*time.Second)
	cache.Set("float_key", 3.14, 5*time.Second)
	cache.Set("map_key", map[string]any{"a": 1}, 5*time.Second)
	cache.Set("slice_key", []string{"a", "b"}, 5*time.Second)

	// 验证所有类型都能正确存取
	if v, ok := cache.Get("string_key"); !ok || v != "string_value" {
		t.Errorf("string_key: expected 'string_value', got %v", v)
	}
	if v, ok := cache.Get("int_key"); !ok || v != 123 {
		t.Errorf("int_key: expected 123, got %v", v)
	}
	if v, ok := cache.Get("float_key"); !ok || v != 3.14 {
		t.Errorf("float_key: expected 3.14, got %v", v)
	}
	if v, ok := cache.Get("map_key"); !ok {
		t.Errorf("map_key: expected map, got %v", v)
	}
	if v, ok := cache.Get("slice_key"); !ok {
		t.Errorf("slice_key: expected slice, got %v", v)
	}
}

// ==================== L1 缓存容量控制测试（新增）====================

func TestL1Cache_MaxSizeEviction(t *testing.T) {
	cache := newL1CacheWithMaxSize(3) // 最多 3 个条目

	// 写入 3 个条目
	cache.Set("key1", "value1", 5*time.Second)
	cache.Set("key2", "value2", 5*time.Second)
	cache.Set("key3", "value3", 5*time.Second)

	// 所有都应该存在
	if _, found := cache.Get("key1"); !found {
		t.Error("expected key1 to exist")
	}
	if _, found := cache.Get("key2"); !found {
		t.Error("expected key2 to exist")
	}
	if _, found := cache.Get("key3"); !found {
		t.Error("expected key3 to exist")
	}

	// 写入第 4 个条目，应该淘汰最旧的 key1
	cache.Set("key4", "value4", 5*time.Second)

	// key1 应该被淘汰，key2/3/4 存在
	if _, found := cache.Get("key1"); found {
		t.Error("expected key1 to be evicted")
	}
	if _, found := cache.Get("key4"); !found {
		t.Error("expected key4 to exist")
	}
}

func TestL1Cache_LRUEviction(t *testing.T) {
	cache := newL1CacheWithMaxSize(3)

	cache.Set("key1", "value1", 5*time.Second)
	cache.Set("key2", "value2", 5*time.Second)
	cache.Set("key3", "value3", 5*time.Second)

	// 访问 key1，使其成为最近使用
	cache.Get("key1")

	// 写入 key4，应该淘汰最久未使用的 key2
	cache.Set("key4", "value4", 5*time.Second)

	// key2 应该被淘汰（LRU）
	if _, found := cache.Get("key2"); found {
		t.Error("expected key2 to be evicted (LRU)")
	}
	// key1 应该存在（最近访问过）
	if _, found := cache.Get("key1"); !found {
		t.Error("expected key1 to exist (recently accessed)")
	}
}

func TestL1Cache_Size(t *testing.T) {
	cache := newL1CacheWithMaxSize(10)

	cache.Set("key1", "value1", 5*time.Second)
	cache.Set("key2", "value2", 5*time.Second)

	if cache.Size() != 2 {
		t.Errorf("expected size 2, got %d", cache.Size())
	}

	cache.Invalidate("key1")

	if cache.Size() != 1 {
		t.Errorf("expected size 1 after invalidate, got %d", cache.Size())
	}

	cache.Clear()

	if cache.Size() != 0 {
		t.Errorf("expected size 0 after clear, got %d", cache.Size())
	}
}

func TestL1Cache_ZeroMaxSizeUnlimited(t *testing.T) {
	cache := newL1CacheWithMaxSize(0) // 0 表示无限制

	// 写入多个条目，都应该存在
	for i := 0; i < 100; i++ {
		cache.Set(string(rune('a'+i)), i, 5*time.Second)
	}

	// 检查所有条目都存在
	if cache.Size() != 100 {
		t.Errorf("expected size 100 for unlimited cache, got %d", cache.Size())
	}
}
