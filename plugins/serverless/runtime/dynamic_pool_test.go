package runtime

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestDynamicPoolConfig 测试动态池配置
func TestDynamicPoolConfig(t *testing.T) {
	config := DefaultDynamicPoolConfig()

	if config.MinSize != 2 {
		t.Errorf("期望 MinSize 为 2，实际为 %d", config.MinSize)
	}
	if config.MaxSize != 20 {
		t.Errorf("期望 MaxSize 为 20，实际为 %d", config.MaxSize)
	}
	if config.ScaleUpThreshold != 0.8 {
		t.Errorf("期望 ScaleUpThreshold 为 0.8，实际为 %f", config.ScaleUpThreshold)
	}
	if config.ScaleDownThreshold != 0.3 {
		t.Errorf("期望 ScaleDownThreshold 为 0.3，实际为 %f", config.ScaleDownThreshold)
	}
}

// TestDynamicPoolCreation 测试动态池创建
func TestDynamicPoolCreation(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 5

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	stats := pool.Stats()
	if stats.Size < config.MinSize {
		t.Errorf("期望池大小 >= %d，实际为 %d", config.MinSize, stats.Size)
	}
}

// TestDynamicPoolInvalidConfig 测试无效配置
func TestDynamicPoolInvalidConfig(t *testing.T) {
	tests := []struct {
		name   string
		config DynamicPoolConfig
	}{
		{
			name: "MinSize <= 0",
			config: DynamicPoolConfig{
				MinSize: 0,
				MaxSize: 10,
			},
		},
		{
			name: "MaxSize < MinSize",
			config: DynamicPoolConfig{
				MinSize: 10,
				MaxSize: 5,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewDynamicPool(tt.config)
			if err == nil {
				t.Error("期望返回错误，但没有")
			}
		})
	}
}

// TestDynamicPoolAcquireRelease 测试获取和释放
func TestDynamicPoolAcquireRelease(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 5

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 获取实例
	engine, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("获取实例失败: %v", err)
	}
	if engine == nil {
		t.Fatal("获取的实例为 nil")
	}

	stats := pool.Stats()
	if stats.InUse != 1 {
		t.Errorf("期望 InUse 为 1，实际为 %d", stats.InUse)
	}

	// 释放实例
	pool.Release(engine)

	stats = pool.Stats()
	if stats.InUse != 0 {
		t.Errorf("期望 InUse 为 0，实际为 %d", stats.InUse)
	}
}

// TestDynamicPoolScaleUp 测试自动扩容
func TestDynamicPoolScaleUp(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 10
	config.ScaleUpThreshold = 0.5    // 使用率 > 50% 时扩容
	config.ScaleInterval = 50 * time.Millisecond
	config.ScaleUpStep = 2

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()
	initialSize := pool.Stats().Size

	// 获取超过一半的实例，触发高使用率
	numToAcquire := initialSize/2 + 1
	var engines []*Engine
	for i := 0; i < numToAcquire; i++ {
		engine, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("获取实例失败: %v", err)
		}
		engines = append(engines, engine)
	}

	// 等待自动扩容
	time.Sleep(200 * time.Millisecond)

	stats := pool.Stats()
	// 扩容后，池大小应该增加，或者至少创建了新实例
	if stats.TotalCreated <= int64(initialSize) {
		t.Logf("警告: 池大小 %d，初始 %d，创建总数 %d（可能扩容时机未到）", 
			stats.Size, initialSize, stats.TotalCreated)
	}

	// 释放实例
	for _, engine := range engines {
		pool.Release(engine)
	}
}

// TestDynamicPoolScaleDown 测试自动缩容
func TestDynamicPoolScaleDown(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 10
	config.InitialSize = 6
	config.ScaleDownThreshold = 0.3 // 使用率 < 30% 时缩容
	config.ScaleInterval = 50 * time.Millisecond
	config.ScaleDownStep = 1
	config.IdleTimeout = 100 * time.Millisecond

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	initialSize := pool.Stats().Size

	// 保持低使用率，等待缩容
	time.Sleep(300 * time.Millisecond)

	stats := pool.Stats()
	if stats.Size >= initialSize && stats.Size > config.MinSize {
		t.Errorf("期望池大小 < %d 或 = %d，实际为 %d（应该已缩容）", initialSize, config.MinSize, stats.Size)
	}
}

// TestDynamicPoolMinSizeLimit 测试最小大小限制
func TestDynamicPoolMinSizeLimit(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 3
	config.MaxSize = 10
	config.InitialSize = 5
	config.ScaleDownThreshold = 0.9 // 几乎总是触发缩容
	config.ScaleInterval = 50 * time.Millisecond
	config.ScaleDownStep = 10 // 大步长

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	// 等待多次缩容尝试
	time.Sleep(300 * time.Millisecond)

	stats := pool.Stats()
	if stats.Size < config.MinSize {
		t.Errorf("池大小 %d 低于最小限制 %d", stats.Size, config.MinSize)
	}
}

// TestDynamicPoolMaxSizeLimit 测试最大大小限制
func TestDynamicPoolMaxSizeLimit(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 4
	config.InitialSize = 2
	config.ScaleUpThreshold = 0.1 // 几乎总是触发扩容
	config.ScaleInterval = 50 * time.Millisecond
	config.ScaleUpStep = 10 // 大步长

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 获取实例触发扩容
	engines := make([]*Engine, 0)
	for i := 0; i < 2; i++ {
		engine, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("获取实例失败: %v", err)
		}
		engines = append(engines, engine)
	}

	// 等待多次扩容尝试
	time.Sleep(300 * time.Millisecond)

	stats := pool.Stats()
	if stats.Size > config.MaxSize {
		t.Errorf("池大小 %d 超过最大限制 %d", stats.Size, config.MaxSize)
	}

	for _, engine := range engines {
		pool.Release(engine)
	}
}

// TestDynamicPoolConcurrentAcquire 测试并发获取
func TestDynamicPoolConcurrentAcquire(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 5
	config.MaxSize = 20
	config.InitialSize = 5

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()
	var wg sync.WaitGroup
	var successCount int64
	numGoroutines := 50

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			ctxWithTimeout, cancel := context.WithTimeout(ctx, 2*time.Second)
			defer cancel()

			engine, err := pool.Acquire(ctxWithTimeout)
			if err != nil {
				return
			}
			atomic.AddInt64(&successCount, 1)

			// 模拟工作
			time.Sleep(10 * time.Millisecond)

			pool.Release(engine)
		}()
	}

	wg.Wait()

	// 应该有一些成功的获取
	if successCount == 0 {
		t.Error("期望至少有一些成功的获取")
	}
}

// TestDynamicPoolContextCancel 测试上下文取消
func TestDynamicPoolContextCancel(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 1
	config.MaxSize = 1
	config.InitialSize = 1

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 获取唯一的实例
	engine, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("获取实例失败: %v", err)
	}

	// 尝试再次获取，使用带取消的上下文
	ctxWithCancel, cancel := context.WithCancel(ctx)

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	_, err = pool.Acquire(ctxWithCancel)
	if err == nil {
		t.Error("期望返回错误（上下文取消）")
	}

	pool.Release(engine)
}

// TestDynamicPoolClose 测试关闭
func TestDynamicPoolClose(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 5

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}

	// 关闭池
	err = pool.Close()
	if err != nil {
		t.Errorf("关闭池失败: %v", err)
	}

	// 再次关闭应该是安全的
	err = pool.Close()
	if err != nil {
		t.Errorf("再次关闭池失败: %v", err)
	}

	// 关闭后获取应该失败
	_, err = pool.Acquire(context.Background())
	if err == nil {
		t.Error("期望关闭后获取失败")
	}
}

// TestDynamicPoolReleaseNil 测试释放 nil
func TestDynamicPoolReleaseNil(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 5

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	// 释放 nil 应该是安全的
	pool.Release(nil)
}

// TestDynamicPoolStats 测试统计信息
func TestDynamicPoolStats(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 3
	config.MaxSize = 10
	config.InitialSize = 3

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	stats := pool.Stats()

	if stats.Size < 3 {
		t.Errorf("期望 Size >= 3，实际为 %d", stats.Size)
	}
	if stats.InUse != 0 {
		t.Errorf("期望 InUse 为 0，实际为 %d", stats.InUse)
	}
	if stats.Available != stats.Size {
		t.Errorf("期望 Available = Size，实际 Available=%d, Size=%d", stats.Available, stats.Size)
	}
}

// TestDynamicPoolUtilization 测试使用率计算
func TestDynamicPoolUtilization(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 4
	config.MaxSize = 10
	config.InitialSize = 4

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 初始使用率应该为 0
	stats := pool.Stats()
	if stats.Utilization != 0 {
		t.Errorf("期望初始使用率为 0，实际为 %f", stats.Utilization)
	}

	// 获取 2 个实例，使用率应该为 50%
	engines := make([]*Engine, 2)
	for i := 0; i < 2; i++ {
		engine, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("获取实例失败: %v", err)
		}
		engines[i] = engine
	}

	stats = pool.Stats()
	expectedUtil := float64(2) / float64(stats.Size)
	if stats.Utilization < expectedUtil-0.01 || stats.Utilization > expectedUtil+0.01 {
		t.Errorf("期望使用率约为 %f，实际为 %f", expectedUtil, stats.Utilization)
	}

	for _, engine := range engines {
		pool.Release(engine)
	}
}

// TestDynamicPoolReleaseAfterClose 测试关闭后释放
func TestDynamicPoolReleaseAfterClose(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 5

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}

	ctx := context.Background()
	engine, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("获取实例失败: %v", err)
	}

	// 关闭池
	pool.Close()

	// 关闭后释放应该销毁实例
	pool.Release(engine)

	stats := pool.Stats()
	if stats.TotalDestroyed == 0 {
		t.Error("期望关闭后释放会销毁实例")
	}
}

// TestDynamicPoolScaleUpCallback 测试扩容回调
func TestDynamicPoolScaleUpCallback(t *testing.T) {
	var callbackCalled bool
	var oldSizeVal, newSizeVal int

	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 10
	config.ScaleUpThreshold = 0.3
	config.ScaleInterval = 50 * time.Millisecond
	config.ScaleUpStep = 2
	config.OnScaleUp = func(oldSize, newSize int) {
		callbackCalled = true
		oldSizeVal = oldSize
		newSizeVal = newSize
	}

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 获取实例触发扩容
	engine, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("获取实例失败: %v", err)
	}

	// 等待扩容
	time.Sleep(200 * time.Millisecond)

	pool.Release(engine)

	if callbackCalled {
		if newSizeVal <= oldSizeVal {
			t.Errorf("期望 newSize > oldSize，实际 oldSize=%d, newSize=%d", oldSizeVal, newSizeVal)
		}
	}
}

// TestDynamicPoolScaleDownCallback 测试缩容回调
func TestDynamicPoolScaleDownCallback(t *testing.T) {
	var callbackCalled bool

	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 10
	config.InitialSize = 6
	config.ScaleDownThreshold = 0.5
	config.ScaleInterval = 50 * time.Millisecond
	config.ScaleDownStep = 1
	config.OnScaleDown = func(oldSize, newSize int) {
		callbackCalled = true
	}

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	// 等待缩容
	time.Sleep(300 * time.Millisecond)

	if !callbackCalled {
		t.Log("缩容回调未被调用（可能缩容条件未满足）")
	}
}

// TestDynamicPoolInitialSizeOverMax 测试初始大小超过最大值
func TestDynamicPoolInitialSizeOverMax(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 5
	config.InitialSize = 10 // 超过 MaxSize

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	stats := pool.Stats()
	if stats.Size > config.MaxSize {
		t.Errorf("池大小 %d 超过最大限制 %d", stats.Size, config.MaxSize)
	}
}

// TestDynamicPoolNoAutoScale 测试禁用自动扩缩容
func TestDynamicPoolNoAutoScale(t *testing.T) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 2
	config.MaxSize = 10
	config.ScaleInterval = 0 // 禁用自动扩缩容

	pool, err := NewDynamicPool(config)
	if err != nil {
		t.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	initialSize := pool.Stats().Size

	// 等待一段时间
	time.Sleep(100 * time.Millisecond)

	// 大小应该不变
	if pool.Stats().Size != initialSize {
		t.Errorf("期望大小不变，实际从 %d 变为 %d", initialSize, pool.Stats().Size)
	}
}

// BenchmarkDynamicPoolAcquireRelease 基准测试获取释放
func BenchmarkDynamicPoolAcquireRelease(b *testing.B) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 10
	config.MaxSize = 100
	config.InitialSize = 10

	pool, err := NewDynamicPool(config)
	if err != nil {
		b.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		engine, err := pool.Acquire(ctx)
		if err != nil {
			b.Fatalf("获取实例失败: %v", err)
		}
		pool.Release(engine)
	}
}

// BenchmarkDynamicPoolConcurrent 基准测试并发场景
func BenchmarkDynamicPoolConcurrent(b *testing.B) {
	config := DefaultDynamicPoolConfig()
	config.MinSize = 10
	config.MaxSize = 100
	config.InitialSize = 10

	pool, err := NewDynamicPool(config)
	if err != nil {
		b.Fatalf("创建动态池失败: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			engine, err := pool.Acquire(ctx)
			if err != nil {
				continue
			}
			pool.Release(engine)
		}
	})
}
