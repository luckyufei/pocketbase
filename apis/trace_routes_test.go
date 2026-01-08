package apis_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestTraceRoutesExist(t *testing.T) {
	const testDataDir = "./pb_trace_routes_test/"
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

	// 测试 /api/traces 路由存在（应该返回 403 Forbidden，因为没有 superuser 权限）
	req := httptest.NewRequest("GET", "/api/traces", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 for /api/traces without auth, got %d", w.Code)
	}

	// 测试 /api/traces/stats 路由存在（应该返回 403 Forbidden）
	req = httptest.NewRequest("GET", "/api/traces/stats", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 for /api/traces/stats without auth, got %d", w.Code)
	}

	// 测试 /api/traces/test-trace-id 路由存在（应该返回 403 Forbidden）
	req = httptest.NewRequest("GET", "/api/traces/test-trace-id", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 for /api/traces/test-trace-id without auth, got %d", w.Code)
	}
}