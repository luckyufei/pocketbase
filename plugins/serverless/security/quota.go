// Package security 提供 Serverless 函数的安全隔离和资源限制
package security

import (
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// QuotaConfig 配额配置
type QuotaConfig struct {
	MaxMemoryMB        int64 // 最大内存 (MB)
	MaxCPUTimeMS       int64 // 最大 CPU 时间 (毫秒)
	MaxConcurrency     int64 // 最大并发数
	MaxRequestsPerMin  int64 // 每分钟最大请求数
	MaxBandwidthMBPerS int64 // 每秒最大带宽 (MB)
}

// Validate 验证配额配置
func (c *QuotaConfig) Validate() error {
	if c.MaxMemoryMB <= 0 {
		return errors.New("MaxMemoryMB must be positive")
	}
	if c.MaxConcurrency < 0 {
		return errors.New("MaxConcurrency cannot be negative")
	}
	return nil
}

// QuotaUsage 配额使用情况
type QuotaUsage struct {
	CurrentConcurrency int64
	TotalRequests      int64
	TotalBandwidthMB   float64
}

// QuotaManager 配额管理器
type QuotaManager struct {
	config *QuotaConfig
	mu     sync.RWMutex

	currentConcurrency int64
	rateLimiters       map[string]*rateLimiter
}

// rateLimiter 速率限制器
type rateLimiter struct {
	requests  []time.Time
	mu        sync.Mutex
	maxPerMin int64
}

// NewQuotaManager 创建配额管理器
func NewQuotaManager(config *QuotaConfig) *QuotaManager {
	return &QuotaManager{
		config:       config,
		rateLimiters: make(map[string]*rateLimiter),
	}
}

// CheckMemory 检查内存配额
func (qm *QuotaManager) CheckMemory(usedMB int64) error {
	if usedMB > qm.config.MaxMemoryMB {
		return errors.New("memory quota exceeded")
	}
	return nil
}

// CheckCPUTime 检查 CPU 时间配额
func (qm *QuotaManager) CheckCPUTime(usedMS int64) error {
	if usedMS > qm.config.MaxCPUTimeMS {
		return errors.New("CPU time quota exceeded")
	}
	return nil
}

// AcquireConcurrency 获取并发槽位
func (qm *QuotaManager) AcquireConcurrency() (func(), error) {
	current := atomic.AddInt64(&qm.currentConcurrency, 1)
	if current > qm.config.MaxConcurrency {
		atomic.AddInt64(&qm.currentConcurrency, -1)
		return nil, errors.New("concurrency limit exceeded")
	}

	return func() {
		atomic.AddInt64(&qm.currentConcurrency, -1)
	}, nil
}

// CheckRateLimit 检查速率限制
func (qm *QuotaManager) CheckRateLimit(funcID string) error {
	qm.mu.Lock()
	limiter, exists := qm.rateLimiters[funcID]
	if !exists {
		limiter = &rateLimiter{
			requests:  make([]time.Time, 0),
			maxPerMin: qm.config.MaxRequestsPerMin,
		}
		qm.rateLimiters[funcID] = limiter
	}
	qm.mu.Unlock()

	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)

	// 清理过期请求
	validRequests := make([]time.Time, 0, len(limiter.requests))
	for _, t := range limiter.requests {
		if t.After(cutoff) {
			validRequests = append(validRequests, t)
		}
	}
	limiter.requests = validRequests

	// 检查是否超限
	if int64(len(limiter.requests)) >= limiter.maxPerMin {
		return errors.New("rate limit exceeded")
	}

	// 记录新请求
	limiter.requests = append(limiter.requests, now)
	return nil
}

// CheckBandwidth 检查带宽配额
func (qm *QuotaManager) CheckBandwidth(bytesPerSecond int64) error {
	maxBytes := qm.config.MaxBandwidthMBPerS * 1024 * 1024
	if bytesPerSecond > maxBytes {
		return errors.New("bandwidth quota exceeded")
	}
	return nil
}

// GetUsage 获取配额使用情况
func (qm *QuotaManager) GetUsage() *QuotaUsage {
	return &QuotaUsage{
		CurrentConcurrency: atomic.LoadInt64(&qm.currentConcurrency),
	}
}

// DefaultQuotaConfig 返回默认配额配置
func DefaultQuotaConfig() *QuotaConfig {
	return &QuotaConfig{
		MaxMemoryMB:        128,
		MaxCPUTimeMS:       30000,
		MaxConcurrency:     100,
		MaxRequestsPerMin:  1000,
		MaxBandwidthMBPerS: 100,
	}
}

// InstructionCounter 指令计数器
type InstructionCounter struct {
	count int64
	limit int64
}

// NewInstructionCounter 创建指令计数器
func NewInstructionCounter(limit int64) *InstructionCounter {
	return &InstructionCounter{
		limit: limit,
	}
}

// Increment 增加计数
func (ic *InstructionCounter) Increment(n int64) error {
	newCount := atomic.AddInt64(&ic.count, n)
	if newCount > ic.limit {
		return errors.New("instruction limit exceeded")
	}
	return nil
}

// Count 获取当前计数
func (ic *InstructionCounter) Count() int64 {
	return atomic.LoadInt64(&ic.count)
}

// Reset 重置计数
func (ic *InstructionCounter) Reset() {
	atomic.StoreInt64(&ic.count, 0)
}

// TimeoutGuard 超时守卫
type TimeoutGuard struct {
	timeout  time.Duration
	timer    *time.Timer
	expired  int32
	canceled int32
}

// NewTimeoutGuard 创建超时守卫
func NewTimeoutGuard(timeout time.Duration) *TimeoutGuard {
	return &TimeoutGuard{
		timeout: timeout,
	}
}

// Start 启动超时计时器
func (tg *TimeoutGuard) Start() {
	tg.timer = time.AfterFunc(tg.timeout, func() {
		if atomic.LoadInt32(&tg.canceled) == 0 {
			atomic.StoreInt32(&tg.expired, 1)
		}
	})
}

// Cancel 取消超时计时器
func (tg *TimeoutGuard) Cancel() {
	atomic.StoreInt32(&tg.canceled, 1)
	if tg.timer != nil {
		tg.timer.Stop()
	}
}

// IsExpired 检查是否已超时
func (tg *TimeoutGuard) IsExpired() bool {
	return atomic.LoadInt32(&tg.expired) == 1
}
