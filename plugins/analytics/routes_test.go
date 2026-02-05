package analytics

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// 注意：由于 apis.NewRouter 已经包含了 analytics 路由（通过 apis/analytics.go），
// 我们这里只测试 requestLogger 函数，不测试 BindRoutes。
// Phase 6 清理后，apis/analytics*.go 将被删除，此时才能完整测试插件版本的 BindRoutes。

func TestRequestLogger(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	testCases := []struct {
		name     string
		endpoint string
	}{
		{"events", "events"},
		{"stats", "stats"},
		{"top-pages", "top-pages"},
		{"devices", "devices"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			handler := requestLogger(app, tc.endpoint)

			if handler == nil {
				t.Fatal("requestLogger should return a handler")
			}

			expectedID := "pbAnalyticsRequestLogger_" + tc.endpoint
			if handler.Id != expectedID {
				t.Errorf("Handler ID = %q, want %q", handler.Id, expectedID)
			}
		})
	}
}

func TestRequestLoggerHandler(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	handler := requestLogger(app, "test-endpoint")

	// 验证 handler 函数不为 nil
	if handler.Func == nil {
		t.Error("Handler function should not be nil")
	}
}

// 确保 requestLogger 返回正确类型
var _ *hook.Handler[*core.RequestEvent] = requestLogger(nil, "")
