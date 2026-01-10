// Package metrics 提供 Serverless 函数的指标收集和导出功能
package metrics

import (
	"time"
)

// RequestResult 请求结果
type RequestResult string

const (
	// ResultSuccess 请求成功
	ResultSuccess RequestResult = "success"
	// ResultError 请求错误
	ResultError RequestResult = "error"
	// ResultTimeout 请求超时
	ResultTimeout RequestResult = "timeout"
	// ResultRejected 请求被拒绝（断路器打开）
	ResultRejected RequestResult = "rejected"
)

// RequestMetric 单次请求指标
type RequestMetric struct {
	// FunctionName 函数名称
	FunctionName string
	// Runtime 运行时类型 (quickjs/wasm)
	Runtime string
	// Duration 执行时长
	Duration time.Duration
	// Result 执行结果
	Result RequestResult
	// Timestamp 时间戳
	Timestamp time.Time
	// MemoryUsed 内存使用量（字节）
	MemoryUsed int64
	// ColdStart 是否为冷启动
	ColdStart bool
}

// PoolStats 实例池统计
type PoolStats struct {
	// Size 当前池大小
	Size int
	// Available 可用实例数
	Available int
	// InUse 使用中实例数
	InUse int
	// WaitingRequests 等待中的请求数
	WaitingRequests int
	// TotalCreated 总共创建的实例数
	TotalCreated int64
	// TotalDestroyed 总共销毁的实例数
	TotalDestroyed int64
}

// MemoryStats 内存统计
type MemoryStats struct {
	// TotalAllocated 总分配内存（字节）
	TotalAllocated int64
	// TotalFreed 总释放内存（字节）
	TotalFreed int64
	// CurrentUsage 当前使用量（字节）
	CurrentUsage int64
	// PeakUsage 峰值使用量（字节）
	PeakUsage int64
}

// LatencyHistogram 延迟直方图
type LatencyHistogram struct {
	// Buckets 桶边界（毫秒）
	Buckets []float64
	// Counts 每个桶的计数
	Counts []int64
	// Sum 总延迟（用于计算平均值）
	Sum float64
	// Count 总请求数
	Count int64
	// Min 最小延迟
	Min float64
	// Max 最大延迟
	Max float64
}

// DefaultLatencyBuckets 返回默认延迟桶边界（毫秒）
// 覆盖 1ms 到 10s 的范围
func DefaultLatencyBuckets() []float64 {
	return []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000}
}

// Stats 综合统计信息
type Stats struct {
	// StartTime 统计开始时间
	StartTime time.Time
	// TotalRequests 总请求数
	TotalRequests int64
	// SuccessRequests 成功请求数
	SuccessRequests int64
	// ErrorRequests 错误请求数
	ErrorRequests int64
	// TimeoutRequests 超时请求数
	TimeoutRequests int64
	// RejectedRequests 被拒绝请求数
	RejectedRequests int64
	// LatencyHistogram 延迟直方图
	LatencyHistogram LatencyHistogram
	// PoolStats 池统计
	PoolStats PoolStats
	// MemoryStats 内存统计
	MemoryStats MemoryStats
	// ColdStarts 冷启动次数
	ColdStarts int64
	// ByFunction 按函数分组的统计
	ByFunction map[string]*FunctionStats
	// ByRuntime 按运行时分组的统计
	ByRuntime map[string]*RuntimeStats
}

// FunctionStats 单个函数的统计
type FunctionStats struct {
	// Name 函数名称
	Name string
	// TotalRequests 总请求数
	TotalRequests int64
	// SuccessRequests 成功请求数
	SuccessRequests int64
	// ErrorRequests 错误请求数
	ErrorRequests int64
	// AvgLatency 平均延迟（毫秒）
	AvgLatency float64
	// P50Latency P50 延迟（毫秒）
	P50Latency float64
	// P95Latency P95 延迟（毫秒）
	P95Latency float64
	// P99Latency P99 延迟（毫秒）
	P99Latency float64
}

// RuntimeStats 单个运行时的统计
type RuntimeStats struct {
	// Runtime 运行时类型
	Runtime string
	// TotalRequests 总请求数
	TotalRequests int64
	// AvgLatency 平均延迟（毫秒）
	AvgLatency float64
	// AvgMemory 平均内存使用（字节）
	AvgMemory float64
}

// WindowStats 滑动窗口统计
type WindowStats struct {
	// WindowSize 窗口大小
	WindowSize time.Duration
	// RequestRate 请求速率（每秒）
	RequestRate float64
	// ErrorRate 错误率 (0-1)
	ErrorRate float64
	// AvgLatency 平均延迟（毫秒）
	AvgLatency float64
	// P95Latency P95 延迟（毫秒）
	P95Latency float64
}

// Collector 指标收集器接口
type Collector interface {
	// RecordRequest 记录请求指标
	RecordRequest(metric RequestMetric)
	// UpdatePoolStats 更新池统计
	UpdatePoolStats(stats PoolStats)
	// UpdateMemoryStats 更新内存统计
	UpdateMemoryStats(stats MemoryStats)
	// GetStats 获取综合统计
	GetStats() Stats
	// GetWindowStats 获取滑动窗口统计
	GetWindowStats(window time.Duration) WindowStats
	// Reset 重置所有统计
	Reset()
}

// MetricsConfig 指标收集配置
type MetricsConfig struct {
	// WindowSize 滑动窗口大小
	WindowSize time.Duration
	// MaxRecentRequests 最大保留的最近请求数
	MaxRecentRequests int
	// LatencyBuckets 延迟直方图桶边界
	LatencyBuckets []float64
}

// DefaultMetricsConfig 返回默认指标配置
func DefaultMetricsConfig() MetricsConfig {
	return MetricsConfig{
		WindowSize:        5 * time.Minute,
		MaxRecentRequests: 10000,
		LatencyBuckets:    DefaultLatencyBuckets(),
	}
}
