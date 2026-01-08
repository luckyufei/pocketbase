package core_test

import (
	"net/http"
	"net/http/httptest"
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
