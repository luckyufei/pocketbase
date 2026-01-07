package dbutils_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

func TestLeakDetector_Basic(t *testing.T) {
	detector := dbutils.NewLeakDetector(100 * time.Millisecond)

	// 追踪获取
	id1 := detector.TrackAcquire()
	id2 := detector.TrackAcquire()

	if detector.GetActiveCount() != 2 {
		t.Errorf("expected 2 active connections, got %d", detector.GetActiveCount())
	}

	// 释放一个
	detector.TrackRelease(id1)

	if detector.GetActiveCount() != 1 {
		t.Errorf("expected 1 active connection, got %d", detector.GetActiveCount())
	}

	// 释放另一个
	detector.TrackRelease(id2)

	if detector.GetActiveCount() != 0 {
		t.Errorf("expected 0 active connections, got %d", detector.GetActiveCount())
	}
}

func TestLeakDetector_LeakDetection(t *testing.T) {
	detector := dbutils.NewLeakDetector(50 * time.Millisecond)

	// 获取连接但不释放
	_ = detector.TrackAcquire()

	// 立即检查，不应有泄漏
	leaks := detector.CheckLeaks()
	if len(leaks) != 0 {
		t.Errorf("expected 0 leaks immediately, got %d", len(leaks))
	}

	// 等待超过阈值
	time.Sleep(100 * time.Millisecond)

	// 再次检查，应该检测到泄漏
	leaks = detector.CheckLeaks()
	if len(leaks) != 1 {
		t.Errorf("expected 1 leak, got %d", len(leaks))
	}

	if len(leaks) > 0 {
		if leaks[0].Duration < 50*time.Millisecond {
			t.Errorf("leak duration should be >= 50ms, got %v", leaks[0].Duration)
		}
		if leaks[0].Stack == "" {
			t.Error("leak should have stack trace")
		}
	}
}

func TestLeakDetector_EnableDisable(t *testing.T) {
	detector := dbutils.NewLeakDetector(100 * time.Millisecond)

	// 默认启用
	if !detector.IsEnabled() {
		t.Error("detector should be enabled by default")
	}

	// 禁用
	detector.Disable()
	if detector.IsEnabled() {
		t.Error("detector should be disabled")
	}

	// 禁用时追踪应该返回 0
	id := detector.TrackAcquire()
	if id != 0 {
		t.Errorf("expected 0 when disabled, got %d", id)
	}

	// 重新启用
	detector.Enable()
	if !detector.IsEnabled() {
		t.Error("detector should be enabled")
	}

	// 启用后追踪应该返回非 0
	id = detector.TrackAcquire()
	if id == 0 {
		t.Error("expected non-zero when enabled")
	}
}

func TestLeakDetector_Concurrent(t *testing.T) {
	detector := dbutils.NewLeakDetector(1 * time.Second)

	const numGoroutines = 100
	const opsPerGoroutine = 100

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < opsPerGoroutine; j++ {
				id := detector.TrackAcquire()
				// 模拟一些工作
				time.Sleep(time.Microsecond)
				detector.TrackRelease(id)
			}
		}()
	}

	wg.Wait()

	// 所有连接都应该被释放
	if detector.GetActiveCount() != 0 {
		t.Errorf("expected 0 active connections after concurrent test, got %d", detector.GetActiveCount())
	}
}

func TestLeakDetector_History(t *testing.T) {
	detector := dbutils.NewLeakDetector(10 * time.Millisecond)

	// 创建一些泄漏
	_ = detector.TrackAcquire()
	_ = detector.TrackAcquire()

	time.Sleep(50 * time.Millisecond)

	// 检查泄漏（这会记录到历史）
	leaks := detector.CheckLeaks()
	if len(leaks) != 2 {
		t.Errorf("expected 2 leaks, got %d", len(leaks))
	}

	// 获取历史
	history := detector.GetLeakHistory()
	if len(history) != 2 {
		t.Errorf("expected 2 in history, got %d", len(history))
	}

	// 清除历史
	detector.ClearHistory()
	history = detector.GetLeakHistory()
	if len(history) != 0 {
		t.Errorf("expected 0 in history after clear, got %d", len(history))
	}
}

func TestLeakDetector_Reset(t *testing.T) {
	detector := dbutils.NewLeakDetector(10 * time.Millisecond)

	// 追踪一些连接
	_ = detector.TrackAcquire()
	_ = detector.TrackAcquire()

	time.Sleep(50 * time.Millisecond)
	detector.CheckLeaks()

	// 重置
	detector.Reset()

	if detector.GetActiveCount() != 0 {
		t.Errorf("expected 0 active after reset, got %d", detector.GetActiveCount())
	}

	if len(detector.GetLeakHistory()) != 0 {
		t.Errorf("expected 0 history after reset, got %d", len(detector.GetLeakHistory()))
	}
}

func TestPoolStats(t *testing.T) {
	// 测试 nil db
	stats := dbutils.GetPoolStats(nil)
	if stats.OpenConnections != 0 {
		t.Errorf("expected 0 for nil db, got %d", stats.OpenConnections)
	}
}

func TestPoolMonitor_StartStop(t *testing.T) {
	monitor := dbutils.NewPoolMonitor(nil, 100*time.Millisecond, 50*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())

	var leakCallbackCalled bool
	monitor.OnLeak(func(leaks []dbutils.ConnectionLeak) {
		leakCallbackCalled = true
	})

	// 启动监控
	monitor.Start(ctx)

	// 创建泄漏
	_ = monitor.TrackAcquire()

	// 等待检测
	time.Sleep(200 * time.Millisecond)

	// 停止
	cancel()
	monitor.Stop()

	// 验证回调被调用
	if !leakCallbackCalled {
		t.Error("leak callback should have been called")
	}
}

func TestPoolMonitor_Stats(t *testing.T) {
	monitor := dbutils.NewPoolMonitor(nil, 100*time.Millisecond, 50*time.Millisecond)

	stats := monitor.GetStats()
	if stats.OpenConnections != 0 {
		t.Errorf("expected 0 for nil db, got %d", stats.OpenConnections)
	}
}

func TestLeakDetector_SetThreshold(t *testing.T) {
	detector := dbutils.NewLeakDetector(1 * time.Second)

	// 获取连接
	_ = detector.TrackAcquire()

	// 使用默认阈值，不应检测到泄漏
	time.Sleep(50 * time.Millisecond)
	leaks := detector.CheckLeaks()
	if len(leaks) != 0 {
		t.Errorf("expected 0 leaks with 1s threshold, got %d", len(leaks))
	}

	// 降低阈值
	detector.SetLeakThreshold(10 * time.Millisecond)

	// 现在应该检测到泄漏
	leaks = detector.CheckLeaks()
	if len(leaks) != 1 {
		t.Errorf("expected 1 leak with 10ms threshold, got %d", len(leaks))
	}
}
