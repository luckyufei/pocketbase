package metrics

import (
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// collector 指标收集器实现
type collector struct {
	mu sync.RWMutex

	startTime time.Time

	// 请求计数（使用原子操作）
	totalRequests    int64
	successRequests  int64
	errorRequests    int64
	timeoutRequests  int64
	rejectedRequests int64
	coldStarts       int64

	// 延迟直方图
	latencyHistogram latencyHistogramData

	// 池统计
	poolStats PoolStats

	// 内存统计
	memoryStats MemoryStats

	// 按函数分组统计
	byFunction map[string]*functionStatsData

	// 按运行时分组统计
	byRuntime map[string]*runtimeStatsData

	// 最近请求记录（用于滑动窗口统计）
	recentRequests []recentRequest
}

// latencyHistogramData 延迟直方图数据
type latencyHistogramData struct {
	buckets []float64
	counts  []int64
	sum     float64
	count   int64
	min     float64
	max     float64
}

// functionStatsData 函数统计数据
type functionStatsData struct {
	totalRequests   int64
	successRequests int64
	errorRequests   int64
	latencySum      float64
	latencies       []float64
}

// runtimeStatsData 运行时统计数据
type runtimeStatsData struct {
	totalRequests int64
	latencySum    float64
	memorySum     int64
}

// recentRequest 最近请求记录
type recentRequest struct {
	timestamp time.Time
	duration  time.Duration
	result    RequestResult
}

// NewCollector 创建新的指标收集器
func NewCollector() Collector {
	buckets := DefaultLatencyBuckets()
	return &collector{
		startTime: time.Now(),
		latencyHistogram: latencyHistogramData{
			buckets: buckets,
			counts:  make([]int64, len(buckets)+1),
			min:     math.MaxFloat64,
			max:     0,
		},
		byFunction:     make(map[string]*functionStatsData),
		byRuntime:      make(map[string]*runtimeStatsData),
		recentRequests: make([]recentRequest, 0, 1000),
	}
}

// NewMetricsCollector 创建新的指标收集器（带配置）
func NewMetricsCollector(config MetricsConfig) Collector {
	buckets := config.LatencyBuckets
	if len(buckets) == 0 {
		buckets = DefaultLatencyBuckets()
	}
	maxRecent := config.MaxRecentRequests
	if maxRecent <= 0 {
		maxRecent = 10000
	}
	return &collector{
		startTime: time.Now(),
		latencyHistogram: latencyHistogramData{
			buckets: buckets,
			counts:  make([]int64, len(buckets)+1),
			min:     math.MaxFloat64,
			max:     0,
		},
		byFunction:     make(map[string]*functionStatsData),
		byRuntime:      make(map[string]*runtimeStatsData),
		recentRequests: make([]recentRequest, 0, maxRecent),
	}
}

// RecordRequest 记录请求指标
func (c *collector) RecordRequest(metric RequestMetric) {
	atomic.AddInt64(&c.totalRequests, 1)

	switch metric.Result {
	case ResultSuccess:
		atomic.AddInt64(&c.successRequests, 1)
	case ResultError:
		atomic.AddInt64(&c.errorRequests, 1)
	case ResultTimeout:
		atomic.AddInt64(&c.timeoutRequests, 1)
	case ResultRejected:
		atomic.AddInt64(&c.rejectedRequests, 1)
	}

	if metric.ColdStart {
		atomic.AddInt64(&c.coldStarts, 1)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	latencyMs := float64(metric.Duration.Milliseconds())

	c.updateLatencyHistogram(latencyMs)
	c.updateFunctionStats(metric.FunctionName, metric.Result, latencyMs)
	c.updateRuntimeStats(metric.Runtime, latencyMs, metric.MemoryUsed)

	c.recentRequests = append(c.recentRequests, recentRequest{
		timestamp: metric.Timestamp,
		duration:  metric.Duration,
		result:    metric.Result,
	})

	if len(c.recentRequests) > 10000 {
		c.recentRequests = c.recentRequests[len(c.recentRequests)-5000:]
	}
}

// updateLatencyHistogram 更新延迟直方图
func (c *collector) updateLatencyHistogram(latencyMs float64) {
	c.latencyHistogram.sum += latencyMs
	c.latencyHistogram.count++

	if latencyMs < c.latencyHistogram.min {
		c.latencyHistogram.min = latencyMs
	}
	if latencyMs > c.latencyHistogram.max {
		c.latencyHistogram.max = latencyMs
	}

	bucketIdx := len(c.latencyHistogram.buckets)
	for i, boundary := range c.latencyHistogram.buckets {
		if latencyMs <= boundary {
			bucketIdx = i
			break
		}
	}
	c.latencyHistogram.counts[bucketIdx]++
}

// updateFunctionStats 更新函数统计
func (c *collector) updateFunctionStats(funcName string, result RequestResult, latencyMs float64) {
	if funcName == "" {
		return
	}

	stats, ok := c.byFunction[funcName]
	if !ok {
		stats = &functionStatsData{
			latencies: make([]float64, 0, 100),
		}
		c.byFunction[funcName] = stats
	}

	stats.totalRequests++
	stats.latencySum += latencyMs
	stats.latencies = append(stats.latencies, latencyMs)

	if len(stats.latencies) > 1000 {
		stats.latencies = stats.latencies[len(stats.latencies)-500:]
	}

	switch result {
	case ResultSuccess:
		stats.successRequests++
	case ResultError, ResultTimeout:
		stats.errorRequests++
	}
}

// updateRuntimeStats 更新运行时统计
func (c *collector) updateRuntimeStats(runtime string, latencyMs float64, memoryUsed int64) {
	if runtime == "" {
		return
	}

	stats, ok := c.byRuntime[runtime]
	if !ok {
		stats = &runtimeStatsData{}
		c.byRuntime[runtime] = stats
	}

	stats.totalRequests++
	stats.latencySum += latencyMs
	stats.memorySum += memoryUsed
}

// UpdatePoolStats 更新池统计
func (c *collector) UpdatePoolStats(stats PoolStats) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.poolStats = stats
}

// UpdateMemoryStats 更新内存统计
func (c *collector) UpdateMemoryStats(stats MemoryStats) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.memoryStats = stats
}

// GetStats 获取综合统计
func (c *collector) GetStats() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	histogram := LatencyHistogram{
		Buckets: c.latencyHistogram.buckets,
		Counts:  make([]int64, len(c.latencyHistogram.counts)),
		Sum:     c.latencyHistogram.sum,
		Count:   c.latencyHistogram.count,
		Min:     c.latencyHistogram.min,
		Max:     c.latencyHistogram.max,
	}
	copy(histogram.Counts, c.latencyHistogram.counts)

	if histogram.Min == math.MaxFloat64 {
		histogram.Min = 0
	}

	byFunction := make(map[string]*FunctionStats)
	for name, data := range c.byFunction {
		avgLatency := float64(0)
		if data.totalRequests > 0 {
			avgLatency = data.latencySum / float64(data.totalRequests)
		}

		byFunction[name] = &FunctionStats{
			Name:            name,
			TotalRequests:   data.totalRequests,
			SuccessRequests: data.successRequests,
			ErrorRequests:   data.errorRequests,
			AvgLatency:      avgLatency,
			P50Latency:      calculatePercentile(data.latencies, 50),
			P95Latency:      calculatePercentile(data.latencies, 95),
			P99Latency:      calculatePercentile(data.latencies, 99),
		}
	}

	byRuntime := make(map[string]*RuntimeStats)
	for runtime, data := range c.byRuntime {
		avgLatency := float64(0)
		avgMemory := float64(0)
		if data.totalRequests > 0 {
			avgLatency = data.latencySum / float64(data.totalRequests)
			avgMemory = float64(data.memorySum) / float64(data.totalRequests)
		}

		byRuntime[runtime] = &RuntimeStats{
			Runtime:       runtime,
			TotalRequests: data.totalRequests,
			AvgLatency:    avgLatency,
			AvgMemory:     avgMemory,
		}
	}

	return Stats{
		StartTime:        c.startTime,
		TotalRequests:    atomic.LoadInt64(&c.totalRequests),
		SuccessRequests:  atomic.LoadInt64(&c.successRequests),
		ErrorRequests:    atomic.LoadInt64(&c.errorRequests),
		TimeoutRequests:  atomic.LoadInt64(&c.timeoutRequests),
		RejectedRequests: atomic.LoadInt64(&c.rejectedRequests),
		LatencyHistogram: histogram,
		PoolStats:        c.poolStats,
		MemoryStats:      c.memoryStats,
		ColdStarts:       atomic.LoadInt64(&c.coldStarts),
		ByFunction:       byFunction,
		ByRuntime:        byRuntime,
	}
}

// GetWindowStats 获取滑动窗口统计
func (c *collector) GetWindowStats(window time.Duration) WindowStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	now := time.Now()
	cutoff := now.Add(-window)

	var totalRequests, errorRequests int64
	var latencySum float64
	var latencies []float64

	for _, req := range c.recentRequests {
		if req.timestamp.After(cutoff) {
			totalRequests++
			latencyMs := float64(req.duration.Milliseconds())
			latencySum += latencyMs
			latencies = append(latencies, latencyMs)

			if req.result == ResultError || req.result == ResultTimeout {
				errorRequests++
			}
		}
	}

	requestRate := float64(0)
	errorRate := float64(0)
	avgLatency := float64(0)
	p95Latency := float64(0)

	if totalRequests > 0 {
		requestRate = float64(totalRequests) / window.Seconds()
		errorRate = float64(errorRequests) / float64(totalRequests)
		avgLatency = latencySum / float64(totalRequests)
		p95Latency = calculatePercentile(latencies, 95)
	}

	return WindowStats{
		WindowSize:  window,
		RequestRate: requestRate,
		ErrorRate:   errorRate,
		AvgLatency:  avgLatency,
		P95Latency:  p95Latency,
	}
}

// Reset 重置所有统计
func (c *collector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	atomic.StoreInt64(&c.totalRequests, 0)
	atomic.StoreInt64(&c.successRequests, 0)
	atomic.StoreInt64(&c.errorRequests, 0)
	atomic.StoreInt64(&c.timeoutRequests, 0)
	atomic.StoreInt64(&c.rejectedRequests, 0)
	atomic.StoreInt64(&c.coldStarts, 0)

	c.startTime = time.Now()
	c.latencyHistogram = latencyHistogramData{
		buckets: DefaultLatencyBuckets(),
		counts:  make([]int64, len(DefaultLatencyBuckets())+1),
		min:     math.MaxFloat64,
		max:     0,
	}
	c.poolStats = PoolStats{}
	c.memoryStats = MemoryStats{}
	c.byFunction = make(map[string]*functionStatsData)
	c.byRuntime = make(map[string]*runtimeStatsData)
	c.recentRequests = make([]recentRequest, 0, 1000)
}

// calculatePercentile 计算百分位数
func calculatePercentile(values []float64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	index := int(float64(len(sorted)-1) * percentile / 100)
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}

	return sorted[index]
}
