package core_test

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tests"
)

// ==================== KV 性能基准测试 ====================

func BenchmarkKVSet(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("bench:set:%d", i)
		kv.Set(key, "benchmark_value")
	}
}

func BenchmarkKVGet(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	// 预先设置 key
	kv.Set("bench:get:key", "benchmark_value")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		kv.Get("bench:get:key")
	}
}

func BenchmarkKVGetL1Hit(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	// 预先设置并触发 L1 缓存
	kv.Set("bench:l1:key", "benchmark_value")
	kv.Get("bench:l1:key") // 触发 L1 缓存

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		kv.Get("bench:l1:key")
	}
}

func BenchmarkKVIncr(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		kv.Incr("bench:incr:counter")
	}
}

func BenchmarkKVIncrConcurrent(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			kv.Incr("bench:incr:concurrent")
		}
	})
}

func BenchmarkKVHSet(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		field := fmt.Sprintf("field_%d", i%100)
		kv.HSet("bench:hash:key", field, i)
	}
}

func BenchmarkKVHGet(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	// 预先设置 hash
	for i := 0; i < 100; i++ {
		kv.HSet("bench:hget:key", fmt.Sprintf("field_%d", i), i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		field := fmt.Sprintf("field_%d", i%100)
		kv.HGet("bench:hget:key", field)
	}
}

func BenchmarkKVLock(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("bench:lock:%d", i)
		kv.Lock(key, 10*time.Second)
		kv.Unlock(key)
	}
}

func BenchmarkKVMSet(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	pairs := make(map[string]any)
	for i := 0; i < 10; i++ {
		pairs[fmt.Sprintf("bench:mset:%d", i)] = fmt.Sprintf("value_%d", i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		kv.MSet(pairs)
	}
}

func BenchmarkKVMGet(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	// 预先设置 keys
	keys := make([]string, 10)
	for i := 0; i < 10; i++ {
		key := fmt.Sprintf("bench:mget:%d", i)
		keys[i] = key
		kv.Set(key, fmt.Sprintf("value_%d", i))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		kv.MGet(keys...)
	}
}

// ==================== 并发压力测试 ====================

func BenchmarkKVConcurrentMixed(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		b.Skip("KVStore not available")
	}

	// 预先设置一些 key
	for i := 0; i < 100; i++ {
		kv.Set(fmt.Sprintf("bench:mixed:%d", i), fmt.Sprintf("value_%d", i))
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := fmt.Sprintf("bench:mixed:%d", i%100)
			switch i % 4 {
			case 0:
				kv.Set(key, fmt.Sprintf("new_value_%d", i))
			case 1:
				kv.Get(key)
			case 2:
				kv.Incr(fmt.Sprintf("bench:counter:%d", i%10))
			case 3:
				kv.Exists(key)
			}
			i++
		}
	})
}

// ==================== 吞吐量测试 ====================

func TestKVThroughput(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping throughput test in short mode")
	}

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	kv := app.KV()
	if kv == nil {
		t.Skip("KVStore not available")
	}

	// 测试参数
	numGoroutines := 10
	numOpsPerGoroutine := 1000

	var wg sync.WaitGroup
	start := time.Now()

	for g := 0; g < numGoroutines; g++ {
		wg.Add(1)
		go func(gid int) {
			defer wg.Done()
			for i := 0; i < numOpsPerGoroutine; i++ {
				key := fmt.Sprintf("throughput:%d:%d", gid, i)
				kv.Set(key, fmt.Sprintf("value_%d_%d", gid, i))
				kv.Get(key)
			}
		}(g)
	}

	wg.Wait()
	elapsed := time.Since(start)

	totalOps := numGoroutines * numOpsPerGoroutine * 2 // Set + Get
	opsPerSec := float64(totalOps) / elapsed.Seconds()

	t.Logf("Throughput: %.0f ops/sec (total %d ops in %v)", opsPerSec, totalOps, elapsed)
	t.Logf("Goroutines: %d, Ops per goroutine: %d", numGoroutines, numOpsPerGoroutine)
}
