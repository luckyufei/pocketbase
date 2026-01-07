package core

import (
	"strings"
	"time"
)

// PostgreSQL 错误码常量
const (
	// 死锁检测 (Class 40 - Transaction Rollback)
	PGErrDeadlock          = "40P01" // deadlock_detected
	PGErrSerializationFail = "40001" // serialization_failure
	PGErrStatementTimeout  = "40003" // statement_completion_unknown

	// 锁相关 (Class 55 - Object Not In Prerequisite State)
	PGErrLockNotAvailable = "55P03" // lock_not_available

	// 连接相关 (Class 08 - Connection Exception)
	PGErrConnectionFailure = "08006" // connection_failure
	PGErrConnectionReset   = "08003" // connection_does_not_exist
)

// RetryConfig 重试配置
type RetryConfig struct {
	// MaxRetries 最大重试次数
	MaxRetries int

	// InitialBackoff 初始退避时间 (毫秒)
	InitialBackoff time.Duration

	// MaxBackoff 最大退避时间 (毫秒)
	MaxBackoff time.Duration

	// BackoffMultiplier 退避时间乘数
	BackoffMultiplier float64

	// Jitter 是否添加随机抖动
	Jitter bool
}

// DefaultRetryConfig 返回默认重试配置
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:        defaultMaxLockRetries,
		InitialBackoff:    50 * time.Millisecond,
		MaxBackoff:        1000 * time.Millisecond,
		BackoffMultiplier: 1.5,
		Jitter:            true,
	}
}

// GetBackoff 计算指定尝试次数的退避时间
func (c *RetryConfig) GetBackoff(attempt int) time.Duration {
	if attempt <= 1 {
		return c.InitialBackoff
	}

	// 指数退避
	backoff := float64(c.InitialBackoff)
	for i := 1; i < attempt; i++ {
		backoff *= c.BackoffMultiplier
		if time.Duration(backoff) >= c.MaxBackoff {
			return c.MaxBackoff
		}
	}

	return time.Duration(backoff)
}

// IsRetryableError 检查错误是否可重试
// 支持 SQLite 和 PostgreSQL 的可重试错误
func IsRetryableError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())

	// SQLite 锁定错误
	if strings.Contains(errStr, "database is locked") ||
		strings.Contains(errStr, "table is locked") {
		return true
	}

	// PostgreSQL 死锁
	if strings.Contains(errStr, "40p01") ||
		strings.Contains(errStr, "deadlock detected") ||
		strings.Contains(errStr, "deadlock") {
		return true
	}

	// PostgreSQL 序列化失败
	if strings.Contains(errStr, "40001") ||
		strings.Contains(errStr, "could not serialize access") ||
		strings.Contains(errStr, "serialization failure") {
		return true
	}

	// PostgreSQL 锁等待超时
	if strings.Contains(errStr, "55p03") ||
		strings.Contains(errStr, "lock timeout") ||
		strings.Contains(errStr, "lock not available") {
		return true
	}

	// 连接问题 (可能是临时的)
	if strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "connection is closed") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "broken pipe") {
		return true
	}

	return false
}

// IsDeadlockError 检查是否为死锁错误
func IsDeadlockError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "40p01") ||
		strings.Contains(errStr, "deadlock detected") ||
		strings.Contains(errStr, "deadlock")
}

// IsSerializationError 检查是否为序列化失败错误
func IsSerializationError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "40001") ||
		strings.Contains(errStr, "could not serialize access") ||
		strings.Contains(errStr, "serialization failure")
}

// IsLockTimeoutError 检查是否为锁等待超时错误
func IsLockTimeoutError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "55p03") ||
		strings.Contains(errStr, "lock timeout") ||
		strings.Contains(errStr, "lock not available")
}

// RetryWithBackoff 使用指数退避执行可重试操作
func RetryWithBackoff(cfg *RetryConfig, op func(attempt int) error) error {
	if cfg == nil {
		cfg = DefaultRetryConfig()
	}

	var lastErr error
	for attempt := 1; attempt <= cfg.MaxRetries+1; attempt++ {
		lastErr = op(attempt)
		if lastErr == nil {
			return nil
		}

		// 检查是否可重试
		if !IsRetryableError(lastErr) {
			return lastErr
		}

		// 已达到最大重试次数
		if attempt > cfg.MaxRetries {
			return lastErr
		}

		// 计算退避时间并等待
		backoff := cfg.GetBackoff(attempt)
		time.Sleep(backoff)
	}

	return lastErr
}

// RetryableOperation 可重试操作的包装
type RetryableOperation struct {
	config *RetryConfig
	op     func(attempt int) error
}

// NewRetryableOperation 创建可重试操作
func NewRetryableOperation(op func(attempt int) error) *RetryableOperation {
	return &RetryableOperation{
		config: DefaultRetryConfig(),
		op:     op,
	}
}

// WithConfig 设置重试配置
func (r *RetryableOperation) WithConfig(cfg *RetryConfig) *RetryableOperation {
	r.config = cfg
	return r
}

// WithMaxRetries 设置最大重试次数
func (r *RetryableOperation) WithMaxRetries(n int) *RetryableOperation {
	r.config.MaxRetries = n
	return r
}

// Execute 执行操作
func (r *RetryableOperation) Execute() error {
	return RetryWithBackoff(r.config, r.op)
}

// TransactionRetryError 事务重试错误
type TransactionRetryError struct {
	Attempts int
	LastErr  error
}

func (e *TransactionRetryError) Error() string {
	return "transaction failed after " + string(rune(e.Attempts)) + " attempts: " + e.LastErr.Error()
}

func (e *TransactionRetryError) Unwrap() error {
	return e.LastErr
}
