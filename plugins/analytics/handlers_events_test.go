package analytics

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tests"
)

// setupTestRouter 创建一个带有 analytics 路由的测试路由器
func setupTestRouter(t *testing.T, app *tests.TestApp) http.Handler {
	t.Helper()

	// 注册 analytics 插件
	if err := Register(app, Config{Enabled: true, Mode: ModeConditional}); err != nil {
		t.Fatal(err)
	}

	// 创建路由器
	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	// 手动绑定 analytics 路由（因为 OnServe 钩子在测试中不会自动触发）
	BindRoutes(app, pbRouter.Group("/api"))

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	return mux
}

func TestEventsHandler_BotTraffic(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	mux := setupTestRouter(t, app)

	body := []byte(`{"events":[{"event":"page_view","path":"/home","sessionId":"test-session"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Googlebot/2.1 (+http://www.google.com/bot.html)")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Errorf("Expected status %d for bot traffic, got %d", http.StatusAccepted, rec.Code)
	}

	// 检查响应
	var resp map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if resp["accepted"] != float64(0) {
		t.Errorf("Expected accepted=0 for bot traffic, got %v", resp["accepted"])
	}
}

func TestEventsHandler_ValidEvents(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	mux := setupTestRouter(t, app)

	body := []byte(`{"events":[{"event":"page_view","path":"/home","sessionId":"test-session-123"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// 应该返回 202 Accepted
	if rec.Code != http.StatusAccepted {
		t.Errorf("Expected status %d, got %d", http.StatusAccepted, rec.Code)
	}
}

func TestEventsHandler_InvalidBody(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	mux := setupTestRouter(t, app)

	// 无效的 JSON
	body := []byte(`{invalid json}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d for invalid JSON, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestEventsHandler_EmptyEvents(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	mux := setupTestRouter(t, app)

	body := []byte(`{"events":[]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d for empty events, got %d", http.StatusBadRequest, rec.Code)
	}
}
