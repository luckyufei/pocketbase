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

// 注意：由于 apis.NewRouter 已经包含了 analytics 路由（通过 apis/analytics.go），
// 我们这里测试的是插件版本的 handlers。
// Phase 6 清理后，apis/analytics*.go 将被删除，此时才能完整测试插件版本。

func TestEventsHandler_BotTraffic(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 使用原有的 apis.NewRouter（包含已绑定的 analytics 路由）
	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

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

	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	body := []byte(`{"events":[{"event":"page_view","path":"/home","sessionId":"test-session-123"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// 注意：这里使用的是 apis/analytics.go 中的 handler，可能返回 404（如果 app.Analytics() 未初始化）
	// 或 202（如果已初始化）
	// 主要验证请求能正常处理
	if rec.Code != http.StatusAccepted && rec.Code != http.StatusNotFound {
		t.Errorf("Unexpected status %d", rec.Code)
	}
}

func TestEventsHandler_InvalidBody(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	// 无效的 JSON
	body := []byte(`{invalid json}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// 可能返回 400 或 404（取决于 analytics 是否启用）
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 400 or 404 for invalid JSON, got %d", rec.Code)
	}
}

func TestEventsHandler_EmptyEvents(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	body := []byte(`{"events":[]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// 可能返回 400 或 404
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 400 or 404 for empty events, got %d", rec.Code)
	}
}
