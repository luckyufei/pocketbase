// Package triggers 提供 Serverless 函数触发器
package triggers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
)

// HTTPTriggerConfig HTTP 触发器配置
type HTTPTriggerConfig struct {
	// Timeout 请求超时时间
	Timeout time.Duration

	// MaxBodySize 最大请求体大小
	MaxBodySize int64
}

// JSRequest 表示传递给 JS 的请求对象
type JSRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	Params  map[string]string `json:"params"`
	Query   map[string]string `json:"query"`
}

// ToJSON 将请求序列化为 JSON 字符串
func (r *JSRequest) ToJSON() string {
	data, _ := json.Marshal(r)
	return string(data)
}

// JSResponse 表示 JS 返回的响应对象
type JSResponse struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// routeEntry 路由条目
type routeEntry struct {
	pattern  string   // 原始模式，如 /api/pb_serverless/users/:id
	file     string   // 对应文件
	segments []string // 分割后的路径段
	params   []string // 参数名列表
}

// HTTPTrigger HTTP 触发器
type HTTPTrigger struct {
	pool   *runtime.Pool
	config HTTPTriggerConfig
	routes []routeEntry
	mu     sync.RWMutex
}

// NewHTTPTrigger 创建新的 HTTP 触发器
func NewHTTPTrigger(pool *runtime.Pool, config HTTPTriggerConfig) *HTTPTrigger {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.MaxBodySize == 0 {
		config.MaxBodySize = 10 * 1024 * 1024 // 10MB
	}

	return &HTTPTrigger{
		pool:   pool,
		config: config,
		routes: []routeEntry{},
	}
}

// RegisterRoute 注册路由
func (t *HTTPTrigger) RegisterRoute(pattern, file string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	entry := routeEntry{
		pattern:  pattern,
		file:     file,
		segments: strings.Split(pattern, "/"),
		params:   []string{},
	}

	// 提取参数名
	for _, seg := range entry.segments {
		if strings.HasPrefix(seg, ":") {
			entry.params = append(entry.params, seg[1:])
		}
	}

	t.routes = append(t.routes, entry)
}

// MatchRoute 匹配路由
func (t *HTTPTrigger) MatchRoute(path string) (file string, params map[string]string, ok bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	pathSegments := strings.Split(path, "/")
	params = make(map[string]string)

	for _, route := range t.routes {
		if len(route.segments) != len(pathSegments) {
			continue
		}

		matched := true
		paramIdx := 0

		for i, seg := range route.segments {
			if strings.HasPrefix(seg, ":") {
				// 动态参数
				if paramIdx < len(route.params) {
					params[route.params[paramIdx]] = pathSegments[i]
					paramIdx++
				}
			} else if seg != pathSegments[i] {
				matched = false
				break
			}
		}

		if matched {
			return route.file, params, true
		}
	}

	return "", nil, false
}

// BuildJSRequest 从 http.Request 构建 JSRequest
func (t *HTTPTrigger) BuildJSRequest(r *http.Request) (*JSRequest, error) {
	// 读取请求体
	var body string
	if r.Body != nil {
		data, err := io.ReadAll(io.LimitReader(r.Body, t.config.MaxBodySize))
		if err != nil {
			return nil, err
		}
		body = string(data)
	}

	// 转换 Headers
	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	// 转换 Query
	query := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			query[k] = v[0]
		}
	}

	return &JSRequest{
		Method:  r.Method,
		URL:     r.URL.Path,
		Headers: headers,
		Body:    body,
		Query:   query,
		Params:  make(map[string]string),
	}, nil
}

// WriteJSResponse 将 JSResponse 写入 http.ResponseWriter
func (t *HTTPTrigger) WriteJSResponse(w http.ResponseWriter, resp *JSResponse) error {
	// 写入 Headers
	for k, v := range resp.Headers {
		w.Header().Set(k, v)
	}

	// 写入状态码
	if resp.Status > 0 {
		w.WriteHeader(resp.Status)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	// 写入 Body
	if resp.Body != "" {
		_, err := w.Write([]byte(resp.Body))
		return err
	}

	return nil
}

// WriteError 写入错误响应
func (t *HTTPTrigger) WriteError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	resp := map[string]string{"error": message}
	json.NewEncoder(w).Encode(resp)
}

// WithTimeout 创建带超时的上下文
func (t *HTTPTrigger) WithTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, t.config.Timeout)
}

// Handle 处理 HTTP 请求
func (t *HTTPTrigger) Handle(w http.ResponseWriter, r *http.Request) {
	// 匹配路由
	file, params, ok := t.MatchRoute(r.URL.Path)
	if !ok {
		t.WriteError(w, http.StatusNotFound, "Route not found")
		return
	}

	// 构建 JS 请求
	jsReq, err := t.BuildJSRequest(r)
	if err != nil {
		t.WriteError(w, http.StatusBadRequest, "Failed to parse request")
		return
	}
	jsReq.Params = params

	// 创建超时上下文
	ctx, cancel := t.WithTimeout(r.Context())
	defer cancel()

	// 获取运行时实例
	if t.pool == nil {
		t.WriteError(w, http.StatusInternalServerError, "Runtime pool not initialized")
		return
	}

	engine, err := t.pool.Acquire(ctx)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			t.WriteError(w, http.StatusGatewayTimeout, "Gateway Timeout")
		} else {
			t.WriteError(w, http.StatusServiceUnavailable, "No available runtime")
		}
		return
	}
	defer t.pool.Release(engine)

	// TODO: 执行 JS 代码
	_ = file
	_ = jsReq

	// 临时返回
	t.WriteError(w, http.StatusNotImplemented, "Not implemented")
}
