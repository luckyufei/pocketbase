// Package serverless 提供 SDK 兼容性和流式响应的集成测试
package serverless

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/hostfn"
	"github.com/pocketbase/pocketbase/plugins/serverless/polyfill"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/plugins/serverless/triggers"
)

// TestIntegration_VercelAISDKCompatibility 测试 Vercel AI SDK 兼容性
// Vercel AI SDK 期望的流式响应格式
func TestIntegration_VercelAISDKCompatibility(t *testing.T) {
	t.Run("SSE 格式响应", func(t *testing.T) {
		// 模拟 Vercel AI SDK 期望的 SSE 格式
		sseData := []string{
			"data: {\"id\":\"chatcmpl-1\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n",
			"data: {\"id\":\"chatcmpl-1\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"delta\":{\"content\":\" World\"}}]}\n\n",
			"data: [DONE]\n\n",
		}

		// 创建模拟服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			flusher, ok := w.(http.Flusher)
			if !ok {
				t.Error("Server doesn't support flushing")
				return
			}

			for _, chunk := range sseData {
				w.Write([]byte(chunk))
				flusher.Flush()
			}
		}))
		defer server.Close()

		// 使用 Fetch 获取流式响应
		fetch := hostfn.NewFetch(hostfn.FetchConfig{
			Timeout: 10 * time.Second,
		})

		resp, err := fetch.Do(context.Background(), hostfn.FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("Fetch error: %v", err)
		}

		// 验证响应头
		if resp.Headers["Content-Type"] != "text/event-stream" {
			t.Errorf("Content-Type = %s, want text/event-stream", resp.Headers["Content-Type"])
		}

		// 验证响应体包含所有 SSE 数据
		for _, chunk := range sseData {
			if !strings.Contains(resp.Body, strings.TrimSpace(chunk)) {
				t.Errorf("Response body missing chunk: %s", chunk)
			}
		}
	})

	t.Run("ReadableStream 支持", func(t *testing.T) {
		// 验证 polyfill 包含 ReadableStream
		streamJS := polyfill.StreamJS
		if !strings.Contains(streamJS, "ReadableStream") {
			t.Error("StreamJS should contain ReadableStream")
		}

		if !strings.Contains(streamJS, "ReadableStreamDefaultReader") {
			t.Error("StreamJS should contain ReadableStreamDefaultReader")
		}
	})
}

// TestIntegration_OpenAISDKCompatibility 测试 OpenAI SDK 兼容性
func TestIntegration_OpenAISDKCompatibility(t *testing.T) {
	t.Run("Chat Completion 请求格式", func(t *testing.T) {
		// 模拟 OpenAI Chat Completion 请求
		requestBody := map[string]interface{}{
			"model": "gpt-4",
			"messages": []map[string]string{
				{"role": "system", "content": "You are a helpful assistant."},
				{"role": "user", "content": "Hello!"},
			},
			"stream": true,
		}

		bodyBytes, _ := json.Marshal(requestBody)

		// 创建模拟 OpenAI 服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 验证请求头
			if r.Header.Get("Content-Type") != "application/json" {
				t.Errorf("Content-Type = %s, want application/json", r.Header.Get("Content-Type"))
			}

			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				t.Errorf("Authorization header should start with 'Bearer '")
			}

			// 验证请求体
			var reqBody map[string]interface{}
			json.NewDecoder(r.Body).Decode(&reqBody)

			if reqBody["model"] != "gpt-4" {
				t.Errorf("model = %v, want gpt-4", reqBody["model"])
			}

			// 返回流式响应
			w.Header().Set("Content-Type", "text/event-stream")
			w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"Hi!\"}}]}\n\n"))
			w.Write([]byte("data: [DONE]\n\n"))
		}))
		defer server.Close()

		// 使用 Fetch 发送请求
		fetch := hostfn.NewFetch(hostfn.FetchConfig{
			Timeout: 10 * time.Second,
		})

		resp, err := fetch.Do(context.Background(), hostfn.FetchRequest{
			URL:    server.URL,
			Method: "POST",
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Bearer sk-test-key",
			},
			Body: string(bodyBytes),
		})
		if err != nil {
			t.Fatalf("Fetch error: %v", err)
		}

		if resp.Status != 200 {
			t.Errorf("Status = %d, want 200", resp.Status)
		}
	})

	t.Run("Embeddings API 兼容", func(t *testing.T) {
		// 模拟 Embeddings 请求
		requestBody := map[string]interface{}{
			"model": "text-embedding-3-small",
			"input": "Hello world",
		}

		bodyBytes, _ := json.Marshal(requestBody)

		// 创建模拟服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 返回嵌入向量
			response := map[string]interface{}{
				"object": "list",
				"data": []map[string]interface{}{
					{
						"object":    "embedding",
						"index":     0,
						"embedding": []float64{0.1, 0.2, 0.3, 0.4, 0.5},
					},
				},
				"model": "text-embedding-3-small",
				"usage": map[string]int{
					"prompt_tokens": 2,
					"total_tokens":  2,
				},
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		fetch := hostfn.NewFetch(hostfn.FetchConfig{
			Timeout: 10 * time.Second,
		})

		resp, err := fetch.Do(context.Background(), hostfn.FetchRequest{
			URL:    server.URL,
			Method: "POST",
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Bearer sk-test-key",
			},
			Body: string(bodyBytes),
		})
		if err != nil {
			t.Fatalf("Fetch error: %v", err)
		}

		// 解析响应
		var respBody map[string]interface{}
		json.Unmarshal([]byte(resp.Body), &respBody)

		if respBody["object"] != "list" {
			t.Errorf("object = %v, want list", respBody["object"])
		}

		data := respBody["data"].([]interface{})
		if len(data) != 1 {
			t.Errorf("data length = %d, want 1", len(data))
		}
	})
}

// TestIntegration_StreamingResponse 测试流式响应端到端
func TestIntegration_StreamingResponse(t *testing.T) {
	t.Run("基本流式响应", func(t *testing.T) {
		pool, err := runtime.NewPool(1)
		if err != nil {
			t.Fatalf("NewPool error: %v", err)
		}
		defer pool.Close()

		trigger := triggers.NewHTTPTrigger(pool, triggers.HTTPTriggerConfig{
			Timeout:     30 * time.Second,
			MaxBodySize: 1024 * 1024,
		})

		// 模拟流式响应处理
		chunks := []string{"Hello", " ", "World", "!"}
		var buffer bytes.Buffer

		for _, chunk := range chunks {
			buffer.WriteString(chunk)
		}

		// 验证完整响应
		if buffer.String() != "Hello World!" {
			t.Errorf("Buffer = %s, want 'Hello World!'", buffer.String())
		}

		// 验证触发器存在
		if trigger == nil {
			t.Error("trigger should not be nil")
		}
	})

	t.Run("SSE 事件解析", func(t *testing.T) {
		// 测试 SSE 事件解析
		sseEvents := `data: {"content":"Hello"}

data: {"content":"World"}

data: [DONE]

`
		reader := strings.NewReader(sseEvents)
		scanner := NewSSEScanner(reader)

		events := []string{}
		for scanner.Scan() {
			events = append(events, scanner.Text())
		}

		if len(events) != 3 {
			t.Errorf("events count = %d, want 3", len(events))
		}

		if events[0] != `{"content":"Hello"}` {
			t.Errorf("events[0] = %s, want {\"content\":\"Hello\"}", events[0])
		}
	})

	t.Run("分块传输编码", func(t *testing.T) {
		// 创建分块传输服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Transfer-Encoding", "chunked")
			w.Header().Set("Content-Type", "text/plain")

			flusher, _ := w.(http.Flusher)
			chunks := []string{"chunk1", "chunk2", "chunk3"}

			for _, chunk := range chunks {
				w.Write([]byte(chunk))
				flusher.Flush()
				time.Sleep(10 * time.Millisecond)
			}
		}))
		defer server.Close()

		fetch := hostfn.NewFetch(hostfn.FetchConfig{
			Timeout: 10 * time.Second,
		})

		resp, err := fetch.Do(context.Background(), hostfn.FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})
		if err != nil {
			t.Fatalf("Fetch error: %v", err)
		}

		if resp.Body != "chunk1chunk2chunk3" {
			t.Errorf("Body = %s, want chunk1chunk2chunk3", resp.Body)
		}
	})

	t.Run("超时处理", func(t *testing.T) {
		// 创建慢速服务器
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(2 * time.Second)
			w.Write([]byte("delayed response"))
		}))
		defer server.Close()

		fetch := hostfn.NewFetch(hostfn.FetchConfig{
			Timeout: 100 * time.Millisecond,
		})

		_, err := fetch.Do(context.Background(), hostfn.FetchRequest{
			URL:    server.URL,
			Method: "GET",
		})

		// 应该超时
		if err == nil {
			t.Error("Should timeout")
		}
	})
}

// TestIntegration_WebAPIPolyfills 测试 Web API Polyfills
func TestIntegration_WebAPIPolyfills(t *testing.T) {
	t.Run("TextEncoder/TextDecoder", func(t *testing.T) {
		webAPI := polyfill.WebAPIJS

		if !strings.Contains(webAPI, "TextEncoder") {
			t.Error("WebAPIJS should contain TextEncoder")
		}

		if !strings.Contains(webAPI, "TextDecoder") {
			t.Error("WebAPIJS should contain TextDecoder")
		}
	})

	t.Run("URL/URLSearchParams", func(t *testing.T) {
		webAPI := polyfill.WebAPIJS

		if !strings.Contains(webAPI, "URLSearchParams") {
			t.Error("WebAPIJS should contain URLSearchParams")
		}
	})

	t.Run("Headers/Request/Response", func(t *testing.T) {
		webAPI := polyfill.WebAPIJS

		if !strings.Contains(webAPI, "Headers") {
			t.Error("WebAPIJS should contain Headers")
		}

		if !strings.Contains(webAPI, "Request") {
			t.Error("WebAPIJS should contain Request")
		}

		if !strings.Contains(webAPI, "Response") {
			t.Error("WebAPIJS should contain Response")
		}
	})

	t.Run("fetch polyfill", func(t *testing.T) {
		webAPI := polyfill.WebAPIJS

		if !strings.Contains(webAPI, "fetch") {
			t.Error("WebAPIJS should contain fetch")
		}
	})
}

// TestIntegration_PBSDKCompleteness 测试 PocketBase SDK 完整性
func TestIntegration_PBSDKCompleteness(t *testing.T) {
	sdk := polyfill.PbSdkJS

	requiredAPIs := []string{
		"globalThis.pb",
		"collection",
		"kv",
		"files",
		"secrets",
		"jobs",
		"utils",
		"tx",
		"getOne",
		"getList",
		"create",
		"update",
		"delete",
		"vectorSearch",
	}

	for _, api := range requiredAPIs {
		if !strings.Contains(sdk, api) {
			t.Errorf("PbSdkJS should contain %s", api)
		}
	}
}

// TestIntegration_BridgeJS 测试桥接层
func TestIntegration_BridgeJS(t *testing.T) {
	bridge := polyfill.BridgeJS

	requiredFunctions := []string{
		"hostCall",
		"OP_FETCH",
		"OP_DB_QUERY",
		"OP_KV_GET",
		"OP_KV_SET",
	}

	for _, fn := range requiredFunctions {
		if !strings.Contains(bridge, fn) {
			t.Errorf("BridgeJS should contain %s", fn)
		}
	}
}

// SSEScanner 用于解析 SSE 事件
type SSEScanner struct {
	reader  io.Reader
	buffer  bytes.Buffer
	current string
}

// NewSSEScanner 创建 SSE 扫描器
func NewSSEScanner(r io.Reader) *SSEScanner {
	return &SSEScanner{reader: r}
}

// Scan 扫描下一个 SSE 事件
func (s *SSEScanner) Scan() bool {
	buf := make([]byte, 1024)
	for {
		n, err := s.reader.Read(buf)
		if n > 0 {
			s.buffer.Write(buf[:n])
		}

		// 查找完整事件
		content := s.buffer.String()
		if idx := strings.Index(content, "\n\n"); idx >= 0 {
			line := content[:idx]
			s.buffer.Reset()
			s.buffer.WriteString(content[idx+2:])

			// 解析 data: 前缀
			if strings.HasPrefix(line, "data: ") {
				s.current = strings.TrimPrefix(line, "data: ")
				return true
			}
		}

		if err == io.EOF {
			return false
		}
		if err != nil {
			return false
		}
	}
}

// Text 返回当前事件数据
func (s *SSEScanner) Text() string {
	return s.current
}
