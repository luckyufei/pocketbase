package triggers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHTTPTriggerHandle(t *testing.T) {
	t.Run("路由未找到", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			Timeout: 30 * time.Second,
		})

		req := httptest.NewRequest("GET", "/api/pb_serverless/notfound", nil)
		w := httptest.NewRecorder()

		trigger.Handle(w, req)

		resp := w.Result()
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("StatusCode = %d, want 404", resp.StatusCode)
		}
	})

	t.Run("无运行时池", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			Timeout: 30 * time.Second,
		})
		trigger.RegisterRoute("/api/pb_serverless/test", "routes/test.ts")

		req := httptest.NewRequest("GET", "/api/pb_serverless/test", nil)
		w := httptest.NewRecorder()

		trigger.Handle(w, req)

		resp := w.Result()
		if resp.StatusCode != http.StatusInternalServerError {
			t.Errorf("StatusCode = %d, want 500", resp.StatusCode)
		}
	})
}

func TestHTTPTriggerBuildRequest(t *testing.T) {
	trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

	t.Run("带 Query 参数", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/test?page=1&limit=10", nil)
		jsReq, err := trigger.BuildJSRequest(req)
		if err != nil {
			t.Fatalf("BuildJSRequest() error = %v", err)
		}

		if jsReq.Query["page"] != "1" {
			t.Errorf("Query[page] = %s, want 1", jsReq.Query["page"])
		}
		if jsReq.Query["limit"] != "10" {
			t.Errorf("Query[limit] = %s, want 10", jsReq.Query["limit"])
		}
	})

	t.Run("空 Body", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/test", nil)
		jsReq, err := trigger.BuildJSRequest(req)
		if err != nil {
			t.Fatalf("BuildJSRequest() error = %v", err)
		}

		if jsReq.Body != "" {
			t.Errorf("Body = %s, want empty", jsReq.Body)
		}
	})

	t.Run("大 Body 截断", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			MaxBodySize: 10, // 只允许 10 字节
		})

		body := strings.NewReader("12345678901234567890") // 20 字节
		req := httptest.NewRequest("POST", "/api/test", body)
		jsReq, err := trigger.BuildJSRequest(req)
		if err != nil {
			t.Fatalf("BuildJSRequest() error = %v", err)
		}

		if len(jsReq.Body) > 10 {
			t.Errorf("Body 应该被截断到 10 字节, got %d", len(jsReq.Body))
		}
	})
}

func TestHTTPTriggerWriteResponse(t *testing.T) {
	trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

	t.Run("默认状态码", func(t *testing.T) {
		w := httptest.NewRecorder()
		trigger.WriteJSResponse(w, &JSResponse{
			Body: "OK",
		})

		resp := w.Result()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
		}
	})

	t.Run("空响应", func(t *testing.T) {
		w := httptest.NewRecorder()
		err := trigger.WriteJSResponse(w, &JSResponse{
			Status: 204,
		})
		if err != nil {
			t.Fatalf("WriteJSResponse() error = %v", err)
		}

		resp := w.Result()
		if resp.StatusCode != 204 {
			t.Errorf("StatusCode = %d, want 204", resp.StatusCode)
		}
	})
}

func TestHTTPTriggerRouteMatching(t *testing.T) {
	trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

	// 注册多个路由
	trigger.RegisterRoute("/api/pb_serverless/users", "routes/users.ts")
	trigger.RegisterRoute("/api/pb_serverless/users/:id", "routes/users/[id].ts")
	trigger.RegisterRoute("/api/pb_serverless/users/:id/posts", "routes/users/[id]/posts.ts")
	trigger.RegisterRoute("/api/pb_serverless/posts/:postId/comments/:commentId", "routes/posts/[postId]/comments/[commentId].ts")

	tests := []struct {
		path       string
		wantFile   string
		wantParams map[string]string
		wantOK     bool
	}{
		{
			path:     "/api/pb_serverless/users",
			wantFile: "routes/users.ts",
			wantOK:   true,
		},
		{
			path:       "/api/pb_serverless/users/123",
			wantFile:   "routes/users/[id].ts",
			wantParams: map[string]string{"id": "123"},
			wantOK:     true,
		},
		{
			path:       "/api/pb_serverless/users/456/posts",
			wantFile:   "routes/users/[id]/posts.ts",
			wantParams: map[string]string{"id": "456"},
			wantOK:     true,
		},
		{
			path:       "/api/pb_serverless/posts/p1/comments/c2",
			wantFile:   "routes/posts/[postId]/comments/[commentId].ts",
			wantParams: map[string]string{"postId": "p1", "commentId": "c2"},
			wantOK:     true,
		},
		{
			path:   "/api/pb_serverless/unknown",
			wantOK: false,
		},
	}

	for _, tt := range tests {
		file, params, ok := trigger.MatchRoute(tt.path)
		if ok != tt.wantOK {
			t.Errorf("MatchRoute(%s) ok = %v, want %v", tt.path, ok, tt.wantOK)
			continue
		}
		if !ok {
			continue
		}
		if file != tt.wantFile {
			t.Errorf("MatchRoute(%s) file = %s, want %s", tt.path, file, tt.wantFile)
		}
		for k, v := range tt.wantParams {
			if params[k] != v {
				t.Errorf("MatchRoute(%s) params[%s] = %s, want %s", tt.path, k, params[k], v)
			}
		}
	}
}
