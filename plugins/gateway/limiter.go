// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"context"
	"time"
)

// ConcurrencyLimiter 并发限制器
// 使用 buffered channel 实现信号量模式
// 用于保护处理能力有限的后端服务（如 Python Sidecar）
//
// FR-010: 使用 buffered channel/semaphore 实现
type ConcurrencyLimiter struct {
	sem chan struct{}
	max int
}

// NewConcurrencyLimiter 创建并发限制器
// max <= 0 时返回 nil（表示不限制）
//
// T014: 实现信号量创建
func NewConcurrencyLimiter(max int) *ConcurrencyLimiter {
	if max <= 0 {
		return nil
	}

	return &ConcurrencyLimiter{
		sem: make(chan struct{}, max),
		max: max,
	}
}

// Acquire 非阻塞获取槽位
// 成功返回 true，超限返回 false
// nil limiter 总是返回 true（不限制）
//
// T015: 实现非阻塞获取
func (l *ConcurrencyLimiter) Acquire() bool {
	if l == nil {
		return true
	}

	select {
	case l.sem <- struct{}{}:
		return true
	default:
		return false
	}
}

// AcquireWithTimeout 带超时获取槽位（排队模式）
// 在超时时间内等待槽位，成功返回 true，超时返回 false
// nil limiter 总是返回 true
//
// T016: 实现带超时获取
func (l *ConcurrencyLimiter) AcquireWithTimeout(timeout time.Duration) bool {
	if l == nil {
		return true
	}

	select {
	case l.sem <- struct{}{}:
		return true
	case <-time.After(timeout):
		return false
	}
}

// AcquireBlocking 阻塞式获取槽位
// 支持 context 取消，返回 error 表示取消原因
// nil limiter 总是返回 nil
//
// T016a: 实现阻塞式获取（支持 context 取消）
func (l *ConcurrencyLimiter) AcquireBlocking(ctx context.Context) error {
	if l == nil {
		return nil
	}

	select {
	case l.sem <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Release 释放槽位
// nil limiter 安全调用（no-op）
//
// T017: 实现释放
func (l *ConcurrencyLimiter) Release() {
	if l == nil {
		return
	}

	select {
	case <-l.sem:
	default:
		// 防止 Release 调用次数超过 Acquire
		// 这不应该发生，但做个保护
	}
}

// Available 返回可用槽位数
// nil limiter 返回 -1
//
// T018: 实现可用槽位查询
func (l *ConcurrencyLimiter) Available() int {
	if l == nil {
		return -1
	}

	return l.max - len(l.sem)
}

// InUse 返回当前使用中的槽位数
// nil limiter 返回 0
func (l *ConcurrencyLimiter) InUse() int {
	if l == nil {
		return 0
	}

	return len(l.sem)
}

// Max 返回最大并发数
// nil limiter 返回 0
func (l *ConcurrencyLimiter) Max() int {
	if l == nil {
		return 0
	}

	return l.max
}
