package reliability

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// 测试错误
var errTest = errors.New("测试错误")

// TestCircuitBreakerInitialState 测试断路器初始状态
func TestCircuitBreakerInitialState(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	if cb.State() != StateClosed {
		t.Errorf("期望初始状态为 Closed，实际为 %v", cb.State())
	}

	if !cb.AllowRequest() {
		t.Error("期望初始状态允许请求")
	}

	stats := cb.Stats()
	if stats.Failures != 0 || stats.Successes != 0 {
		t.Errorf("期望初始统计为零，实际 failures=%d, successes=%d", stats.Failures, stats.Successes)
	}
}

// TestCircuitBreakerClosedToOpen 测试从关闭到打开的状态转换
func TestCircuitBreakerClosedToOpen(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 3
	cb := NewCircuitBreaker(config)

	// 连续失败应该打开断路器
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	if cb.State() != StateOpen {
		t.Errorf("期望状态为 Open，实际为 %v", cb.State())
	}

	if cb.AllowRequest() {
		t.Error("期望打开状态拒绝请求")
	}
}

// TestCircuitBreakerOpenToHalfOpen 测试从打开到半开的状态转换
func TestCircuitBreakerOpenToHalfOpen(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 3
	config.Timeout = 50 * time.Millisecond
	cb := NewCircuitBreaker(config)

	// 打开断路器
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	if cb.State() != StateOpen {
		t.Errorf("期望状态为 Open，实际为 %v", cb.State())
	}

	// 等待超时
	time.Sleep(60 * time.Millisecond)

	// 超时后应该允许请求（进入半开状态）
	if !cb.AllowRequest() {
		t.Error("期望超时后允许请求")
	}

	if cb.State() != StateHalfOpen {
		t.Errorf("期望状态为 HalfOpen，实际为 %v", cb.State())
	}
}

// TestCircuitBreakerHalfOpenToClosed 测试从半开到关闭的状态转换
func TestCircuitBreakerHalfOpenToClosed(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 3
	config.SuccessThreshold = 2
	config.Timeout = 50 * time.Millisecond
	cb := NewCircuitBreaker(config)

	// 打开断路器
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	// 等待超时进入半开状态
	time.Sleep(60 * time.Millisecond)
	cb.AllowRequest() // 触发状态转换

	// 连续成功应该关闭断路器
	for i := 0; i < 2; i++ {
		cb.RecordSuccess()
	}

	if cb.State() != StateClosed {
		t.Errorf("期望状态为 Closed，实际为 %v", cb.State())
	}
}

// TestCircuitBreakerHalfOpenToOpen 测试从半开到打开的状态转换
func TestCircuitBreakerHalfOpenToOpen(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 3
	config.Timeout = 50 * time.Millisecond
	cb := NewCircuitBreaker(config)

	// 打开断路器
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	// 等待超时进入半开状态
	time.Sleep(60 * time.Millisecond)
	cb.AllowRequest() // 触发状态转换

	if cb.State() != StateHalfOpen {
		t.Errorf("期望状态为 HalfOpen，实际为 %v", cb.State())
	}

	// 半开状态下失败应该重新打开断路器
	cb.RecordFailure()

	if cb.State() != StateOpen {
		t.Errorf("期望状态为 Open，实际为 %v", cb.State())
	}
}

// TestCircuitBreakerExecuteSuccess 测试 Execute 成功场景
func TestCircuitBreakerExecuteSuccess(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	var called bool
	err := cb.Execute(context.Background(), func() error {
		called = true
		return nil
	})

	if err != nil {
		t.Errorf("期望无错误，实际为 %v", err)
	}

	if !called {
		t.Error("期望函数被调用")
	}

	stats := cb.Stats()
	if stats.Successes != 1 {
		t.Errorf("期望成功次数为 1，实际为 %d", stats.Successes)
	}
}

// TestCircuitBreakerExecuteFailure 测试 Execute 失败场景
func TestCircuitBreakerExecuteFailure(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	err := cb.Execute(context.Background(), func() error {
		return errTest
	})

	if !errors.Is(err, errTest) {
		t.Errorf("期望错误为 errTest，实际为 %v", err)
	}

	stats := cb.Stats()
	if stats.Failures != 1 {
		t.Errorf("期望失败次数为 1，实际为 %d", stats.Failures)
	}
}

// TestCircuitBreakerExecuteRejected 测试 Execute 被拒绝场景
func TestCircuitBreakerExecuteRejected(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 1
	cb := NewCircuitBreaker(config)

	// 打开断路器
	cb.RecordFailure()

	var called bool
	err := cb.Execute(context.Background(), func() error {
		called = true
		return nil
	})

	if !errors.Is(err, ErrCircuitOpen) {
		t.Errorf("期望错误为 ErrCircuitOpen，实际为 %v", err)
	}

	if called {
		t.Error("期望函数不被调用")
	}

	stats := cb.Stats()
	if stats.RejectedRequests != 1 {
		t.Errorf("期望拒绝请求数为 1，实际为 %d", stats.RejectedRequests)
	}
}

// TestCircuitBreakerExecuteContextCanceled 测试 Execute 上下文取消场景
func TestCircuitBreakerExecuteContextCanceled(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // 立即取消

	err := cb.Execute(ctx, func() error {
		return nil
	})

	if !errors.Is(err, context.Canceled) {
		t.Errorf("期望错误为 context.Canceled，实际为 %v", err)
	}
}

// TestCircuitBreakerReset 测试重置功能
func TestCircuitBreakerReset(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 1
	cb := NewCircuitBreaker(config)

	// 打开断路器
	cb.RecordFailure()

	if cb.State() != StateOpen {
		t.Errorf("期望状态为 Open，实际为 %v", cb.State())
	}

	// 重置
	cb.Reset()

	if cb.State() != StateClosed {
		t.Errorf("期望重置后状态为 Closed，实际为 %v", cb.State())
	}

	if !cb.AllowRequest() {
		t.Error("期望重置后允许请求")
	}

	stats := cb.Stats()
	if stats.ConsecutiveFails != 0 {
		t.Errorf("期望重置后连续失败次数为 0，实际为 %d", stats.ConsecutiveFails)
	}
}

// TestCircuitBreakerStateChangeCallback 测试状态变更回调
func TestCircuitBreakerStateChangeCallback(t *testing.T) {
	var transitions []struct{ from, to State }
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 2
	config.Timeout = 50 * time.Millisecond
	config.OnStateChange = func(from, to State) {
		transitions = append(transitions, struct{ from, to State }{from, to})
	}
	cb := NewCircuitBreaker(config)

	// Closed -> Open
	cb.RecordFailure()
	cb.RecordFailure()

	// 等待超时 Open -> HalfOpen
	time.Sleep(60 * time.Millisecond)
	cb.AllowRequest()

	// HalfOpen -> Closed
	cb.RecordSuccess()
	cb.RecordSuccess()

	expectedTransitions := []struct{ from, to State }{
		{StateClosed, StateOpen},
		{StateOpen, StateHalfOpen},
		{StateHalfOpen, StateClosed},
	}

	if len(transitions) != len(expectedTransitions) {
		t.Errorf("期望 %d 次状态转换，实际为 %d", len(expectedTransitions), len(transitions))
		return
	}

	for i, expected := range expectedTransitions {
		if transitions[i].from != expected.from || transitions[i].to != expected.to {
			t.Errorf("第 %d 次转换期望 %v -> %v，实际为 %v -> %v",
				i, expected.from, expected.to, transitions[i].from, transitions[i].to)
		}
	}
}

// TestCircuitBreakerConcurrentSafety 测试并发安全性
func TestCircuitBreakerConcurrentSafety(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	var wg sync.WaitGroup
	numGoroutines := 100
	numOperations := 100

	// 并发执行成功和失败操作
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				if id%2 == 0 {
					cb.RecordSuccess()
				} else {
					cb.RecordFailure()
				}
				cb.AllowRequest()
				cb.State()
				cb.Stats()
			}
		}(i)
	}

	wg.Wait()

	// 验证没有 panic，统计数据一致
	stats := cb.Stats()
	expectedTotal := int64(numGoroutines * numOperations)
	actualTotal := stats.Successes + stats.Failures

	if actualTotal != expectedTotal {
		t.Errorf("期望总操作数为 %d，实际为 %d", expectedTotal, actualTotal)
	}
}

// TestCircuitBreakerConcurrentExecute 测试并发 Execute
func TestCircuitBreakerConcurrentExecute(t *testing.T) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	var wg sync.WaitGroup
	var successCount, errorCount int64
	numGoroutines := 50

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			err := cb.Execute(context.Background(), func() error {
				time.Sleep(time.Millisecond) // 模拟工作
				if id%3 == 0 {
					return errTest
				}
				return nil
			})
			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else if errors.Is(err, errTest) {
				atomic.AddInt64(&errorCount, 1)
			}
		}(i)
	}

	wg.Wait()

	stats := cb.Stats()
	if stats.TotalRequests != int64(numGoroutines) {
		t.Errorf("期望总请求数为 %d，实际为 %d", numGoroutines, stats.TotalRequests)
	}
}

// TestCircuitBreakerSuccessResetsConsecutiveFailures 测试成功重置连续失败计数
func TestCircuitBreakerSuccessResetsConsecutiveFailures(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 5
	cb := NewCircuitBreaker(config)

	// 失败 3 次
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	stats := cb.Stats()
	if stats.ConsecutiveFails != 3 {
		t.Errorf("期望连续失败次数为 3，实际为 %d", stats.ConsecutiveFails)
	}

	// 成功一次应该重置连续失败计数
	cb.RecordSuccess()

	stats = cb.Stats()
	if stats.ConsecutiveFails != 0 {
		t.Errorf("期望连续失败次数为 0，实际为 %d", stats.ConsecutiveFails)
	}

	// 断路器应该仍然关闭
	if cb.State() != StateClosed {
		t.Errorf("期望状态为 Closed，实际为 %v", cb.State())
	}
}

// TestCircuitBreakerStatsAccuracy 测试统计准确性
func TestCircuitBreakerStatsAccuracy(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 10 // 设置高阈值避免打开
	cb := NewCircuitBreaker(config)

	ctx := context.Background()

	// 通过 Execute 执行操作（这样才会增加 TotalRequests）
	for i := 0; i < 5; i++ {
		_ = cb.Execute(ctx, func() error { return nil })
	}
	for i := 0; i < 3; i++ {
		_ = cb.Execute(ctx, func() error { return errTest })
	}

	stats := cb.Stats()

	if stats.Successes != 5 {
		t.Errorf("期望成功次数为 5，实际为 %d", stats.Successes)
	}

	if stats.Failures != 3 {
		t.Errorf("期望失败次数为 3，实际为 %d", stats.Failures)
	}

	if stats.TotalRequests != 8 {
		t.Errorf("期望总请求数为 8，实际为 %d", stats.TotalRequests)
	}

	if stats.ConsecutiveFails != 3 {
		t.Errorf("期望连续失败次数为 3，实际为 %d", stats.ConsecutiveFails)
	}
}

// TestStateString 测试状态字符串表示
func TestStateString(t *testing.T) {
	tests := []struct {
		state    State
		expected string
	}{
		{StateClosed, "closed"},
		{StateOpen, "open"},
		{StateHalfOpen, "half-open"},
		{State(99), "unknown"},
	}

	for _, tt := range tests {
		if got := tt.state.String(); got != tt.expected {
			t.Errorf("State(%d).String() = %v, 期望 %v", tt.state, got, tt.expected)
		}
	}
}

// TestDegradationLevelString 测试降级级别字符串表示
func TestDegradationLevelString(t *testing.T) {
	tests := []struct {
		level    DegradationLevel
		expected string
	}{
		{DegradationNone, "none"},
		{DegradationPartial, "partial"},
		{DegradationSevere, "severe"},
		{DegradationFull, "full"},
		{DegradationLevel(99), "unknown"},
	}

	for _, tt := range tests {
		if got := tt.level.String(); got != tt.expected {
			t.Errorf("DegradationLevel(%d).String() = %v, 期望 %v", tt.level, got, tt.expected)
		}
	}
}

// TestDefaultConfigs 测试默认配置
func TestDefaultConfigs(t *testing.T) {
	cbConfig := DefaultCircuitBreakerConfig()
	if cbConfig.FailureThreshold != 5 {
		t.Errorf("期望 FailureThreshold 为 5，实际为 %d", cbConfig.FailureThreshold)
	}
	if cbConfig.SuccessThreshold != 2 {
		t.Errorf("期望 SuccessThreshold 为 2，实际为 %d", cbConfig.SuccessThreshold)
	}
	if cbConfig.Timeout != 30*time.Second {
		t.Errorf("期望 Timeout 为 30s，实际为 %v", cbConfig.Timeout)
	}

	retryConfig := DefaultRetryConfig()
	if retryConfig.MaxAttempts != 3 {
		t.Errorf("期望 MaxAttempts 为 3，实际为 %d", retryConfig.MaxAttempts)
	}
	if retryConfig.InitialInterval != 100*time.Millisecond {
		t.Errorf("期望 InitialInterval 为 100ms，实际为 %v", retryConfig.InitialInterval)
	}
}

// TestCircuitBreakerOpenDuration 测试打开持续时间统计
func TestCircuitBreakerOpenDuration(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 1
	config.Timeout = 1 * time.Second
	cb := NewCircuitBreaker(config)

	// 打开断路器
	cb.RecordFailure()

	// 等待一段时间
	time.Sleep(50 * time.Millisecond)

	stats := cb.Stats()
	if stats.OpenDuration < 50*time.Millisecond {
		t.Errorf("期望 OpenDuration >= 50ms，实际为 %v", stats.OpenDuration)
	}
}

// TestCircuitBreakerMultipleResets 测试多次重置
func TestCircuitBreakerMultipleResets(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	config.FailureThreshold = 1
	cb := NewCircuitBreaker(config)

	// 多次重置应该是安全的
	cb.Reset()
	cb.Reset()
	cb.Reset()

	if cb.State() != StateClosed {
		t.Errorf("期望状态为 Closed，实际为 %v", cb.State())
	}
}

// BenchmarkCircuitBreakerAllowRequest 基准测试 AllowRequest
func BenchmarkCircuitBreakerAllowRequest(b *testing.B) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cb.AllowRequest()
	}
}

// BenchmarkCircuitBreakerExecute 基准测试 Execute
func BenchmarkCircuitBreakerExecute(b *testing.B) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())
	ctx := context.Background()
	fn := func() error { return nil }

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = cb.Execute(ctx, fn)
	}
}

// BenchmarkCircuitBreakerConcurrent 基准测试并发场景
func BenchmarkCircuitBreakerConcurrent(b *testing.B) {
	cb := NewCircuitBreaker(DefaultCircuitBreakerConfig())
	ctx := context.Background()
	fn := func() error { return nil }

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = cb.Execute(ctx, fn)
		}
	})
}
