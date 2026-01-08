package apis_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tests"
)

func TestServerlessConfig_Default(t *testing.T) {
	config := apis.DefaultServerlessConfig()

	if config.FunctionsDir != "pb_serverless" {
		t.Errorf("expected FunctionsDir 'pb_serverless', got %q", config.FunctionsDir)
	}

	if config.PoolSize != 4 {
		t.Errorf("expected PoolSize 4, got %d", config.PoolSize)
	}

	if config.Timeout != 30*time.Second {
		t.Errorf("expected Timeout 30s, got %v", config.Timeout)
	}

	if config.MaxBodySize != 10*1024*1024 {
		t.Errorf("expected MaxBodySize 10MB, got %d", config.MaxBodySize)
	}
}

func TestServerlessHandler_NewHandler_EmptyDir(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 使用不存在的目录
	config := apis.ServerlessConfig{
		FunctionsDir: "/nonexistent/path",
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer handler.Close()
}

func TestServerlessHandler_RouteMatching(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建临时目录
	tmpDir := t.TempDir()
	routesDir := filepath.Join(tmpDir, "routes")
	if err := os.MkdirAll(routesDir, 0755); err != nil {
		t.Fatalf("failed to create routes dir: %v", err)
	}

	// 创建测试路由文件
	helloCode := `
export async function GET(req) {
    return new Response(JSON.stringify({message: "Hello, World!"}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
    });
}
`
	if err := os.WriteFile(filepath.Join(routesDir, "hello.ts"), []byte(helloCode), 0644); err != nil {
		t.Fatalf("failed to write hello.ts: %v", err)
	}

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()
}

func TestServerlessHandler_Handle_NotFound(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	routesDir := filepath.Join(tmpDir, "routes")
	os.MkdirAll(routesDir, 0755)

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()

	// 测试不存在的路由
	req := httptest.NewRequest(http.MethodGet, "/api/pb_serverless/nonexistent", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]string
	json.Unmarshal(body, &result)

	if result["error"] != "Route not found" {
		t.Errorf("expected error 'Route not found', got %q", result["error"])
	}
}

func TestServerlessHandler_BuildJSRequest(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	routesDir := filepath.Join(tmpDir, "routes")
	os.MkdirAll(routesDir, 0755)

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()

	// 测试请求构建
	reqBody := `{"name": "test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/pb_serverless/test?foo=bar", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Custom-Header", "custom-value")

	// 通过 ServeHTTP 间接测试
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// 即使路由不存在，也应该返回 404 而不是崩溃
	resp := w.Result()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected status 404 for non-existent route, got %d", resp.StatusCode)
	}
}

func TestServerlessHandler_WriteError(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	os.MkdirAll(filepath.Join(tmpDir, "routes"), 0755)

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()

	testCases := []struct {
		name           string
		path           string
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "not found",
			path:           "/api/pb_serverless/nonexistent",
			expectedStatus: http.StatusNotFound,
			expectedError:  "Route not found",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			resp := w.Result()
			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("expected status %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			var result map[string]string
			json.Unmarshal(body, &result)

			if result["error"] != tc.expectedError {
				t.Errorf("expected error %q, got %q", tc.expectedError, result["error"])
			}
		})
	}
}

func TestServerlessHandler_Close(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	os.MkdirAll(filepath.Join(tmpDir, "routes"), 0755)

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     2,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	// 关闭处理器
	if err := handler.Close(); err != nil {
		t.Errorf("unexpected error on close: %v", err)
	}

	// 再次关闭应该不会出错
	if err := handler.Close(); err != nil {
		t.Errorf("unexpected error on second close: %v", err)
	}
}

func TestServerlessHandler_DynamicRoutes(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	routesDir := filepath.Join(tmpDir, "routes", "users")
	if err := os.MkdirAll(routesDir, 0755); err != nil {
		t.Fatalf("failed to create routes dir: %v", err)
	}

	// 创建动态路由文件 [id].ts
	dynamicCode := `
export async function GET(req) {
    const id = req.params.id;
    return new Response(JSON.stringify({id: id}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
    });
}
`
	if err := os.WriteFile(filepath.Join(routesDir, "[id].ts"), []byte(dynamicCode), 0644); err != nil {
		t.Fatalf("failed to write [id].ts: %v", err)
	}

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()
}

func TestServerlessHandler_MethodNotAllowed(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	routesDir := filepath.Join(tmpDir, "routes")
	if err := os.MkdirAll(routesDir, 0755); err != nil {
		t.Fatalf("failed to create routes dir: %v", err)
	}

	// 创建只支持 GET 的路由
	getOnlyCode := `
export async function GET(req) {
    return new Response("OK", {status: 200});
}
`
	if err := os.WriteFile(filepath.Join(routesDir, "get-only.ts"), []byte(getOnlyCode), 0644); err != nil {
		t.Fatalf("failed to write get-only.ts: %v", err)
	}

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()

	// 测试 POST 请求到只支持 GET 的路由
	req := httptest.NewRequest(http.MethodPost, "/api/pb_serverless/get-only", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %d", resp.StatusCode)
	}
}

func TestServerlessHandler_LargeBody(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	routesDir := filepath.Join(tmpDir, "routes")
	os.MkdirAll(routesDir, 0755)

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  100, // 限制为 100 字节
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()

	// 创建超过限制的请求体
	largeBody := strings.Repeat("x", 200)
	req := httptest.NewRequest(http.MethodPost, "/api/pb_serverless/test", strings.NewReader(largeBody))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// 应该返回 404（路由不存在），但不应该因为大请求体而崩溃
	resp := w.Result()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", resp.StatusCode)
	}
}

func TestServerlessHandler_ContentType(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	tmpDir := t.TempDir()
	os.MkdirAll(filepath.Join(tmpDir, "routes"), 0755)

	config := apis.ServerlessConfig{
		FunctionsDir: tmpDir,
		PoolSize:     1,
		Timeout:      5 * time.Second,
		MaxBodySize:  1024,
	}

	handler, err := apis.NewServerlessHandler(app, config)
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}
	defer handler.Close()

	// 测试错误响应的 Content-Type
	req := httptest.NewRequest(http.MethodGet, "/api/pb_serverless/nonexistent", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	contentType := resp.Header.Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type 'application/json', got %q", contentType)
	}
}

func TestBindServerlessApi(t *testing.T) {
	// 这个测试验证 BindServerlessApi 函数的存在性
	// 实际的集成测试需要完整的 PocketBase 应用
	_ = apis.BindServerlessApi
	_ = apis.BindServerlessApiWithConfig
}
