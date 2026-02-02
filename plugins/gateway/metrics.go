// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"fmt"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// HistogramBuckets Prometheus histogram 桶配置 (T038a)
// le="0.01", "0.05", "0.1", "0.25", "0.5", "1", "2.5", "5", "10"
var HistogramBuckets = []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

// ProxyStats 代理统计信息
type ProxyStats struct {
	RequestsTotal int64         // 总请求数
	ErrorsTotal   int64         // 错误数（5xx）
	AvgLatency    time.Duration // 平均延迟
}

// SuccessRate 返回成功率
func (s ProxyStats) SuccessRate() float64 {
	if s.RequestsTotal == 0 {
		return 0
	}
	return float64(s.RequestsTotal-s.ErrorsTotal) / float64(s.RequestsTotal)
}

// proxyMetrics 单个代理的指标
type proxyMetrics struct {
	requestsTotal int64
	errorsTotal   int64
	latencySumNs  int64  // 延迟总和（纳秒）
	latencyCount  int64  // 延迟计数
	activeConns   int64  // 活跃连接数
	circuitState  int64  // 熔断状态
	histogram     []int64 // histogram buckets
}

// MetricsCollector 指标收集器
// 使用 atomic 实现无 Prometheus 依赖版本
//
// FR-018: /api/gateway/metrics 端点
// FR-019, FR-020: 指标定义
type MetricsCollector struct {
	mu      sync.RWMutex
	proxies map[string]*proxyMetrics
}

// NewMetricsCollector 创建指标收集器
//
// T039: 实现创建
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		proxies: make(map[string]*proxyMetrics),
	}
}

// getOrCreateProxy 获取或创建代理指标（需要持有写锁）
func (mc *MetricsCollector) getOrCreateProxy(proxyName string) *proxyMetrics {
	pm, ok := mc.proxies[proxyName]
	if !ok {
		pm = &proxyMetrics{
			histogram: make([]int64, len(HistogramBuckets)+1), // +1 for +Inf
		}
		mc.proxies[proxyName] = pm
	}
	return pm
}

// RecordRequest 记录请求
//
// T040: 实现请求记录
// FR-019: requests_total, errors_total, latency
func (mc *MetricsCollector) RecordRequest(proxyName string, statusCode int, duration time.Duration) {
	if mc == nil {
		return
	}

	mc.mu.Lock()
	pm := mc.getOrCreateProxy(proxyName)
	mc.mu.Unlock()

	// 使用 atomic 更新
	atomic.AddInt64(&pm.requestsTotal, 1)

	// 5xx 错误
	if statusCode >= 500 {
		atomic.AddInt64(&pm.errorsTotal, 1)
	}

	// 延迟统计
	atomic.AddInt64(&pm.latencySumNs, int64(duration))
	atomic.AddInt64(&pm.latencyCount, 1)

	// 更新 histogram
	durationSec := duration.Seconds()
	for i, bucket := range HistogramBuckets {
		if durationSec <= bucket {
			atomic.AddInt64(&pm.histogram[i], 1)
			break
		}
	}
	// +Inf bucket
	atomic.AddInt64(&pm.histogram[len(HistogramBuckets)], 1)
}

// IncrActiveConns 增加活跃连接数
//
// T041: 实现活跃连接计数
// FR-020: active_connections
func (mc *MetricsCollector) IncrActiveConns(proxyName string) {
	if mc == nil {
		return
	}

	mc.mu.Lock()
	pm := mc.getOrCreateProxy(proxyName)
	mc.mu.Unlock()

	atomic.AddInt64(&pm.activeConns, 1)
}

// DecrActiveConns 减少活跃连接数
func (mc *MetricsCollector) DecrActiveConns(proxyName string) {
	if mc == nil {
		return
	}

	mc.mu.Lock()
	pm := mc.getOrCreateProxy(proxyName)
	mc.mu.Unlock()

	atomic.AddInt64(&pm.activeConns, -1)
}

// GetActiveConns 获取活跃连接数
func (mc *MetricsCollector) GetActiveConns(proxyName string) int64 {
	if mc == nil {
		return 0
	}

	mc.mu.RLock()
	pm, ok := mc.proxies[proxyName]
	mc.mu.RUnlock()

	if !ok {
		return 0
	}
	return atomic.LoadInt64(&pm.activeConns)
}

// SetCircuitState 设置熔断状态
//
// T042: 实现熔断状态记录
// FR-020: circuit_breaker_state
func (mc *MetricsCollector) SetCircuitState(proxyName string, state CircuitState) {
	if mc == nil {
		return
	}

	mc.mu.Lock()
	pm := mc.getOrCreateProxy(proxyName)
	mc.mu.Unlock()

	atomic.StoreInt64(&pm.circuitState, int64(state))
}

// GetCircuitState 获取熔断状态
func (mc *MetricsCollector) GetCircuitState(proxyName string) CircuitState {
	if mc == nil {
		return CircuitClosed
	}

	mc.mu.RLock()
	pm, ok := mc.proxies[proxyName]
	mc.mu.RUnlock()

	if !ok {
		return CircuitClosed
	}
	return CircuitState(atomic.LoadInt64(&pm.circuitState))
}

// GetStats 获取代理统计信息
func (mc *MetricsCollector) GetStats(proxyName string) ProxyStats {
	if mc == nil {
		return ProxyStats{}
	}

	mc.mu.RLock()
	pm, ok := mc.proxies[proxyName]
	mc.mu.RUnlock()

	if !ok {
		return ProxyStats{}
	}

	requestsTotal := atomic.LoadInt64(&pm.requestsTotal)
	errorsTotal := atomic.LoadInt64(&pm.errorsTotal)
	latencySumNs := atomic.LoadInt64(&pm.latencySumNs)
	latencyCount := atomic.LoadInt64(&pm.latencyCount)

	var avgLatency time.Duration
	if latencyCount > 0 {
		avgLatency = time.Duration(latencySumNs / latencyCount)
	}

	return ProxyStats{
		RequestsTotal: requestsTotal,
		ErrorsTotal:   errorsTotal,
		AvgLatency:    avgLatency,
	}
}

// Reset 重置统计（保留活跃连接）
func (mc *MetricsCollector) Reset() {
	if mc == nil {
		return
	}

	mc.mu.Lock()
	defer mc.mu.Unlock()

	for _, pm := range mc.proxies {
		atomic.StoreInt64(&pm.requestsTotal, 0)
		atomic.StoreInt64(&pm.errorsTotal, 0)
		atomic.StoreInt64(&pm.latencySumNs, 0)
		atomic.StoreInt64(&pm.latencyCount, 0)
		for i := range pm.histogram {
			atomic.StoreInt64(&pm.histogram[i], 0)
		}
		// 不重置 activeConns 和 circuitState
	}
}

// ServeHTTP 输出 Prometheus 格式指标
//
// T043: 实现 ServeHTTP
// FR-018: /api/gateway/metrics 端点
func (mc *MetricsCollector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if mc == nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	mc.mu.RLock()
	// 获取代理名称列表并排序（确保输出稳定）
	proxyNames := make([]string, 0, len(mc.proxies))
	for name := range mc.proxies {
		proxyNames = append(proxyNames, name)
	}
	mc.mu.RUnlock()

	sort.Strings(proxyNames)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// HELP 和 TYPE 声明
	fmt.Fprintln(w, "# HELP gateway_requests_total Total number of requests")
	fmt.Fprintln(w, "# TYPE gateway_requests_total counter")

	fmt.Fprintln(w, "# HELP gateway_errors_total Total number of errors (5xx)")
	fmt.Fprintln(w, "# TYPE gateway_errors_total counter")

	fmt.Fprintln(w, "# HELP gateway_active_connections Current number of active connections")
	fmt.Fprintln(w, "# TYPE gateway_active_connections gauge")

	fmt.Fprintln(w, "# HELP gateway_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)")
	fmt.Fprintln(w, "# TYPE gateway_circuit_breaker_state gauge")

	fmt.Fprintln(w, "# HELP gateway_request_duration_seconds Request duration histogram")
	fmt.Fprintln(w, "# TYPE gateway_request_duration_seconds histogram")

	// 输出每个代理的指标
	for _, name := range proxyNames {
		mc.mu.RLock()
		pm := mc.proxies[name]
		mc.mu.RUnlock()

		if pm == nil {
			continue
		}

		requestsTotal := atomic.LoadInt64(&pm.requestsTotal)
		errorsTotal := atomic.LoadInt64(&pm.errorsTotal)
		activeConns := atomic.LoadInt64(&pm.activeConns)
		circuitState := atomic.LoadInt64(&pm.circuitState)
		latencySumNs := atomic.LoadInt64(&pm.latencySumNs)
		latencyCount := atomic.LoadInt64(&pm.latencyCount)

		fmt.Fprintf(w, "gateway_requests_total{proxy=\"%s\"} %d\n", name, requestsTotal)
		fmt.Fprintf(w, "gateway_errors_total{proxy=\"%s\"} %d\n", name, errorsTotal)
		fmt.Fprintf(w, "gateway_active_connections{proxy=\"%s\"} %d\n", name, activeConns)
		fmt.Fprintf(w, "gateway_circuit_breaker_state{proxy=\"%s\"} %d\n", name, circuitState)

		// Histogram buckets
		var cumulative int64 = 0
		for i, bucket := range HistogramBuckets {
			cumulative += atomic.LoadInt64(&pm.histogram[i])
			fmt.Fprintf(w, "gateway_request_duration_seconds_bucket{proxy=\"%s\",le=\"%.2g\"} %d\n", name, bucket, cumulative)
		}
		cumulative += atomic.LoadInt64(&pm.histogram[len(HistogramBuckets)])
		fmt.Fprintf(w, "gateway_request_duration_seconds_bucket{proxy=\"%s\",le=\"+Inf\"} %d\n", name, cumulative)

		// Sum 和 Count
		fmt.Fprintf(w, "gateway_request_duration_seconds_sum{proxy=\"%s\"} %.6f\n", name, float64(latencySumNs)/1e9)
		fmt.Fprintf(w, "gateway_request_duration_seconds_count{proxy=\"%s\"} %d\n", name, latencyCount)
	}
}
