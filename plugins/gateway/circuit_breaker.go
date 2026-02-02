// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"sync"
	"time"
)

// CircuitState 熔断器状态
// FR-013: 三态熔断
type CircuitState int

const (
	// CircuitClosed 正常状态：允许所有请求
	CircuitClosed CircuitState = iota

	// CircuitOpen 熔断状态：拒绝所有请求
	CircuitOpen

	// CircuitHalfOpen 试探状态：允许有限请求测试恢复
	CircuitHalfOpen
)

// String 返回状态的字符串表示
func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "closed"
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreakerConfig 熔断器配置
// FR-014: 可配置熔断条件
type CircuitBreakerConfig struct {
	// Enabled 是否启用熔断器
	// 默认 false，需显式启用
	Enabled bool `json:"enabled"`

	// FailureThreshold 触发熔断的连续失败次数
	// 默认 5
	FailureThreshold int `json:"failure_threshold"`

	// RecoveryTimeout 熔断恢复超时（秒）
	// Open 状态持续该时间后进入 HalfOpen
	// 默认 30
	// NFR-006: 熔断恢复时间可配置
	RecoveryTimeout int `json:"recovery_timeout"`

	// HalfOpenRequests HalfOpen 状态允许的试探请求数
	// 默认 1
	HalfOpenRequests int `json:"half_open_requests"`
}

// DefaultCircuitBreakerConfig 返回默认配置
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		Enabled:          false, // 默认禁用
		FailureThreshold: 5,
		RecoveryTimeout:  30,
		HalfOpenRequests: 1,
	}
}

// CircuitBreaker 熔断器实现
// 基于失败次数和时间窗口的状态机
type CircuitBreaker struct {
	state           CircuitState
	failureCount    int
	lastFailureTime time.Time
	config          CircuitBreakerConfig
	mu              sync.RWMutex
}

// NewCircuitBreaker 创建熔断器
// 如果 config.Enabled 为 false，返回 nil
//
// T023: 实现创建
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	if !config.Enabled {
		return nil
	}

	// 应用默认值
	if config.FailureThreshold <= 0 {
		config.FailureThreshold = DefaultCircuitBreakerConfig().FailureThreshold
	}
	if config.RecoveryTimeout <= 0 {
		config.RecoveryTimeout = DefaultCircuitBreakerConfig().RecoveryTimeout
	}
	if config.HalfOpenRequests <= 0 {
		config.HalfOpenRequests = DefaultCircuitBreakerConfig().HalfOpenRequests
	}

	return &CircuitBreaker{
		state:  CircuitClosed,
		config: config,
	}
}

// IsOpen 检查是否应该拒绝请求
// 返回 true 表示熔断器打开（拒绝请求）
// nil 熔断器总是返回 false（允许请求）
//
// T024: 实现状态检查
func (cb *CircuitBreaker) IsOpen() bool {
	if cb == nil {
		return false
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return false

	case CircuitOpen:
		// 检查是否超过恢复时间
		if time.Since(cb.lastFailureTime) > time.Duration(cb.config.RecoveryTimeout)*time.Second {
			// 转为 HalfOpen 状态
			cb.state = CircuitHalfOpen
			return false // 允许试探请求
		}
		return true // 仍在熔断期

	case CircuitHalfOpen:
		// HalfOpen 状态允许请求（用于试探）
		return false

	default:
		return false
	}
}

// RecordSuccess 记录成功
// HalfOpen 状态成功后转为 Closed
// Closed 状态重置失败计数
//
// T025: 实现成功记录
func (cb *CircuitBreaker) RecordSuccess() {
	if cb == nil {
		return
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	// 重置失败计数
	cb.failureCount = 0

	// HalfOpen 状态成功后恢复为 Closed
	if cb.state == CircuitHalfOpen {
		cb.state = CircuitClosed
	}
}

// RecordFailure 记录失败
// 增加失败计数，达到阈值时熔断
// HalfOpen 状态失败后立即返回 Open
//
// T026: 实现失败记录
func (cb *CircuitBreaker) RecordFailure() {
	if cb == nil {
		return
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailureTime = time.Now()

	switch cb.state {
	case CircuitClosed:
		cb.failureCount++
		// 达到阈值触发熔断
		if cb.failureCount >= cb.config.FailureThreshold {
			cb.state = CircuitOpen
		}

	case CircuitHalfOpen:
		// HalfOpen 状态下失败立即熔断
		cb.state = CircuitOpen
		cb.failureCount = cb.config.FailureThreshold // 重置计数到阈值

	case CircuitOpen:
		// Open 状态下记录失败（用于更新 lastFailureTime）
	}
}

// State 获取当前状态
// nil 熔断器返回 CircuitClosed
//
// T027: 实现状态获取
func (cb *CircuitBreaker) State() CircuitState {
	if cb == nil {
		return CircuitClosed
	}

	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return cb.state
}

// Reset 重置为 Closed 状态
// 用于管理目的（如手动恢复）
//
// T028: 实现重置
func (cb *CircuitBreaker) Reset() {
	if cb == nil {
		return
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = CircuitClosed
	cb.failureCount = 0
	cb.lastFailureTime = time.Time{}
}

// FailureCount 返回当前失败计数
// nil 熔断器返回 0
func (cb *CircuitBreaker) FailureCount() int {
	if cb == nil {
		return 0
	}

	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return cb.failureCount
}

// Config 返回配置（只读）
func (cb *CircuitBreaker) Config() CircuitBreakerConfig {
	if cb == nil {
		return CircuitBreakerConfig{}
	}

	return cb.config
}
