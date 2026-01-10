package apis

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/metrics"
)

// TestServerlessMetricsHandler 测试指标处理器
func TestServerlessMetricsHandler(t *testing.T) {
	collector := metrics.NewCollector()

	// 记录一些测试指标
	collector.RecordRequest(metrics.RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     100 * time.Millisecond,
		Result:       metrics.ResultSuccess,
		Timestamp:    time.Now(),
	})

	collector.RecordRequest(metrics.RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     200 * time.Millisecond,
		Result:       metrics.ResultError,
		Timestamp:    time.Now(),
	})

	handler := NewServerlessMetricsHandler(collector)

	// 测试 GET /api/serverless/metrics
	req := httptest.NewRequest(http.MethodGet, "/api/serverless/metrics", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}

	// 验证响应内容
	var resp MetricsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	if resp.TotalRequests != 2 {
		t.Errorf("期望总请求数 2，实际为 %d", resp.TotalRequests)
	}

	if resp.SuccessCount != 1 {
		t.Errorf("期望成功数 1，实际为 %d", resp.SuccessCount)
	}

	if resp.ErrorCount != 1 {
		t.Errorf("期望错误数 1，实际为 %d", resp.ErrorCount)
	}
}

// TestServerlessMetricsHandlerEmpty 测试空指标
func TestServerlessMetricsHandlerEmpty(t *testing.T) {
	collector := metrics.NewCollector()
	handler := NewServerlessMetricsHandler(collector)

	req := httptest.NewRequest(http.MethodGet, "/api/serverless/metrics", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}

	var resp MetricsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	if resp.TotalRequests != 0 {
		t.Errorf("期望总请求数 0，实际为 %d", resp.TotalRequests)
	}
}

// TestServerlessMetricsHandlerPoolStats 测试池统计
func TestServerlessMetricsHandlerPoolStats(t *testing.T) {
	collector := metrics.NewCollector()

	collector.UpdatePoolStats(metrics.PoolStats{
		Size:            10,
		Available:       5,
		InUse:           5,
		WaitingRequests: 2,
		TotalCreated:    100,
		TotalDestroyed:  90,
	})

	handler := NewServerlessMetricsHandler(collector)

	req := httptest.NewRequest(http.MethodGet, "/api/serverless/metrics", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	var resp MetricsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	if resp.Pool.Size != 10 {
		t.Errorf("期望池大小 10，实际为 %d", resp.Pool.Size)
	}

	if resp.Pool.InUse != 5 {
		t.Errorf("期望使用中实例数 5，实际为 %d", resp.Pool.InUse)
	}
}

// TestServerlessMetricsHandlerMethodNotAllowed 测试不允许的方法
func TestServerlessMetricsHandlerMethodNotAllowed(t *testing.T) {
	collector := metrics.NewCollector()
	handler := NewServerlessMetricsHandler(collector)

	req := httptest.NewRequest(http.MethodPost, "/api/serverless/metrics", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("期望状态码 405，实际为 %d", w.Code)
	}
}

// TestServerlessMetricsHandlerWindow 测试窗口统计
func TestServerlessMetricsHandlerWindow(t *testing.T) {
	collector := metrics.NewCollector()

	// 记录一些指标
	for i := 0; i < 10; i++ {
		result := metrics.ResultSuccess
		if i%2 != 0 {
			result = metrics.ResultError
		}
		collector.RecordRequest(metrics.RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     time.Duration(i*10) * time.Millisecond,
			Result:       result,
			Timestamp:    time.Now(),
		})
	}

	handler := NewServerlessMetricsHandler(collector)

	// 请求带窗口参数
	req := httptest.NewRequest(http.MethodGet, "/api/serverless/metrics?window=5m", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}

	var resp MetricsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	// 窗口统计应该有数据（RequestRate > 0 表示有请求）
	if resp.Window.RequestRate <= 0 && resp.TotalRequests > 0 {
		t.Errorf("期望窗口请求率大于 0")
	}
}

// TestServerlessMetricsHandlerLatencyHistogram 测试延迟直方图
func TestServerlessMetricsHandlerLatencyHistogram(t *testing.T) {
	collector := metrics.NewCollector()

	// 记录不同延迟的请求
	durations := []time.Duration{
		1 * time.Millisecond,
		10 * time.Millisecond,
		50 * time.Millisecond,
		100 * time.Millisecond,
		500 * time.Millisecond,
		1 * time.Second,
	}

	for _, d := range durations {
		collector.RecordRequest(metrics.RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     d,
			Result:       metrics.ResultSuccess,
			Timestamp:    time.Now(),
		})
	}

	handler := NewServerlessMetricsHandler(collector)

	req := httptest.NewRequest(http.MethodGet, "/api/serverless/metrics", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	var resp MetricsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	// 验证延迟统计
	if resp.Latency.Min <= 0 {
		t.Error("期望最小延迟大于 0")
	}

	if resp.Latency.Max <= 0 {
		t.Error("期望最大延迟大于 0")
	}

	if resp.Latency.Avg <= 0 {
		t.Error("期望平均延迟大于 0")
	}
}

// TestServerlessMetricsHandlerFunctionStats 测试按函数统计
func TestServerlessMetricsHandlerFunctionStats(t *testing.T) {
	collector := metrics.NewCollector()

	// 记录不同函数的请求
	functions := []string{"func-a", "func-b", "func-c"}
	for _, fn := range functions {
		for i := 0; i < 5; i++ {
			collector.RecordRequest(metrics.RequestMetric{
				FunctionName: fn,
				Runtime:      "quickjs",
				Duration:     100 * time.Millisecond,
				Result:       metrics.ResultSuccess,
				Timestamp:    time.Now(),
			})
		}
	}

	handler := NewServerlessMetricsHandler(collector)

	req := httptest.NewRequest(http.MethodGet, "/api/serverless/metrics", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	var resp MetricsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	// 验证按函数统计
	if len(resp.ByFunction) != 3 {
		t.Errorf("期望 3 个函数统计，实际为 %d", len(resp.ByFunction))
	}

	for _, fn := range functions {
		if stats, ok := resp.ByFunction[fn]; !ok {
			t.Errorf("缺少函数 %s 的统计", fn)
		} else if stats.TotalRequests != 5 {
			t.Errorf("期望函数 %s 请求数 5，实际为 %d", fn, stats.TotalRequests)
		}
	}
}
