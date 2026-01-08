package core_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestProxyCollectionName(t *testing.T) {
	// 验证常量定义正确
	if core.CollectionNameProxies != "_proxies" {
		t.Errorf("expected CollectionNameProxies to be '_proxies', got %q", core.CollectionNameProxies)
	}
}

func TestValidateProxyPath(t *testing.T) {
	testCases := []struct {
		name      string
		path      string
		expectErr bool
	}{
		// 有效路径
		{"valid gateway path", "/-/openai", false},
		{"valid gateway nested path", "/-/openai/v1", false},
		{"valid custom absolute path", "/v1/chat/completions", false},
		{"valid webhook path", "/webhooks/stripe", false},

		// 无效路径 - 禁止 /api/
		{"invalid api path", "/api/users", true},
		{"invalid api nested path", "/api/collections/users", true},

		// 无效路径 - 禁止 /_/
		{"invalid admin path", "/_/admin", true},
		{"invalid admin nested path", "/_/settings/mail", true},

		// 边界情况
		{"empty path", "", true},
		{"path without leading slash", "openai", true},
		{"root path", "/", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := core.ValidateProxyPath(tc.path)
			if tc.expectErr && err == nil {
				t.Errorf("expected error for path %q, got nil", tc.path)
			}
			if !tc.expectErr && err != nil {
				t.Errorf("expected no error for path %q, got %v", tc.path, err)
			}
		})
	}
}

func TestNewProxy(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	proxy := core.NewProxy(app)
	if proxy == nil {
		t.Fatal("expected proxy to be non-nil")
	}

	// 验证 proxy 实现了 RecordProxy 接口
	var _ core.RecordProxy = proxy

	// 验证 ProxyRecord 方法
	if proxy.ProxyRecord() == nil {
		t.Error("expected ProxyRecord() to return non-nil Record")
	}
}

func TestProxyGettersSetters(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	proxy := core.NewProxy(app)

	// 测试 Path
	proxy.SetPath("/-/test")
	if proxy.Path() != "/-/test" {
		t.Errorf("expected Path() to be '/-/test', got %q", proxy.Path())
	}

	// 测试 Upstream
	proxy.SetUpstream("https://api.example.com")
	if proxy.Upstream() != "https://api.example.com" {
		t.Errorf("expected Upstream() to be 'https://api.example.com', got %q", proxy.Upstream())
	}

	// 测试 StripPath
	proxy.SetStripPath(true)
	if !proxy.StripPath() {
		t.Error("expected StripPath() to be true")
	}
	proxy.SetStripPath(false)
	if proxy.StripPath() {
		t.Error("expected StripPath() to be false")
	}

	// 测试 AccessRule
	proxy.SetAccessRule("@request.auth.id != ''")
	if proxy.AccessRule() != "@request.auth.id != ''" {
		t.Errorf("expected AccessRule() to be '@request.auth.id != ''', got %q", proxy.AccessRule())
	}

	// 测试 Timeout
	proxy.SetTimeout(60)
	if proxy.Timeout() != 60 {
		t.Errorf("expected Timeout() to be 60, got %d", proxy.Timeout())
	}

	// 测试 Active
	proxy.SetActive(true)
	if !proxy.Active() {
		t.Error("expected Active() to be true")
	}
	proxy.SetActive(false)
	if proxy.Active() {
		t.Error("expected Active() to be false")
	}

	// 测试 Headers (JSON)
	headers := map[string]string{
		"Authorization": "Bearer {secret.API_KEY}",
		"X-Custom":      "value",
	}
	proxy.SetHeaders(headers)
	gotHeaders := proxy.Headers()
	if gotHeaders["Authorization"] != headers["Authorization"] {
		t.Errorf("expected Authorization header to be %q, got %q", headers["Authorization"], gotHeaders["Authorization"])
	}
}

func TestProxyTableName(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	proxy := core.NewProxy(app)
	if proxy.TableName() != "_proxies" {
		t.Errorf("expected TableName() to be '_proxies', got %q", proxy.TableName())
	}
}
