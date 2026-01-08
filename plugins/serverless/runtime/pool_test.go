package runtime

import (
	"context"
	"sync"
	"testing"
	"time"
)

// T009-T013: 实例池测试

func TestPool(t *testing.T) {
	t.Run("创建实例池", func(t *testing.T) {
		pool, err := NewPool(4)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		if pool == nil {
			t.Fatal("pool 不应为 nil")
		}
		if pool.Size() != 4 {
			t.Errorf("pool.Size() = %d, want 4", pool.Size())
		}
	})

	t.Run("Acquire 和 Release", func(t *testing.T) {
		pool, err := NewPool(2)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		ctx := context.Background()

		// 获取实例
		inst1, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("Acquire() error = %v", err)
		}
		if inst1 == nil {
			t.Fatal("inst1 不应为 nil")
		}

		// 获取第二个实例
		inst2, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("Acquire() error = %v", err)
		}
		if inst2 == nil {
			t.Fatal("inst2 不应为 nil")
		}

		// 释放实例
		pool.Release(inst1)
		pool.Release(inst2)

		// 应该可以再次获取
		inst3, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("Acquire() after release error = %v", err)
		}
		pool.Release(inst3)
	})

	t.Run("并发获取实例", func(t *testing.T) {
		pool, err := NewPool(4)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		ctx := context.Background()
		var wg sync.WaitGroup
		errCh := make(chan error, 10)

		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				inst, err := pool.Acquire(ctx)
				if err != nil {
					errCh <- err
					return
				}
				// 模拟执行
				time.Sleep(10 * time.Millisecond)
				pool.Release(inst)
			}()
		}

		wg.Wait()
		close(errCh)

		for err := range errCh {
			t.Errorf("并发 Acquire 错误: %v", err)
		}
	})

	t.Run("实例预热", func(t *testing.T) {
		pool, err := NewPool(4)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		// 预热后应该有可用实例
		if pool.Available() != 4 {
			t.Errorf("pool.Available() = %d, want 4", pool.Available())
		}
	})

	t.Run("Acquire 超时", func(t *testing.T) {
		pool, err := NewPool(1)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		ctx := context.Background()

		// 获取唯一实例
		inst, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("Acquire() error = %v", err)
		}

		// 尝试在超时内获取第二个实例
		ctxTimeout, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		defer cancel()

		_, err = pool.Acquire(ctxTimeout)
		if err == nil {
			t.Error("应该超时返回错误")
		}

		pool.Release(inst)
	})
}

func TestPoolStats(t *testing.T) {
	t.Run("统计信息", func(t *testing.T) {
		pool, err := NewPool(4)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		ctx := context.Background()
		inst, _ := pool.Acquire(ctx)

		stats := pool.Stats()
		if stats.Total != 4 {
			t.Errorf("stats.Total = %d, want 4", stats.Total)
		}
		if stats.InUse != 1 {
			t.Errorf("stats.InUse = %d, want 1", stats.InUse)
		}
		if stats.Available != 3 {
			t.Errorf("stats.Available = %d, want 3", stats.Available)
		}

		pool.Release(inst)
	})
}

func TestPoolEdgeCases(t *testing.T) {
	t.Run("无效 size", func(t *testing.T) {
		_, err := NewPool(0)
		if err == nil {
			t.Error("size=0 应返回错误")
		}

		_, err = NewPool(-1)
		if err == nil {
			t.Error("size=-1 应返回错误")
		}
	})

	t.Run("Release nil", func(t *testing.T) {
		pool, err := NewPool(2)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}
		defer pool.Close()

		// 不应 panic
		pool.Release(nil)
	})

	t.Run("关闭后 Acquire", func(t *testing.T) {
		pool, err := NewPool(2)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}

		pool.Close()

		ctx := context.Background()
		_, err = pool.Acquire(ctx)
		if err == nil {
			t.Error("关闭后 Acquire 应返回错误")
		}
	})

	t.Run("关闭后 Release", func(t *testing.T) {
		pool, err := NewPool(2)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}

		ctx := context.Background()
		inst, _ := pool.Acquire(ctx)

		pool.Close()

		// 不应 panic
		pool.Release(inst)
	})

	t.Run("重复关闭", func(t *testing.T) {
		pool, err := NewPool(2)
		if err != nil {
			t.Fatalf("NewPool() error = %v", err)
		}

		err = pool.Close()
		if err != nil {
			t.Errorf("第一次 Close() error = %v", err)
		}

		err = pool.Close()
		if err != nil {
			t.Errorf("第二次 Close() error = %v", err)
		}
	})
}
