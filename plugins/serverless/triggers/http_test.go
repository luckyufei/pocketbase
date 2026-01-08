// Package triggers 提供 Serverless 函数触发器
package triggers

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// T022-T030: HTTP 触发器测试

func TestHTTPTrigger(t *testing.T) {
	t.Run("创建 HTTP 触发器", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			Timeout: 30 * time.Second,
		})

		if trigger == nil {
			t.Fatal("trigger 不应为 nil")
		}
	})

	t.Run("构建 Request 对象", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

		body := bytes.NewReader([]byte(`{"name":"test"}`))
		req := httptest.NewRequest("POST", "/api/pb_serverless/users", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer token123")

		jsReq, err := trigger.BuildJSRequest(req)
		if err != nil {
			t.Fatalf("BuildJSRequest() error = %v", err)
		}

		if jsReq.Method != "POST" {
			t.Errorf("Method = %s, want POST", jsReq.Method)
		}
		if jsReq.URL != "/api/pb_serverless/users" {
			t.Errorf("URL = %s, want /api/pb_serverless/users", jsReq.URL)
		}
		if jsReq.Headers["Content-Type"] != "application/json" {
			t.Errorf("Content-Type header 不匹配")
		}
		if jsReq.Body != `{"name":"test"}` {
			t.Errorf("Body = %s, want {\"name\":\"test\"}", jsReq.Body)
		}
	})

	t.Run("解析 Response 对象", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

		jsResp := &JSResponse{
			Status:  201,
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    `{"id":"123"}`,
		}

		w := httptest.NewRecorder()
		err := trigger.WriteJSResponse(w, jsResp)
		if err != nil {
			t.Fatalf("WriteJSResponse() error = %v", err)
		}

		resp := w.Result()
		if resp.StatusCode != 201 {
			t.Errorf("StatusCode = %d, want 201", resp.StatusCode)
		}
		if resp.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type = %s, want application/json", resp.Header.Get("Content-Type"))
		}

		body, _ := io.ReadAll(resp.Body)
		if string(body) != `{"id":"123"}` {
			t.Errorf("Body = %s, want {\"id\":\"123\"}", string(body))
		}
	})

	t.Run("路由匹配", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

		// 注册路由
		trigger.RegisterRoute("/api/pb_serverless/users", "routes/users.ts")
		trigger.RegisterRoute("/api/pb_serverless/users/:id", "routes/users/[id].ts")

		tests := []struct {
			path     string
			wantFile string
			wantOK   bool
		}{
			{"/api/pb_serverless/users", "routes/users.ts", true},
			{"/api/pb_serverless/users/123", "routes/users/[id].ts", true},
			{"/api/pb_serverless/posts", "", false},
		}

		for _, tt := range tests {
			file, params, ok := trigger.MatchRoute(tt.path)
			if ok != tt.wantOK {
				t.Errorf("MatchRoute(%s) ok = %v, want %v", tt.path, ok, tt.wantOK)
			}
			if ok && file != tt.wantFile {
				t.Errorf("MatchRoute(%s) file = %s, want %s", tt.path, file, tt.wantFile)
			}
			if tt.path == "/api/pb_serverless/users/123" && params["id"] != "123" {
				t.Errorf("MatchRoute(%s) params[id] = %s, want 123", tt.path, params["id"])
			}
		}
	})

	t.Run("超时控制", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			Timeout: 50 * time.Millisecond,
		})

		ctx := context.Background()
		execCtx, cancel := trigger.WithTimeout(ctx)
		defer cancel()

		// 等待超时
		select {
		case <-execCtx.Done():
			// 预期超时
		case <-time.After(100 * time.Millisecond):
			t.Error("应该超时")
		}
	})

	t.Run("错误处理 - 500", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

		w := httptest.NewRecorder()
		trigger.WriteError(w, http.StatusInternalServerError, "Internal Server Error")

		resp := w.Result()
		if resp.StatusCode != 500 {
			t.Errorf("StatusCode = %d, want 500", resp.StatusCode)
		}
	})

	t.Run("错误处理 - 504 Gateway Timeout", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{})

		w := httptest.NewRecorder()
		trigger.WriteError(w, http.StatusGatewayTimeout, "Gateway Timeout")

		resp := w.Result()
		if resp.StatusCode != 504 {
			t.Errorf("StatusCode = %d, want 504", resp.StatusCode)
		}
	})
}

func TestJSRequestJSON(t *testing.T) {
	t.Run("Request 序列化为 JSON", func(t *testing.T) {
		req := &JSRequest{
			Method:  "POST",
			URL:     "/api/test",
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    `{"key":"value"}`,
			Params:  map[string]string{"id": "123"},
		}

		json := req.ToJSON()
		if json == "" {
			t.Error("ToJSON() 返回空字符串")
		}
		if !bytes.Contains([]byte(json), []byte(`"method":"POST"`)) {
			t.Error("JSON 应包含 method 字段")
		}
	})
}

func TestHTTPTriggerHandleErrors(t *testing.T) {
	t.Run("Handle 无 Pool 返回错误", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			Timeout: 5000,
		})
		// 注册路由但不设置 pool
		trigger.RegisterRoute("/api/test", "routes/test.ts")

		req := httptest.NewRequest("GET", "/api/test", nil)
		w := httptest.NewRecorder()

		trigger.Handle(w, req)

		resp := w.Result()
		if resp.StatusCode != 500 {
			t.Errorf("StatusCode = %d, want 500", resp.StatusCode)
		}
	})

	t.Run("Handle 路由不匹配返回 404", func(t *testing.T) {
		trigger := NewHTTPTrigger(nil, HTTPTriggerConfig{
			Timeout: 5000,
		})

		req := httptest.NewRequest("GET", "/api/nonexistent", nil)
		w := httptest.NewRecorder()

		trigger.Handle(w, req)

		resp := w.Result()
		if resp.StatusCode != 404 {
			t.Errorf("StatusCode = %d, want 404", resp.StatusCode)
		}
	})
}
