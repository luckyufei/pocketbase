package gateway

import (
	"sync"
	"testing"
	"time"
)

// TestCircuitStateConstants 验证状态常量
func TestCircuitStateConstants(t *testing.T) {
	// 验证状态值
	if CircuitClosed != 0 {
		t.Errorf("CircuitClosed should be 0, got %d", CircuitClosed)
	}
	if CircuitOpen != 1 {
		t.Errorf("CircuitOpen should be 1, got %d", CircuitOpen)
	}
	if CircuitHalfOpen != 2 {
		t.Errorf("CircuitHalfOpen should be 2, got %d", CircuitHalfOpen)
	}
}

// TestCircuitStateString 验证状态字符串表示
func TestCircuitStateString(t *testing.T) {
	tests := []struct {
		state CircuitState
		want  string
	}{
		{CircuitClosed, "closed"},
		{CircuitOpen, "open"},
		{CircuitHalfOpen, "half-open"},
		{CircuitState(99), "unknown"},
	}

	for _, tt := range tests {
		if got := tt.state.String(); got != tt.want {
			t.Errorf("CircuitState(%d).String() = %q, want %q", tt.state, got, tt.want)
		}
	}
}

// TestDefaultCircuitBreakerConfig 验证默认配置
func TestDefaultCircuitBreakerConfig(t *testing.T) {
	config := DefaultCircuitBreakerConfig()

	if config.Enabled {
		t.Error("Default Enabled should be false")
	}
	if config.FailureThreshold != 5 {
		t.Errorf("FailureThreshold: want 5, got %d", config.FailureThreshold)
	}
	if config.RecoveryTimeout != 30 {
		t.Errorf("RecoveryTimeout: want 30, got %d", config.RecoveryTimeout)
	}
	if config.HalfOpenRequests != 1 {
		t.Errorf("HalfOpenRequests: want 1, got %d", config.HalfOpenRequests)
	}
}

// TestNewCircuitBreaker 验证创建
func TestNewCircuitBreaker(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 3,
		RecoveryTimeout:  10,
		HalfOpenRequests: 2,
	}

	cb := NewCircuitBreaker(config)
	if cb == nil {
		t.Fatal("NewCircuitBreaker should not return nil")
	}

	if cb.State() != CircuitClosed {
		t.Errorf("Initial state should be Closed, got %v", cb.State())
	}
}

// TestNewCircuitBreakerDisabled 验证禁用时返回 nil
func TestNewCircuitBreakerDisabled(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled: false,
	}

	cb := NewCircuitBreaker(config)
	if cb != nil {
		t.Error("NewCircuitBreaker with Enabled=false should return nil")
	}
}

// TestCircuitBreakerClosedToOpen 验证 Closed → Open 转换 (FR-013)
func TestCircuitBreakerClosedToOpen(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 3,
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	// 初始状态 Closed
	if cb.IsOpen() {
		t.Error("Initial state should not be open")
	}

	// 记录失败（未达阈值）
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.State() != CircuitClosed {
		t.Error("Should still be Closed after 2 failures")
	}
	if cb.IsOpen() {
		t.Error("Should not be open after 2 failures")
	}

	// 第 3 次失败触发熔断
	cb.RecordFailure()
	if cb.State() != CircuitOpen {
		t.Errorf("Should be Open after 3 failures, got %v", cb.State())
	}
	if !cb.IsOpen() {
		t.Error("IsOpen should return true after reaching threshold")
	}
}

// TestCircuitBreakerOpenToHalfOpen 验证 Open → HalfOpen 转换 (FR-013)
func TestCircuitBreakerOpenToHalfOpen(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 1,
		RecoveryTimeout:  1, // 1 秒恢复时间
	}
	cb := NewCircuitBreaker(config)

	// 触发熔断
	cb.RecordFailure()
	if cb.State() != CircuitOpen {
		t.Fatal("Should be Open")
	}

	// 等待恢复时间
	time.Sleep(1100 * time.Millisecond)

	// 检查是否转为 HalfOpen
	// IsOpen 在超时后应该返回 false（允许试探请求）
	if cb.IsOpen() {
		t.Error("Should be HalfOpen after recovery timeout")
	}
	if cb.State() != CircuitHalfOpen {
		t.Errorf("State should be HalfOpen, got %v", cb.State())
	}
}

// TestCircuitBreakerHalfOpenToClosedSuccess 验证 HalfOpen → Closed（成功）(FR-013)
func TestCircuitBreakerHalfOpenToClosedSuccess(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 1,
		RecoveryTimeout:  1,
		HalfOpenRequests: 1,
	}
	cb := NewCircuitBreaker(config)

	// 触发熔断并等待恢复
	cb.RecordFailure()
	time.Sleep(1100 * time.Millisecond)

	// 确认进入 HalfOpen
	cb.IsOpen() // 触发状态检查
	if cb.State() != CircuitHalfOpen {
		t.Fatalf("Should be HalfOpen, got %v", cb.State())
	}

	// 记录成功
	cb.RecordSuccess()

	// 应该回到 Closed
	if cb.State() != CircuitClosed {
		t.Errorf("Should be Closed after success, got %v", cb.State())
	}
}

// TestCircuitBreakerHalfOpenToOpenFailure 验证 HalfOpen → Open（失败）(FR-013)
func TestCircuitBreakerHalfOpenToOpenFailure(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 1,
		RecoveryTimeout:  1,
	}
	cb := NewCircuitBreaker(config)

	// 触发熔断并等待恢复
	cb.RecordFailure()
	time.Sleep(1100 * time.Millisecond)

	// 确认进入 HalfOpen
	cb.IsOpen()
	if cb.State() != CircuitHalfOpen {
		t.Fatalf("Should be HalfOpen, got %v", cb.State())
	}

	// HalfOpen 状态下失败立即回到 Open
	cb.RecordFailure()

	if cb.State() != CircuitOpen {
		t.Errorf("Should be Open after failure in HalfOpen, got %v", cb.State())
	}
}

// TestCircuitBreakerSuccessResetCount 验证成功重置失败计数
func TestCircuitBreakerSuccessResetCount(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 3,
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	// 记录 2 次失败
	cb.RecordFailure()
	cb.RecordFailure()

	// 记录成功（应该重置计数）
	cb.RecordSuccess()

	// 再记录 2 次失败（不应该触发熔断）
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != CircuitClosed {
		t.Error("Should still be Closed (count was reset)")
	}

	// 第 3 次失败才触发
	cb.RecordFailure()
	if cb.State() != CircuitOpen {
		t.Error("Should be Open after 3 consecutive failures")
	}
}

// TestCircuitBreakerReset 验证手动重置
func TestCircuitBreakerReset(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 1,
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	// 触发熔断
	cb.RecordFailure()
	if cb.State() != CircuitOpen {
		t.Fatal("Should be Open")
	}

	// 手动重置
	cb.Reset()

	if cb.State() != CircuitClosed {
		t.Error("Should be Closed after Reset")
	}
	if cb.IsOpen() {
		t.Error("IsOpen should return false after Reset")
	}
}

// TestCircuitBreakerConcurrency 验证并发安全性
func TestCircuitBreakerConcurrency(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 100, // 高阈值避免测试中触发
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	var wg sync.WaitGroup

	// 并发记录成功和失败
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			cb.RecordSuccess()
		}()
		go func() {
			defer wg.Done()
			cb.RecordFailure()
		}()
	}

	// 并发读取状态
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cb.IsOpen()
			cb.State()
		}()
	}

	wg.Wait()
}

// TestCircuitBreakerNilSafe 验证 nil 安全
func TestCircuitBreakerNilSafe(t *testing.T) {
	var cb *CircuitBreaker = nil

	// 所有方法对 nil 应该安全
	if cb.IsOpen() {
		t.Error("nil.IsOpen() should return false")
	}

	cb.RecordSuccess() // 不应该 panic
	cb.RecordFailure() // 不应该 panic
	cb.Reset()         // 不应该 panic

	if cb.State() != CircuitClosed {
		t.Error("nil.State() should return CircuitClosed")
	}
}

// TestCircuitBreakerFailureCount 验证失败计数获取
func TestCircuitBreakerFailureCount(t *testing.T) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 10,
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	if cb.FailureCount() != 0 {
		t.Errorf("Initial FailureCount: want 0, got %d", cb.FailureCount())
	}

	cb.RecordFailure()
	cb.RecordFailure()

	if cb.FailureCount() != 2 {
		t.Errorf("After 2 failures: want 2, got %d", cb.FailureCount())
	}

	cb.RecordSuccess()

	if cb.FailureCount() != 0 {
		t.Errorf("After success: want 0, got %d", cb.FailureCount())
	}
}

// BenchmarkCircuitBreakerRecordFailure 性能基准测试
func BenchmarkCircuitBreakerRecordFailure(b *testing.B) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 1000000, // 高阈值
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			cb.RecordFailure()
			cb.RecordSuccess()
		}
	})
}

// BenchmarkCircuitBreakerIsOpen 性能基准测试
func BenchmarkCircuitBreakerIsOpen(b *testing.B) {
	config := CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 5,
		RecoveryTimeout:  60,
	}
	cb := NewCircuitBreaker(config)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			cb.IsOpen()
		}
	})
}
