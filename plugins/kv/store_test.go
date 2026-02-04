package kv

import (
	"testing"
	"time"
)

// ==================== T003: Store 接口测试 ====================

func TestStoreInterface(t *testing.T) {
	// 验证 Store 接口定义
	var _ Store = (*NoopStore)(nil)
}

// ==================== T004: NoopStore 测试 ====================

func TestNoopStore_Get(t *testing.T) {
	store := NewNoopStore()
	_, err := store.Get("key")
	if err != ErrNotFound {
		t.Errorf("NoopStore.Get should return ErrNotFound, got %v", err)
	}
}

func TestNoopStore_Set(t *testing.T) {
	store := NewNoopStore()
	err := store.Set("key", "value")
	if err != nil {
		t.Errorf("NoopStore.Set should return nil, got %v", err)
	}
}

func TestNoopStore_SetEx(t *testing.T) {
	store := NewNoopStore()
	err := store.SetEx("key", "value", time.Second)
	if err != nil {
		t.Errorf("NoopStore.SetEx should return nil, got %v", err)
	}
}

func TestNoopStore_Delete(t *testing.T) {
	store := NewNoopStore()
	err := store.Delete("key")
	if err != nil {
		t.Errorf("NoopStore.Delete should return nil, got %v", err)
	}
}

func TestNoopStore_Exists(t *testing.T) {
	store := NewNoopStore()
	exists, err := store.Exists("key")
	if err != nil {
		t.Errorf("NoopStore.Exists should return nil error, got %v", err)
	}
	if exists {
		t.Error("NoopStore.Exists should return false")
	}
}

func TestNoopStore_TTL(t *testing.T) {
	store := NewNoopStore()
	_, err := store.TTL("key")
	if err != ErrNotFound {
		t.Errorf("NoopStore.TTL should return ErrNotFound, got %v", err)
	}
}

func TestNoopStore_Expire(t *testing.T) {
	store := NewNoopStore()
	err := store.Expire("key", time.Second)
	if err != ErrNotFound {
		t.Errorf("NoopStore.Expire should return ErrNotFound, got %v", err)
	}
}

func TestNoopStore_Incr(t *testing.T) {
	store := NewNoopStore()
	val, err := store.Incr("key")
	if err != nil {
		t.Errorf("NoopStore.Incr should return nil error, got %v", err)
	}
	if val != 0 {
		t.Errorf("NoopStore.Incr should return 0, got %d", val)
	}
}

func TestNoopStore_IncrBy(t *testing.T) {
	store := NewNoopStore()
	val, err := store.IncrBy("key", 10)
	if err != nil {
		t.Errorf("NoopStore.IncrBy should return nil error, got %v", err)
	}
	if val != 0 {
		t.Errorf("NoopStore.IncrBy should return 0, got %d", val)
	}
}

func TestNoopStore_Decr(t *testing.T) {
	store := NewNoopStore()
	val, err := store.Decr("key")
	if err != nil {
		t.Errorf("NoopStore.Decr should return nil error, got %v", err)
	}
	if val != 0 {
		t.Errorf("NoopStore.Decr should return 0, got %d", val)
	}
}

func TestNoopStore_HSet(t *testing.T) {
	store := NewNoopStore()
	err := store.HSet("key", "field", "value")
	if err != nil {
		t.Errorf("NoopStore.HSet should return nil, got %v", err)
	}
}

func TestNoopStore_HGet(t *testing.T) {
	store := NewNoopStore()
	_, err := store.HGet("key", "field")
	if err != ErrNotFound {
		t.Errorf("NoopStore.HGet should return ErrNotFound, got %v", err)
	}
}

func TestNoopStore_HGetAll(t *testing.T) {
	store := NewNoopStore()
	_, err := store.HGetAll("key")
	if err != ErrNotFound {
		t.Errorf("NoopStore.HGetAll should return ErrNotFound, got %v", err)
	}
}

func TestNoopStore_HDel(t *testing.T) {
	store := NewNoopStore()
	err := store.HDel("key", "field")
	if err != nil {
		t.Errorf("NoopStore.HDel should return nil, got %v", err)
	}
}

func TestNoopStore_HIncrBy(t *testing.T) {
	store := NewNoopStore()
	val, err := store.HIncrBy("key", "field", 10)
	if err != nil {
		t.Errorf("NoopStore.HIncrBy should return nil error, got %v", err)
	}
	if val != 0 {
		t.Errorf("NoopStore.HIncrBy should return 0, got %d", val)
	}
}

func TestNoopStore_Lock(t *testing.T) {
	store := NewNoopStore()
	acquired, err := store.Lock("key", time.Second)
	if err != nil {
		t.Errorf("NoopStore.Lock should return nil error, got %v", err)
	}
	if !acquired {
		t.Error("NoopStore.Lock should return true (always succeeds)")
	}
}

func TestNoopStore_Unlock(t *testing.T) {
	store := NewNoopStore()
	err := store.Unlock("key")
	if err != nil {
		t.Errorf("NoopStore.Unlock should return nil, got %v", err)
	}
}

func TestNoopStore_MSet(t *testing.T) {
	store := NewNoopStore()
	err := store.MSet(map[string]any{"k1": "v1", "k2": "v2"})
	if err != nil {
		t.Errorf("NoopStore.MSet should return nil, got %v", err)
	}
}

func TestNoopStore_MGet(t *testing.T) {
	store := NewNoopStore()
	result, err := store.MGet("k1", "k2")
	if err != nil {
		t.Errorf("NoopStore.MGet should return nil error, got %v", err)
	}
	if result == nil {
		t.Error("NoopStore.MGet should return empty map, not nil")
	}
	if len(result) != 0 {
		t.Errorf("NoopStore.MGet should return empty map, got %v", result)
	}
}

func TestNoopStore_Keys(t *testing.T) {
	store := NewNoopStore()
	keys, err := store.Keys("*")
	if err != nil {
		t.Errorf("NoopStore.Keys should return nil error, got %v", err)
	}
	if keys == nil {
		t.Error("NoopStore.Keys should return empty slice, not nil")
	}
	if len(keys) != 0 {
		t.Errorf("NoopStore.Keys should return empty slice, got %v", keys)
	}
}
