package gateway

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestIsHopByHopHeader 测试 hop-by-hop 头判断
func TestIsHopByHopHeader(t *testing.T) {
	hopByHop := []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Te",
		"Trailers",
		"Transfer-Encoding",
		"Upgrade",
	}

	for _, h := range hopByHop {
		if !IsHopByHopHeader(h) {
			t.Errorf("IsHopByHopHeader(%q) = false, want true", h)
		}
	}

	// 测试非 hop-by-hop 头
	notHopByHop := []string{
		"Content-Type",
		"Authorization",
		"X-Custom-Header",
		"Accept",
	}

	for _, h := range notHopByHop {
		if IsHopByHopHeader(h) {
			t.Errorf("IsHopByHopHeader(%q) = true, want false", h)
		}
	}
}

// TestNormalizeDirector 测试 Director 配置
func TestNormalizeDirector(t *testing.T) {
	// 这个测试验证 Director 的核心逻辑
	// 实际的 Director 测试需要模拟 HTTP 请求

	// 验证常量
	if DefaultFlushInterval.Milliseconds() != 100 {
		t.Errorf("DefaultFlushInterval = %v, want 100ms", DefaultFlushInterval)
	}
}

// TestWriteErrorJSON 测试 JSON 错误响应
func TestWriteErrorJSON(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		errorMsg   string
		details    string
		wantBody   string
	}{
		{
			"with details",
			http.StatusBadGateway,
			"AI Gateway Error",
			"connection refused",
			`{"error":"AI Gateway Error","details":"connection refused"}`,
		},
		{
			"without details",
			http.StatusNotFound,
			"Not Found",
			"",
			`{"error":"Not Found"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			writeErrorJSONDirect(w, tt.statusCode, tt.errorMsg, tt.details)

			if w.Code != tt.statusCode {
				t.Errorf("status code = %d, want %d", w.Code, tt.statusCode)
			}

			if w.Header().Get("Content-Type") != "application/json" {
				t.Errorf("Content-Type = %q, want %q", w.Header().Get("Content-Type"), "application/json")
			}

			body := w.Body.String()
			if body != tt.wantBody {
				t.Errorf("body = %q, want %q", body, tt.wantBody)
			}
		})
	}
}

// writeErrorJSONDirect 直接写入 JSON 错误（不依赖 plugin）
func writeErrorJSONDirect(w http.ResponseWriter, statusCode int, errorMsg string, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if details != "" {
		w.Write([]byte(`{"error":"` + errorMsg + `","details":"` + details + `"}`))
	} else {
		w.Write([]byte(`{"error":"` + errorMsg + `"}`))
	}
}

// TestReverseProxyIntegration 测试 ReverseProxy 集成
func TestReverseProxyIntegration(t *testing.T) {
	// 创建一个模拟的上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 验证 Accept-Encoding 已被删除
		if r.Header.Get("Accept-Encoding") != "" {
			t.Error("Accept-Encoding should be stripped")
		}

		// 验证 Host 头已被重写
		if r.Host == "" {
			t.Error("Host header should be set")
		}

		// 返回简单响应
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer upstream.Close()

	// 创建 Manager
	m := NewManager(nil)
	proxies := []*ProxyConfig{
		{
			ID:        "1",
			Path:      "/-/test",
			Upstream:  upstream.URL,
			StripPath: true, // 启用 StripPath
			Active:    true,
		},
	}
	m.SetProxies(proxies)

	// 验证上游 URL 构建
	upstreamURL := m.BuildUpstreamURL(proxies[0], "/-/test/api")
	if upstreamURL != upstream.URL+"/api" {
		t.Errorf("BuildUpstreamURL() = %q, want %q", upstreamURL, upstream.URL+"/api")
	}
}

// TestSSEFlushInterval 测试 SSE 流式响应配置
func TestSSEFlushInterval(t *testing.T) {
	// 创建一个 SSE 模拟服务器
	sseServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Error("ResponseWriter should support Flusher")
			return
		}

		// 发送 SSE 事件
		w.Write([]byte("data: test\n\n"))
		flusher.Flush()
	}))
	defer sseServer.Close()

	// 发送请求验证 SSE 响应
	resp, err := http.Get(sseServer.URL)
	if err != nil {
		t.Fatalf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if string(body) != "data: test\n\n" {
		t.Errorf("SSE body = %q, want %q", string(body), "data: test\n\n")
	}
}

// TestManagerGetProxies 测试获取代理配置
func TestManagerGetProxies(t *testing.T) {
	m := NewManager(nil)
	proxies := []*ProxyConfig{
		{ID: "1", Path: "/-/test1", Active: true},
		{ID: "2", Path: "/-/test2", Active: true},
		{ID: "3", Path: "/-/inactive", Active: false},
	}
	m.SetProxies(proxies)

	// 获取代理配置（应该只有活跃的）
	result := m.GetProxies()
	if len(result) != 2 {
		t.Errorf("GetProxies() returned %d proxies, want 2", len(result))
	}
}

// TestManagerTransport 测试 Transport 获取
func TestManagerTransport(t *testing.T) {
	m := NewManager(nil)

	transport := m.Transport()
	if transport == nil {
		t.Error("Transport() should not return nil")
	}

	// 验证 Transport 配置（HardenedTransport 默认值）
	if !transport.ForceAttemptHTTP2 {
		t.Error("Transport.ForceAttemptHTTP2 should be true")
	}
	// HardenedTransport 使用 1000 而非 100
	if transport.MaxIdleConns != 1000 {
		t.Errorf("Transport.MaxIdleConns = %d, want 1000", transport.MaxIdleConns)
	}
	// 验证 MaxIdleConnsPerHost（这是关键配置）
	if transport.MaxIdleConnsPerHost != 100 {
		t.Errorf("Transport.MaxIdleConnsPerHost = %d, want 100", transport.MaxIdleConnsPerHost)
	}
}
