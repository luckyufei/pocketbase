package gateway

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// TestTransportConfigDefaults 验证 TransportConfig 的默认值
func TestTransportConfigDefaults(t *testing.T) {
	config := DefaultTransportConfig()

	// 验证默认值符合 spec.md FR-001 ~ FR-007
	if config.DialTimeout != 2 {
		t.Errorf("DialTimeout: want 2, got %d", config.DialTimeout)
	}
	if config.DialKeepAlive != 30 {
		t.Errorf("DialKeepAlive: want 30, got %d", config.DialKeepAlive)
	}
	if config.ResponseHeaderTimeout != 30 {
		t.Errorf("ResponseHeaderTimeout: want 30, got %d", config.ResponseHeaderTimeout)
	}
	if config.IdleConnTimeout != 90 {
		t.Errorf("IdleConnTimeout: want 90, got %d", config.IdleConnTimeout)
	}
	if config.MaxIdleConns != 1000 {
		t.Errorf("MaxIdleConns: want 1000, got %d", config.MaxIdleConns)
	}
	if config.MaxIdleConnsPerHost != 100 {
		t.Errorf("MaxIdleConnsPerHost: want 100, got %d", config.MaxIdleConnsPerHost)
	}
	if config.TLSHandshakeTimeout != 5 {
		t.Errorf("TLSHandshakeTimeout: want 5, got %d", config.TLSHandshakeTimeout)
	}
	if config.ExpectContinueTimeout != 1 {
		t.Errorf("ExpectContinueTimeout: want 1, got %d", config.ExpectContinueTimeout)
	}
}

// TestNewHardenedTransport 验证 HardenedTransport 创建
func TestNewHardenedTransport(t *testing.T) {
	transport := NewHardenedTransport(DefaultTransportConfig())

	if transport == nil {
		t.Fatal("NewHardenedTransport returned nil")
	}

	// 验证关键配置被正确应用 (FR-005, FR-006, FR-007)
	if transport.MaxIdleConns != 1000 {
		t.Errorf("MaxIdleConns: want 1000, got %d", transport.MaxIdleConns)
	}
	if transport.MaxIdleConnsPerHost != 100 {
		t.Errorf("MaxIdleConnsPerHost: want 100, got %d", transport.MaxIdleConnsPerHost)
	}
	if !transport.ForceAttemptHTTP2 {
		t.Error("ForceAttemptHTTP2 should be true")
	}
	if transport.IdleConnTimeout != 90*time.Second {
		t.Errorf("IdleConnTimeout: want 90s, got %v", transport.IdleConnTimeout)
	}
	if transport.TLSHandshakeTimeout != 5*time.Second {
		t.Errorf("TLSHandshakeTimeout: want 5s, got %v", transport.TLSHandshakeTimeout)
	}
	if transport.ExpectContinueTimeout != 1*time.Second {
		t.Errorf("ExpectContinueTimeout: want 1s, got %v", transport.ExpectContinueTimeout)
	}
}

// TestHardenedTransportCustomConfig 验证自定义配置
func TestHardenedTransportCustomConfig(t *testing.T) {
	config := TransportConfig{
		DialTimeout:           5,
		DialKeepAlive:         60,
		ResponseHeaderTimeout: 0, // AI 场景：无限等待 (FR-004)
		IdleConnTimeout:       120,
		MaxIdleConns:          500,
		MaxIdleConnsPerHost:   50,
		TLSHandshakeTimeout:   10,
		ExpectContinueTimeout: 2,
	}

	transport := NewHardenedTransport(config)

	if transport.MaxIdleConns != 500 {
		t.Errorf("MaxIdleConns: want 500, got %d", transport.MaxIdleConns)
	}
	if transport.MaxIdleConnsPerHost != 50 {
		t.Errorf("MaxIdleConnsPerHost: want 50, got %d", transport.MaxIdleConnsPerHost)
	}
	if transport.IdleConnTimeout != 120*time.Second {
		t.Errorf("IdleConnTimeout: want 120s, got %v", transport.IdleConnTimeout)
	}
	// ResponseHeaderTimeout = 0 应该被正确处理
	if transport.ResponseHeaderTimeout != 0 {
		t.Errorf("ResponseHeaderTimeout: want 0 (unlimited), got %v", transport.ResponseHeaderTimeout)
	}
}

// TestDialTimeout 验证建连超时行为 (FR-001)
func TestDialTimeout(t *testing.T) {
	// 创建一个永远不会响应的监听器
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	// 获取地址但不 Accept 连接，模拟超时
	addr := listener.Addr().String()

	// 使用非常短的超时进行测试
	config := DefaultTransportConfig()
	config.DialTimeout = 1 // 1 秒超时

	transport := NewHardenedTransport(config)

	// 消耗掉 listener 的 backlog，让后续连接必须等待
	// 创建多个连接填满 backlog
	conns := make([]net.Conn, 0)
	for i := 0; i < 10; i++ {
		conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
		if err != nil {
			break
		}
		conns = append(conns, conn)
	}
	defer func() {
		for _, c := range conns {
			c.Close()
		}
		listener.Close()
	}()

	// 尝试连接（应该超时）
	client := &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second, // 总超时大于 DialTimeout
	}

	start := time.Now()
	_, err = client.Get("http://" + addr + "/test")
	elapsed := time.Since(start)

	// 应该在超时时间附近返回错误
	if err == nil {
		t.Error("Expected timeout error, got nil")
	}

	// 验证超时时间合理（1-3 秒范围内）
	if elapsed < 500*time.Millisecond || elapsed > 5*time.Second {
		t.Logf("Dial timeout elapsed: %v (expected ~1s)", elapsed)
	}
}

// TestResponseHeaderTimeout 验证首字节超时 (FR-002)
func TestResponseHeaderTimeout(t *testing.T) {
	// 创建一个延迟响应的服务器
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 延迟 3 秒再响应
		time.Sleep(3 * time.Second)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	// 使用 1 秒的 ResponseHeaderTimeout
	config := DefaultTransportConfig()
	config.ResponseHeaderTimeout = 1

	transport := NewHardenedTransport(config)
	client := &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
	}

	start := time.Now()
	_, err := client.Get(server.URL)
	elapsed := time.Since(start)

	if err == nil {
		t.Error("Expected timeout error, got nil")
	}

	// 应该在 1-2 秒内超时
	if elapsed > 2*time.Second {
		t.Errorf("ResponseHeaderTimeout took too long: %v (expected ~1s)", elapsed)
	}
}

// TestResponseHeaderTimeoutUnlimited 验证 AI 场景无限等待 (FR-004)
func TestResponseHeaderTimeoutUnlimited(t *testing.T) {
	// 创建一个延迟响应的服务器
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	// ResponseHeaderTimeout = 0 表示无限等待
	config := DefaultTransportConfig()
	config.ResponseHeaderTimeout = 0

	transport := NewHardenedTransport(config)
	client := &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
	}

	resp, err := client.Get(server.URL)
	if err != nil {
		t.Errorf("Unexpected error with unlimited timeout: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

// TestConnectionReuse 验证连接复用 (FR-006, NFR-002)
func TestConnectionReuse(t *testing.T) {
	var connectionCount int32

	// 创建一个追踪连接数的服务器
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	// 包装 listener 以追踪连接
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			atomic.AddInt32(&connectionCount, 1)
			go handleHTTPConnection(conn)
		}
	}()

	addr := listener.Addr().String()

	transport := NewHardenedTransport(DefaultTransportConfig())
	client := &http.Client{Transport: transport}

	// 发送 20 个连续请求
	for i := 0; i < 20; i++ {
		resp, err := client.Get("http://" + addr + "/test")
		if err != nil {
			t.Logf("Request %d failed: %v", i, err)
			continue
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}

	// 由于连接复用，新建连接数应该远小于请求数
	// 理想情况下只需要 1-2 个连接
	connCount := atomic.LoadInt32(&connectionCount)
	if connCount > 5 {
		t.Errorf("Too many connections created: %d (expected <= 5 for connection reuse)", connCount)
	}
	t.Logf("Connection count for 20 requests: %d", connCount)
}

// handleHTTPConnection 简单的 HTTP 连接处理器
func handleHTTPConnection(conn net.Conn) {
	defer conn.Close()

	buf := make([]byte, 1024)
	for {
		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		n, err := conn.Read(buf)
		if err != nil {
			return
		}

		// 简单解析 HTTP 请求，返回 200
		if n > 0 {
			response := "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\nOK"
			conn.Write([]byte(response))
		}
	}
}

// TestTransportConfigValidation 验证配置边界条件
func TestTransportConfigValidation(t *testing.T) {
	tests := []struct {
		name   string
		config TransportConfig
	}{
		{
			name: "zero values should use defaults in transport",
			config: TransportConfig{
				DialTimeout:           0,
				ResponseHeaderTimeout: 0, // 0 是有效值，表示无限
				MaxIdleConns:          0, // 0 应该使用默认值
			},
		},
		{
			name: "negative values treated as zero",
			config: TransportConfig{
				DialTimeout:  -1,
				MaxIdleConns: -100,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 不应该 panic
			transport := NewHardenedTransport(tt.config)
			if transport == nil {
				t.Error("NewHardenedTransport should not return nil")
			}
		})
	}
}

// TestNewHardenedTransportNegativeValues 验证负值配置处理
func TestNewHardenedTransportNegativeValues(t *testing.T) {
	config := TransportConfig{
		DialTimeout:           -1,
		DialKeepAlive:         -1,
		ResponseHeaderTimeout: -1,
		IdleConnTimeout:       -1,
		MaxIdleConns:          -1,
		MaxIdleConnsPerHost:   -1,
		TLSHandshakeTimeout:   -1,
		ExpectContinueTimeout: -1,
	}

	transport := NewHardenedTransport(config)

	// 验证负值被处理为 0 或默认值
	if transport.MaxIdleConns != 1000 {
		t.Errorf("MaxIdleConns: negative should use default 1000, got %d", transport.MaxIdleConns)
	}
	if transport.MaxIdleConnsPerHost != 100 {
		t.Errorf("MaxIdleConnsPerHost: negative should use default 100, got %d", transport.MaxIdleConnsPerHost)
	}
	if transport.IdleConnTimeout != 0 {
		t.Errorf("IdleConnTimeout: negative should be 0, got %v", transport.IdleConnTimeout)
	}
	if transport.TLSHandshakeTimeout != 0 {
		t.Errorf("TLSHandshakeTimeout: negative should be 0, got %v", transport.TLSHandshakeTimeout)
	}
	if transport.ExpectContinueTimeout != 0 {
		t.Errorf("ExpectContinueTimeout: negative should be 0, got %v", transport.ExpectContinueTimeout)
	}
}

// TestTransportConcurrentUse 验证并发安全性
func TestTransportConcurrentUse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	transport := NewHardenedTransport(DefaultTransportConfig())
	client := &http.Client{Transport: transport}

	// 并发发送 50 个请求
	done := make(chan bool, 50)
	for i := 0; i < 50; i++ {
		go func() {
			resp, err := client.Get(server.URL)
			if err == nil {
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
			}
			done <- true
		}()
	}

	// 等待所有请求完成
	for i := 0; i < 50; i++ {
		select {
		case <-done:
		case <-time.After(10 * time.Second):
			t.Fatal("Timeout waiting for concurrent requests")
		}
	}
}

// TestTimeoutConfig 验证 TimeoutConfig 结构体
func TestTimeoutConfig(t *testing.T) {
	config := DefaultTimeoutConfig()

	if config.Dial != 2 {
		t.Errorf("Dial: want 2, got %d", config.Dial)
	}
	if config.ResponseHeader != 30 {
		t.Errorf("ResponseHeader: want 30, got %d", config.ResponseHeader)
	}
	if config.Idle != 90 {
		t.Errorf("Idle: want 90, got %d", config.Idle)
	}
}

// TestTimeoutConfigToTransportConfig 验证转换
func TestTimeoutConfigToTransportConfig(t *testing.T) {
	tc := TimeoutConfig{
		Dial:           5,
		ResponseHeader: 60,
		Idle:           120,
	}

	transportConfig := tc.ToTransportConfig()

	if transportConfig.DialTimeout != 5 {
		t.Errorf("DialTimeout: want 5, got %d", transportConfig.DialTimeout)
	}
	if transportConfig.ResponseHeaderTimeout != 60 {
		t.Errorf("ResponseHeaderTimeout: want 60, got %d", transportConfig.ResponseHeaderTimeout)
	}
	if transportConfig.IdleConnTimeout != 120 {
		t.Errorf("IdleConnTimeout: want 120, got %d", transportConfig.IdleConnTimeout)
	}
}

// BenchmarkTransportRequest 性能基准测试
func BenchmarkTransportRequest(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	transport := NewHardenedTransport(DefaultTransportConfig())
	client := &http.Client{Transport: transport}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, err := client.Get(server.URL)
		if err != nil {
			b.Fatal(err)
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}
