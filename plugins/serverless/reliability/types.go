// Package reliability 提供 Serverless 函数的可靠性保障机制
// 包括断路器、重试、降级等模式
package reliability

import (
	"context"
	"time"
)

// State 表示断路器的状态
type State int

const (
	// StateClosed 表示断路器关闭（正常状态，允许请求通过）
	StateClosed State = iota
	// StateOpen 表示断路器打开（故障状态，拒绝请求）
	StateOpen
	// StateHalfOpen 表示断路器半开（恢复探测状态，允许部分请求）
	StateHalfOpen
)

// String 返回状态的字符串表示
func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreakerConfig 断路器配置
type CircuitBreakerConfig struct {
	// FailureThreshold 失败阈值，连续失败次数达到此值后打开断路器
	FailureThreshold int
	// SuccessThreshold 成功阈值，半开状态下连续成功次数达到此值后关闭断路器
	SuccessThreshold int
	// Timeout 断路器打开后的超时时间，超时后进入半开状态
	Timeout time.Duration
	// MaxConcurrent 最大并发请求数（半开状态下）
	MaxConcurrent int
	// OnStateChange 状态变更回调
	OnStateChange func(from, to State)
}

// DefaultCircuitBreakerConfig 返回默认断路器配置
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold: 5,
		SuccessThreshold: 2,
		Timeout:          30 * time.Second,
		MaxConcurrent:    1,
		OnStateChange:    nil,
	}
}

// CircuitBreaker 断路器接口
type CircuitBreaker interface {
	// Execute 执行函数，如果断路器打开则返回错误
	Execute(ctx context.Context, fn func() error) error
	// AllowRequest 检查是否允许请求通过
	AllowRequest() bool
	// RecordSuccess 记录成功
	RecordSuccess()
	// RecordFailure 记录失败
	RecordFailure()
	// State 返回当前状态
	State() State
	// Reset 重置断路器到关闭状态
	Reset()
	// Stats 返回统计信息
	Stats() CircuitBreakerStats
}

// CircuitBreakerStats 断路器统计信息
type CircuitBreakerStats struct {
	State            State         // 当前状态
	Failures         int64         // 失败次数
	Successes        int64         // 成功次数
	ConsecutiveFails int64         // 连续失败次数
	LastFailure      time.Time     // 最后一次失败时间
	LastSuccess      time.Time     // 最后一次成功时间
	TotalRequests    int64         // 总请求数
	RejectedRequests int64         // 被拒绝的请求数
	OpenDuration     time.Duration // 断路器打开持续时间
}

// RetryConfig 重试配置
type RetryConfig struct {
	// MaxAttempts 最大重试次数（包括首次尝试）
	MaxAttempts int
	// InitialInterval 初始重试间隔
	InitialInterval time.Duration
	// MaxInterval 最大重试间隔
	MaxInterval time.Duration
	// Multiplier 退避乘数
	Multiplier float64
	// Jitter 抖动系数 (0-1)，用于避免雷群效应
	Jitter float64
	// RetryableErrors 可重试的错误判断函数
	RetryableErrors func(error) bool
}

// DefaultRetryConfig 返回默认重试配置
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:     3,
		InitialInterval: 100 * time.Millisecond,
		MaxInterval:     10 * time.Second,
		Multiplier:      2.0,
		Jitter:          0.1,
		RetryableErrors: nil, // 默认所有错误都可重试
	}
}

// Retryer 重试器接口
type Retryer interface {
	// Execute 执行函数，失败时按配置重试
	Execute(ctx context.Context, fn func() error) error
	// ExecuteWithResult 执行带返回值的函数
	ExecuteWithResult(ctx context.Context, fn func() (any, error)) (any, error)
}

// DegradationLevel 降级级别
type DegradationLevel int

const (
	// DegradationNone 无降级
	DegradationNone DegradationLevel = iota
	// DegradationPartial 部分降级（禁用非关键功能）
	DegradationPartial
	// DegradationSevere 严重降级（只保留核心功能）
	DegradationSevere
	// DegradationFull 完全降级（拒绝所有请求）
	DegradationFull
)

// String 返回降级级别的字符串表示
func (d DegradationLevel) String() string {
	switch d {
	case DegradationNone:
		return "none"
	case DegradationPartial:
		return "partial"
	case DegradationSevere:
		return "severe"
	case DegradationFull:
		return "full"
	default:
		return "unknown"
	}
}

// 注意：DegradationTrigger 和 DegradationStrategy 的具体实现在 degradation.go 中
