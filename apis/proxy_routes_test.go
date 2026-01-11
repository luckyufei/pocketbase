package apis_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestProxyRouteBasic(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建测试上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Upstream", "true")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","path":"` + r.URL.Path + `"}`))
	}))
	defer upstream.Close()

	// 创建代理记录
	proxiesCol, err := app.FindCollectionByNameOrId(core.CollectionNameProxies)
	if err != nil {
		t.Fatalf("failed to find proxies collection: %v", err)
	}

	proxyRecord := core.NewRecord(proxiesCol)
	proxyRecord.Set(core.ProxyFieldPath, "/-/test")
	proxyRecord.Set(core.ProxyFieldUpstream, upstream.URL)
	proxyRecord.Set(core.ProxyFieldStripPath, true)
	proxyRecord.Set(core.ProxyFieldAccessRule, "true") // 公开访问
	proxyRecord.Set(core.ProxyFieldActive, true)
	proxyRecord.Set(core.ProxyFieldTimeout, 30)

	if err := app.Save(proxyRecord); err != nil {
		t.Fatalf("failed to save proxy record: %v", err)
	}

	// 等待 Hot Reload
	app.ProxyManager().Reload()

	scenarios := []struct {
		name           string
		path           string
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "proxy match with strip path",
			path:           "/-/test/hello",
			expectedStatus: http.StatusOK,
			expectedBody:   `"path":"/hello"`,
		},
		{
			name:           "proxy match root",
			path:           "/-/test",
			expectedStatus: http.StatusOK,
			expectedBody:   `"status":"ok"`,
		},
		{
			name:           "no matching proxy",
			path:           "/-/unknown",
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, s.path, nil)

			pbRouter, _ := apis.NewRouter(app)
			mux, _ := pbRouter.BuildMux()
			mux.ServeHTTP(rec, req)

			if rec.Code != s.expectedStatus {
				t.Errorf("expected status %d, got %d", s.expectedStatus, rec.Code)
			}

			if s.expectedBody != "" && rec.Code == http.StatusOK {
				body := rec.Body.String()
				if body == "" || !contains(body, s.expectedBody) {
					t.Errorf("expected body to contain %q, got %q", s.expectedBody, body)
				}
			}
		})
	}
}

func TestProxyRouteAccessControl(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建测试上游服务器
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer upstream.Close()

	// 创建需要认证的代理记录
	proxiesCol, _ := app.FindCollectionByNameOrId(core.CollectionNameProxies)

	proxyRecord := core.NewRecord(proxiesCol)
	proxyRecord.Set(core.ProxyFieldPath, "/-/auth-required")
	proxyRecord.Set(core.ProxyFieldUpstream, upstream.URL)
	proxyRecord.Set(core.ProxyFieldStripPath, true)
	proxyRecord.Set(core.ProxyFieldAccessRule, "@request.auth.id != ''") // 需要认证
	proxyRecord.Set(core.ProxyFieldActive, true)
	proxyRecord.Set(core.ProxyFieldTimeout, 30)

	if err := app.Save(proxyRecord); err != nil {
		t.Fatalf("failed to save proxy record: %v", err)
	}

	app.ProxyManager().Reload()

	// 测试未认证请求
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/-/auth-required/test", nil)

	pbRouter, _ := apis.NewRouter(app)
	mux, _ := pbRouter.BuildMux()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d for unauthenticated request, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestProxyRouteHeaderInjection(t *testing.T) {
	// 不使用 t.Parallel() 因为需要设置环境变量

	// 设置环境变量
	t.Setenv("TEST_API_KEY", "secret-key-123")

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建测试上游服务器，验证请求头
	var receivedHeaders http.Header
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaders = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer upstream.Close()

	// 创建带请求头注入的代理记录
	proxiesCol, _ := app.FindCollectionByNameOrId(core.CollectionNameProxies)

	proxyRecord := core.NewRecord(proxiesCol)
	proxyRecord.Set(core.ProxyFieldPath, "/-/headers")
	proxyRecord.Set(core.ProxyFieldUpstream, upstream.URL)
	proxyRecord.Set(core.ProxyFieldStripPath, true)
	proxyRecord.Set(core.ProxyFieldAccessRule, "true")
	proxyRecord.Set(core.ProxyFieldActive, true)
	proxyRecord.Set(core.ProxyFieldTimeout, 30)
	proxyRecord.Set(core.ProxyFieldHeaders, map[string]string{
		"X-Api-Key":    "{env.TEST_API_KEY}",
		"X-Custom":     "static-value",
	})

	if err := app.Save(proxyRecord); err != nil {
		t.Fatalf("failed to save proxy record: %v", err)
	}

	app.ProxyManager().Reload()

	// 发送请求
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/-/headers/test", nil)

	pbRouter, _ := apis.NewRouter(app)
	mux, _ := pbRouter.BuildMux()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	// 验证请求头注入
	if receivedHeaders.Get("X-Api-Key") != "secret-key-123" {
		t.Errorf("expected X-Api-Key header to be 'secret-key-123', got %q", receivedHeaders.Get("X-Api-Key"))
	}
	if receivedHeaders.Get("X-Custom") != "static-value" {
		t.Errorf("expected X-Custom header to be 'static-value', got %q", receivedHeaders.Get("X-Custom"))
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
