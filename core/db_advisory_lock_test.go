package core

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestAdvisoryLockKey 测试 Advisory Lock Key 生成
func TestAdvisoryLockKey(t *testing.T) {
	t.Run("生成锁 Key", func(t *testing.T) {
		key1 := GenerateLockKey("cron:daily_cleanup")
		key2 := GenerateLockKey("cron:hourly_report")

		if key1 == 0 {
			t.Error("锁 Key 不能为 0")
		}
		if key1 == key2 {
			t.Error("不同名称应该生成不同的 Key")
		}
	})

	t.Run("相同名称生成相同 Key", func(t *testing.T) {
		key1 := GenerateLockKey("cron:test")
		key2 := GenerateLockKey("cron:test")

		if key1 != key2 {
			t.Errorf("相同名称应该生成相同 Key: %d != %d", key1, key2)
		}
	})
}

// TestAdvisoryLockManager 测试 Advisory Lock 管理器
func TestAdvisoryLockManager(t *testing.T) {
	t.Run("创建管理器", func(t *testing.T) {
		manager := NewAdvisoryLockManager(nil)
		if manager == nil {
			t.Fatal("管理器不能为 nil")
		}
	})

	t.Run("本地锁获取和释放", func(t *testing.T) {
		manager := NewAdvisoryLockManager(nil)

		// 获取锁
		acquired, err := manager.TryLock(context.Background(), "test:lock")
		if err != nil {
			t.Fatalf("获取锁失败: %v", err)
		}
		if !acquired {
			t.Error("应该成功获取锁")
		}

		// 再次获取同一个锁应该失败（本地模式）
		acquired2, err := manager.TryLock(context.Background(), "test:lock")
		if err != nil {
			t.Fatalf("第二次获取锁失败: %v", err)
		}
		if acquired2 {
			t.Error("不应该重复获取同一个锁")
		}

		// 释放锁
		err = manager.Unlock(context.Background(), "test:lock")
		if err != nil {
			t.Fatalf("释放锁失败: %v", err)
		}

		// 释放后应该可以再次获取
		acquired3, err := manager.TryLock(context.Background(), "test:lock")
		if err != nil {
			t.Fatalf("第三次获取锁失败: %v", err)
		}
		if !acquired3 {
			t.Error("释放后应该可以再次获取锁")
		}

		manager.Unlock(context.Background(), "test:lock")
	})

	t.Run("不同锁互不影响", func(t *testing.T) {
		manager := NewAdvisoryLockManager(nil)

		acquired1, _ := manager.TryLock(context.Background(), "lock:a")
		acquired2, _ := manager.TryLock(context.Background(), "lock:b")

		if !acquired1 || !acquired2 {
			t.Error("不同的锁应该可以同时获取")
		}

		manager.Unlock(context.Background(), "lock:a")
		manager.Unlock(context.Background(), "lock:b")
	})
}

// TestDistributedCronScheduler 测试分布式 Cron 调度器
func TestDistributedCronScheduler(t *testing.T) {
	t.Run("创建调度器", func(t *testing.T) {
		lockManager := NewAdvisoryLockManager(nil)
		scheduler := NewDistributedCronScheduler(lockManager)

		if scheduler == nil {
			t.Fatal("调度器不能为 nil")
		}
	})

	t.Run("注册任务", func(t *testing.T) {
		lockManager := NewAdvisoryLockManager(nil)
		scheduler := NewDistributedCronScheduler(lockManager)

		err := scheduler.RegisterTask("test:task", "*/5 * * * *", func(ctx context.Context) error {
			return nil
		})

		if err != nil {
			t.Errorf("注册任务失败: %v", err)
		}
	})

	t.Run("执行任务获取锁", func(t *testing.T) {
		lockManager := NewAdvisoryLockManager(nil)
		scheduler := NewDistributedCronScheduler(lockManager)

		var executed int32
		scheduler.RegisterTask("exec:task", "*/5 * * * *", func(ctx context.Context) error {
			atomic.AddInt32(&executed, 1)
			return nil
		})

		// 手动触发任务
		err := scheduler.TriggerTask(context.Background(), "exec:task")
		if err != nil {
			t.Errorf("触发任务失败: %v", err)
		}

		if atomic.LoadInt32(&executed) != 1 {
			t.Errorf("任务应该执行一次, 实际 %d", executed)
		}
	})

	t.Run("并发执行只有一个成功", func(t *testing.T) {
		lockManager := NewAdvisoryLockManager(nil)
		scheduler := NewDistributedCronScheduler(lockManager)

		var executed int32
		scheduler.RegisterTask("concurrent:task", "*/5 * * * *", func(ctx context.Context) error {
			atomic.AddInt32(&executed, 1)
			time.Sleep(50 * time.Millisecond) // 模拟任务执行
			return nil
		})

		// 并发触发
		var wg sync.WaitGroup
		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				scheduler.TriggerTask(context.Background(), "concurrent:task")
			}()
		}

		wg.Wait()
		time.Sleep(100 * time.Millisecond)

		// 由于锁的存在，只有一个应该执行成功
		if atomic.LoadInt32(&executed) != 1 {
			t.Errorf("并发情况下只应该执行一次, 实际 %d", executed)
		}
	})
}

// TestTaskStatus 测试任务状态查询
func TestTaskStatus(t *testing.T) {
	t.Run("获取任务状态", func(t *testing.T) {
		lockManager := NewAdvisoryLockManager(nil)
		scheduler := NewDistributedCronScheduler(lockManager)

		scheduler.RegisterTask("status:task", "*/5 * * * *", func(ctx context.Context) error {
			time.Sleep(10 * time.Millisecond)
			return nil
		})

		// 触发任务
		go scheduler.TriggerTask(context.Background(), "status:task")
		time.Sleep(5 * time.Millisecond)

		// 查询状态
		status := scheduler.GetTaskStatus("status:task")
		if status == nil {
			t.Fatal("应该返回任务状态")
		}

		t.Logf("任务状态: running=%v, lastRun=%v", status.Running, status.LastRun)
	})

	t.Run("列出所有任务", func(t *testing.T) {
		lockManager := NewAdvisoryLockManager(nil)
		scheduler := NewDistributedCronScheduler(lockManager)

		scheduler.RegisterTask("list:task1", "*/5 * * * *", func(ctx context.Context) error { return nil })
		scheduler.RegisterTask("list:task2", "*/10 * * * *", func(ctx context.Context) error { return nil })

		tasks := scheduler.ListTasks()
		if len(tasks) != 2 {
			t.Errorf("期望 2 个任务, 实际 %d", len(tasks))
		}
	})
}

// TestForceLockRelease 测试强制释放锁
func TestForceLockRelease(t *testing.T) {
	t.Run("强制释放锁", func(t *testing.T) {
		manager := NewAdvisoryLockManager(nil)

		// 获取锁
		manager.TryLock(context.Background(), "force:lock")

		// 强制释放
		err := manager.ForceUnlock(context.Background(), "force:lock")
		if err != nil {
			t.Errorf("强制释放失败: %v", err)
		}

		// 应该可以再次获取
		acquired, _ := manager.TryLock(context.Background(), "force:lock")
		if !acquired {
			t.Error("强制释放后应该可以获取锁")
		}

		manager.Unlock(context.Background(), "force:lock")
	})
}
