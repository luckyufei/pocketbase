package kv

import (
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tests"
)

// ==================== T008-T010: L2 数据库 + Store 实现测试 ====================

func TestKVStoreSetAndGet(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 注册 KV 插件
		err := Register(app, DefaultConfig())
		if err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		store := GetStore(app)
		if store == nil {
			t.Fatal("expected non-nil store")
		}

		// 测试 Set 和 Get
		err = store.Set("user:1", "allen")
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		value, err := store.Get("user:1")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if value != "allen" {
			t.Errorf("expected 'allen', got '%v'", value)
		}
	})
}

func TestKVStoreGetNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		_, err := store.Get("nonexistent")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreDelete(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.Set("to_delete", "value")
		err := store.Delete("to_delete")
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		_, err = store.Get("to_delete")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound after delete, got %v", err)
		}
	})
}

func TestKVStoreExists(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		exists, _ := store.Exists("not_exists")
		if exists {
			t.Error("expected false for non-existent key")
		}

		store.Set("exists_key", "value")
		exists, _ = store.Exists("exists_key")
		if !exists {
			t.Error("expected true for existing key")
		}
	})
}

func TestKVStoreSetEx(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		err := store.SetEx("expire_key", "value", 1*time.Second)
		if err != nil {
			t.Fatalf("SetEx failed: %v", err)
		}

		value, err := store.Get("expire_key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if value != "value" {
			t.Errorf("expected 'value', got '%v'", value)
		}

		time.Sleep(1500 * time.Millisecond)

		_, err = store.Get("expire_key")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound after expiration, got %v", err)
		}
	})
}

func TestKVStoreTTL(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.SetEx("ttl_key", "value", 60*time.Second)

		ttl, err := store.TTL("ttl_key")
		if err != nil {
			t.Fatalf("TTL failed: %v", err)
		}

		if ttl < 55*time.Second || ttl > 60*time.Second {
			t.Errorf("expected TTL between 55s and 60s, got %v", ttl)
		}
	})
}

func TestKVStoreExpire(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.Set("expire_update", "value")
		err := store.Expire("expire_update", 30*time.Second)
		if err != nil {
			t.Fatalf("Expire failed: %v", err)
		}

		ttl, _ := store.TTL("expire_update")
		if ttl < 25*time.Second || ttl > 30*time.Second {
			t.Errorf("expected TTL between 25s and 30s, got %v", ttl)
		}
	})
}

func TestKVStoreIncr(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		val, err := store.Incr("counter_new")
		if err != nil {
			t.Fatalf("Incr failed: %v", err)
		}
		if val != 1 {
			t.Errorf("expected 1, got %d", val)
		}

		val, _ = store.Incr("counter_new")
		if val != 2 {
			t.Errorf("expected 2, got %d", val)
		}
	})
}

func TestKVStoreIncrBy(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		val, err := store.IncrBy("counter_by", 10)
		if err != nil {
			t.Fatalf("IncrBy failed: %v", err)
		}
		if val != 10 {
			t.Errorf("expected 10, got %d", val)
		}

		val, _ = store.IncrBy("counter_by", 5)
		if val != 15 {
			t.Errorf("expected 15, got %d", val)
		}
	})
}

func TestKVStoreDecr(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.IncrBy("counter_decr", 10)

		val, err := store.Decr("counter_decr")
		if err != nil {
			t.Fatalf("Decr failed: %v", err)
		}
		if val != 9 {
			t.Errorf("expected 9, got %d", val)
		}
	})
}

func TestKVStoreIncrConcurrent(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		const concurrency = 100
		var wg sync.WaitGroup

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				store.Incr("concurrent_counter")
			}()
		}

		wg.Wait()

		value, _ := store.Get("concurrent_counter")
		var finalValue int64
		switch v := value.(type) {
		case float64:
			finalValue = int64(v)
		case int64:
			finalValue = v
		}
		if finalValue != int64(concurrency) {
			t.Errorf("expected %d, got %v", concurrency, value)
		}
	})
}

func TestKVStoreHSetAndHGet(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		err := store.HSet("cart:user1", "apple", 5)
		if err != nil {
			t.Fatalf("HSet failed: %v", err)
		}

		value, err := store.HGet("cart:user1", "apple")
		if err != nil {
			t.Fatalf("HGet failed: %v", err)
		}

		if v, ok := value.(float64); !ok || int(v) != 5 {
			t.Errorf("expected 5, got %v", value)
		}
	})
}

func TestKVStoreHGetAll(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.HSet("cart:user2", "apple", 3)
		store.HSet("cart:user2", "banana", 2)

		all, err := store.HGetAll("cart:user2")
		if err != nil {
			t.Fatalf("HGetAll failed: %v", err)
		}

		if len(all) != 2 {
			t.Errorf("expected 2 fields, got %d", len(all))
		}
	})
}

func TestKVStoreHDel(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.HSet("cart:user3", "apple", 5)
		store.HSet("cart:user3", "banana", 3)

		err := store.HDel("cart:user3", "apple")
		if err != nil {
			t.Fatalf("HDel failed: %v", err)
		}

		_, err = store.HGet("cart:user3", "apple")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound after HDel, got %v", err)
		}

		value, err := store.HGet("cart:user3", "banana")
		if err != nil {
			t.Fatalf("HGet banana failed: %v", err)
		}
		if v, ok := value.(float64); !ok || int(v) != 3 {
			t.Errorf("expected 3, got %v", value)
		}
	})
}

func TestKVStoreHIncrBy(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		val, err := store.HIncrBy("cart:user4", "apple", 5)
		if err != nil {
			t.Fatalf("HIncrBy failed: %v", err)
		}
		if val != 5 {
			t.Errorf("expected 5, got %d", val)
		}

		val, err = store.HIncrBy("cart:user4", "apple", 3)
		if err != nil {
			t.Fatalf("HIncrBy failed: %v", err)
		}
		if val != 8 {
			t.Errorf("expected 8, got %d", val)
		}
	})
}

func TestKVStoreLockAndUnlock(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		acquired, err := store.Lock("resource:1", 10*time.Second)
		if err != nil {
			t.Fatalf("Lock failed: %v", err)
		}
		if !acquired {
			t.Error("expected to acquire lock")
		}

		err = store.Unlock("resource:1")
		if err != nil {
			t.Fatalf("Unlock failed: %v", err)
		}
	})
}

func TestKVStoreMSetAndMGet(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		err := store.MSet(map[string]any{
			"batch:a": "value_a",
			"batch:b": "value_b",
			"batch:c": 123,
		})
		if err != nil {
			t.Fatalf("MSet failed: %v", err)
		}

		result, err := store.MGet("batch:a", "batch:b", "batch:c", "batch:nonexistent")
		if err != nil {
			t.Fatalf("MGet failed: %v", err)
		}

		if len(result) != 3 {
			t.Errorf("expected 3 results, got %d", len(result))
		}

		if result["batch:a"] != "value_a" {
			t.Errorf("expected 'value_a', got '%v'", result["batch:a"])
		}
	})
}

func TestKVStoreKeys(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		store.Set("pattern:key1", "v1")
		store.Set("pattern:key2", "v2")
		store.Set("other:key3", "v3")

		keys, err := store.Keys("pattern:*")
		if err != nil {
			t.Fatalf("Keys failed: %v", err)
		}

		if len(keys) != 2 {
			t.Errorf("expected 2 keys, got %d: %v", len(keys), keys)
		}
	})
}

func TestKVStoreKeyTooLong(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		longKey := make([]byte, 300)
		for i := range longKey {
			longKey[i] = 'a'
		}

		err := store.Set(string(longKey), "value")
		if err != ErrKeyTooLong {
			t.Errorf("expected ErrKeyTooLong, got %v", err)
		}
	})
}

func TestKVStoreValueTooLarge(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		Register(app, cfg)
		store := GetStore(app)

		largeValue := make([]byte, cfg.MaxValueSize+1)
		for i := range largeValue {
			largeValue[i] = 'x'
		}

		err := store.Set("large:key", string(largeValue))
		if err != ErrValueTooLarge {
			t.Errorf("expected ErrValueTooLarge, got %v", err)
		}
	})
}

// ==================== T011: Register 测试 ====================

func TestRegister(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		err := Register(app, DefaultConfig())
		if err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		store := GetStore(app)
		if store == nil {
			t.Fatal("expected non-nil store after Register")
		}
	})
}

func TestMustRegister(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// MustRegister 不应该 panic
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("MustRegister panicked: %v", r)
			}
		}()

		MustRegister(app, DefaultConfig())

		store := GetStore(app)
		if store == nil {
			t.Fatal("expected non-nil store after MustRegister")
		}
	})
}

func TestGetStoreWithoutRegister(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 不调用 Register
		store := GetStore(app)
		if store != nil {
			t.Error("expected nil store without Register")
		}
	})
}

func TestKVStoreL1CacheDisabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		// 测试禁用 L1 缓存时的操作
		err := store.Set("no_l1_key", "value")
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		value, err := store.Get("no_l1_key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if value != "value" {
			t.Errorf("expected 'value', got '%v'", value)
		}
	})
}

func TestKVStoreSetExKeyTooLong(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		longKey := make([]byte, 300)
		for i := range longKey {
			longKey[i] = 'a'
		}

		err := store.SetEx(string(longKey), "value", time.Second)
		if err != ErrKeyTooLong {
			t.Errorf("expected ErrKeyTooLong, got %v", err)
		}
	})
}

func TestKVStoreSetExValueTooLarge(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		Register(app, cfg)
		store := GetStore(app)

		largeValue := make([]byte, cfg.MaxValueSize+1)
		for i := range largeValue {
			largeValue[i] = 'x'
		}

		err := store.SetEx("setex:large", string(largeValue), time.Second)
		if err != ErrValueTooLarge {
			t.Errorf("expected ErrValueTooLarge, got %v", err)
		}
	})
}

func TestKVStoreTTLNoExpire(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 设置永不过期的 key
		store.Set("no_expire_key", "value")

		ttl, err := store.TTL("no_expire_key")
		if err != nil {
			t.Fatalf("TTL failed: %v", err)
		}

		// 永不过期应该返回 -1
		if ttl != -1 {
			t.Errorf("expected TTL -1 for no expire, got %v", ttl)
		}
	})
}

func TestKVStoreTTLNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		_, err := store.TTL("nonexistent_key")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreExpireNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		err := store.Expire("nonexistent_key", time.Second)
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreLockMutualExclusion(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 第一个获取锁
		acquired1, _ := store.Lock("mutex:1", 10*time.Second)
		if !acquired1 {
			t.Fatal("first lock should succeed")
		}

		// 第二个尝试获取同一个锁（应该失败）
		acquired2, _ := store.Lock("mutex:1", 10*time.Second)
		if acquired2 {
			t.Error("second lock should fail (mutex)")
		}

		// 释放后可以再次获取
		store.Unlock("mutex:1")
		acquired3, _ := store.Lock("mutex:1", 10*time.Second)
		if !acquired3 {
			t.Error("lock after unlock should succeed")
		}
	})
}

func TestKVStoreUnlockNotOwned(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 尝试释放不存在的锁
		err := store.Unlock("nonexistent_lock")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreHGetNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 测试获取不存在的 hash key
		_, err := store.HGet("nonexistent:hash", "field")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreHGetFieldNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 先创建 hash
		store.HSet("hash_key", "existing_field", "value")

		// 测试获取不存在的字段
		_, err := store.HGet("hash_key", "nonexistent_field")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreHGetAllNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		_, err := store.HGetAll("nonexistent:hash2")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestKVStoreHDelEmptyFields(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 空字段列表应该不报错
		err := store.HDel("some_key")
		if err != nil {
			t.Errorf("HDel with empty fields should not error, got %v", err)
		}
	})
}

func TestKVStoreMSetEmpty(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 空 pairs 应该不报错
		err := store.MSet(map[string]any{})
		if err != nil {
			t.Errorf("MSet with empty pairs should not error, got %v", err)
		}
	})
}

func TestKVStoreMGetEmpty(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 空 keys 应该返回空 map
		result, err := store.MGet()
		if err != nil {
			t.Errorf("MGet with no keys should not error, got %v", err)
		}
		if len(result) != 0 {
			t.Errorf("MGet with no keys should return empty map, got %v", result)
		}
	})
}

func TestKVStoreValueSizeObjectTooLarge(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.MaxValueSize = 100 // 设置一个小的限制
		Register(app, cfg)
		store := GetStore(app)

		// 创建一个大对象
		largeObj := map[string]string{}
		for i := 0; i < 50; i++ {
			largeObj[string(rune('a'+i))] = "some_long_value_here"
		}

		err := store.Set("large:obj", largeObj)
		if err != ErrValueTooLarge {
			t.Errorf("expected ErrValueTooLarge for large object, got %v", err)
		}
	})
}

func TestKVStoreValueSizeByteArray(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		Register(app, cfg)
		store := GetStore(app)

		// 测试 []byte 类型的大 value
		largeValue := make([]byte, cfg.MaxValueSize+1)
		for i := range largeValue {
			largeValue[i] = 'x'
		}

		err := store.Set("large:bytes", largeValue)
		if err != ErrValueTooLarge {
			t.Errorf("expected ErrValueTooLarge for []byte, got %v", err)
		}
	})
}

func TestKVStoreDeleteWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		store.Set("delete_no_l1", "value")
		err := store.Delete("delete_no_l1")
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
	})
}

func TestKVStoreExpireWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		store.Set("expire_no_l1", "value")
		err := store.Expire("expire_no_l1", time.Hour)
		if err != nil {
			t.Fatalf("Expire failed: %v", err)
		}
	})
}

func TestKVStoreIncrByWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		val, err := store.IncrBy("incr_no_l1", 5)
		if err != nil {
			t.Fatalf("IncrBy failed: %v", err)
		}
		if val != 5 {
			t.Errorf("expected 5, got %d", val)
		}
	})
}

func TestKVStoreHSetWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		err := store.HSet("hash_no_l1", "field", "value")
		if err != nil {
			t.Fatalf("HSet failed: %v", err)
		}
	})
}

func TestKVStoreHDelWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		store.HSet("hdel_no_l1", "field", "value")
		err := store.HDel("hdel_no_l1", "field")
		if err != nil {
			t.Fatalf("HDel failed: %v", err)
		}
	})
}

func TestKVStoreHIncrByWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		val, err := store.HIncrBy("hincrby_no_l1", "counter", 10)
		if err != nil {
			t.Fatalf("HIncrBy failed: %v", err)
		}
		if val != 10 {
			t.Errorf("expected 10, got %d", val)
		}
	})
}

func TestKVStoreMSetWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		err := store.MSet(map[string]any{
			"mset_no_l1_a": "a",
			"mset_no_l1_b": "b",
		})
		if err != nil {
			t.Fatalf("MSet failed: %v", err)
		}
	})
}

func TestKVStoreSetExWithL1Disabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = false
		Register(app, cfg)
		store := GetStore(app)

		err := store.SetEx("setex_no_l1", "value", time.Hour)
		if err != nil {
			t.Fatalf("SetEx failed: %v", err)
		}

		value, err := store.Get("setex_no_l1")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if value != "value" {
			t.Errorf("expected 'value', got '%v'", value)
		}
	})
}

// ==================== UNLOGGED TABLE 测试（PostgreSQL）====================

func TestCreateKVTableUnlogged(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())

		if dbType == tests.DBTypePostgres {
			// 验证 PostgreSQL 创建的是 UNLOGGED 表
			var relPersistence string
			err := app.DB().NewQuery(`
				SELECT relpersistence FROM pg_class WHERE relname = '_kv'
			`).Row(&relPersistence)
			if err != nil {
				t.Fatalf("Failed to query table persistence: %v", err)
			}
			// 'u' = unlogged, 'p' = permanent (normal), 't' = temporary
			if relPersistence != "u" {
				t.Errorf("expected UNLOGGED table (relpersistence='u'), got '%s'", relPersistence)
			}
		}
	})
}

// ==================== HGet/MGet L1 缓存测试（新增）====================

func TestKVStoreHGetWithL1Cache(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = true
		cfg.L1TTL = 5 * time.Second
		Register(app, cfg)
		store := GetStore(app)

		// 设置 Hash
		store.HSet("hash:l1test", "field1", "value1")
		store.HSet("hash:l1test", "field2", "value2")

		// 第一次 HGetAll 从 L2 读取
		all1, err := store.HGetAll("hash:l1test")
		if err != nil {
			t.Fatalf("HGetAll failed: %v", err)
		}
		if len(all1) != 2 {
			t.Errorf("expected 2 fields, got %d", len(all1))
		}

		// 第二次 HGetAll 应该从 L1 缓存读取（性能更好）
		all2, err := store.HGetAll("hash:l1test")
		if err != nil {
			t.Fatalf("HGetAll (cached) failed: %v", err)
		}
		if len(all2) != 2 {
			t.Errorf("expected 2 fields from cache, got %d", len(all2))
		}
	})
}

func TestKVStoreMGetWithL1Cache(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = true
		cfg.L1TTL = 5 * time.Second
		Register(app, cfg)
		store := GetStore(app)

		// 设置多个 key
		store.Set("mget:key1", "value1")
		store.Set("mget:key2", "value2")
		store.Set("mget:key3", "value3")

		// 先单独 Get 一些 key，填充 L1
		store.Get("mget:key1")
		store.Get("mget:key2")

		// MGet 应该优先从 L1 获取已缓存的 key
		result, err := store.MGet("mget:key1", "mget:key2", "mget:key3")
		if err != nil {
			t.Fatalf("MGet failed: %v", err)
		}

		if len(result) != 3 {
			t.Errorf("expected 3 results, got %d", len(result))
		}
		if result["mget:key1"] != "value1" {
			t.Errorf("expected 'value1', got '%v'", result["mget:key1"])
		}
	})
}

func TestKVStoreHGetFieldWithL1Cache(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = true
		cfg.L1TTL = 5 * time.Second
		Register(app, cfg)
		store := GetStore(app)

		// 设置 Hash
		store.HSet("hash:field_l1", "name", "alice")
		store.HSet("hash:field_l1", "age", 25)

		// 第一次 HGet
		v1, err := store.HGet("hash:field_l1", "name")
		if err != nil {
			t.Fatalf("HGet failed: %v", err)
		}
		if v1 != "alice" {
			t.Errorf("expected 'alice', got '%v'", v1)
		}

		// 第二次 HGet（应从缓存）
		v2, err := store.HGet("hash:field_l1", "name")
		if err != nil {
			t.Fatalf("HGet (cached) failed: %v", err)
		}
		if v2 != "alice" {
			t.Errorf("expected 'alice' from cache, got '%v'", v2)
		}
	})
}

// ==================== L1 MaxSize 配置测试 ====================

func TestKVStoreL1MaxSize(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = true
		cfg.L1MaxSize = 3 // 最多缓存 3 个 key
		Register(app, cfg)
		store := GetStore(app)

		// 写入 5 个 key
		for i := 0; i < 5; i++ {
			store.Set(string(rune('a'+i)), i)
		}

		// 读取所有 key 以填充 L1 缓存
		for i := 0; i < 5; i++ {
			store.Get(string(rune('a' + i)))
		}

		// 验证所有 key 仍然可以从 L2 获取
		for i := 0; i < 5; i++ {
			v, err := store.Get(string(rune('a' + i)))
			if err != nil {
				t.Errorf("Get(%c) failed: %v", rune('a'+i), err)
			}
			if vi, ok := v.(float64); !ok || int(vi) != i {
				t.Errorf("expected %d, got %v", i, v)
			}
		}
	})
}

// ==================== L2 CleanupExpired 测试 ====================

func TestKVStoreCleanupExpired(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 设置一些过期的 key
		store.SetEx("expire:1", "value1", 10*time.Millisecond)
		store.SetEx("expire:2", "value2", 10*time.Millisecond)
		store.Set("no_expire", "value3")

		// 等待过期
		time.Sleep(50 * time.Millisecond)

		// 手动触发清理（通过获取 kvStore 实例）
		if kvs, ok := store.(*kvStore); ok {
			err := kvs.l2.CleanupExpired()
			if err != nil {
				t.Fatalf("CleanupExpired failed: %v", err)
			}
		}

		// 验证过期的 key 已被清理
		_, err := store.Get("expire:1")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound for expired key, got %v", err)
		}

		// 验证未过期的 key 仍然存在
		v, err := store.Get("no_expire")
		if err != nil {
			t.Fatalf("Get no_expire failed: %v", err)
		}
		if v != "value3" {
			t.Errorf("expected 'value3', got '%v'", v)
		}
	})
}

// ==================== L1 缓存一致性测试 ====================

func TestKVStoreL1CacheInvalidation(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = true
		cfg.L1TTL = 10 * time.Second
		Register(app, cfg)
		store := GetStore(app)

		// 设置值并读取（填充 L1）
		store.Set("cache:key", "original")
		v1, _ := store.Get("cache:key")
		if v1 != "original" {
			t.Errorf("expected 'original', got '%v'", v1)
		}

		// 更新值（应该使 L1 失效）
		store.Set("cache:key", "updated")

		// 再次读取应该得到新值
		v2, _ := store.Get("cache:key")
		if v2 != "updated" {
			t.Errorf("expected 'updated' after cache invalidation, got '%v'", v2)
		}
	})
}

// ==================== SetEx 与 L1 TTL 协调测试 ====================

func TestKVStoreSetExL1TTLCoordination(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.L1Enabled = true
		cfg.L1TTL = 10 * time.Second // L1 默认 10 秒
		Register(app, cfg)
		store := GetStore(app)

		// 设置一个 1 秒过期的 key
		store.SetEx("short_ttl", "value", 1*time.Second)

		// 读取（L1 缓存 TTL 应该被限制为 1 秒而非 10 秒）
		v1, _ := store.Get("short_ttl")
		if v1 != "value" {
			t.Errorf("expected 'value', got '%v'", v1)
		}

		// 等待 L2 过期
		time.Sleep(1500 * time.Millisecond)

		// 应该返回 NotFound（L1 缓存也应该过期）
		_, err := store.Get("short_ttl")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound after L2 expiration, got %v", err)
		}
	})
}

// ==================== 边界条件测试 ====================

func TestKVStoreEmptyKeyOperations(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// 空 key 应该正常处理
		err := store.Set("", "value")
		if err != nil {
			t.Fatalf("Set empty key failed: %v", err)
		}

		v, err := store.Get("")
		if err != nil {
			t.Fatalf("Get empty key failed: %v", err)
		}
		if v != "value" {
			t.Errorf("expected 'value', got '%v'", v)
		}
	})
}

func TestKVStoreNilValue(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		Register(app, DefaultConfig())
		store := GetStore(app)

		// nil value 应该正常处理
		err := store.Set("nil_key", nil)
		if err != nil {
			t.Fatalf("Set nil value failed: %v", err)
		}

		v, err := store.Get("nil_key")
		if err != nil {
			t.Fatalf("Get nil value failed: %v", err)
		}
		if v != nil {
			t.Errorf("expected nil, got '%v'", v)
		}
	})
}

// ==================== HTTP API 启用测试 ====================

func TestRegisterWithHTTPEnabled(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.HTTPEnabled = true
		err := Register(app, cfg)
		if err != nil {
			t.Fatalf("Register with HTTPEnabled failed: %v", err)
		}

		store := GetStore(app)
		if store == nil {
			t.Fatal("expected non-nil store")
		}
	})
}
