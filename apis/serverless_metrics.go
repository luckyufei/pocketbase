package apis

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/metrics"
)

// MetricsResponse 指标 API 响应
type MetricsResponse struct {
	// TotalRequests 总请求数
	TotalRequests int64 `json:"totalRequests"`
	// SuccessCount 成功请求数
	SuccessCount int64 `json:"successCount"`
	// ErrorCount 错误请求数
	ErrorCount int64 `json:"errorCount"`
	// TimeoutCount 超时请求数
	TimeoutCount int64 `json:"timeoutCount"`
	// RejectedCount 被拒绝请求数
	RejectedCount int64 `json:"rejectedCount"`
	// ColdStarts 冷启动次数
	ColdStarts int64 `json:"coldStarts"`
	// Uptime 运行时长（秒）
	Uptime float64 `json:"uptime"`
	// Latency 延迟统计
	Latency LatencyStats `json:"latency"`
	// Pool 池统计
	Pool PoolStatsResponse `json:"pool"`
	// Memory 内存统计
	Memory MemoryStatsResponse `json:"memory"`
	// Window 滑动窗口统计
	Window WindowStatsResponse `json:"window"`
	// ByFunction 按函数分组的统计
	ByFunction map[string]*FunctionStatsResponse `json:"byFunction"`
	// ByRuntime 按运行时分组的统计
	ByRuntime map[string]*RuntimeStatsResponse `json:"byRuntime"`
}

// LatencyStats 延迟统计
type LatencyStats struct {
	// Min 最小延迟（毫秒）
	Min float64 `json:"min"`
	// Max 最大延迟（毫秒）
	Max float64 `json:"max"`
	// Avg 平均延迟（毫秒）
	Avg float64 `json:"avg"`
	// Buckets 桶边界
	Buckets []float64 `json:"buckets"`
	// Counts 每个桶的计数
	Counts []int64 `json:"counts"`
}

// PoolStatsResponse 池统计响应
type PoolStatsResponse struct {
	// Size 当前池大小
	Size int `json:"size"`
	// Available 可用实例数
	Available int `json:"available"`
	// InUse 使用中实例数
	InUse int `json:"inUse"`
	// WaitingRequests 等待中的请求数
	WaitingRequests int `json:"waitingRequests"`
	// TotalCreated 总共创建的实例数
	TotalCreated int64 `json:"totalCreated"`
	// TotalDestroyed 总共销毁的实例数
	TotalDestroyed int64 `json:"totalDestroyed"`
}

// MemoryStatsResponse 内存统计响应
type MemoryStatsResponse struct {
	// TotalAllocated 总分配内存（字节）
	TotalAllocated int64 `json:"totalAllocated"`
	// TotalFreed 总释放内存（字节）
	TotalFreed int64 `json:"totalFreed"`
	// CurrentUsage 当前使用量（字节）
	CurrentUsage int64 `json:"currentUsage"`
	// PeakUsage 峰值使用量（字节）
	PeakUsage int64 `json:"peakUsage"`
}

// WindowStatsResponse 滑动窗口统计响应
type WindowStatsResponse struct {
	// WindowSize 窗口大小（秒）
	WindowSize float64 `json:"windowSize"`
	// RequestRate 请求速率（每秒）
	RequestRate float64 `json:"requestRate"`
	// ErrorRate 错误率 (0-1)
	ErrorRate float64 `json:"errorRate"`
	// AvgLatency 平均延迟（毫秒）
	AvgLatency float64 `json:"avgLatency"`
	// P95Latency P95 延迟（毫秒）
	P95Latency float64 `json:"p95Latency"`
}

// FunctionStatsResponse 函数统计响应
type FunctionStatsResponse struct {
	// TotalRequests 总请求数
	TotalRequests int64 `json:"totalRequests"`
	// SuccessRequests 成功请求数
	SuccessRequests int64 `json:"successRequests"`
	// ErrorRequests 错误请求数
	ErrorRequests int64 `json:"errorRequests"`
	// AvgLatency 平均延迟（毫秒）
	AvgLatency float64 `json:"avgLatency"`
	// P50Latency P50 延迟（毫秒）
	P50Latency float64 `json:"p50Latency"`
	// P95Latency P95 延迟（毫秒）
	P95Latency float64 `json:"p95Latency"`
	// P99Latency P99 延迟（毫秒）
	P99Latency float64 `json:"p99Latency"`
}

// RuntimeStatsResponse 运行时统计响应
type RuntimeStatsResponse struct {
	// TotalRequests 总请求数
	TotalRequests int64 `json:"totalRequests"`
	// AvgLatency 平均延迟（毫秒）
	AvgLatency float64 `json:"avgLatency"`
	// AvgMemory 平均内存使用（字节）
	AvgMemory float64 `json:"avgMemory"`
}

// ServerlessMetricsHandler 指标处理器
type ServerlessMetricsHandler struct {
	collector metrics.Collector
}

// NewServerlessMetricsHandler 创建新的指标处理器
func NewServerlessMetricsHandler(collector metrics.Collector) *ServerlessMetricsHandler {
	return &ServerlessMetricsHandler{
		collector: collector,
	}
}

// ServeHTTP 实现 http.Handler 接口
func (h *ServerlessMetricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	// 解析窗口参数
	windowStr := r.URL.Query().Get("window")
	window := 5 * time.Minute // 默认 5 分钟
	if windowStr != "" {
		if d, err := time.ParseDuration(windowStr); err == nil {
			window = d
		}
	}

	// 获取统计数据
	stats := h.collector.GetStats()
	windowStats := h.collector.GetWindowStats(window)

	// 构建响应
	resp := MetricsResponse{
		TotalRequests: stats.TotalRequests,
		SuccessCount:  stats.SuccessRequests,
		ErrorCount:    stats.ErrorRequests,
		TimeoutCount:  stats.TimeoutRequests,
		RejectedCount: stats.RejectedRequests,
		ColdStarts:    stats.ColdStarts,
		Uptime:        time.Since(stats.StartTime).Seconds(),
		Latency: LatencyStats{
			Min:     stats.LatencyHistogram.Min,
			Max:     stats.LatencyHistogram.Max,
			Avg:     calculateAvg(stats.LatencyHistogram.Sum, stats.LatencyHistogram.Count),
			Buckets: stats.LatencyHistogram.Buckets,
			Counts:  stats.LatencyHistogram.Counts,
		},
		Pool: PoolStatsResponse{
			Size:            stats.PoolStats.Size,
			Available:       stats.PoolStats.Available,
			InUse:           stats.PoolStats.InUse,
			WaitingRequests: stats.PoolStats.WaitingRequests,
			TotalCreated:    stats.PoolStats.TotalCreated,
			TotalDestroyed:  stats.PoolStats.TotalDestroyed,
		},
		Memory: MemoryStatsResponse{
			TotalAllocated: stats.MemoryStats.TotalAllocated,
			TotalFreed:     stats.MemoryStats.TotalFreed,
			CurrentUsage:   stats.MemoryStats.CurrentUsage,
			PeakUsage:      stats.MemoryStats.PeakUsage,
		},
		Window: WindowStatsResponse{
			WindowSize:  window.Seconds(),
			RequestRate: windowStats.RequestRate,
			ErrorRate:   windowStats.ErrorRate,
			AvgLatency:  windowStats.AvgLatency,
			P95Latency:  windowStats.P95Latency,
		},
		ByFunction: make(map[string]*FunctionStatsResponse),
		ByRuntime:  make(map[string]*RuntimeStatsResponse),
	}

	// 转换函数统计
	for name, fs := range stats.ByFunction {
		resp.ByFunction[name] = &FunctionStatsResponse{
			TotalRequests:   fs.TotalRequests,
			SuccessRequests: fs.SuccessRequests,
			ErrorRequests:   fs.ErrorRequests,
			AvgLatency:      fs.AvgLatency,
			P50Latency:      fs.P50Latency,
			P95Latency:      fs.P95Latency,
			P99Latency:      fs.P99Latency,
		}
	}

	// 转换运行时统计
	for name, rs := range stats.ByRuntime {
		resp.ByRuntime[name] = &RuntimeStatsResponse{
			TotalRequests: rs.TotalRequests,
			AvgLatency:    rs.AvgLatency,
			AvgMemory:     rs.AvgMemory,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

// calculateAvg 计算平均值
func calculateAvg(sum float64, count int64) float64 {
	if count == 0 {
		return 0
	}
	return sum / float64(count)
}
