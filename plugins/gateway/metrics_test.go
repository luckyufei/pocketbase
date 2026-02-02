package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// TestNewMetricsCollector 验证创建
func TestNewMetricsCollector(t *testing.T) {
	mc := NewMetricsCollector()
	if mc == nil {
		t.Fatal("NewMetricsCollector should not return nil")
	}
}

// TestMetricsCollectorRecordRequest 验证请求记录
func TestMetricsCollectorRecordRequest(t *testing.T) {
	mc := NewMetricsCollector()

	// 记录请求
	mc.RecordRequest("proxy1", 200, 100*time.Millisecond)
	mc.RecordRequest("proxy1", 200, 200*time.Millisecond)
	mc.RecordRequest("proxy1", 500, 50*time.Millisecond)
	mc.RecordRequest("proxy2", 200, 150*time.Millisecond)

	// 验证计数
	stats := mc.GetStats("proxy1")
	if stats.RequestsTotal != 3 {
		t.Errorf("proxy1 RequestsTotal: want 3, got %d", stats.RequestsTotal)
	}
	if stats.ErrorsTotal != 1 {
		t.Errorf("proxy1 ErrorsTotal: want 1 (500 error), got %d", stats.ErrorsTotal)
	}

	stats2 := mc.GetStats("proxy2")
	if stats2.RequestsTotal != 1 {
		t.Errorf("proxy2 RequestsTotal: want 1, got %d", stats2.RequestsTotal)
	}
}

// TestMetricsCollectorActiveConns 验证活跃连接计数
func TestMetricsCollectorActiveConns(t *testing.T) {
	mc := NewMetricsCollector()

	// 初始为 0
	if mc.GetActiveConns("proxy1") != 0 {
		t.Error("Initial active conns should be 0")
	}

	// 增加
	mc.IncrActiveConns("proxy1")
	mc.IncrActiveConns("proxy1")
	mc.IncrActiveConns("proxy1")

	if mc.GetActiveConns("proxy1") != 3 {
		t.Errorf("After 3 incr: want 3, got %d", mc.GetActiveConns("proxy1"))
	}

	// 减少
	mc.DecrActiveConns("proxy1")

	if mc.GetActiveConns("proxy1") != 2 {
		t.Errorf("After 1 decr: want 2, got %d", mc.GetActiveConns("proxy1"))
	}

	// 不同代理独立计数
	mc.IncrActiveConns("proxy2")
	if mc.GetActiveConns("proxy2") != 1 {
		t.Errorf("proxy2: want 1, got %d", mc.GetActiveConns("proxy2"))
	}
}

// TestMetricsCollectorCircuitState 验证熔断状态记录
func TestMetricsCollectorCircuitState(t *testing.T) {
	mc := NewMetricsCollector()

	// 设置状态
	mc.SetCircuitState("proxy1", CircuitClosed)
	if mc.GetCircuitState("proxy1") != CircuitClosed {
		t.Errorf("proxy1 state: want Closed, got %v", mc.GetCircuitState("proxy1"))
	}

	mc.SetCircuitState("proxy1", CircuitOpen)
	if mc.GetCircuitState("proxy1") != CircuitOpen {
		t.Errorf("proxy1 state: want Open, got %v", mc.GetCircuitState("proxy1"))
	}

	mc.SetCircuitState("proxy2", CircuitHalfOpen)
	if mc.GetCircuitState("proxy2") != CircuitHalfOpen {
		t.Errorf("proxy2 state: want HalfOpen, got %v", mc.GetCircuitState("proxy2"))
	}
}

// TestMetricsCollectorLatency 验证延迟统计
func TestMetricsCollectorLatency(t *testing.T) {
	mc := NewMetricsCollector()

	// 记录多个请求
	mc.RecordRequest("proxy1", 200, 100*time.Millisecond)
	mc.RecordRequest("proxy1", 200, 200*time.Millisecond)
	mc.RecordRequest("proxy1", 200, 300*time.Millisecond)

	stats := mc.GetStats("proxy1")

	// 平均延迟应该是 200ms
	expectedAvg := 200 * time.Millisecond
	if stats.AvgLatency < expectedAvg-10*time.Millisecond || stats.AvgLatency > expectedAvg+10*time.Millisecond {
		t.Errorf("AvgLatency: want ~%v, got %v", expectedAvg, stats.AvgLatency)
	}
}

// TestMetricsCollectorServeHTTP 验证 Prometheus 格式输出
func TestMetricsCollectorServeHTTP(t *testing.T) {
	mc := NewMetricsCollector()

	// 记录一些数据
	mc.RecordRequest("proxy1", 200, 100*time.Millisecond)
	mc.RecordRequest("proxy1", 500, 50*time.Millisecond)
	mc.IncrActiveConns("proxy1")
	mc.SetCircuitState("proxy1", CircuitOpen)

	// 请求指标
	req := httptest.NewRequest("GET", "/metrics", nil)
	rec := httptest.NewRecorder()

	mc.ServeHTTP(rec, req)

	// 验证响应
	if rec.Code != http.StatusOK {
		t.Errorf("Status: want 200, got %d", rec.Code)
	}

	body := rec.Body.String()

	// 验证 Content-Type
	contentType := rec.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/plain") {
		t.Errorf("Content-Type: want text/plain, got %s", contentType)
	}

	// 验证指标存在
	expectedMetrics := []string{
		"gateway_requests_total",
		"gateway_errors_total",
		"gateway_active_connections",
		"gateway_circuit_breaker_state",
	}

	for _, metric := range expectedMetrics {
		if !strings.Contains(body, metric) {
			t.Errorf("Missing metric: %s", metric)
		}
	}

	// 验证 proxy1 标签
	if !strings.Contains(body, `proxy="proxy1"`) {
		t.Error("Missing proxy label")
	}
}

// TestMetricsCollectorHistogram 验证 histogram bucket 配置 (T038a)
func TestMetricsCollectorHistogram(t *testing.T) {
	mc := NewMetricsCollector()

	// 记录不同延迟的请求
	mc.RecordRequest("proxy1", 200, 5*time.Millisecond)   // le=0.01
	mc.RecordRequest("proxy1", 200, 50*time.Millisecond)  // le=0.05
	mc.RecordRequest("proxy1", 200, 500*time.Millisecond) // le=0.5
	mc.RecordRequest("proxy1", 200, 2*time.Second)        // le=2.5

	req := httptest.NewRequest("GET", "/metrics", nil)
	rec := httptest.NewRecorder()
	mc.ServeHTTP(rec, req)

	body := rec.Body.String()

	// 验证 histogram bucket 存在
	expectedBuckets := []string{
		`le="0.01"`,
		`le="0.05"`,
		`le="0.1"`,
		`le="0.25"`,
		`le="0.5"`,
		`le="1"`,
		`le="2.5"`,
		`le="5"`,
		`le="10"`,
		`le="+Inf"`,
	}

	for _, bucket := range expectedBuckets {
		if !strings.Contains(body, bucket) {
			t.Errorf("Missing histogram bucket: %s", bucket)
		}
	}
}

// TestMetricsCollectorConcurrency 验证并发安全性
func TestMetricsCollectorConcurrency(t *testing.T) {
	mc := NewMetricsCollector()
	var wg sync.WaitGroup

	// 并发记录
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()

			proxyName := "proxy1"
			if n%2 == 0 {
				proxyName = "proxy2"
			}

			mc.RecordRequest(proxyName, 200, time.Duration(n)*time.Millisecond)
			mc.IncrActiveConns(proxyName)
			mc.DecrActiveConns(proxyName)
			mc.SetCircuitState(proxyName, CircuitState(n%3))
			mc.GetStats(proxyName)
			mc.GetActiveConns(proxyName)
		}(i)
	}

	wg.Wait()

	// 验证数据一致性
	stats1 := mc.GetStats("proxy1")
	stats2 := mc.GetStats("proxy2")
	total := stats1.RequestsTotal + stats2.RequestsTotal
	if total != 100 {
		t.Errorf("Total requests: want 100, got %d", total)
	}
}

// TestMetricsCollectorReset 验证重置功能
func TestMetricsCollectorReset(t *testing.T) {
	mc := NewMetricsCollector()

	// 记录一些数据
	mc.RecordRequest("proxy1", 200, 100*time.Millisecond)
	mc.IncrActiveConns("proxy1")

	// 重置
	mc.Reset()

	// 验证数据被清除
	stats := mc.GetStats("proxy1")
	if stats.RequestsTotal != 0 {
		t.Errorf("After reset RequestsTotal: want 0, got %d", stats.RequestsTotal)
	}

	// 注意：活跃连接数不应该被重置（因为可能还有活跃请求）
}

// TestMetricsCollectorNilSafe 验证 nil 安全
func TestMetricsCollectorNilSafe(t *testing.T) {
	var mc *MetricsCollector = nil

	// 所有方法对 nil 应该安全
	mc.RecordRequest("proxy1", 200, time.Second) // 不应该 panic
	mc.IncrActiveConns("proxy1")
	mc.DecrActiveConns("proxy1")
	mc.SetCircuitState("proxy1", CircuitOpen)

	if mc.GetActiveConns("proxy1") != 0 {
		t.Error("nil.GetActiveConns should return 0")
	}

	if mc.GetCircuitState("proxy1") != CircuitClosed {
		t.Error("nil.GetCircuitState should return CircuitClosed")
	}
}

// TestProxyStats 验证 ProxyStats 结构体
func TestProxyStats(t *testing.T) {
	stats := ProxyStats{
		RequestsTotal: 100,
		ErrorsTotal:   5,
		AvgLatency:    50 * time.Millisecond,
	}

	if stats.SuccessRate() != 0.95 {
		t.Errorf("SuccessRate: want 0.95, got %f", stats.SuccessRate())
	}

	// 边界情况：无请求
	emptyStats := ProxyStats{}
	if emptyStats.SuccessRate() != 0 {
		t.Errorf("Empty SuccessRate: want 0, got %f", emptyStats.SuccessRate())
	}
}

// BenchmarkMetricsCollectorRecordRequest 性能基准测试
func BenchmarkMetricsCollectorRecordRequest(b *testing.B) {
	mc := NewMetricsCollector()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			mc.RecordRequest("proxy1", 200, 100*time.Millisecond)
		}
	})
}
