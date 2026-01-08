package apis_test

import (
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// TestTraceMiddlewareIntegration 测试追踪中间件集成
func TestTraceMiddlewareIntegration(t *testing.T) {
	const testDataDir = "./pb_trace_middleware_integration_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}

	// 创建路由器
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	// 构建 mux
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	// 创建测试请求
	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	// 执行请求
	mux.ServeHTTP(w, req)

	// 等待 trace flush
	time.Sleep(100 * time.Millisecond)
	app.Trace().Flush()

	// 验证是否有 trace 记录
	params := core.NewFilterParams()
	spans, total, err := app.Trace().Query(params)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if total == 0 {
		t.Error("Expected trace middleware to record spans, but got 0")
		return
	}

	// 验证 span 内容
	found := false
	for _, span := range spans {
		if span.Name == "GET /api/health" {
			found = true
			if span.Kind != core.SpanKindServer {
				t.Errorf("Expected span kind %v, got %v", core.SpanKindServer, span.Kind)
			}
			if span.Attributes["http.method"] != "GET" {
				t.Errorf("Expected http.method=GET, got %v", span.Attributes["http.method"])
			}
			if span.Status != core.SpanStatusOK {
				t.Errorf("Expected span status OK, got %v", span.Status)
			}
			break
		}
	}

	if !found {
		t.Error("Expected to find span with name 'GET /api/health'")
	}
}

// TestTraceMiddlewareIntegrationWithTraceparent 测试 traceparent 头解析
func TestTraceMiddlewareIntegrationWithTraceparent(t *testing.T) {
	const testDataDir = "./pb_trace_middleware_traceparent_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}

	// 创建路由器
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	// 构建 mux
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	// 创建带 traceparent 头的测试请求
	req := httptest.NewRequest("GET", "/api/health", nil)
	req.Header.Set("traceparent", "00-0123456789abcdef0123456789abcdef-fedcba9876543210-01")
	w := httptest.NewRecorder()

	// 执行请求
	mux.ServeHTTP(w, req)

	// 等待 trace flush
	time.Sleep(100 * time.Millisecond)
	app.Trace().Flush()

	// 验证是否有 trace 记录
	params := core.NewFilterParams()
	spans, total, err := app.Trace().Query(params)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if total == 0 {
		t.Error("Expected trace middleware to record spans, but got 0")
		return
	}

	// 验证 span 使用了 traceparent 中的 trace_id
	found := false
	for _, span := range spans {
		if span.Name == "GET /api/health" {
			found = true
			if span.TraceID != "0123456789abcdef0123456789abcdef" {
				t.Errorf("Expected trace_id from traceparent, got %v", span.TraceID)
			}
			if span.ParentID != "fedcba9876543210" {
				t.Errorf("Expected parent_id from traceparent, got %v", span.ParentID)
			}
			break
		}
	}

	if !found {
		t.Error("Expected to find span with name 'GET /api/health'")
	}
}