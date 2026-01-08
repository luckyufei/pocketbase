// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"testing"
	"time"
)

// Phase 7: US4 KV Storage 测试

func TestKVStore(t *testing.T) {
	t.Run("基本 Get/Set", func(t *testing.T) {
		kv := NewKVStore(nil)

		err := kv.Set("key1", "value1", 0)
		if err != nil {
			t.Fatalf("Set() error = %v", err)
		}

		val, err := kv.Get("key1")
		if err != nil {
			t.Fatalf("Get() error = %v", err)
		}

		if val != "value1" {
			t.Errorf("Get() = %v, want value1", val)
		}
	})

	t.Run("JSON 值存储", func(t *testing.T) {
		kv := NewKVStore(nil)

		data := map[string]interface{}{
			"stage":  "step_2",
			"userId": "123",
		}

		err := kv.Set("session:123", data, 0)
		if err != nil {
			t.Fatalf("Set() error = %v", err)
		}

		val, err := kv.Get("session:123")
		if err != nil {
			t.Fatalf("Get() error = %v", err)
		}

		result, ok := val.(map[string]interface{})
		if !ok {
			t.Fatalf("Get() 返回类型错误")
		}

		if result["stage"] != "step_2" {
			t.Errorf("stage = %v, want step_2", result["stage"])
		}
	})

	t.Run("TTL 过期", func(t *testing.T) {
		kv := NewKVStore(nil)

		err := kv.Set("expire_key", "value", 1) // 1 秒过期
		if err != nil {
			t.Fatalf("Set() error = %v", err)
		}

		// 立即获取应该成功
		val, err := kv.Get("expire_key")
		if err != nil {
			t.Fatalf("Get() error = %v", err)
		}
		if val != "value" {
			t.Errorf("Get() = %v, want value", val)
		}

		// 等待过期
		time.Sleep(1100 * time.Millisecond)

		// 过期后应该返回 nil
		val, err = kv.Get("expire_key")
		if err != nil {
			t.Fatalf("Get() error = %v", err)
		}
		if val != nil {
			t.Errorf("Get() = %v, want nil (expired)", val)
		}
	})

	t.Run("Delete", func(t *testing.T) {
		kv := NewKVStore(nil)

		kv.Set("delete_key", "value", 0)

		err := kv.Delete("delete_key")
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		val, _ := kv.Get("delete_key")
		if val != nil {
			t.Errorf("Get() = %v, want nil", val)
		}
	})

	t.Run("不存在的键", func(t *testing.T) {
		kv := NewKVStore(nil)

		val, err := kv.Get("nonexistent")
		if err != nil {
			t.Fatalf("Get() error = %v", err)
		}
		if val != nil {
			t.Errorf("Get() = %v, want nil", val)
		}
	})

	t.Run("覆盖已有值", func(t *testing.T) {
		kv := NewKVStore(nil)

		kv.Set("overwrite", "old", 0)
		kv.Set("overwrite", "new", 0)

		val, _ := kv.Get("overwrite")
		if val != "new" {
			t.Errorf("Get() = %v, want new", val)
		}
	})
}

func TestKVStoreOptions(t *testing.T) {
	t.Run("SetWithOptions", func(t *testing.T) {
		kv := NewKVStore(nil)

		opts := KVSetOptions{
			TTL: 600,
		}

		err := kv.SetWithOptions("key", "value", opts)
		if err != nil {
			t.Fatalf("SetWithOptions() error = %v", err)
		}

		val, _ := kv.Get("key")
		if val != "value" {
			t.Errorf("Get() = %v, want value", val)
		}
	})
}

func TestKVStoreHostFunction(t *testing.T) {
	t.Run("Host Function 调用", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		// 测试 KV 操作
		err := hf.KVSet("test_key", "test_value", 0)
		if err != nil {
			t.Fatalf("KVSet() error = %v", err)
		}

		val, err := hf.KVGet("test_key")
		if err != nil {
			t.Fatalf("KVGet() error = %v", err)
		}

		if val != "test_value" {
			t.Errorf("KVGet() = %v, want test_value", val)
		}

		err = hf.KVDelete("test_key")
		if err != nil {
			t.Fatalf("KVDelete() error = %v", err)
		}
	})
}

// 新增测试用例覆盖桥接功能

func TestKVStore_Exists(t *testing.T) {
	kv := NewKVStore(nil)

	// 不存在的键
	exists, err := kv.Exists("nonexistent")
	if err != nil {
		t.Fatalf("Exists() error = %v", err)
	}
	if exists {
		t.Error("Exists() = true, want false")
	}

	// 设置后存在
	kv.Set("exists_key", "value", 0)
	exists, err = kv.Exists("exists_key")
	if err != nil {
		t.Fatalf("Exists() error = %v", err)
	}
	if !exists {
		t.Error("Exists() = false, want true")
	}

	// 过期后不存在
	kv.Set("expire_key", "value", 1)
	time.Sleep(1100 * time.Millisecond)
	exists, err = kv.Exists("expire_key")
	if err != nil {
		t.Fatalf("Exists() error = %v", err)
	}
	if exists {
		t.Error("Exists() = true, want false (expired)")
	}
}

func TestKVStore_TTL(t *testing.T) {
	kv := NewKVStore(nil)

	// 不存在的键
	_, err := kv.TTL("nonexistent")
	if err == nil {
		t.Error("TTL() should return error for nonexistent key")
	}

	// 永不过期的键
	kv.Set("no_expire", "value", 0)
	ttl, err := kv.TTL("no_expire")
	if err != nil {
		t.Fatalf("TTL() error = %v", err)
	}
	if ttl != -1 {
		t.Errorf("TTL() = %v, want -1 (never expires)", ttl)
	}

	// 有过期时间的键
	kv.Set("with_expire", "value", 60)
	ttl, err = kv.TTL("with_expire")
	if err != nil {
		t.Fatalf("TTL() error = %v", err)
	}
	if ttl <= 0 || ttl > 60*time.Second {
		t.Errorf("TTL() = %v, want between 0 and 60s", ttl)
	}
}

func TestKVStore_Expire(t *testing.T) {
	kv := NewKVStore(nil)

	// 不存在的键
	err := kv.Expire("nonexistent", time.Second)
	if err == nil {
		t.Error("Expire() should return error for nonexistent key")
	}

	// 更新过期时间
	kv.Set("expire_test", "value", 0)
	err = kv.Expire("expire_test", 100*time.Millisecond)
	if err != nil {
		t.Fatalf("Expire() error = %v", err)
	}

	time.Sleep(150 * time.Millisecond)
	val, _ := kv.Get("expire_test")
	if val != nil {
		t.Error("Get() should return nil after expiration")
	}
}

func TestKVStore_Counter(t *testing.T) {
	kv := NewKVStore(nil)

	// Incr 新键
	val, err := kv.Incr("counter")
	if err != nil {
		t.Fatalf("Incr() error = %v", err)
	}
	if val != 1 {
		t.Errorf("Incr() = %v, want 1", val)
	}

	// 再次 Incr
	val, err = kv.Incr("counter")
	if err != nil {
		t.Fatalf("Incr() error = %v", err)
	}
	if val != 2 {
		t.Errorf("Incr() = %v, want 2", val)
	}

	// IncrBy
	val, err = kv.IncrBy("counter", 10)
	if err != nil {
		t.Fatalf("IncrBy() error = %v", err)
	}
	if val != 12 {
		t.Errorf("IncrBy() = %v, want 12", val)
	}

	// Decr
	val, err = kv.Decr("counter")
	if err != nil {
		t.Fatalf("Decr() error = %v", err)
	}
	if val != 11 {
		t.Errorf("Decr() = %v, want 11", val)
	}
}

func TestKVStore_Hash(t *testing.T) {
	kv := NewKVStore(nil)

	// HSet
	err := kv.HSet("hash_key", "field1", "value1")
	if err != nil {
		t.Fatalf("HSet() error = %v", err)
	}

	// HGet
	val, err := kv.HGet("hash_key", "field1")
	if err != nil {
		t.Fatalf("HGet() error = %v", err)
	}
	if val != "value1" {
		t.Errorf("HGet() = %v, want value1", val)
	}

	// HGet 不存在的字段
	_, err = kv.HGet("hash_key", "nonexistent")
	if err == nil {
		t.Error("HGet() should return error for nonexistent field")
	}

	// 添加更多字段
	kv.HSet("hash_key", "field2", "value2")

	// HGetAll
	all, err := kv.HGetAll("hash_key")
	if err != nil {
		t.Fatalf("HGetAll() error = %v", err)
	}
	if len(all) != 2 {
		t.Errorf("HGetAll() returned %d fields, want 2", len(all))
	}

	// HDel
	err = kv.HDel("hash_key", "field1")
	if err != nil {
		t.Fatalf("HDel() error = %v", err)
	}
	_, err = kv.HGet("hash_key", "field1")
	if err == nil {
		t.Error("HGet() should return error after HDel")
	}

	// HIncrBy
	kv.HSet("hash_key", "counter", int64(0))
	newVal, err := kv.HIncrBy("hash_key", "counter", 5)
	if err != nil {
		t.Fatalf("HIncrBy() error = %v", err)
	}
	if newVal != 5 {
		t.Errorf("HIncrBy() = %v, want 5", newVal)
	}
}

func TestKVStore_Lock(t *testing.T) {
	kv := NewKVStore(nil)

	// 获取锁
	acquired, err := kv.Lock("test_lock", 100*time.Millisecond)
	if err != nil {
		t.Fatalf("Lock() error = %v", err)
	}
	if !acquired {
		t.Error("Lock() = false, want true")
	}

	// 重复获取应该失败
	acquired, err = kv.Lock("test_lock", 100*time.Millisecond)
	if err != nil {
		t.Fatalf("Lock() error = %v", err)
	}
	if acquired {
		t.Error("Lock() = true, want false (already locked)")
	}

	// 等待锁过期
	time.Sleep(150 * time.Millisecond)

	// 过期后应该能获取
	acquired, err = kv.Lock("test_lock", 100*time.Millisecond)
	if err != nil {
		t.Fatalf("Lock() error = %v", err)
	}
	if !acquired {
		t.Error("Lock() = false, want true (lock expired)")
	}

	// 主动释放
	err = kv.Unlock("test_lock")
	if err != nil {
		t.Fatalf("Unlock() error = %v", err)
	}

	// 释放后应该能获取
	acquired, err = kv.Lock("test_lock", time.Second)
	if err != nil {
		t.Fatalf("Lock() error = %v", err)
	}
	if !acquired {
		t.Error("Lock() = false, want true (after unlock)")
	}
}

func TestKVStoreHostFunction_Extended(t *testing.T) {
	hf := NewHostFunctions(nil)

	t.Run("KVExists", func(t *testing.T) {
		hf.KVSet("exists_test", "value", 0)
		exists, err := hf.KVExists("exists_test")
		if err != nil {
			t.Fatalf("KVExists() error = %v", err)
		}
		if !exists {
			t.Error("KVExists() = false, want true")
		}
	})

	t.Run("KVIncr", func(t *testing.T) {
		val, err := hf.KVIncr("hf_counter")
		if err != nil {
			t.Fatalf("KVIncr() error = %v", err)
		}
		if val != 1 {
			t.Errorf("KVIncr() = %v, want 1", val)
		}
	})

	t.Run("KVIncrBy", func(t *testing.T) {
		val, err := hf.KVIncrBy("hf_counter", 10)
		if err != nil {
			t.Fatalf("KVIncrBy() error = %v", err)
		}
		if val != 11 {
			t.Errorf("KVIncrBy() = %v, want 11", val)
		}
	})

	t.Run("KVHSet/KVHGet", func(t *testing.T) {
		err := hf.KVHSet("hf_hash", "field", "value")
		if err != nil {
			t.Fatalf("KVHSet() error = %v", err)
		}

		val, err := hf.KVHGet("hf_hash", "field")
		if err != nil {
			t.Fatalf("KVHGet() error = %v", err)
		}
		if val != "value" {
			t.Errorf("KVHGet() = %v, want value", val)
		}
	})

	t.Run("KVHGetAll", func(t *testing.T) {
		hf.KVHSet("hf_hash2", "f1", "v1")
		hf.KVHSet("hf_hash2", "f2", "v2")

		all, err := hf.KVHGetAll("hf_hash2")
		if err != nil {
			t.Fatalf("KVHGetAll() error = %v", err)
		}
		if len(all) != 2 {
			t.Errorf("KVHGetAll() returned %d fields, want 2", len(all))
		}
	})

	t.Run("KVLock/KVUnlock", func(t *testing.T) {
		acquired, err := hf.KVLock("hf_lock", time.Second)
		if err != nil {
			t.Fatalf("KVLock() error = %v", err)
		}
		if !acquired {
			t.Error("KVLock() = false, want true")
		}

		err = hf.KVUnlock("hf_lock")
		if err != nil {
			t.Fatalf("KVUnlock() error = %v", err)
		}
	})
}
