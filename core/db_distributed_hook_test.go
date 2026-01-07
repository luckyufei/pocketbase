package core

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestHookExecutionMode 测试 Hook 执行模式
func TestHookExecutionMode(t *testing.T) {
	t.Run("执行模式常量", func(t *testing.T) {
		modes := []HookExecutionMode{
			HookModeLocal,     // 仅本地执行
			HookModeBroadcast, // 广播到所有节点
			HookModeCompete,   // 竞争消费（只有一个节点执行）
		}

		for _, mode := range modes {
			if mode == "" {
				t.Error("执行模式不能为空")
			}
		}
	})
}

// TestDistributedHookManager 测试分布式 Hook 管理器
func TestDistributedHookManager(t *testing.T) {
	t.Run("创建管理器", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		if manager == nil {
			t.Fatal("管理器不能为 nil")
		}
	})

	t.Run("注册本地 Hook", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		called := false
		manager.RegisterHook("test.event", HookModeLocal, func(ctx context.Context, data map[string]any) error {
			called = true
			return nil
		})

		// 触发 Hook
		err := manager.TriggerHook(context.Background(), "test.event", nil)
		if err != nil {
			t.Errorf("触发 Hook 失败: %v", err)
		}

		time.Sleep(10 * time.Millisecond)

		if !called {
			t.Error("本地 Hook 应该被调用")
		}
	})

	t.Run("广播模式", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		var callCount int32
		manager.RegisterHook("broadcast.event", HookModeBroadcast, func(ctx context.Context, data map[string]any) error {
			atomic.AddInt32(&callCount, 1)
			return nil
		})

		// 模拟从其他节点收到的广播事件
		manager.handleRemoteHook(HookPayload{
			NodeID:    "other-node",
			EventName: "broadcast.event",
			Mode:      HookModeBroadcast,
		})

		time.Sleep(10 * time.Millisecond)

		if atomic.LoadInt32(&callCount) != 1 {
			t.Errorf("广播 Hook 应该被调用一次, 实际 %d", callCount)
		}
	})

	t.Run("竞争消费模式", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		var callCount int32
		manager.RegisterHook("compete.event", HookModeCompete, func(ctx context.Context, data map[string]any) error {
			atomic.AddInt32(&callCount, 1)
			return nil
		})

		// 在竞争模式下，只有获得锁的节点才会执行
		// 这里测试本地触发
		err := manager.TriggerHook(context.Background(), "compete.event", nil)
		if err != nil {
			t.Errorf("触发竞争 Hook 失败: %v", err)
		}

		time.Sleep(10 * time.Millisecond)

		if atomic.LoadInt32(&callCount) != 1 {
			t.Errorf("竞争 Hook 应该被调用一次, 实际 %d", callCount)
		}
	})

	t.Run("忽略自己发送的广播", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		var callCount int32
		manager.RegisterHook("self.event", HookModeBroadcast, func(ctx context.Context, data map[string]any) error {
			atomic.AddInt32(&callCount, 1)
			return nil
		})

		// 模拟收到自己发送的事件
		manager.handleRemoteHook(HookPayload{
			NodeID:    pubsub.NodeID(), // 同一节点
			EventName: "self.event",
			Mode:      HookModeBroadcast,
		})

		time.Sleep(10 * time.Millisecond)

		if atomic.LoadInt32(&callCount) != 0 {
			t.Errorf("不应该执行自己发送的广播, 实际调用 %d 次", callCount)
		}
	})
}

// TestHookRetry 测试 Hook 失败重试
func TestHookRetry(t *testing.T) {
	t.Run("重试配置", func(t *testing.T) {
		config := DefaultHookRetryConfig()

		if config.MaxRetries < 1 {
			t.Error("最大重试次数应该大于 0")
		}
		if config.InitialDelay <= 0 {
			t.Error("初始延迟应该大于 0")
		}
	})

	t.Run("失败后重试", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		var attempts int32
		manager.RegisterHook("retry.event", HookModeLocal, func(ctx context.Context, data map[string]any) error {
			count := atomic.AddInt32(&attempts, 1)
			if count < 3 {
				return &RetryableError{Message: "临时错误"}
			}
			return nil
		})

		manager.SetRetryConfig(HookRetryConfig{
			MaxRetries:   5,
			InitialDelay: time.Millisecond,
			MaxDelay:     10 * time.Millisecond,
			Multiplier:   2.0,
		})

		err := manager.TriggerHookWithRetry(context.Background(), "retry.event", nil)
		if err != nil {
			t.Errorf("重试后应该成功: %v", err)
		}

		if atomic.LoadInt32(&attempts) != 3 {
			t.Errorf("期望 3 次尝试, 实际 %d", attempts)
		}
	})

	t.Run("超过最大重试次数", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		manager.RegisterHook("always.fail", HookModeLocal, func(ctx context.Context, data map[string]any) error {
			return &RetryableError{Message: "永久失败"}
		})

		manager.SetRetryConfig(HookRetryConfig{
			MaxRetries:   3,
			InitialDelay: time.Millisecond,
			MaxDelay:     10 * time.Millisecond,
			Multiplier:   2.0,
		})

		err := manager.TriggerHookWithRetry(context.Background(), "always.fail", nil)
		if err == nil {
			t.Error("应该返回错误")
		}
	})
}

// TestHookConcurrency 测试 Hook 并发执行
func TestHookConcurrency(t *testing.T) {
	t.Run("并发触发", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		manager := NewDistributedHookManager(pubsub)

		var callCount int32
		manager.RegisterHook("concurrent.event", HookModeLocal, func(ctx context.Context, data map[string]any) error {
			atomic.AddInt32(&callCount, 1)
			time.Sleep(time.Millisecond)
			return nil
		})

		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				manager.TriggerHook(context.Background(), "concurrent.event", nil)
			}()
		}

		wg.Wait()
		time.Sleep(50 * time.Millisecond)

		if atomic.LoadInt32(&callCount) != 100 {
			t.Errorf("期望 100 次调用, 实际 %d", callCount)
		}
	})
}
