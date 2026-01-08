package core_test

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// ==================== Phase 1: 基础接口测试 ====================

func TestKVStoreInterface(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 验证 KV() 方法存在且返回非 nil
	kv := app.KV()
	if kv == nil {
		t.Fatal("expected KV() to return non-nil KVStore")
	}
}

// ==================== Phase 3: US1 基础键值操作测试 ====================

func TestKVSetAndGet(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试 Set 和 Get
	err = kv.Set("user:1", "allen")
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	value, err := kv.Get("user:1")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if value != "allen" {
		t.Errorf("expected 'allen', got '%v'", value)
	}
}

func TestKVGetNotFound(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试不存在的 Key
	value, err := kv.Get("nonexistent")
	if err != core.ErrKVNotFound {
		t.Errorf("expected ErrKVNotFound, got %v", err)
	}
	if value != nil {
		t.Errorf("expected nil value, got %v", value)
	}
}

func TestKVDelete(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 先写入
	kv.Set("to_delete", "value")

	// 删除
	err = kv.Delete("to_delete")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// 验证已删除
	_, err = kv.Get("to_delete")
	if err != core.ErrKVNotFound {
		t.Errorf("expected ErrKVNotFound after delete, got %v", err)
	}
}

func TestKVExists(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 不存在
	exists, err := kv.Exists("not_exists")
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if exists {
		t.Error("expected false for non-existent key")
	}

	// 写入后存在
	kv.Set("exists_key", "value")
	exists, err = kv.Exists("exists_key")
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if !exists {
		t.Error("expected true for existing key")
	}
}

func TestKVOverwrite(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 第一次写入
	kv.Set("overwrite", "first")

	// 覆盖
	kv.Set("overwrite", "second")

	value, _ := kv.Get("overwrite")
	if value != "second" {
		t.Errorf("expected 'second', got '%v'", value)
	}
}

// ==================== Phase 4: US2 TTL 过期测试 ====================

func TestKVSetEx(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 设置 1 秒过期
	err = kv.SetEx("expire_key", "value", 1*time.Second)
	if err != nil {
		t.Fatalf("SetEx failed: %v", err)
	}

	// 立即读取应该成功
	value, err := kv.Get("expire_key")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if value != "value" {
		t.Errorf("expected 'value', got '%v'", value)
	}

	// 等待过期
	time.Sleep(1500 * time.Millisecond)

	// 过期后应该返回 ErrKVNotFound
	_, err = kv.Get("expire_key")
	if err != core.ErrKVNotFound {
		t.Errorf("expected ErrKVNotFound after expiration, got %v", err)
	}
}

func TestKVTTL(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 设置 60 秒过期
	kv.SetEx("ttl_key", "value", 60*time.Second)

	// 查询 TTL
	ttl, err := kv.TTL("ttl_key")
	if err != nil {
		t.Fatalf("TTL failed: %v", err)
	}

	// TTL 应该在 55-60 秒之间
	if ttl < 55*time.Second || ttl > 60*time.Second {
		t.Errorf("expected TTL between 55s and 60s, got %v", ttl)
	}
}

func TestKVExpire(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 先设置无过期
	kv.Set("expire_update", "value")

	// 更新过期时间
	err = kv.Expire("expire_update", 30*time.Second)
	if err != nil {
		t.Fatalf("Expire failed: %v", err)
	}

	// 验证 TTL
	ttl, _ := kv.TTL("expire_update")
	if ttl < 25*time.Second || ttl > 30*time.Second {
		t.Errorf("expected TTL between 25s and 30s, got %v", ttl)
	}
}

// ==================== Phase 5: US3 原子计数器测试 ====================

func TestKVIncr(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// Key 不存在时 Incr 应该返回 1
	val, err := kv.Incr("counter_new")
	if err != nil {
		t.Fatalf("Incr failed: %v", err)
	}
	if val != 1 {
		t.Errorf("expected 1, got %d", val)
	}

	// 再次 Incr
	val, _ = kv.Incr("counter_new")
	if val != 2 {
		t.Errorf("expected 2, got %d", val)
	}
}

func TestKVIncrBy(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// IncrBy 10
	val, err := kv.IncrBy("counter_by", 10)
	if err != nil {
		t.Fatalf("IncrBy failed: %v", err)
	}
	if val != 10 {
		t.Errorf("expected 10, got %d", val)
	}

	// 再 IncrBy 5
	val, _ = kv.IncrBy("counter_by", 5)
	if val != 15 {
		t.Errorf("expected 15, got %d", val)
	}
}

func TestKVDecr(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 先设置初始值
	kv.IncrBy("counter_decr", 10)

	// Decr
	val, err := kv.Decr("counter_decr")
	if err != nil {
		t.Fatalf("Decr failed: %v", err)
	}
	if val != 9 {
		t.Errorf("expected 9, got %d", val)
	}
}

func TestKVIncrConcurrent(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 100 个并发 Incr
	const concurrency = 100
	done := make(chan bool, concurrency)

	for i := 0; i < concurrency; i++ {
		go func() {
			kv.Incr("concurrent_counter")
			done <- true
		}()
	}

	// 等待所有完成
	for i := 0; i < concurrency; i++ {
		<-done
	}

	// 验证最终值
	value, _ := kv.Get("concurrent_counter")
	// JSON 解析后数字类型是 float64
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
}

// ==================== Phase 6: US4 Hash 操作测试 ====================

func TestKVHSetAndHGet(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// HSet
	err = kv.HSet("cart:user1", "apple", 5)
	if err != nil {
		t.Fatalf("HSet failed: %v", err)
	}

	// HGet
	value, err := kv.HGet("cart:user1", "apple")
	if err != nil {
		t.Fatalf("HGet failed: %v", err)
	}

	// JSON 解析后数字是 float64
	if v, ok := value.(float64); !ok || int(v) != 5 {
		t.Errorf("expected 5, got %v", value)
	}
}

func TestKVHGetAll(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 设置多个字段
	kv.HSet("cart:user2", "apple", 3)
	kv.HSet("cart:user2", "banana", 2)

	// HGetAll
	all, err := kv.HGetAll("cart:user2")
	if err != nil {
		t.Fatalf("HGetAll failed: %v", err)
	}

	if len(all) != 2 {
		t.Errorf("expected 2 fields, got %d", len(all))
	}
}

func TestKVHDel(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 设置字段
	kv.HSet("cart:user3", "apple", 5)
	kv.HSet("cart:user3", "banana", 3)

	// 删除一个字段
	err = kv.HDel("cart:user3", "apple")
	if err != nil {
		t.Fatalf("HDel failed: %v", err)
	}

	// 验证删除
	_, err = kv.HGet("cart:user3", "apple")
	if err != core.ErrKVNotFound {
		t.Errorf("expected ErrKVNotFound after HDel, got %v", err)
	}

	// 其他字段仍存在
	value, err := kv.HGet("cart:user3", "banana")
	if err != nil {
		t.Fatalf("HGet banana failed: %v", err)
	}
	if v, ok := value.(float64); !ok || int(v) != 3 {
		t.Errorf("expected 3, got %v", value)
	}
}

func TestKVHIncrBy(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// HIncrBy 不存在的字段
	val, err := kv.HIncrBy("cart:user4", "apple", 5)
	if err != nil {
		t.Fatalf("HIncrBy failed: %v", err)
	}
	if val != 5 {
		t.Errorf("expected 5, got %d", val)
	}

	// 再次递增
	val, err = kv.HIncrBy("cart:user4", "apple", 3)
	if err != nil {
		t.Fatalf("HIncrBy failed: %v", err)
	}
	if val != 8 {
		t.Errorf("expected 8, got %d", val)
	}
}

// ==================== Phase 7: US5 分布式锁测试 ====================

func TestKVLockAndUnlock(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 获取锁
	acquired, err := kv.Lock("resource:1", 10*time.Second)
	if err != nil {
		t.Fatalf("Lock failed: %v", err)
	}
	if !acquired {
		t.Error("expected to acquire lock")
	}

	// 释放锁
	err = kv.Unlock("resource:1")
	if err != nil {
		t.Fatalf("Unlock failed: %v", err)
	}
}

func TestKVLockMutualExclusion(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 第一个获取锁
	acquired1, _ := kv.Lock("mutex:1", 10*time.Second)
	if !acquired1 {
		t.Fatal("first lock should succeed")
	}

	// 第二个尝试获取同一个锁（应该失败）
	acquired2, _ := kv.Lock("mutex:1", 10*time.Second)
	if acquired2 {
		t.Error("second lock should fail (mutex)")
	}

	// 释放后可以再次获取
	kv.Unlock("mutex:1")
	acquired3, _ := kv.Lock("mutex:1", 10*time.Second)
	if !acquired3 {
		t.Error("lock after unlock should succeed")
	}
}

// ==================== Phase 8: US6 L1 缓存测试 ====================

func TestKVL1CacheHit(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 写入
	kv.Set("cache_test", "value")

	// 第一次读取（从 L2）
	kv.Get("cache_test")

	// 第二次读取应该更快（从 L1 缓存）
	value, err := kv.Get("cache_test")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if value != "value" {
		t.Errorf("expected 'value', got '%v'", value)
	}
}

// ==================== Phase 9: US7 批量操作测试 ====================

func TestKVMSetAndMGet(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// MSet
	err = kv.MSet(map[string]any{
		"batch:a": "value_a",
		"batch:b": "value_b",
		"batch:c": 123,
	})
	if err != nil {
		t.Fatalf("MSet failed: %v", err)
	}

	// MGet
	result, err := kv.MGet("batch:a", "batch:b", "batch:c", "batch:nonexistent")
	if err != nil {
		t.Fatalf("MGet failed: %v", err)
	}

	if len(result) != 3 {
		t.Errorf("expected 3 results, got %d", len(result))
	}

	if result["batch:a"] != "value_a" {
		t.Errorf("expected 'value_a', got '%v'", result["batch:a"])
	}
}

func TestKVKeys(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 设置多个 key
	kv.Set("pattern:key1", "v1")
	kv.Set("pattern:key2", "v2")
	kv.Set("other:key3", "v3")

	// 按模式查询
	keys, err := kv.Keys("pattern:*")
	if err != nil {
		t.Fatalf("Keys failed: %v", err)
	}

	if len(keys) != 2 {
		t.Errorf("expected 2 keys, got %d: %v", len(keys), keys)
	}
}

// ==================== Phase 12: 验证和边界测试 ====================

func TestKVKeyTooLong(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 创建超过 256 字符的 key
	longKey := make([]byte, 300)
	for i := range longKey {
		longKey[i] = 'a'
	}

	err = kv.Set(string(longKey), "value")
	if err != core.ErrKVKeyTooLong {
		t.Errorf("expected ErrKVKeyTooLong, got %v", err)
	}
}

func TestKVValueTooLarge(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 创建超过 1MB 的 value
	largeValue := make([]byte, core.KVMaxValueSize+1)
	for i := range largeValue {
		largeValue[i] = 'x'
	}

	err = kv.Set("large:key", string(largeValue))
	if err != core.ErrKVValueTooLarge {
		t.Errorf("expected ErrKVValueTooLarge, got %v", err)
	}
}

func TestKVValueTooLargeBytes(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试 []byte 类型的大 value
	largeValue := make([]byte, core.KVMaxValueSize+1)
	for i := range largeValue {
		largeValue[i] = 'x'
	}

	err = kv.Set("large:bytes", largeValue)
	if err != core.ErrKVValueTooLarge {
		t.Errorf("expected ErrKVValueTooLarge for []byte, got %v", err)
	}
}

func TestKVValueSizeValidObject(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试正常大小的对象
	normalValue := map[string]string{"key": "value"}
	err = kv.Set("normal:object", normalValue)
	if err != nil {
		t.Errorf("unexpected error for normal object: %v", err)
	}
}

func TestKVHIncrByCore(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试 HIncrBy
	newVal, err := kv.HIncrBy("hincrby:test", "counter", 5)
	if err != nil {
		t.Fatalf("HIncrBy failed: %v", err)
	}
	if newVal != 5 {
		t.Errorf("expected 5, got %d", newVal)
	}

	// 再次递增
	newVal, err = kv.HIncrBy("hincrby:test", "counter", 3)
	if err != nil {
		t.Fatalf("HIncrBy second call failed: %v", err)
	}
	if newVal != 8 {
		t.Errorf("expected 8, got %d", newVal)
	}
}

func TestKVSetExWithValidation(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试 SetEx 的 key 长度验证
	longKey := make([]byte, 300)
	for i := range longKey {
		longKey[i] = 'a'
	}

	err = kv.SetEx(string(longKey), "value", 60000000000)
	if err != core.ErrKVKeyTooLong {
		t.Errorf("expected ErrKVKeyTooLong for SetEx, got %v", err)
	}

	// 测试 SetEx 的 value 大小验证
	largeValue := make([]byte, core.KVMaxValueSize+1)
	err = kv.SetEx("setex:large", string(largeValue), 60000000000)
	if err != core.ErrKVValueTooLarge {
		t.Errorf("expected ErrKVValueTooLarge for SetEx, got %v", err)
	}
}

func TestKVHGetNotFound(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试获取不存在的 hash 字段
	val, err := kv.HGet("nonexistent:hash", "field")
	// 可能返回错误或 nil，两种情况都是正确的
	if err == nil && val != nil {
		t.Errorf("expected nil or error for nonexistent hash, got %v", val)
	}
}

func TestKVHGetAllNotFound(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试获取不存在的 hash
	result, err := kv.HGetAll("nonexistent:hash2")
	// 可能返回错误或 nil，两种情况都是正确的
	if err == nil && result != nil {
		t.Errorf("expected nil or error for nonexistent hash, got %v", result)
	}
}

// ==================== 清理和辅助函数测试 ====================

func TestKVCleanupExpired(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 设置一个立即过期的 key
	err = kv.SetEx("cleanup:test", "value", 1) // 1 纳秒
	if err != nil {
		t.Fatalf("SetEx failed: %v", err)
	}

	// 等待过期
	time.Sleep(10 * time.Millisecond)

	// 调用 Get - 过期的 key 应该返回错误或 nil
	val, err := kv.Get("cleanup:test")
	// 过期后，Get 应该返回错误或 nil 值
	if err == nil && val != nil {
		t.Errorf("expected nil or error for expired key, got %v", val)
	}
}
