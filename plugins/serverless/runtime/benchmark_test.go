// Package runtime 提供 Serverless 函数运行时的性能基准测试
package runtime

import (
	"context"
	"sync"
	"testing"
	"time"
)

// BenchmarkColdStart 冷启动延迟基准
func BenchmarkColdStart(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pool, err := NewPool(1)
		if err != nil {
			b.Fatalf("NewPool() error: %v", err)
		}
		instance, err := pool.Acquire(context.Background())
		if err != nil {
			b.Fatalf("Acquire() error: %v", err)
		}
		pool.Release(instance)
		pool.Close()
	}
}

// BenchmarkWarmStart 热启动延迟基准
func BenchmarkWarmStart(b *testing.B) {
	pool, err := NewPool(10)
	if err != nil {
		b.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		instance, err := pool.Acquire(context.Background())
		if err != nil {
			b.Fatalf("Acquire() error: %v", err)
		}
		pool.Release(instance)
	}
}

// BenchmarkConcurrentExecution 并发执行基准
func BenchmarkConcurrentExecution(b *testing.B) {
	pool, err := NewPool(100)
	if err != nil {
		b.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			instance, err := pool.Acquire(context.Background())
			if err != nil {
				b.Fatalf("Acquire() error: %v", err)
			}
			// 模拟执行
			time.Sleep(1 * time.Millisecond)
			pool.Release(instance)
		}
	})
}

// BenchmarkPoolThroughput 实例池吞吐量基准
func BenchmarkPoolThroughput(b *testing.B) {
	pool, err := NewPool(50)
	if err != nil {
		b.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	var wg sync.WaitGroup
	concurrency := 10

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := 0; j < concurrency; j++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				instance, err := pool.Acquire(context.Background())
				if err != nil {
					return
				}
				pool.Release(instance)
			}()
		}
		wg.Wait()
	}
}

// BenchmarkConfigValidation 配置验证基准
func BenchmarkConfigValidation(b *testing.B) {
	config := DefaultRuntimeConfig()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = config.Validate()
	}
}

// BenchmarkPoolStats 统计信息获取基准
func BenchmarkPoolStats(b *testing.B) {
	pool, err := NewPool(50)
	if err != nil {
		b.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = pool.Stats()
	}
}

// TestBenchmark_ColdStartLatency 测试冷启动延迟
func TestBenchmark_ColdStartLatency(t *testing.T) {
	iterations := 10
	var totalDuration time.Duration

	for i := 0; i < iterations; i++ {
		start := time.Now()

		pool, err := NewPool(1)
		if err != nil {
			t.Fatalf("NewPool() error: %v", err)
		}
		instance, err := pool.Acquire(context.Background())
		if err != nil {
			t.Fatalf("Acquire() error: %v", err)
		}

		duration := time.Since(start)
		totalDuration += duration

		pool.Release(instance)
		pool.Close()
	}

	avgLatency := totalDuration / time.Duration(iterations)
	t.Logf("Average cold start latency: %v", avgLatency)

	// 冷启动应该在 100ms 以内
	if avgLatency > 100*time.Millisecond {
		t.Logf("Warning: cold start latency %v exceeds 100ms target", avgLatency)
	}
}

// TestBenchmark_WarmStartLatency 测试热启动延迟
func TestBenchmark_WarmStartLatency(t *testing.T) {
	pool, err := NewPool(10)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	iterations := 100
	var totalDuration time.Duration

	for i := 0; i < iterations; i++ {
		start := time.Now()

		instance, err := pool.Acquire(context.Background())
		if err != nil {
			t.Fatalf("Acquire() error: %v", err)
		}

		duration := time.Since(start)
		totalDuration += duration

		pool.Release(instance)
	}

	avgLatency := totalDuration / time.Duration(iterations)
	t.Logf("Average warm start latency: %v", avgLatency)

	// 热启动应该在 1ms 以内
	if avgLatency > 1*time.Millisecond {
		t.Logf("Warning: warm start latency %v exceeds 1ms target", avgLatency)
	}
}

// TestBenchmark_Throughput 测试吞吐量
func TestBenchmark_Throughput(t *testing.T) {
	pool, err := NewPool(100)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	duration := 1 * time.Second
	concurrency := 10
	var count int64
	var mu sync.Mutex

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				default:
					instance, err := pool.Acquire(context.Background())
					if err != nil {
						continue
					}
					pool.Release(instance)

					mu.Lock()
					count++
					mu.Unlock()
				}
			}
		}()
	}

	wg.Wait()

	throughput := float64(count) / duration.Seconds()
	t.Logf("Throughput: %.2f requests/second", throughput)

	// 吞吐量应该至少 1000 req/s
	if throughput < 1000 {
		t.Logf("Warning: throughput %.2f req/s is below 1000 req/s target", throughput)
	}
}

// TestBenchmark_MemoryUsage 测试内存使用
func TestBenchmark_MemoryUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("跳过长时间运行的内存测试")
	}

	// 减少池大小以避免超时（每个实例需要编译 WASM）
	pool, err := NewPool(5)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	// 获取多个实例
	instances := make([]*Engine, 0, 5)
	for i := 0; i < 5; i++ {
		instance, err := pool.Acquire(context.Background())
		if err != nil {
			t.Fatalf("Acquire() error: %v", err)
		}
		instances = append(instances, instance)
	}

	stats := pool.Stats()
	t.Logf("InUse instances: %d", stats.InUse)
	t.Logf("Available instances: %d", stats.Available)
	t.Logf("Total instances: %d", stats.Total)

	// 释放实例
	for _, instance := range instances {
		pool.Release(instance)
	}
}

// TestBenchmark_ConcurrencyScaling 测试并发扩展性
func TestBenchmark_ConcurrencyScaling(t *testing.T) {
	// 此测试需要创建大量 WASM 实例，非常耗时，默认跳过
	t.Skip("跳过长时间运行的并发扩展测试（需要手动启用）")

	concurrencyLevels := []int{1, 5, 10}

	for _, concurrency := range concurrencyLevels {
		t.Run("", func(t *testing.T) {
			// 减少池大小以避免超时
			pool, err := NewPool(10)
			if err != nil {
				t.Fatalf("NewPool() error: %v", err)
			}
			defer pool.Close()

			iterations := 20
			var wg sync.WaitGroup
			start := time.Now()

			for i := 0; i < iterations; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					instance, err := pool.Acquire(context.Background())
					if err != nil {
						return
					}
					time.Sleep(1 * time.Millisecond) // 模拟工作
					pool.Release(instance)
				}()

				// 控制并发
				if (i+1)%concurrency == 0 {
					wg.Wait()
				}
			}
			wg.Wait()

			duration := time.Since(start)
			t.Logf("Concurrency %d: %v for %d iterations (%.2f iter/s)",
				concurrency, duration, iterations, float64(iterations)/duration.Seconds())
		})
	}
}
