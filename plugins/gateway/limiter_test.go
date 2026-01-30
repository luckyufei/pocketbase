package gateway

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestNewConcurrencyLimiter 验证限制器创建
func TestNewConcurrencyLimiter(t *testing.T) {
	tests := []struct {
		name     string
		max      int
		wantNil  bool
		wantSize int
	}{
		{"positive max", 5, false, 5},
		{"zero max returns nil", 0, true, 0},
		{"negative max returns nil", -1, true, 0},
		{"large max", 1000, false, 1000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limiter := NewConcurrencyLimiter(tt.max)
			if tt.wantNil {
				if limiter != nil {
					t.Errorf("NewConcurrencyLimiter(%d) should return nil", tt.max)
				}
			} else {
				if limiter == nil {
					t.Fatalf("NewConcurrencyLimiter(%d) should not return nil", tt.max)
				}
				if limiter.Max() != tt.wantSize {
					t.Errorf("Max(): want %d, got %d", tt.wantSize, limiter.Max())
				}
			}
		})
	}
}

// TestConcurrencyLimiterAcquireRelease 验证基本获取释放
func TestConcurrencyLimiterAcquireRelease(t *testing.T) {
	limiter := NewConcurrencyLimiter(3)

	// 获取 3 个槽位
	if !limiter.Acquire() {
		t.Error("First Acquire should succeed")
	}
	if !limiter.Acquire() {
		t.Error("Second Acquire should succeed")
	}
	if !limiter.Acquire() {
		t.Error("Third Acquire should succeed")
	}

	// 验证可用数量
	if limiter.Available() != 0 {
		t.Errorf("Available: want 0, got %d", limiter.Available())
	}

	// 第 4 个应该失败
	if limiter.Acquire() {
		t.Error("Fourth Acquire should fail (limit reached)")
	}

	// 释放一个
	limiter.Release()

	// 现在应该能获取
	if !limiter.Acquire() {
		t.Error("Acquire after Release should succeed")
	}
}

// TestConcurrencyLimiterAvailable 验证可用槽位计算
func TestConcurrencyLimiterAvailable(t *testing.T) {
	limiter := NewConcurrencyLimiter(5)

	if limiter.Available() != 5 {
		t.Errorf("Initial Available: want 5, got %d", limiter.Available())
	}

	limiter.Acquire()
	if limiter.Available() != 4 {
		t.Errorf("After 1 Acquire: want 4, got %d", limiter.Available())
	}

	limiter.Acquire()
	limiter.Acquire()
	if limiter.Available() != 2 {
		t.Errorf("After 3 Acquires: want 2, got %d", limiter.Available())
	}

	limiter.Release()
	limiter.Release()
	if limiter.Available() != 4 {
		t.Errorf("After 2 Releases: want 4, got %d", limiter.Available())
	}
}

// TestConcurrencyLimiterAcquireWithTimeout 验证带超时获取（排队模式）
func TestConcurrencyLimiterAcquireWithTimeout(t *testing.T) {
	limiter := NewConcurrencyLimiter(1)

	// 先占用唯一的槽位
	if !limiter.Acquire() {
		t.Fatal("Initial Acquire should succeed")
	}

	// 尝试带超时获取（应该失败）
	start := time.Now()
	if limiter.AcquireWithTimeout(100 * time.Millisecond) {
		t.Error("AcquireWithTimeout should fail when limit reached")
	}
	elapsed := time.Since(start)

	// 应该在超时时间附近返回
	if elapsed < 90*time.Millisecond || elapsed > 200*time.Millisecond {
		t.Errorf("Timeout elapsed: %v (expected ~100ms)", elapsed)
	}

	// 启动协程释放槽位
	go func() {
		time.Sleep(50 * time.Millisecond)
		limiter.Release()
	}()

	// 这次应该成功（在等待期间槽位被释放）
	if !limiter.AcquireWithTimeout(200 * time.Millisecond) {
		t.Error("AcquireWithTimeout should succeed after release")
	}
}

// TestConcurrencyLimiterAcquireBlocking 验证阻塞式获取
func TestConcurrencyLimiterAcquireBlocking(t *testing.T) {
	limiter := NewConcurrencyLimiter(1)

	// 占用槽位
	limiter.Acquire()

	// 启动协程释放
	go func() {
		time.Sleep(50 * time.Millisecond)
		limiter.Release()
	}()

	// 阻塞获取
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	start := time.Now()
	err := limiter.AcquireBlocking(ctx)
	elapsed := time.Since(start)

	if err != nil {
		t.Errorf("AcquireBlocking should succeed: %v", err)
	}

	// 应该在 ~50ms 后返回（不是 200ms）
	if elapsed > 100*time.Millisecond {
		t.Errorf("AcquireBlocking took too long: %v (expected ~50ms)", elapsed)
	}
}

// TestConcurrencyLimiterAcquireBlockingCancel 验证 context 取消
func TestConcurrencyLimiterAcquireBlockingCancel(t *testing.T) {
	limiter := NewConcurrencyLimiter(1)
	limiter.Acquire() // 占用唯一槽位

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	err := limiter.AcquireBlocking(ctx)
	elapsed := time.Since(start)

	if err == nil {
		t.Error("AcquireBlocking should return error on context timeout")
	}

	// 应该在超时时间附近返回
	if elapsed < 90*time.Millisecond || elapsed > 200*time.Millisecond {
		t.Errorf("Context timeout elapsed: %v (expected ~100ms)", elapsed)
	}
}

// TestConcurrencyLimiterConcurrency 验证并发安全性
func TestConcurrencyLimiterConcurrency(t *testing.T) {
	limiter := NewConcurrencyLimiter(10)
	var acquired int32
	var wg sync.WaitGroup

	// 启动 50 个并发 goroutine
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			if limiter.Acquire() {
				atomic.AddInt32(&acquired, 1)
				time.Sleep(10 * time.Millisecond)
				limiter.Release()
			}
		}()
	}

	// 检查某一时刻的并发数不超过限制
	time.Sleep(5 * time.Millisecond)
	current := 10 - limiter.Available()
	if current > 10 {
		t.Errorf("Concurrent count exceeded limit: %d > 10", current)
	}

	wg.Wait()
}

// TestConcurrencyLimiterRace 使用 race detector 验证
func TestConcurrencyLimiterRace(t *testing.T) {
	limiter := NewConcurrencyLimiter(5)
	var wg sync.WaitGroup

	// 大量并发操作
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// 随机操作
			if limiter.Acquire() {
				limiter.Available() // 读取
				limiter.Release()
			}
			limiter.AcquireWithTimeout(1 * time.Millisecond)
		}()
	}

	wg.Wait()
}

// TestConcurrencyLimiterNilSafe 验证 nil limiter 安全
func TestConcurrencyLimiterNilSafe(t *testing.T) {
	var limiter *ConcurrencyLimiter = nil

	// 所有方法对 nil 应该安全
	if !limiter.Acquire() {
		t.Error("nil.Acquire() should return true (no limit)")
	}

	limiter.Release() // 不应该 panic

	if limiter.Available() != -1 {
		t.Errorf("nil.Available() should return -1, got %d", limiter.Available())
	}

	if !limiter.AcquireWithTimeout(time.Second) {
		t.Error("nil.AcquireWithTimeout() should return true")
	}

	if limiter.AcquireBlocking(context.Background()) != nil {
		t.Error("nil.AcquireBlocking() should return nil")
	}
}

// TestConcurrencyLimiterInUse 验证 InUse 方法
func TestConcurrencyLimiterInUse(t *testing.T) {
	limiter := NewConcurrencyLimiter(5)

	if limiter.InUse() != 0 {
		t.Errorf("Initial InUse: want 0, got %d", limiter.InUse())
	}

	limiter.Acquire()
	limiter.Acquire()

	if limiter.InUse() != 2 {
		t.Errorf("After 2 Acquires: want 2, got %d", limiter.InUse())
	}

	limiter.Release()

	if limiter.InUse() != 1 {
		t.Errorf("After 1 Release: want 1, got %d", limiter.InUse())
	}
}

// BenchmarkConcurrencyLimiterAcquireRelease 性能基准测试
func BenchmarkConcurrencyLimiterAcquireRelease(b *testing.B) {
	limiter := NewConcurrencyLimiter(1000)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if limiter.Acquire() {
				limiter.Release()
			}
		}
	})
}
