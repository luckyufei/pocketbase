package jsvm

import (
	"context"
	"log/slog"
	"runtime"
	"sync/atomic"
	"time"

	"github.com/dop251/goja"
)

// JSVMMetrics 执行监控指标
type JSVMMetrics struct {
	HookName      string        // Hook 名称，如 "onRecordCreate"
	Collection    string        // 关联集合，如 "posts"
	Duration      time.Duration // 执行耗时
	MemAllocBytes int64         // 近似内存分配（字节）
	CacheHit      bool          // 预编译缓存命中
	Error         string        // 错误信息（如有）
	Timeout       bool          // 是否超时
}

// MetricsStats 统计信息
type MetricsStats struct {
	TotalExecutions int64 // 总执行次数
	TotalErrors     int64 // 错误次数
	TotalTimeouts   int64 // 超时次数
}

// MetricsCollector 监控收集器
type MetricsCollector struct {
	enabled bool
	logger  *slog.Logger

	// 统计计数器
	totalExecutions int64
	totalErrors     int64
	totalTimeouts   int64
}

// NewMetricsCollector 创建新的监控收集器
func NewMetricsCollector(enabled bool, logger *slog.Logger) *MetricsCollector {
	return &MetricsCollector{
		enabled: enabled,
		logger:  logger,
	}
}

// Record 记录执行指标
func (c *MetricsCollector) Record(m *JSVMMetrics) {
	if !c.enabled || c.logger == nil {
		return
	}

	// 更新统计
	atomic.AddInt64(&c.totalExecutions, 1)
	if m.Error != "" {
		atomic.AddInt64(&c.totalErrors, 1)
	}
	if m.Timeout {
		atomic.AddInt64(&c.totalTimeouts, 1)
	}

	// 构建日志字段
	attrs := []slog.Attr{
		slog.String("hook", m.HookName),
		slog.String("collection", m.Collection),
		slog.Float64("duration_ms", float64(m.Duration.Microseconds())/1000.0),
	}

	if m.MemAllocBytes > 0 {
		attrs = append(attrs, slog.Float64("mem_alloc_kb", float64(m.MemAllocBytes)/1024.0))
	}

	if m.CacheHit {
		attrs = append(attrs, slog.Bool("cache_hit", m.CacheHit))
	}

	if m.Timeout {
		attrs = append(attrs, slog.Bool("timeout", m.Timeout))
	}

	if m.Error != "" {
		attrs = append(attrs, slog.String("error", m.Error))
	}

	// 根据状态选择日志级别
	level := slog.LevelInfo
	if m.Timeout {
		level = slog.LevelWarn
	} else if m.Error != "" {
		level = slog.LevelError
	}

	// 输出日志
	c.logger.LogAttrs(context.Background(), level, "jsvm execution", attrs...)
}

// GetStats 获取统计信息
func (c *MetricsCollector) GetStats() MetricsStats {
	return MetricsStats{
		TotalExecutions: atomic.LoadInt64(&c.totalExecutions),
		TotalErrors:     atomic.LoadInt64(&c.totalErrors),
		TotalTimeouts:   atomic.LoadInt64(&c.totalTimeouts),
	}
}

// Reset 重置统计
func (c *MetricsCollector) Reset() {
	atomic.StoreInt64(&c.totalExecutions, 0)
	atomic.StoreInt64(&c.totalErrors, 0)
	atomic.StoreInt64(&c.totalTimeouts, 0)
}

// NewSafeExecutorWithMetrics 创建带监控的安全执行器
func NewSafeExecutorWithMetrics(pool *vmsPool, defaultTimeout time.Duration, collector *MetricsCollector) *SafeExecutorWithMetrics {
	if defaultTimeout <= 0 {
		defaultTimeout = 5 * time.Second
	}
	return &SafeExecutorWithMetrics{
		pool:           pool,
		defaultTimeout: defaultTimeout,
		collector:      collector,
	}
}

// SafeExecutorWithMetrics 带监控的安全执行器
type SafeExecutorWithMetrics struct {
	pool           *vmsPool
	defaultTimeout time.Duration
	collector      *MetricsCollector
}

// ExecuteWithMetrics 执行脚本并记录监控指标
func (e *SafeExecutorWithMetrics) ExecuteWithMetrics(
	ctx context.Context,
	script string,
	opts *ExecuteOptions,
	hookName string,
	collection string,
) (goja.Value, error) {
	timeout := e.defaultTimeout
	if opts != nil && opts.Timeout > 0 {
		timeout = opts.Timeout
	}

	// 记录执行前的内存状态
	var memBefore runtime.MemStats
	if e.collector != nil && e.collector.enabled {
		runtime.ReadMemStats(&memBefore)
	}

	start := time.Now()
	var result goja.Value
	var execErr error
	var isTimeout bool

	err := e.pool.run(func(vm *goja.Runtime) error {
		vm.ClearInterrupt()

		execCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		done := make(chan struct{})
		go func() {
			select {
			case <-execCtx.Done():
				vm.Interrupt("execution timeout or cancelled")
				isTimeout = true
			case <-done:
			}
		}()

		result, execErr = vm.RunString(script)

		close(done)
		vm.ClearInterrupt()

		return execErr
	})

	duration := time.Since(start)

	// 记录监控指标
	if e.collector != nil {
		var memAfter runtime.MemStats
		var memAlloc int64
		if e.collector.enabled {
			runtime.ReadMemStats(&memAfter)
			memAlloc = int64(memAfter.Alloc) - int64(memBefore.Alloc)
			if memAlloc < 0 {
				memAlloc = 0 // GC 可能导致负值
			}
		}

		metrics := &JSVMMetrics{
			HookName:      hookName,
			Collection:    collection,
			Duration:      duration,
			MemAllocBytes: memAlloc,
			Timeout:       isTimeout,
		}

		if err != nil {
			metrics.Error = err.Error()
		} else if execErr != nil {
			metrics.Error = execErr.Error()
		}

		e.collector.Record(metrics)
	}

	if err != nil {
		return nil, err
	}

	return result, execErr
}
