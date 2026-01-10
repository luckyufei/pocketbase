package reliability

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// ErrCircuitOpen 断路器打开错误
var ErrCircuitOpen = errors.New("断路器已打开，请求被拒绝")

// circuitBreaker 断路器实现
type circuitBreaker struct {
	config CircuitBreakerConfig

	mu               sync.RWMutex
	state            State
	consecutiveFails int64
	consecutiveSuccs int64
	lastFailure      time.Time
	lastSuccess      time.Time
	openedAt         time.Time

	// 统计信息（使用原子操作）
	failures         int64
	successes        int64
	totalRequests    int64
	rejectedRequests int64
}

// NewCircuitBreaker 创建新的断路器
func NewCircuitBreaker(config CircuitBreakerConfig) CircuitBreaker {
	return &circuitBreaker{
		config: config,
		state:  StateClosed,
	}
}

// Execute 执行函数，如果断路器打开则返回错误
func (cb *circuitBreaker) Execute(ctx context.Context, fn func() error) error {
	// 检查上下文是否已取消
	if ctx.Err() != nil {
		return ctx.Err()
	}

	// 检查是否允许请求
	if !cb.AllowRequest() {
		atomic.AddInt64(&cb.rejectedRequests, 1)
		return ErrCircuitOpen
	}

	// 增加总请求数
	atomic.AddInt64(&cb.totalRequests, 1)

	// 执行函数
	err := fn()

	// 记录结果
	if err != nil {
		cb.RecordFailure()
	} else {
		cb.RecordSuccess()
	}

	return err
}

// AllowRequest 检查是否允许请求通过
func (cb *circuitBreaker) AllowRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true

	case StateOpen:
		// 检查是否超时，超时则进入半开状态
		if time.Since(cb.openedAt) >= cb.config.Timeout {
			cb.transitionTo(StateHalfOpen)
			return true
		}
		return false

	case StateHalfOpen:
		// 半开状态允许请求通过（用于探测）
		return true

	default:
		return false
	}
}

// RecordSuccess 记录成功
func (cb *circuitBreaker) RecordSuccess() {
	atomic.AddInt64(&cb.successes, 1)

	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastSuccess = time.Now()
	cb.consecutiveFails = 0
	cb.consecutiveSuccs++

	switch cb.state {
	case StateClosed:
		// 关闭状态下成功不需要特殊处理

	case StateHalfOpen:
		// 半开状态下，连续成功达到阈值则关闭断路器
		if cb.consecutiveSuccs >= int64(cb.config.SuccessThreshold) {
			cb.transitionTo(StateClosed)
		}
	}
}

// RecordFailure 记录失败
func (cb *circuitBreaker) RecordFailure() {
	atomic.AddInt64(&cb.failures, 1)

	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailure = time.Now()
	cb.consecutiveFails++
	cb.consecutiveSuccs = 0

	switch cb.state {
	case StateClosed:
		// 关闭状态下，连续失败达到阈值则打开断路器
		if cb.consecutiveFails >= int64(cb.config.FailureThreshold) {
			cb.transitionTo(StateOpen)
		}

	case StateHalfOpen:
		// 半开状态下任何失败都会重新打开断路器
		cb.transitionTo(StateOpen)
	}
}

// State 返回当前状态
func (cb *circuitBreaker) State() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Reset 重置断路器到关闭状态
func (cb *circuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	oldState := cb.state
	cb.state = StateClosed
	cb.consecutiveFails = 0
	cb.consecutiveSuccs = 0
	cb.openedAt = time.Time{}

	if oldState != StateClosed && cb.config.OnStateChange != nil {
		cb.config.OnStateChange(oldState, StateClosed)
	}
}

// Stats 返回统计信息
func (cb *circuitBreaker) Stats() CircuitBreakerStats {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	var openDuration time.Duration
	if cb.state == StateOpen {
		openDuration = time.Since(cb.openedAt)
	}

	return CircuitBreakerStats{
		State:            cb.state,
		Failures:         atomic.LoadInt64(&cb.failures),
		Successes:        atomic.LoadInt64(&cb.successes),
		ConsecutiveFails: cb.consecutiveFails,
		LastFailure:      cb.lastFailure,
		LastSuccess:      cb.lastSuccess,
		TotalRequests:    atomic.LoadInt64(&cb.totalRequests),
		RejectedRequests: atomic.LoadInt64(&cb.rejectedRequests),
		OpenDuration:     openDuration,
	}
}

// transitionTo 状态转换（必须在持有锁的情况下调用）
func (cb *circuitBreaker) transitionTo(newState State) {
	if cb.state == newState {
		return
	}

	oldState := cb.state
	cb.state = newState

	// 状态转换时的特殊处理
	switch newState {
	case StateOpen:
		cb.openedAt = time.Now()
	case StateHalfOpen:
		cb.consecutiveSuccs = 0
	case StateClosed:
		cb.consecutiveFails = 0
		cb.consecutiveSuccs = 0
		cb.openedAt = time.Time{}
	}

	// 触发回调
	if cb.config.OnStateChange != nil {
		cb.config.OnStateChange(oldState, newState)
	}
}
