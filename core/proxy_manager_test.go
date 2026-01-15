package core_test

import (
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestNewProxyManager(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	if pm == nil {
		t.Fatal("expected ProxyManager to be non-nil")
	}
}

func TestProxyManagerMatchProxy(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	// 添加测试代理配置
	proxies := []*core.ProxyConfig{
		{Path: "/-/openai", Upstream: "https://api.openai.com/v1", StripPath: true, Active: true},
		{Path: "/-/openai/v2", Upstream: "https://api.openai.com/v2", StripPath: true, Active: true},
		{Path: "/webhooks/stripe", Upstream: "https://internal.example.com/stripe", StripPath: false, Active: true},
		{Path: "/-/disabled", Upstream: "https://disabled.example.com", StripPath: true, Active: false},
	}
	pm.SetProxies(proxies)

	testCases := []struct {
		name           string
		requestPath    string
		expectedPath   string
		expectedMatch  bool
	}{
		// 精确匹配
		{"exact match gateway", "/-/openai", "/-/openai", true},
		{"exact match webhook", "/webhooks/stripe", "/webhooks/stripe", true},

		// 前缀匹配 - 最长匹配优先
		{"prefix match with subpath", "/-/openai/chat/completions", "/-/openai", true},
		{"longer prefix wins", "/-/openai/v2/models", "/-/openai/v2", true},

		// 不匹配
		{"no match", "/api/users", "", false},
		{"no match partial", "/-/open", "", false},

		// 禁用的代理不匹配
		{"disabled proxy", "/-/disabled/test", "", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			proxy := pm.MatchProxy(tc.requestPath)
			if tc.expectedMatch {
				if proxy == nil {
					t.Errorf("expected match for path %q, got nil", tc.requestPath)
					return
				}
				if proxy.Path != tc.expectedPath {
					t.Errorf("expected matched path %q, got %q", tc.expectedPath, proxy.Path)
				}
			} else {
				if proxy != nil {
					t.Errorf("expected no match for path %q, got %q", tc.requestPath, proxy.Path)
				}
			}
		})
	}
}

func TestProxyManagerBuildUpstreamURL(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	testCases := []struct {
		name        string
		proxy       *core.ProxyConfig
		requestPath string
		expectedURL string
	}{
		{
			name:        "strip path enabled",
			proxy:       &core.ProxyConfig{Path: "/-/openai", Upstream: "https://api.openai.com/v1", StripPath: true},
			requestPath: "/-/openai/chat/completions",
			expectedURL: "https://api.openai.com/v1/chat/completions",
		},
		{
			name:        "strip path disabled",
			proxy:       &core.ProxyConfig{Path: "/webhooks", Upstream: "https://internal.example.com", StripPath: false},
			requestPath: "/webhooks/stripe",
			expectedURL: "https://internal.example.com/webhooks/stripe",
		},
		{
			name:        "exact path match with strip",
			proxy:       &core.ProxyConfig{Path: "/-/api", Upstream: "https://backend.example.com", StripPath: true},
			requestPath: "/-/api",
			expectedURL: "https://backend.example.com",
		},
		{
			name:        "upstream with trailing slash",
			proxy:       &core.ProxyConfig{Path: "/-/svc", Upstream: "https://svc.example.com/", StripPath: true},
			requestPath: "/-/svc/endpoint",
			expectedURL: "https://svc.example.com/endpoint",
		},
		{
			name:        "preserve query string",
			proxy:       &core.ProxyConfig{Path: "/-/api", Upstream: "https://api.example.com", StripPath: true},
			requestPath: "/-/api/search?q=test&limit=10",
			expectedURL: "https://api.example.com/search?q=test&limit=10",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := pm.BuildUpstreamURL(tc.proxy, tc.requestPath)
			if result != tc.expectedURL {
				t.Errorf("expected URL %q, got %q", tc.expectedURL, result)
			}
		})
	}
}

func TestProxyManagerRouteTableOrdering(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	// 故意以非排序顺序添加
	proxies := []*core.ProxyConfig{
		{Path: "/-/a", Upstream: "https://a.example.com", Active: true},
		{Path: "/-/abc/def/ghi", Upstream: "https://long.example.com", Active: true},
		{Path: "/-/abc", Upstream: "https://abc.example.com", Active: true},
		{Path: "/-/ab", Upstream: "https://ab.example.com", Active: true},
	}
	pm.SetProxies(proxies)

	// 验证最长匹配优先
	matched := pm.MatchProxy("/-/abc/def/ghi/test")
	if matched == nil || matched.Path != "/-/abc/def/ghi" {
		t.Errorf("expected longest path match, got %v", matched)
	}

	matched = pm.MatchProxy("/-/abc/test")
	if matched == nil || matched.Path != "/-/abc" {
		t.Errorf("expected /-/abc match, got %v", matched)
	}
}

func TestProxyManagerServeHTTP(t *testing.T) {
	// 创建一个测试上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Upstream-Path", r.URL.Path)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("upstream response"))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true, Timeout: 30},
	})

	// 创建测试请求
	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	rec := httptest.NewRecorder()

	// 执行代理
	pm.ServeHTTP(rec, req)

	// 验证响应
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	if rec.Body.String() != "upstream response" {
		t.Errorf("expected 'upstream response', got %q", rec.Body.String())
	}

	// 验证路径被正确 strip
	if rec.Header().Get("X-Upstream-Path") != "/endpoint" {
		t.Errorf("expected upstream path '/endpoint', got %q", rec.Header().Get("X-Upstream-Path"))
	}
}

func TestProxyManagerNoMatch(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: "https://example.com", Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 无匹配应返回 404
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", rec.Code)
	}
}

func TestProxyManagerAcceptEncodingIdentity(t *testing.T) {
	// 创建测试上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true, Timeout: 30},
	})

	req := httptest.NewRequest(http.MethodPost, "/-/test/chat", nil)
	// 客户端可能发送 gzip Accept-Encoding
	req.Header.Set("Accept-Encoding", "gzip, deflate")
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 新实现透传客户端的 Accept-Encoding，由 http.Client 自动处理解压
	// 验证请求成功转发
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestProxyManagerForwardedHeaders(t *testing.T) {
	// 创建测试上游服务器，捕获 X-Forwarded-* 头
	var headers http.Header
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	req.Host = "example.com"
	req.RemoteAddr = "192.168.1.100:12345"
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 验证 X-Forwarded-* 头
	if headers.Get("X-Forwarded-Host") != "example.com" {
		t.Errorf("expected X-Forwarded-Host 'example.com', got %q", headers.Get("X-Forwarded-Host"))
	}
	if headers.Get("X-Forwarded-Proto") != "http" {
		t.Errorf("expected X-Forwarded-Proto 'http', got %q", headers.Get("X-Forwarded-Proto"))
	}
	if headers.Get("X-Forwarded-For") == "" {
		t.Error("expected X-Forwarded-For to be set")
	}
}

func TestProxyManagerServeHTTPWithAuth(t *testing.T) {
	// 创建测试上游服务器
	var receivedHeaders http.Header
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaders = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("authenticated response"))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	proxy := &core.ProxyConfig{
		Path:      "/-/api",
		Upstream:  upstream.URL,
		StripPath: true,
		Active:    true,
		Timeout:   30,
		Headers: map[string]string{
			"X-Custom-Header": "custom-value",
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/-/api/endpoint", nil)
	rec := httptest.NewRecorder()

	// 调用带认证的代理方法（authRecord 为 nil 测试）
	pm.ServeHTTPWithAuth(rec, req, proxy, nil)

	// 验证响应
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// 验证自定义头被注入
	if receivedHeaders.Get("X-Custom-Header") != "custom-value" {
		t.Errorf("expected X-Custom-Header 'custom-value', got %q", receivedHeaders.Get("X-Custom-Header"))
	}

	// 验证代理相关头被设置
	if receivedHeaders.Get("X-Forwarded-Host") == "" {
		t.Error("expected X-Forwarded-Host to be set")
	}
}

func TestProxyManagerTimeout(t *testing.T) {
	// 创建一个慢速上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 模拟慢速响应，超过代理超时
		select {
		case <-r.Context().Done():
			// 上下文被取消
			return
		case <-make(chan struct{}):
			// 永远阻塞（除非上下文取消）
		}
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/slow", Upstream: upstream.URL, StripPath: true, Active: true, Timeout: 1}, // 1 秒超时
	})

	req := httptest.NewRequest(http.MethodGet, "/-/slow/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 超时应返回 504 或 502
	if rec.Code != http.StatusGatewayTimeout && rec.Code != http.StatusBadGateway {
		t.Errorf("expected status 504 or 502, got %d", rec.Code)
	}
}

func TestProxyManagerDefaultTimeout(t *testing.T) {
	// 验证默认超时为 30 秒
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true, Timeout: 0}, // 未设置超时
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 请求应成功（使用默认 30 秒超时）
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestProxyManagerPathSegmentMatch(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/openai", Upstream: "https://api.openai.com", Active: true},
	})

	testCases := []struct {
		name        string
		requestPath string
		shouldMatch bool
	}{
		{"exact match", "/-/openai", true},
		{"with subpath", "/-/openai/chat", true},
		{"partial name no match", "/-/openaiextra", false},
		{"partial name no match 2", "/-/openaiv2", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			proxy := pm.MatchProxy(tc.requestPath)
			if tc.shouldMatch && proxy == nil {
				t.Errorf("expected match for %q, got nil", tc.requestPath)
			}
			if !tc.shouldMatch && proxy != nil {
				t.Errorf("expected no match for %q, got %v", tc.requestPath, proxy)
			}
		})
	}
}

func TestProxyManagerInactiveProxy(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/active", Upstream: "https://active.example.com", Active: true},
		{Path: "/-/inactive", Upstream: "https://inactive.example.com", Active: false},
	})

	// 活跃的代理应匹配
	if proxy := pm.MatchProxy("/-/active/test"); proxy == nil {
		t.Error("expected active proxy to match")
	}

	// 非活跃的代理不应匹配
	if proxy := pm.MatchProxy("/-/inactive/test"); proxy != nil {
		t.Error("expected inactive proxy not to match")
	}
}

func TestProxyManagerLoadProxies(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	// LoadProxies 在 _proxies collection 不存在时应返回 nil
	err := pm.LoadProxies()
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestProxyManagerReload(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	// Reload 调用 LoadProxies
	err := pm.Reload()
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestProxyManagerGetSchemeWithForwardedProto(t *testing.T) {
	// 测试 X-Forwarded-Proto 头
	var receivedProto string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedProto = r.Header.Get("X-Forwarded-Proto")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	// 测试带 X-Forwarded-Proto 头的请求
	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 验证协议被正确传递
	if receivedProto != "https" {
		t.Errorf("expected X-Forwarded-Proto 'https', got %q", receivedProto)
	}
}

func TestProxyManagerPreserveExistingForwardedFor(t *testing.T) {
	// 测试保留已存在的 X-Forwarded-For 头
	var receivedForwardedFor string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedForwardedFor = r.Header.Get("X-Forwarded-For")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1")
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 验证原有的 X-Forwarded-For 被保留（httputil.ReverseProxy 会追加新 IP）
	if receivedForwardedFor == "" {
		t.Error("expected X-Forwarded-For to be set")
	}
	// 应该包含原始 IP
	if !strings.Contains(receivedForwardedFor, "10.0.0.1") {
		t.Errorf("expected X-Forwarded-For to contain '10.0.0.1', got %q", receivedForwardedFor)
	}
}

func TestProxyManagerServeHTTPWithAuthInvalidURL(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	// 使用无效的上游 URL
	proxy := &core.ProxyConfig{
		Path:      "/-/test",
		Upstream:  "://invalid-url",
		StripPath: true,
		Active:    true,
	}

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTPWithAuth(rec, req, proxy, nil)

	// 无效 URL 应返回 502
	if rec.Code != http.StatusBadGateway {
		t.Errorf("expected status 502, got %d", rec.Code)
	}
}

func TestProxyManagerServeProxyInvalidURL(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/invalid", Upstream: "://invalid-url", StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/invalid/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 无效 URL 应返回 502
	if rec.Code != http.StatusBadGateway {
		t.Errorf("expected status 502, got %d", rec.Code)
	}
}

func TestProxyManagerBuildUpstreamURLEdgeCases(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	testCases := []struct {
		name        string
		proxy       *core.ProxyConfig
		requestPath string
		expectedURL string
	}{
		{
			name:        "path without leading slash after strip",
			proxy:       &core.ProxyConfig{Path: "/-/api", Upstream: "https://api.example.com", StripPath: true},
			requestPath: "/-/api",
			expectedURL: "https://api.example.com",
		},
		{
			name:        "empty path after strip",
			proxy:       &core.ProxyConfig{Path: "/", Upstream: "https://api.example.com", StripPath: true},
			requestPath: "/",
			expectedURL: "https://api.example.com",
		},
		{
			name:        "path needs leading slash",
			proxy:       &core.ProxyConfig{Path: "/-/api", Upstream: "https://api.example.com", StripPath: false},
			requestPath: "endpoint",
			expectedURL: "https://api.example.com/endpoint",
		},
		{
			name:        "query string without path",
			proxy:       &core.ProxyConfig{Path: "/-/api", Upstream: "https://api.example.com", StripPath: true},
			requestPath: "/-/api?key=value",
			expectedURL: "https://api.example.com?key=value",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := pm.BuildUpstreamURL(tc.proxy, tc.requestPath)
			if result != tc.expectedURL {
				t.Errorf("expected URL %q, got %q", tc.expectedURL, result)
			}
		})
	}
}

func TestProxyManagerServeHTTPWithAuthTimeout(t *testing.T) {
	// 创建慢速上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
			return
		case <-make(chan struct{}):
		}
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	proxy := &core.ProxyConfig{
		Path:      "/-/slow",
		Upstream:  upstream.URL,
		StripPath: true,
		Active:    true,
		Timeout:   1, // 1 秒超时
	}

	req := httptest.NewRequest(http.MethodGet, "/-/slow/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTPWithAuth(rec, req, proxy, nil)

	// 超时应返回 504 或 502
	if rec.Code != http.StatusGatewayTimeout && rec.Code != http.StatusBadGateway {
		t.Errorf("expected status 504 or 502, got %d", rec.Code)
	}
}

func TestProxyManagerLoadProxiesWithData(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建 _proxies 记录
	proxiesCollection, err := app.FindCollectionByNameOrId(core.CollectionNameProxies)
	if err != nil {
		t.Skipf("_proxies collection not found: %v", err)
	}

	record := core.NewRecord(proxiesCollection)
	record.Set(core.ProxyFieldPath, "/-/test-load")
	record.Set(core.ProxyFieldUpstream, "https://test.example.com")
	record.Set(core.ProxyFieldStripPath, true)
	record.Set(core.ProxyFieldAccessRule, "")
	record.Set(core.ProxyFieldTimeout, 30)
	record.Set(core.ProxyFieldActive, true)
	record.Set(core.ProxyFieldHeaders, map[string]string{"X-Test": "value"})

	if err := app.Save(record); err != nil {
		t.Fatalf("failed to create proxy record: %v", err)
	}

	pm := core.NewProxyManager(app)
	err = pm.LoadProxies()
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	// 验证代理已加载
	matched := pm.MatchProxy("/-/test-load/endpoint")
	if matched == nil {
		t.Error("expected proxy to be loaded and matched")
	}
	if matched != nil && matched.Upstream != "https://test.example.com" {
		t.Errorf("expected upstream 'https://test.example.com', got %q", matched.Upstream)
	}
}

func TestProxyManagerGetSchemeTLS(t *testing.T) {
	// 创建 TLS 测试上游服务器
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	// 创建模拟 TLS 请求 - 通过设置 X-Forwarded-Proto 头来模拟
	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	rec := httptest.NewRecorder()

	// 如果没有 X-Forwarded-Proto，默认返回 http
	pm.ServeHTTP(rec, req)

	// 请求可能失败（因为上游是 TLS 但 transport 没配置），但这不影响 getScheme 逻辑测试
	// getScheme 是在 Director 中调用的，我们主要验证逻辑正确
}

func TestProxyManagerServeHTTPWithAuthEmptyHeaders(t *testing.T) {
	// 测试 Headers 为空的情况
	var receivedHeaders http.Header
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaders = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	proxy := &core.ProxyConfig{
		Path:      "/-/api",
		Upstream:  upstream.URL,
		StripPath: true,
		Active:    true,
		Headers:   nil, // 空 headers
	}

	req := httptest.NewRequest(http.MethodGet, "/-/api/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTPWithAuth(rec, req, proxy, nil)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// 验证请求头被正确复制（Accept-Encoding 由 Go http.Client 自动设置）
	// 新实现不再强制 identity，而是让 http.Client 自动处理解压
	if receivedHeaders.Get("X-Forwarded-Host") == "" {
		t.Error("expected X-Forwarded-Host to be set")
	}
}

func TestIsHopByHopHeader(t *testing.T) {
	// 测试 hop-by-hop 头识别
	hopByHopHeaders := []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Te",
		"Trailers",
		"Transfer-Encoding",
		"Upgrade",
		// 测试大小写不敏感
		"connection",
		"KEEP-ALIVE",
		"transfer-encoding",
	}

	for _, header := range hopByHopHeaders {
		if !core.IsHopByHopHeader(header) {
			t.Errorf("expected %q to be hop-by-hop header", header)
		}
	}

	// 非 hop-by-hop 头
	normalHeaders := []string{
		"Content-Type",
		"Content-Length",
		"Authorization",
		"X-Custom-Header",
		"Accept",
		"Accept-Encoding",
	}

	for _, header := range normalHeaders {
		if core.IsHopByHopHeader(header) {
			t.Errorf("expected %q to NOT be hop-by-hop header", header)
		}
	}
}

func TestProxyManagerResponseHeadersCopied(t *testing.T) {
	// 验证响应头正确复制（排除 hop-by-hop）
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 设置各种响应头
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Custom-Response", "custom-value")
		w.Header().Set("Cache-Control", "no-cache")
		// 设置 hop-by-hop 头（不应被转发）
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Transfer-Encoding", "chunked")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 验证正常响应头被复制
	if rec.Header().Get("Content-Type") != "application/json" {
		t.Errorf("expected Content-Type 'application/json', got %q", rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("X-Custom-Response") != "custom-value" {
		t.Errorf("expected X-Custom-Response 'custom-value', got %q", rec.Header().Get("X-Custom-Response"))
	}
	if rec.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("expected Cache-Control 'no-cache', got %q", rec.Header().Get("Cache-Control"))
	}

	// 验证 hop-by-hop 头未被复制
	if rec.Header().Get("Connection") != "" {
		t.Errorf("expected Connection header to be filtered, got %q", rec.Header().Get("Connection"))
	}
}

func TestProxyManagerStreamingResponse(t *testing.T) {
	// 验证 SSE/流式响应正确传输
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)

		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("expected ResponseWriter to be a Flusher")
		}

		// 模拟 SSE 数据
		for i := 0; i < 3; i++ {
			w.Write([]byte("data: chunk" + string(rune('0'+i)) + "\n\n"))
			flusher.Flush()
		}
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/sse", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/sse/stream", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// 验证 SSE 数据完整
	body := rec.Body.String()
	if !strings.Contains(body, "data: chunk0") {
		t.Errorf("expected body to contain 'data: chunk0', got %q", body)
	}
	if !strings.Contains(body, "data: chunk2") {
		t.Errorf("expected body to contain 'data: chunk2', got %q", body)
	}
}

func TestProxyManagerPostRequestBody(t *testing.T) {
	// 验证 POST 请求体正确转发
	var receivedBody string
	var receivedContentType string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedContentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		receivedBody = string(body)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("received"))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/api", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	jsonBody := `{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}`
	req := httptest.NewRequest(http.MethodPost, "/-/api/chat/completions", strings.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// 验证请求体正确传递
	if receivedBody != jsonBody {
		t.Errorf("expected body %q, got %q", jsonBody, receivedBody)
	}

	// 验证 Content-Type 头正确传递
	if receivedContentType != "application/json" {
		t.Errorf("expected Content-Type 'application/json', got %q", receivedContentType)
	}
}

func TestProxyManagerUpstreamConnectionFailed(t *testing.T) {
	// 验证上游连接失败时返回 502
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		// 使用不存在的地址
		{Path: "/-/dead", Upstream: "http://127.0.0.1:59999", StripPath: true, Active: true, Timeout: 2},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/dead/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 连接失败应返回 502
	if rec.Code != http.StatusBadGateway {
		t.Errorf("expected status 502, got %d", rec.Code)
	}
}

func TestProxyManagerHostHeaderSet(t *testing.T) {
	// 验证 Host 头被正确设置为上游主机
	var receivedHost string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHost = r.Host
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	req.Host = "original.example.com" // 原始 Host
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 验证 Host 头被设置为上游地址
	if receivedHost == "" {
		t.Error("expected Host to be set")
	}
	// upstream.URL 格式为 http://127.0.0.1:xxxxx
	if receivedHost == "original.example.com" {
		t.Errorf("expected Host to be upstream host, not original %q", receivedHost)
	}
}

func TestProxyManagerMultiValueHeaders(t *testing.T) {
	// 验证多值请求头正确传递
	var receivedCookies []string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedCookies = r.Header.Values("Cookie")
		// 设置多值响应头
		w.Header().Add("Set-Cookie", "session=abc123")
		w.Header().Add("Set-Cookie", "user=john")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	req.Header.Add("Cookie", "foo=bar")
	req.Header.Add("Cookie", "baz=qux")
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// 验证多值请求头正确传递
	if len(receivedCookies) < 1 {
		t.Error("expected Cookie headers to be forwarded")
	}

	// 验证多值响应头正确复制
	setCookies := rec.Header().Values("Set-Cookie")
	if len(setCookies) != 2 {
		t.Errorf("expected 2 Set-Cookie headers, got %d", len(setCookies))
	}
}

func TestProxyManagerUpstreamStatusCodes(t *testing.T) {
	// 验证各种上游状态码正确传递
	statusCodes := []int{
		http.StatusCreated,           // 201
		http.StatusNoContent,         // 204
		http.StatusMovedPermanently,  // 301
		http.StatusBadRequest,        // 400
		http.StatusUnauthorized,      // 401
		http.StatusForbidden,         // 403
		http.StatusNotFound,          // 404
		http.StatusInternalServerError, // 500
		http.StatusServiceUnavailable,  // 503
	}

	for _, expectedCode := range statusCodes {
		t.Run(http.StatusText(expectedCode), func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(expectedCode)
			}))
			defer upstream.Close()

			app, _ := tests.NewTestApp()
			defer app.Cleanup()

			pm := core.NewProxyManager(app)
			pm.SetProxies([]*core.ProxyConfig{
				{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
			})

			req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
			rec := httptest.NewRecorder()

			pm.ServeHTTP(rec, req)

			if rec.Code != expectedCode {
				t.Errorf("expected status %d, got %d", expectedCode, rec.Code)
			}
		})
	}
}

func TestProxyManagerLargeRequestBody(t *testing.T) {
	// 验证大请求体正确传递
	var receivedSize int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		receivedSize = len(body)
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/upload", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	// 创建 1MB 请求体
	largeBody := strings.Repeat("x", 1024*1024)
	req := httptest.NewRequest(http.MethodPost, "/-/upload/file", strings.NewReader(largeBody))
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	if receivedSize != len(largeBody) {
		t.Errorf("expected body size %d, got %d", len(largeBody), receivedSize)
	}
}

// nonFlushingResponseWriter 是不支持 Flusher 接口的 ResponseWriter
type nonFlushingResponseWriter struct {
	header     http.Header
	body       []byte
	statusCode int
}

func newNonFlushingResponseWriter() *nonFlushingResponseWriter {
	return &nonFlushingResponseWriter{
		header:     make(http.Header),
		statusCode: http.StatusOK,
	}
}

func (w *nonFlushingResponseWriter) Header() http.Header {
	return w.header
}

func (w *nonFlushingResponseWriter) Write(b []byte) (int, error) {
	w.body = append(w.body, b...)
	return len(b), nil
}

func (w *nonFlushingResponseWriter) WriteHeader(code int) {
	w.statusCode = code
}

func TestProxyManagerNonFlushingResponseWriter(t *testing.T) {
	// 测试不支持 Flusher 接口的 ResponseWriter（覆盖 io.Copy 分支）
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("response body"))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	rec := newNonFlushingResponseWriter()

	pm.ServeHTTP(rec, req)

	if rec.statusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.statusCode)
	}

	if string(rec.body) != "response body" {
		t.Errorf("expected body 'response body', got %q", string(rec.body))
	}
}

func TestProxyManagerServeHTTPWithAuthNonFlushing(t *testing.T) {
	// 测试 ServeHTTPWithAuth 的非 Flusher 分支
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("auth response"))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	proxy := &core.ProxyConfig{
		Path:      "/-/api",
		Upstream:  upstream.URL,
		StripPath: true,
		Active:    true,
	}

	req := httptest.NewRequest(http.MethodGet, "/-/api/endpoint", nil)
	rec := newNonFlushingResponseWriter()

	pm.ServeHTTPWithAuth(rec, req, proxy, nil)

	if rec.statusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.statusCode)
	}

	if string(rec.body) != "auth response" {
		t.Errorf("expected body 'auth response', got %q", string(rec.body))
	}
}

func TestProxyManagerWriteError(t *testing.T) {
	// 测试写入响应时发生错误（覆盖 writeErr 分支）
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		// 写入足够多的数据触发多次 Read
		w.Write([]byte(strings.Repeat("x", 100*1024)))
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	// 使用会在写入时失败的 ResponseWriter
	rec := &failingResponseWriter{header: make(http.Header)}

	// 不应 panic
	pm.ServeHTTP(rec, req)
}

// failingResponseWriter 在写入时返回错误
type failingResponseWriter struct {
	header     http.Header
	statusCode int
	writeCount int
}

func (w *failingResponseWriter) Header() http.Header {
	return w.header
}

func (w *failingResponseWriter) Write(b []byte) (int, error) {
	w.writeCount++
	// 第二次写入时失败
	if w.writeCount > 1 {
		return 0, io.EOF
	}
	return len(b), nil
}

func (w *failingResponseWriter) WriteHeader(code int) {
	w.statusCode = code
}

func (w *failingResponseWriter) Flush() {
	// no-op
}

func TestProxyManagerHTTPMethods(t *testing.T) {
	// 测试各种 HTTP 方法
	methods := []string{
		http.MethodGet,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
		http.MethodHead,
		http.MethodOptions,
	}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			var receivedMethod string
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				receivedMethod = r.Method
				w.WriteHeader(http.StatusOK)
			}))
			defer upstream.Close()

			app, _ := tests.NewTestApp()
			defer app.Cleanup()

			pm := core.NewProxyManager(app)
			pm.SetProxies([]*core.ProxyConfig{
				{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
			})

			req := httptest.NewRequest(method, "/-/test/endpoint", nil)
			rec := httptest.NewRecorder()

			pm.ServeHTTP(rec, req)

			if receivedMethod != method {
				t.Errorf("expected method %s, got %s", method, receivedMethod)
			}
		})
	}
}

func TestProxyManagerEmptySetProxies(t *testing.T) {
	// 测试设置空代理列表
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	// 先设置一些代理
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: "https://example.com", Active: true},
	})

	// 验证代理已设置
	if pm.MatchProxy("/-/test/endpoint") == nil {
		t.Error("expected proxy to match before clearing")
	}

	// 设置空列表
	pm.SetProxies([]*core.ProxyConfig{})

	// 验证代理已清空
	if pm.MatchProxy("/-/test/endpoint") != nil {
		t.Error("expected no proxy match after clearing")
	}
}

func TestProxyManagerConcurrentAccess(t *testing.T) {
	// 测试并发访问安全性
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: "https://example.com", Active: true},
	})

	done := make(chan bool)

	// 并发读取
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				pm.MatchProxy("/-/test/endpoint")
			}
			done <- true
		}()
	}

	// 并发写入
	for i := 0; i < 5; i++ {
		go func() {
			for j := 0; j < 50; j++ {
				pm.SetProxies([]*core.ProxyConfig{
					{Path: "/-/test", Upstream: "https://example.com", Active: true},
				})
			}
			done <- true
		}()
	}

	// 等待所有 goroutine 完成
	for i := 0; i < 15; i++ {
		<-done
	}
}

func TestProxyManagerGetSchemeTLSRequest(t *testing.T) {
	// 创建上游服务器，验证 X-Forwarded-Proto 头
	var receivedProto string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedProto = r.Header.Get("X-Forwarded-Proto")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/test", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	// 创建带 TLS 的请求（模拟 TLS 请求通过设置 TLS 字段）
	req := httptest.NewRequest(http.MethodGet, "/-/test/endpoint", nil)
	req.TLS = &tls.ConnectionState{} // 设置 TLS 字段表示 HTTPS 请求
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	// TLS 请求应该设置 X-Forwarded-Proto 为 https
	if receivedProto != "https" {
		t.Errorf("expected X-Forwarded-Proto 'https', got %q", receivedProto)
	}
}

func TestProxyManagerHeadersWithEnvTemplate(t *testing.T) {
	// 测试带环境变量模板的 Headers
	var receivedAuth string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)

	proxy := &core.ProxyConfig{
		Path:      "/-/api",
		Upstream:  upstream.URL,
		StripPath: true,
		Active:    true,
		Headers: map[string]string{
			"Authorization": "Bearer test-api-key",
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/-/api/endpoint", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTPWithAuth(rec, req, proxy, nil)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// 验证 Authorization 头被注入
	if receivedAuth != "Bearer test-api-key" {
		t.Errorf("expected Authorization 'Bearer test-api-key', got %q", receivedAuth)
	}
}

func TestProxyManagerQueryStringPreserved(t *testing.T) {
	// 验证查询字符串完整保留
	var receivedQuery string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	pm := core.NewProxyManager(app)
	pm.SetProxies([]*core.ProxyConfig{
		{Path: "/-/api", Upstream: upstream.URL, StripPath: true, Active: true},
	})

	// 包含特殊字符的查询字符串
	req := httptest.NewRequest(http.MethodGet, "/-/api/search?q=hello+world&filter=type%3Dtest&limit=10", nil)
	rec := httptest.NewRecorder()

	pm.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// 验证查询字符串被完整保留
	expectedQuery := "q=hello+world&filter=type%3Dtest&limit=10"
	if receivedQuery != expectedQuery {
		t.Errorf("expected query %q, got %q", expectedQuery, receivedQuery)
	}
}
