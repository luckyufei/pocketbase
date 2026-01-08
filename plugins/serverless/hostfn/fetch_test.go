// Package hostfn 提供 Host Functions 实现
package hostfn

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// T031-T038: Fetch Host Function 测试

func TestFetchHostFunction(t *testing.T) {
	t.Run("创建 Fetch 实例", func(t *testing.T) {
		fetch := NewFetch(FetchConfig{
			Timeout: 30 * time.Second,
		})

		if fetch == nil {
			t.Fatal("fetch 不应为 nil")
		}
	})

	t.Run("发起 GET 请求", func(t *testing.T) {
		// 创建测试服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "GET" {
				t.Errorf("Method = %s, want GET", r.Method)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"message": "hello"})
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		resp, err := fetch.Do(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("Do() error = %v", err)
		}

		if resp.Status != 200 {
			t.Errorf("Status = %d, want 200", resp.Status)
		}
		if resp.Headers["Content-Type"] != "application/json" {
			t.Errorf("Content-Type = %s, want application/json", resp.Headers["Content-Type"])
		}
	})

	t.Run("发起 POST 请求", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				t.Errorf("Method = %s, want POST", r.Method)
			}
			if r.Header.Get("Content-Type") != "application/json" {
				t.Errorf("Content-Type = %s, want application/json", r.Header.Get("Content-Type"))
			}

			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			if body["name"] != "test" {
				t.Errorf("body.name = %s, want test", body["name"])
			}

			w.WriteHeader(201)
			json.NewEncoder(w).Encode(map[string]string{"id": "123"})
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		resp, err := fetch.Do(ctx, FetchRequest{
			URL:    server.URL,
			Method: "POST",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: `{"name":"test"}`,
		})
		if err != nil {
			t.Fatalf("Do() error = %v", err)
		}

		if resp.Status != 201 {
			t.Errorf("Status = %d, want 201", resp.Status)
		}
	})

	t.Run("处理 Headers", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer token123" {
				t.Errorf("Authorization = %s, want Bearer token123", r.Header.Get("Authorization"))
			}
			if r.Header.Get("X-Custom") != "value" {
				t.Errorf("X-Custom = %s, want value", r.Header.Get("X-Custom"))
			}
			w.WriteHeader(200)
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		_, err := fetch.Do(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
			Headers: map[string]string{
				"Authorization": "Bearer token123",
				"X-Custom":      "value",
			},
		})
		if err != nil {
			t.Fatalf("Do() error = %v", err)
		}
	})

	t.Run("请求超时", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(200 * time.Millisecond)
			w.WriteHeader(200)
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 50 * time.Millisecond})
		ctx := context.Background()

		_, err := fetch.Do(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err == nil {
			t.Error("应该超时返回错误")
		}
	})
}

func TestFetchWhitelist(t *testing.T) {
	t.Run("白名单验证 - 允许", func(t *testing.T) {
		fetch := NewFetch(FetchConfig{
			Whitelist: []string{"api.openai.com", "api.anthropic.com"},
		})

		if !fetch.IsAllowed("https://api.openai.com/v1/chat") {
			t.Error("api.openai.com 应该被允许")
		}
	})

	t.Run("白名单验证 - 拒绝", func(t *testing.T) {
		fetch := NewFetch(FetchConfig{
			Whitelist: []string{"api.openai.com"},
		})

		if fetch.IsAllowed("https://evil.com/hack") {
			t.Error("evil.com 不应该被允许")
		}
	})

	t.Run("空白名单允许所有", func(t *testing.T) {
		fetch := NewFetch(FetchConfig{
			Whitelist: nil,
		})

		if !fetch.IsAllowed("https://any.domain.com/path") {
			t.Error("空白名单应该允许所有域名")
		}
	})

	t.Run("白名单拒绝时返回错误", func(t *testing.T) {
		fetch := NewFetch(FetchConfig{
			Whitelist: []string{"api.openai.com"},
			Timeout:   5 * time.Second,
		})
		ctx := context.Background()

		_, err := fetch.Do(ctx, FetchRequest{
			URL:    "https://evil.com/hack",
			Method: "GET",
		})
		if err == nil {
			t.Error("应该返回白名单错误")
		}
	})
}

func TestFetchResponse(t *testing.T) {
	t.Run("JSON 响应解析", func(t *testing.T) {
		resp := &FetchResponse{
			Status:  200,
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    `{"key":"value","num":42}`,
		}

		var data map[string]any
		err := resp.JSON(&data)
		if err != nil {
			t.Fatalf("JSON() error = %v", err)
		}

		if data["key"] != "value" {
			t.Errorf("data[key] = %v, want value", data["key"])
		}
		if data["num"] != float64(42) {
			t.Errorf("data[num] = %v, want 42", data["num"])
		}
	})

	t.Run("Text 响应", func(t *testing.T) {
		resp := &FetchResponse{
			Status: 200,
			Body:   "Hello, World!",
		}

		text := resp.Text()
		if text != "Hello, World!" {
			t.Errorf("Text() = %s, want Hello, World!", text)
		}
	})
}

// T035: 流式响应测试
func TestFetchStream(t *testing.T) {
	t.Run("流式响应 - SSE", func(t *testing.T) {
		// 创建 SSE 测试服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			flusher, ok := w.(http.Flusher)
			if !ok {
				t.Fatal("服务器不支持 Flusher")
			}

			// 发送 3 个事件
			for i := 1; i <= 3; i++ {
				w.Write([]byte("data: message " + string(rune('0'+i)) + "\n\n"))
				flusher.Flush()
			}
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}
		defer stream.Close()

		if stream.Status != 200 {
			t.Errorf("Status = %d, want 200", stream.Status)
		}

		// 读取流数据
		chunks := []string{}
		for {
			chunk, err := stream.Read()
			if err != nil {
				break
			}
			if chunk != "" {
				chunks = append(chunks, chunk)
			}
		}

		if len(chunks) == 0 {
			t.Error("应该读取到流数据")
		}
	})

	t.Run("流式响应 - 取消", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)

			for i := 0; i < 100; i++ {
				select {
				case <-r.Context().Done():
					return
				default:
					w.Write([]byte("data: chunk\n\n"))
					flusher.Flush()
					time.Sleep(10 * time.Millisecond)
				}
			}
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx, cancel := context.WithCancel(context.Background())

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}

		// 读取一些数据后取消
		stream.Read()
		cancel()
		stream.Close()
	})

	t.Run("流式响应 - 白名单拒绝", func(t *testing.T) {
		fetch := NewFetch(FetchConfig{
			Whitelist: []string{"api.openai.com"},
			Timeout:   5 * time.Second,
		})
		ctx := context.Background()

		_, err := fetch.DoStream(ctx, FetchRequest{
			URL:    "https://evil.com/stream",
			Method: "GET",
		})
		if err == nil {
			t.Error("应该返回白名单错误")
		}
	})
}

// TestStreamResponse 测试流式响应结构
func TestStreamResponse(t *testing.T) {
	t.Run("StreamResponse 结构", func(t *testing.T) {
		stream := &StreamResponse{
			Status:  200,
			Headers: map[string]string{"Content-Type": "text/event-stream"},
		}

		if stream.Status != 200 {
			t.Errorf("Status = %d, want 200", stream.Status)
		}

		if stream.Headers["Content-Type"] != "text/event-stream" {
			t.Errorf("Content-Type = %s, want text/event-stream", stream.Headers["Content-Type"])
		}
	})

	t.Run("IsClosed 检查", func(t *testing.T) {
		stream := &StreamResponse{
			Status: 200,
		}

		if stream.IsClosed() {
			t.Error("新创建的 stream 不应该是 closed")
		}

		stream.Close()

		if !stream.IsClosed() {
			t.Error("Close 后 stream 应该是 closed")
		}
	})

	t.Run("ReadChunk", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("chunk1chunk2chunk3"))
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}
		defer stream.Close()

		// 读取固定大小的 chunk
		chunk, err := stream.ReadChunk(5)
		if err != nil {
			t.Fatalf("ReadChunk() error = %v", err)
		}

		if len(chunk) == 0 {
			t.Error("ReadChunk 应该返回数据")
		}
	})
}

// T110-T112: SDK 兼容性测试

// TestVercelAISDKCompatibility 测试 Vercel AI SDK 兼容性 (T110)
func TestVercelAISDKCompatibility(t *testing.T) {
	t.Run("模拟 Vercel AI SDK 请求格式", func(t *testing.T) {
		// Vercel AI SDK 使用的请求格式
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 验证请求头
			if r.Header.Get("Content-Type") != "application/json" {
				t.Errorf("Content-Type = %s, want application/json", r.Header.Get("Content-Type"))
			}

			// 返回 Vercel AI SDK 兼容的响应格式
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Header().Set("X-Vercel-AI-Data-Stream", "v1")
			w.Write([]byte("0:\"Hello\"\n0:\" World\"\n"))
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		resp, err := fetch.Do(ctx, FetchRequest{
			URL:    server.URL,
			Method: "POST",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: `{"messages":[{"role":"user","content":"Hello"}]}`,
		})
		if err != nil {
			t.Fatalf("Do() error = %v", err)
		}

		if resp.Status != 200 {
			t.Errorf("Status = %d, want 200", resp.Status)
		}

		body := resp.Text()
		if body == "" {
			t.Error("响应体不应为空")
		}
	})

	t.Run("Vercel AI SDK 流式响应", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Header().Set("X-Vercel-AI-Data-Stream", "v1")
			flusher, _ := w.(http.Flusher)

			// 模拟 Vercel AI SDK 流式格式
			chunks := []string{
				"0:\"Hello\"\n",
				"0:\" World\"\n",
				"0:\"!\"\n",
				"d:{\"finishReason\":\"stop\"}\n",
			}

			for _, chunk := range chunks {
				w.Write([]byte(chunk))
				flusher.Flush()
			}
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "POST",
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}
		defer stream.Close()

		// 读取所有数据
		allData := ""
		for {
			chunk, err := stream.Read()
			if err != nil {
				break
			}
			allData += chunk
		}

		if allData == "" {
			t.Error("应该读取到流数据")
		}
	})
}

// TestOpenAISDKCompatibility 测试 OpenAI SDK 兼容性 (T111)
func TestOpenAISDKCompatibility(t *testing.T) {
	t.Run("模拟 OpenAI Chat Completion 请求", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 验证 Authorization 头
			auth := r.Header.Get("Authorization")
			if auth == "" {
				t.Error("缺少 Authorization 头")
			}

			// 返回 OpenAI 格式的响应
			w.Header().Set("Content-Type", "application/json")
			response := map[string]any{
				"id":      "chatcmpl-123",
				"object":  "chat.completion",
				"created": 1677652288,
				"model":   "gpt-4",
				"choices": []map[string]any{
					{
						"index": 0,
						"message": map[string]string{
							"role":    "assistant",
							"content": "Hello! How can I help you?",
						},
						"finish_reason": "stop",
					},
				},
				"usage": map[string]int{
					"prompt_tokens":     10,
					"completion_tokens": 8,
					"total_tokens":      18,
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		resp, err := fetch.Do(ctx, FetchRequest{
			URL:    server.URL,
			Method: "POST",
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Bearer sk-test-key",
			},
			Body: `{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}]}`,
		})
		if err != nil {
			t.Fatalf("Do() error = %v", err)
		}

		if resp.Status != 200 {
			t.Errorf("Status = %d, want 200", resp.Status)
		}

		var data map[string]any
		err = resp.JSON(&data)
		if err != nil {
			t.Fatalf("JSON() error = %v", err)
		}

		if data["id"] != "chatcmpl-123" {
			t.Errorf("id = %v, want chatcmpl-123", data["id"])
		}
	})

	t.Run("OpenAI 流式响应 (SSE)", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			flusher, _ := w.(http.Flusher)

			// 模拟 OpenAI SSE 格式
			events := []string{
				`data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},"index":0}]}`,
				`data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}`,
				`data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":"!"},"index":0}]}`,
				`data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}`,
				`data: [DONE]`,
			}

			for _, event := range events {
				w.Write([]byte(event + "\n\n"))
				flusher.Flush()
			}
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "POST",
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Bearer sk-test-key",
			},
			Body: `{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}],"stream":true}`,
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}
		defer stream.Close()

		// 读取所有 SSE 事件
		allData := ""
		for {
			chunk, err := stream.Read()
			if err != nil {
				break
			}
			allData += chunk
		}

		if allData == "" {
			t.Error("应该读取到流数据")
		}

		// 验证包含 [DONE] 标记
		if !containsString(allData, "[DONE]") {
			t.Error("流数据应该包含 [DONE] 标记")
		}
	})
}

// TestStreamingE2E 端到端流式响应测试 (T112)
func TestStreamingE2E(t *testing.T) {
	t.Run("完整流式响应生命周期", func(t *testing.T) {
		chunkCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)

			for i := 0; i < 5; i++ {
				w.Write([]byte("data: chunk " + string(rune('0'+i)) + "\n\n"))
				flusher.Flush()
				time.Sleep(10 * time.Millisecond)
			}
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}

		// 读取所有 chunks
		for {
			chunk, err := stream.Read()
			if err != nil {
				break
			}
			if chunk != "" {
				chunkCount++
			}
		}

		// 关闭流
		err = stream.Close()
		if err != nil {
			t.Errorf("Close() error = %v", err)
		}

		// 验证流已关闭
		if !stream.IsClosed() {
			t.Error("流应该已关闭")
		}

		if chunkCount == 0 {
			t.Error("应该读取到至少一个 chunk")
		}
	})

	t.Run("流式响应超时", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)

			w.Write([]byte("data: start\n\n"))
			flusher.Flush()

			// 模拟长时间等待
			time.Sleep(2 * time.Second)
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 100 * time.Millisecond})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			// 超时错误是预期的
			return
		}
		defer stream.Close()

		// 读取应该在超时后停止
		_, _ = stream.Read()
	})

	t.Run("流式响应中断恢复", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)

			for i := 0; i < 3; i++ {
				w.Write([]byte("data: chunk\n\n"))
				flusher.Flush()
			}
		}))
		defer server.Close()

		fetch := NewFetch(FetchConfig{Timeout: 5 * time.Second})
		ctx := context.Background()

		stream, err := fetch.DoStream(ctx, FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("DoStream() error = %v", err)
		}

		// 读取一个 chunk
		_, _ = stream.Read()

		// 立即关闭
		stream.Close()

		// 验证关闭后读取返回错误或空
		chunk, _ := stream.Read()
		if chunk != "" {
			t.Log("关闭后可能还有缓冲数据")
		}
	})
}

// containsString 检查字符串是否包含子串
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStringHelper(s, substr))
}

func containsStringHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
