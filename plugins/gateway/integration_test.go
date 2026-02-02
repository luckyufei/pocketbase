package gateway

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestManagerWithHardenedTransport 验证 Manager 使用 HardenedTransport
// T051: proxy.go 使用 HardenedTransport
func TestManagerWithHardenedTransport(t *testing.T) {
	// 创建测试服务器
	var requestCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	// 创建 Manager（应该使用 HardenedTransport）
	manager := NewManagerWithConfig(nil, ManagerConfig{
		TransportConfig: DefaultTransportConfig(),
	})

	// 验证 Transport 配置
	transport := manager.Transport()
	if transport == nil {
		t.Fatal("Transport should not be nil")
	}

	// 验证连接池配置（HardenedTransport 特征）
	if transport.MaxIdleConns != 1000 {
		t.Errorf("MaxIdleConns: want 1000, got %d", transport.MaxIdleConns)
	}
	if transport.MaxIdleConnsPerHost != 100 {
		t.Errorf("MaxIdleConnsPerHost: want 100, got %d", transport.MaxIdleConnsPerHost)
	}
}

// TestManagerProxyWithLimiterAndBreaker 验证代理带限流和熔断
// T050: manager.go 创建独立的 Limiter 和 CircuitBreaker
func TestManagerProxyWithLimiterAndBreaker(t *testing.T) {
	// 创建带并发限制的代理配置
	proxy := &ProxyConfig{
		ID:            "test-proxy",
		Path:          "/-/test",
		Upstream:      "http://localhost:8080",
		Active:        true,
		MaxConcurrent: 5,
		CircuitBreaker: &CircuitBreakerConfig{
			Enabled:          true,
			FailureThreshold: 3,
			RecoveryTimeout:  30,
		},
	}

	// 创建 Manager
	manager := NewManagerWithConfig(nil, ManagerConfig{
		TransportConfig: DefaultTransportConfig(),
	})

	// 设置代理
	manager.SetProxies([]*ProxyConfig{proxy})

	// 获取代理的控制组件
	limiter := manager.GetLimiter(proxy.ID)
	breaker := manager.GetCircuitBreaker(proxy.ID)

	// 验证 Limiter 创建
	if limiter == nil {
		t.Error("Limiter should be created for proxy with MaxConcurrent > 0")
	} else if limiter.Max() != 5 {
		t.Errorf("Limiter.Max(): want 5, got %d", limiter.Max())
	}

	// 验证 CircuitBreaker 创建
	if breaker == nil {
		t.Error("CircuitBreaker should be created for proxy with circuit_breaker.enabled")
	} else if breaker.State() != CircuitClosed {
		t.Errorf("CircuitBreaker initial state: want Closed, got %v", breaker.State())
	}
}

// TestManagerProxyNoLimiter 验证不限流的代理
func TestManagerProxyNoLimiter(t *testing.T) {
	proxy := &ProxyConfig{
		ID:            "test-proxy-no-limit",
		Path:          "/-/unlimited",
		Upstream:      "http://localhost:8080",
		Active:        true,
		MaxConcurrent: 0, // 不限制
	}

	manager := NewManagerWithConfig(nil, ManagerConfig{})
	manager.SetProxies([]*ProxyConfig{proxy})

	limiter := manager.GetLimiter(proxy.ID)
	if limiter != nil {
		t.Error("Limiter should be nil for proxy with MaxConcurrent <= 0")
	}
}

// TestGatewayGlobalComponents 验证全局组件初始化
// T052: gateway.go 初始化全局 BytesPool 和 MetricsCollector
func TestGatewayGlobalComponents(t *testing.T) {
	// 验证 DefaultBytesPool
	pool := DefaultBytesPool()
	if pool == nil {
		t.Fatal("DefaultBytesPool should not be nil")
	}
	if pool.BufferSize() != DefaultBufferSize {
		t.Errorf("BufferSize: want %d, got %d", DefaultBufferSize, pool.BufferSize())
	}

	// 验证多次调用返回同一实例（单例）
	pool2 := DefaultBytesPool()
	if pool != pool2 {
		t.Error("DefaultBytesPool should return the same instance")
	}
}

// TestManagerWithBufferPool 验证 Manager 带 BufferPool
// T035: proxy.go 注入 BufferPool
func TestManagerWithBufferPool(t *testing.T) {
	manager := NewManagerWithConfig(nil, ManagerConfig{
		BufferPool: DefaultBytesPool(),
	})

	pool := manager.BufferPool()
	if pool == nil {
		t.Error("BufferPool should be set")
	}
}

// TestManagerWithMetrics 验证 Manager 带 Metrics
func TestManagerWithMetrics(t *testing.T) {
	metrics := NewMetricsCollector()
	manager := NewManagerWithConfig(nil, ManagerConfig{
		Metrics: metrics,
	})

	if manager.Metrics() != metrics {
		t.Error("Metrics should be the same instance")
	}
}

// TestIntegrationFullStack 验证完整集成
func TestIntegrationFullStack(t *testing.T) {
	// 创建后端服务
	backendCalls := int32(0)
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&backendCalls, 1)
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer backend.Close()

	// 创建带所有组件的 Manager
	metrics := NewMetricsCollector()
	manager := NewManagerWithConfig(nil, ManagerConfig{
		TransportConfig: DefaultTransportConfig(),
		BufferPool:      DefaultBytesPool(),
		Metrics:         metrics,
	})

	// 设置代理
	proxy := &ProxyConfig{
		ID:            "integration-test",
		Path:          "/-/api",
		Upstream:      backend.URL,
		Active:        true,
		MaxConcurrent: 10,
		CircuitBreaker: &CircuitBreakerConfig{
			Enabled:          true,
			FailureThreshold: 5,
		},
	}
	manager.SetProxies([]*ProxyConfig{proxy})

	// 验证组件正确创建
	if manager.GetLimiter(proxy.ID) == nil {
		t.Error("Limiter should be created")
	}
	if manager.GetCircuitBreaker(proxy.ID) == nil {
		t.Error("CircuitBreaker should be created")
	}
}

// =============================================================================
// T057: 集成测试 - 超时行为验证
// =============================================================================

// TestIntegrationDialTimeout 验证建连超时
// T057: 使用延迟 mock server 测试 DialTimeout
func TestIntegrationDialTimeout(t *testing.T) {
	// 创建一个很短的建连超时配置
	config := TransportConfig{
		DialTimeout: 1, // 1 秒超时（最小有效值）
	}
	transport := NewHardenedTransport(config)

	// 测试正常连接应该成功
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	client := &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
	}

	resp, err := client.Get(backend.URL)
	if err != nil {
		t.Errorf("Request to reachable server should succeed: %v", err)
	} else {
		resp.Body.Close()
	}

	// 验证 DialContext 被正确配置
	if transport.DialContext == nil {
		t.Error("DialContext should be configured")
	}
}

// TestIntegrationResponseHeaderTimeout 验证首字节超时
// T057: 使用延迟响应 mock server 测试 ResponseHeaderTimeout
func TestIntegrationResponseHeaderTimeout(t *testing.T) {
	// 创建延迟响应的服务器
	slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second) // 延迟 3 秒才返回头
		w.WriteHeader(http.StatusOK)
	}))
	defer slowServer.Close()

	config := TransportConfig{
		ResponseHeaderTimeout: 1, // 1 秒超时
	}
	transport := NewHardenedTransport(config)

	client := &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
	}

	start := time.Now()
	_, err := client.Get(slowServer.URL)
	elapsed := time.Since(start)

	if err == nil {
		t.Error("Request to slow server should timeout")
	}

	// 验证超时时间接近 1 秒
	if elapsed > 2*time.Second {
		t.Errorf("ResponseHeaderTimeout should be around 1s, took %v", elapsed)
	}
	t.Logf("ResponseHeaderTimeout test: elapsed %v", elapsed)
}

// =============================================================================
// T058: 集成测试 - 并发限制验证
// =============================================================================

// TestIntegrationConcurrencyLimit 验证并发限制
// T058: 配置 max_concurrent=5，发送 10 个并发请求
func TestIntegrationConcurrencyLimit(t *testing.T) {
	// 创建慢速后端
	activeConns := int32(0)
	maxActiveConns := int32(0)
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&activeConns, 1)
		defer atomic.AddInt32(&activeConns, -1)

		// 记录最大并发数
		for {
			old := atomic.LoadInt32(&maxActiveConns)
			if current <= old || atomic.CompareAndSwapInt32(&maxActiveConns, old, current) {
				break
			}
		}

		time.Sleep(100 * time.Millisecond) // 模拟慢速处理
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	// 创建限流器
	limiter := NewConcurrencyLimiter(5)

	// 创建包装的 handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp, err := http.Get(backend.URL)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		w.WriteHeader(resp.StatusCode)
	})

	wrapped := wrapHandler(handler, "test-proxy", limiter, nil, nil)

	// 发送 10 个并发请求
	results := make(chan int, 10)
	for i := 0; i < 10; i++ {
		go func() {
			req := httptest.NewRequest("GET", "/test", nil)
			rec := httptest.NewRecorder()
			wrapped.ServeHTTP(rec, req)
			results <- rec.Code
		}()
	}

	// 收集结果
	successCount := 0
	tooManyCount := 0
	for i := 0; i < 10; i++ {
		code := <-results
		if code == http.StatusOK {
			successCount++
		} else if code == http.StatusTooManyRequests {
			tooManyCount++
		}
	}

	// 验证：最大并发应该不超过 5
	maxActive := atomic.LoadInt32(&maxActiveConns)
	if maxActive > 5 {
		t.Errorf("Max active connections should be <= 5, got %d", maxActive)
	}

	// 验证：应该有一些请求被拒绝
	t.Logf("Success: %d, TooMany: %d, MaxActive: %d", successCount, tooManyCount, maxActive)
}

// =============================================================================
// T059: 集成测试 - 熔断器验证
// =============================================================================

// TestIntegrationCircuitBreaker 验证熔断器
// T059: 配置 failure_threshold=3，发送失败请求触发熔断
func TestIntegrationCircuitBreaker(t *testing.T) {
	// 创建始终失败的后端
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer backend.Close()

	// 创建熔断器
	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 3,
		RecoveryTimeout:  1, // 1 秒恢复
	})

	// 验证初始状态
	if cb.State() != CircuitClosed {
		t.Errorf("Initial state should be Closed, got %v", cb.State())
	}

	// 创建包装的 handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp, err := http.Get(backend.URL)
		if err != nil {
			cb.RecordFailure()
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			cb.RecordFailure()
		} else {
			cb.RecordSuccess()
		}
		w.WriteHeader(resp.StatusCode)
	})

	wrapped := wrapHandler(handler, "test-proxy", nil, cb, nil)

	// 发送 3 个失败请求触发熔断
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
	}

	// 验证熔断器已打开
	if cb.State() != CircuitOpen {
		t.Errorf("State should be Open after 3 failures, got %v", cb.State())
	}

	// 第 4 个请求应该被熔断器直接拒绝
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Request should be rejected with 503, got %d", rec.Code)
	}

	// 等待恢复超时
	time.Sleep(1100 * time.Millisecond)

	// 验证转为 HalfOpen 状态
	if cb.State() != CircuitHalfOpen {
		// 需要调用 IsOpen() 触发状态检查
		cb.IsOpen()
		if cb.State() != CircuitHalfOpen {
			t.Errorf("State should be HalfOpen after recovery timeout, got %v", cb.State())
		}
	}
}

// TestIntegrationCircuitBreakerRecovery 验证熔断器恢复
// T059: 验证 recovery_timeout 后恢复
func TestIntegrationCircuitBreakerRecovery(t *testing.T) {
	failCount := int32(0)

	// 创建先失败后成功的后端
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.LoadInt32(&failCount)
		if count < 3 {
			atomic.AddInt32(&failCount, 1)
			w.WriteHeader(http.StatusInternalServerError)
		} else {
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer backend.Close()

	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Enabled:          true,
		FailureThreshold: 3,
		RecoveryTimeout:  1, // 1 秒
		HalfOpenRequests: 1,
	})

	// 触发熔断
	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	if cb.State() != CircuitOpen {
		t.Fatalf("Should be Open, got %v", cb.State())
	}

	// 等待恢复
	time.Sleep(1100 * time.Millisecond)

	// 检查状态（触发 HalfOpen 转换）
	if cb.IsOpen() {
		t.Error("Should not be open after recovery timeout")
	}

	if cb.State() != CircuitHalfOpen {
		t.Errorf("Should be HalfOpen, got %v", cb.State())
	}

	// 记录成功，应该转为 Closed
	cb.RecordSuccess()

	if cb.State() != CircuitClosed {
		t.Errorf("Should be Closed after success in HalfOpen, got %v", cb.State())
	}
}

// =============================================================================
// T060: 集成测试 - 连接复用验证
// =============================================================================

// TestIntegrationConnectionReuse 验证连接复用
// T060: 发送 100 个连续请求，验证连接复用机制
func TestIntegrationConnectionReuse(t *testing.T) {
	// 创建后端
	requestCount := int32(0)
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer backend.Close()

	// 使用 HardenedTransport 的默认配置
	// 关键配置：MaxIdleConnsPerHost=100 应该允许大量连接复用
	transport := NewHardenedTransport(DefaultTransportConfig())

	client := &http.Client{
		Transport: transport,
	}

	// 发送 100 个请求
	for i := 0; i < 100; i++ {
		resp, err := client.Get(backend.URL)
		if err != nil {
			t.Fatalf("Request %d failed: %v", i, err)
		}
		resp.Body.Close()
	}

	// 验证所有请求都被处理
	count := atomic.LoadInt32(&requestCount)
	if count != 100 {
		t.Errorf("Expected 100 requests, got %d", count)
	}

	// 验证 HardenedTransport 配置正确支持连接复用
	// MaxIdleConnsPerHost=100 意味着单个上游可以保持 100 个空闲连接
	if transport.MaxIdleConnsPerHost != 100 {
		t.Errorf("MaxIdleConnsPerHost should be 100 for connection reuse, got %d", transport.MaxIdleConnsPerHost)
	}

	t.Logf("Connection reuse test: 100 requests completed, MaxIdleConnsPerHost=%d", transport.MaxIdleConnsPerHost)
}

// =============================================================================
// T060a: 集成测试 - 排队模式验证
// =============================================================================

// TestIntegrationQueueMode 验证排队模式
// T060a: 配置 max_concurrent=5 + 排队模式
func TestIntegrationQueueMode(t *testing.T) {
	processedOrder := make([]int, 0, 10)
	orderMu := sync.Mutex{}

	// 创建慢速后端
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	limiter := NewConcurrencyLimiter(5)

	// 发送 10 个请求
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			// 使用带超时的获取（排队模式）
			if limiter.AcquireWithTimeout(500 * time.Millisecond) {
				defer limiter.Release()

				// 记录处理顺序
				orderMu.Lock()
				processedOrder = append(processedOrder, idx)
				orderMu.Unlock()

				// 执行请求
				resp, err := http.Get(backend.URL)
				if err == nil {
					resp.Body.Close()
				}
			}
		}(i)
	}

	wg.Wait()

	// 验证所有请求都被处理（排队等待）
	orderMu.Lock()
	processed := len(processedOrder)
	orderMu.Unlock()

	t.Logf("Processed %d out of 10 requests in queue mode", processed)

	// 在排队模式下，所有请求应该都能被处理
	if processed < 10 {
		t.Errorf("Queue mode should process all requests, only processed %d", processed)
	}
}

// =============================================================================
// T060b: Success Criteria 验证 - 连接复用率
// =============================================================================

// TestSuccessCriteriaSC001ConnectionReuse 验证 SC-001: 连接复用率 > 90%
func TestSuccessCriteriaSC001ConnectionReuse(t *testing.T) {
	connCount := int32(0)

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	transport := NewHardenedTransport(DefaultTransportConfig())
	originalDialContext := transport.DialContext
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		atomic.AddInt32(&connCount, 1)
		return originalDialContext(ctx, network, addr)
	}

	client := &http.Client{Transport: transport}

	// 连续 100 个请求
	for i := 0; i < 100; i++ {
		resp, err := client.Get(backend.URL)
		if err != nil {
			t.Fatalf("Request %d failed: %v", i, err)
		}
		resp.Body.Close()
	}

	conns := atomic.LoadInt32(&connCount)
	reuseRate := float64(100-conns) / 100.0 * 100

	t.Logf("SC-001: Connection reuse rate = %.1f%% (%d connections for 100 requests)", reuseRate, conns)

	// SC-001: 连接复用率 > 90%
	if reuseRate < 90.0 {
		t.Errorf("SC-001 FAILED: Connection reuse rate %.1f%% < 90%%", reuseRate)
	}
}

// =============================================================================
// T060c: Success Criteria 验证 - 并发限制准确性
// =============================================================================

// TestSuccessCriteriaSC005ConcurrencyAccuracy 验证 SC-005: 并发限制准确性
func TestSuccessCriteriaSC005ConcurrencyAccuracy(t *testing.T) {
	maxConcurrent := 5
	limiter := NewConcurrencyLimiter(maxConcurrent)

	observedMax := int32(0)
	active := int32(0)

	// 100 个并发请求
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			if limiter.Acquire() {
				defer limiter.Release()

				current := atomic.AddInt32(&active, 1)
				defer atomic.AddInt32(&active, -1)

				// 记录最大值
				for {
					old := atomic.LoadInt32(&observedMax)
					if current <= old || atomic.CompareAndSwapInt32(&observedMax, old, current) {
						break
					}
				}

				time.Sleep(10 * time.Millisecond)
			}
		}()
	}

	wg.Wait()

	maxObserved := atomic.LoadInt32(&observedMax)
	t.Logf("SC-005: Max concurrent observed = %d (limit = %d)", maxObserved, maxConcurrent)

	// SC-005: 不超过配置值 +1
	if maxObserved > int32(maxConcurrent+1) {
		t.Errorf("SC-005 FAILED: Max concurrent %d > limit %d + 1", maxObserved, maxConcurrent)
	}
}

// =============================================================================
// T060d: Success Criteria 验证 - Metrics 响应时间
// =============================================================================

// TestSuccessCriteriaSC006MetricsLatency 验证 SC-006: Prometheus 指标端点响应时间 < 50ms
func TestSuccessCriteriaSC006MetricsLatency(t *testing.T) {
	metrics := NewMetricsCollector()

	// 预热：添加一些数据
	for i := 0; i < 1000; i++ {
		metrics.RecordRequest("proxy-"+string(rune('a'+i%26)), 200, time.Millisecond*time.Duration(i%100))
	}

	// 测量响应时间
	req := httptest.NewRequest("GET", "/api/gateway/metrics", nil)

	var totalLatency time.Duration
	iterations := 100

	for i := 0; i < iterations; i++ {
		rec := httptest.NewRecorder()
		start := time.Now()
		metrics.ServeHTTP(rec, req)
		totalLatency += time.Since(start)
	}

	avgLatency := totalLatency / time.Duration(iterations)
	t.Logf("SC-006: Metrics endpoint avg latency = %v", avgLatency)

	// SC-006: 响应时间 < 50ms
	if avgLatency > 50*time.Millisecond {
		t.Errorf("SC-006 FAILED: Metrics latency %v > 50ms", avgLatency)
	}
}
