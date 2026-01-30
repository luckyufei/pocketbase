package gateway

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestResponseWriterWrapper 验证 ResponseWriter 包装器
func TestResponseWriterWrapper(t *testing.T) {
	rec := httptest.NewRecorder()
	rw := newResponseWriter(rec)

	// 验证初始状态
	if rw.StatusCode() != 0 {
		t.Errorf("Initial StatusCode: want 0, got %d", rw.StatusCode())
	}

	// 写入响应
	rw.WriteHeader(http.StatusCreated)
	rw.Write([]byte("test"))

	// 验证状态码被记录
	if rw.StatusCode() != http.StatusCreated {
		t.Errorf("StatusCode: want 201, got %d", rw.StatusCode())
	}

	// 验证数据被写入底层 ResponseWriter
	if rec.Code != http.StatusCreated {
		t.Errorf("Recorder Code: want 201, got %d", rec.Code)
	}
	if rec.Body.String() != "test" {
		t.Errorf("Recorder Body: want 'test', got '%s'", rec.Body.String())
	}
}

// TestResponseWriterWrapperDefaultStatus 验证未显式设置状态码时的默认值
func TestResponseWriterWrapperDefaultStatus(t *testing.T) {
	rec := httptest.NewRecorder()
	rw := newResponseWriter(rec)

	// 直接写入数据（不调用 WriteHeader）
	rw.Write([]byte("test"))

	// 应该默认使用 200
	if rw.StatusCode() != http.StatusOK {
		t.Errorf("Default StatusCode: want 200, got %d", rw.StatusCode())
	}
}

// TestWriteTooManyRequestsError 验证 429 响应 (FR-009, FR-011)
func TestWriteTooManyRequestsError(t *testing.T) {
	rec := httptest.NewRecorder()

	writeTooManyRequestsError(rec, 30)

	// 验证状态码
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("Status: want 429, got %d", rec.Code)
	}

	// 验证 Content-Type
	if rec.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type: want application/json, got %s", rec.Header().Get("Content-Type"))
	}

	// 验证 Retry-After 头
	if rec.Header().Get("Retry-After") != "30" {
		t.Errorf("Retry-After: want '30', got '%s'", rec.Header().Get("Retry-After"))
	}

	// 验证 JSON 响应体包含错误信息
	body := rec.Body.String()
	if !strings.Contains(body, "Too Many Requests") {
		t.Errorf("Response body should contain 'Too Many Requests', got '%s'", body)
	}
}

// TestWriteCircuitOpenError 验证 503 熔断响应 (FR-015)
func TestWriteCircuitOpenError(t *testing.T) {
	rec := httptest.NewRecorder()

	writeCircuitOpenError(rec)

	// 验证状态码
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Status: want 503, got %d", rec.Code)
	}

	// 验证 X-Circuit-Breaker 头
	if rec.Header().Get("X-Circuit-Breaker") != "open" {
		t.Errorf("X-Circuit-Breaker: want 'open', got '%s'", rec.Header().Get("X-Circuit-Breaker"))
	}

	// 验证 JSON 响应体包含错误信息
	body := rec.Body.String()
	if !strings.Contains(body, "Service Unavailable") {
		t.Errorf("Response body should contain 'Service Unavailable', got '%s'", body)
	}
}

// TestWrapHandlerNoLimitNoBreaker 验证无限流无熔断的包装
func TestWrapHandlerNoLimitNoBreaker(t *testing.T) {
	// 创建一个简单的后端 handler
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	metrics := NewMetricsCollector()
	wrapped := wrapHandler(backend, "test-proxy", nil, nil, metrics)

	// 发送请求
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	wrapped.ServeHTTP(rec, req)

	// 验证响应
	if rec.Code != http.StatusOK {
		t.Errorf("Status: want 200, got %d", rec.Code)
	}

	// 验证指标被记录
	stats := metrics.GetStats("test-proxy")
	if stats.RequestsTotal != 1 {
		t.Errorf("RequestsTotal: want 1, got %d", stats.RequestsTotal)
	}
}

// TestWrapHandlerWithLimiter 验证带限流的包装
func TestWrapHandlerWithLimiter(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond) // 模拟处理时间
		w.WriteHeader(http.StatusOK)
	})

	limiter := NewConcurrencyLimiter(1) // 只允许 1 个并发
	metrics := NewMetricsCollector()
	wrapped := wrapHandler(backend, "test-proxy", limiter, nil, metrics)

	// 发送第一个请求（应该成功）
	req1 := httptest.NewRequest("GET", "/test", nil)
	rec1 := httptest.NewRecorder()

	// 先占用唯一的槽位
	limiter.Acquire()

	// 发送第二个请求（应该被拒绝）
	req2 := httptest.NewRequest("GET", "/test", nil)
	rec2 := httptest.NewRecorder()

	wrapped.ServeHTTP(rec2, req2)

	// 释放槽位
	limiter.Release()

	// 验证第二个请求被拒绝
	if rec2.Code != http.StatusTooManyRequests {
		t.Errorf("Second request status: want 429, got %d", rec2.Code)
	}

	// 现在发送正常请求
	wrapped.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Errorf("First request status: want 200, got %d", rec1.Code)
	}
}

// TestWrapHandlerWithCircuitBreaker 验证带熔断器的包装
func TestWrapHandlerWithCircuitBreaker(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 1,
		RecoveryTimeout:  60,
	})
	metrics := NewMetricsCollector()
	wrapped := wrapHandler(backend, "test-proxy", nil, cb, metrics)

	// 手动触发熔断
	cb.RecordFailure()

	// 发送请求（应该被熔断器拒绝）
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	wrapped.ServeHTTP(rec, req)

	// 验证被拒绝
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Status: want 503, got %d", rec.Code)
	}

	// 验证 X-Circuit-Breaker 头
	if rec.Header().Get("X-Circuit-Breaker") != "open" {
		t.Errorf("X-Circuit-Breaker: want 'open', got '%s'", rec.Header().Get("X-Circuit-Breaker"))
	}
}

// TestWrapHandlerBackendError 验证后端错误记录
func TestWrapHandlerBackendError(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 3,
		RecoveryTimeout:  60,
	})
	metrics := NewMetricsCollector()
	wrapped := wrapHandler(backend, "test-proxy", nil, cb, metrics)

	// 发送 3 个失败请求
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
	}

	// 验证熔断器已打开
	if !cb.IsOpen() {
		t.Error("CircuitBreaker should be open after 3 failures")
	}

	// 验证指标
	stats := metrics.GetStats("test-proxy")
	if stats.ErrorsTotal != 3 {
		t.Errorf("ErrorsTotal: want 3, got %d", stats.ErrorsTotal)
	}
}

// TestWrapHandlerMetricsActiveConns 验证活跃连接计数
func TestWrapHandlerMetricsActiveConns(t *testing.T) {
	done := make(chan struct{})

	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-done // 等待信号
		w.WriteHeader(http.StatusOK)
	})

	metrics := NewMetricsCollector()
	wrapped := wrapHandler(backend, "test-proxy", nil, nil, metrics)

	// 在 goroutine 中发送请求
	go func() {
		req := httptest.NewRequest("GET", "/test", nil)
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
	}()

	// 等待请求开始处理
	time.Sleep(10 * time.Millisecond)

	// 验证活跃连接数
	activeConns := metrics.GetActiveConns("test-proxy")
	if activeConns != 1 {
		t.Errorf("ActiveConns during request: want 1, got %d", activeConns)
	}

	// 释放请求
	close(done)
	time.Sleep(10 * time.Millisecond)

	// 验证活跃连接数减少
	activeConns = metrics.GetActiveConns("test-proxy")
	if activeConns != 0 {
		t.Errorf("ActiveConns after request: want 0, got %d", activeConns)
	}
}

// TestWriteWebSocketUpgradeError 验证 WebSocket 升级拒绝响应 (T031a)
func TestWriteWebSocketUpgradeError(t *testing.T) {
	rec := httptest.NewRecorder()

	writeWebSocketUpgradeError(rec)

	// 验证状态码
	if rec.Code != http.StatusNotImplemented {
		t.Errorf("Status: want 501, got %d", rec.Code)
	}

	// 验证响应体包含错误信息
	body, _ := io.ReadAll(rec.Body)
	bodyStr := string(body)
	if !strings.Contains(bodyStr, "WebSocket Not Supported") {
		t.Errorf("Response body should contain 'WebSocket Not Supported', got '%s'", bodyStr)
	}
}

// TestIsWebSocketUpgrade 验证 WebSocket 升级检测
func TestIsWebSocketUpgrade(t *testing.T) {
	tests := []struct {
		name    string
		headers map[string]string
		want    bool
	}{
		{
			name: "websocket upgrade",
			headers: map[string]string{
				"Connection": "Upgrade",
				"Upgrade":    "websocket",
			},
			want: true,
		},
		{
			name: "websocket upgrade case insensitive",
			headers: map[string]string{
				"Connection": "upgrade",
				"Upgrade":    "WebSocket",
			},
			want: true,
		},
		{
			name: "no upgrade",
			headers: map[string]string{
				"Content-Type": "application/json",
			},
			want: false,
		},
		{
			name: "non-websocket upgrade",
			headers: map[string]string{
				"Connection": "Upgrade",
				"Upgrade":    "h2c",
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}

			if got := isWebSocketUpgrade(req); got != tt.want {
				t.Errorf("isWebSocketUpgrade() = %v, want %v", got, tt.want)
			}
		})
	}
}
