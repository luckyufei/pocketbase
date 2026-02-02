// Package trace 提供可插拔的分布式追踪功能
package trace

import (
	"net/http"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// MiddlewareConfig 中间件配置
type MiddlewareConfig struct {
	// Mode 追踪模式
	Mode TraceMode

	// Filters 过滤器列表
	Filters []Filter

	// DyeStore 染色用户存储（可选）
	DyeStore interface {
		IsDyed(userID string) bool
	}

	// GetUserID 从请求中获取用户 ID 的函数
	GetUserID func(r *http.Request) string

	// SkipPaths 要跳过的路径列表
	SkipPaths []string

	// SpanNameFunc 自定义 Span 名称生成函数
	SpanNameFunc func(r *http.Request) string
}

// DefaultMiddlewareConfig 返回默认中间件配置
func DefaultMiddlewareConfig() *MiddlewareConfig {
	return &MiddlewareConfig{
		Mode:    ModeConditional,
		Filters: []Filter{},
	}
}

// TraceMiddleware 创建 HTTP 追踪中间件
func TraceMiddleware(tracer Tracer, config *MiddlewareConfig) func(http.Handler) http.Handler {
	if config == nil {
		config = DefaultMiddlewareConfig()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 检查追踪是否启用
			if !tracer.IsEnabled() || config.Mode == ModeOff {
				next.ServeHTTP(w, r)
				return
			}

			// 检查是否在跳过列表中
			if shouldSkipPath(r.URL.Path, config.SkipPaths) {
				next.ServeHTTP(w, r)
				return
			}

			// 解析或创建 TraceContext
			traceCtx := parseOrCreateTraceContext(r)

			// 创建响应捕获器
			capture := NewResponseCapture(w)

			// 记录开始时间
			startTime := time.Now()

			// 创建 LazySpan（延迟创建）
			spanName := getSpanName(r, config.SpanNameFunc)
			lazySpan := NewLazySpan(spanName, func() string { return traceCtx.TraceID }, func() string { return GenerateSpanID() })

			// 检查预执行过滤器（决定是否需要追踪）
			shouldTrace := config.Mode == ModeFull
			if !shouldTrace && config.Mode == ModeConditional {
				// 检查是否是染色用户
				if config.DyeStore != nil && config.GetUserID != nil {
					userID := config.GetUserID(r)
					if userID != "" && config.DyeStore.IsDyed(userID) {
						shouldTrace = true
					}
				}

				// 检查预执行过滤器
				if !shouldTrace {
					filterCtx := &FilterContext{
						Request: r,
					}
					for _, filter := range config.Filters {
						if filter.Phase() == PreExecution && filter.ShouldTrace(filterCtx) {
							shouldTrace = true
							break
						}
					}
				}
			}

			// 执行请求
			next.ServeHTTP(capture, r)

			// 计算持续时间
			duration := time.Since(startTime)

			// 检查后执行过滤器
			if !shouldTrace && config.Mode == ModeConditional {
				filterCtx := &FilterContext{
					Request:  r,
					Response: &Response{StatusCode: capture.StatusCode(), Size: capture.Size()},
					Duration: duration,
				}
				for _, filter := range config.Filters {
					if filter.Phase() == PostExecution && filter.ShouldTrace(filterCtx) {
						shouldTrace = true
						break
					}
				}
			}

			// 如果需要追踪，创建并记录 Span
			if shouldTrace {
				span := lazySpan.GetOrCreate()
				span.ParentID = traceCtx.ParentID
				span.StartTime = startTime.UnixMicro()
				span.Duration = duration.Microseconds()
				span.Kind = SpanKindServer
				span.Status = getSpanStatus(capture.StatusCode())
				span.Created = types.NowDateTime()
				span.Attributes = buildSpanAttributes(r, capture, duration)

				// 设置染色标记
				if config.DyeStore != nil && config.GetUserID != nil {
					userID := config.GetUserID(r)
					if userID != "" && config.DyeStore.IsDyed(userID) {
						if span.Attributes == nil {
							span.Attributes = make(map[string]any)
						}
						span.Attributes["trace.dyed"] = true
						span.Attributes["user.id"] = userID
					}
				}

				tracer.RecordSpan(span)
			}
		})
	}
}

// ResponseCapture 捕获响应状态码和大小
type ResponseCapture struct {
	http.ResponseWriter
	statusCode int
	size       int64
	written    bool
}

// NewResponseCapture 创建响应捕获器
func NewResponseCapture(w http.ResponseWriter) *ResponseCapture {
	return &ResponseCapture{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}
}

// WriteHeader 实现 http.ResponseWriter
func (c *ResponseCapture) WriteHeader(statusCode int) {
	if !c.written {
		c.statusCode = statusCode
		c.written = true
		c.ResponseWriter.WriteHeader(statusCode)
	}
}

// Write 实现 http.ResponseWriter
func (c *ResponseCapture) Write(b []byte) (int, error) {
	if !c.written {
		c.written = true
	}
	n, err := c.ResponseWriter.Write(b)
	c.size += int64(n)
	return n, err
}

// StatusCode 返回响应状态码
func (c *ResponseCapture) StatusCode() int {
	return c.statusCode
}

// Size 返回响应大小
func (c *ResponseCapture) Size() int64 {
	return c.size
}

// LazySpan 延迟创建的 Span
type LazySpan struct {
	mu           sync.Mutex
	span         *Span
	name         string
	traceIDFunc  func() string
	spanIDFunc   func() string
	created      bool
}

// NewLazySpan 创建延迟 Span
func NewLazySpan(name string, traceIDFunc, spanIDFunc func() string) *LazySpan {
	return &LazySpan{
		name:        name,
		traceIDFunc: traceIDFunc,
		spanIDFunc:  spanIDFunc,
	}
}

// GetOrCreate 获取或创建 Span
func (ls *LazySpan) GetOrCreate() *Span {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	if !ls.created {
		ls.span = &Span{
			ID:      GenerateSpanID(),
			TraceID: ls.traceIDFunc(),
			SpanID:  ls.spanIDFunc(),
			Name:    ls.name,
		}
		ls.created = true
	}
	return ls.span
}

// GetIfCreated 如果已创建则返回 Span，否则返回 nil
func (ls *LazySpan) GetIfCreated() *Span {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	return ls.span
}

// IsCreated 返回 Span 是否已创建
func (ls *LazySpan) IsCreated() bool {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	return ls.created
}

// parseOrCreateTraceContext 解析或创建 TraceContext
func parseOrCreateTraceContext(r *http.Request) *TraceContext {
	traceparent := r.Header.Get("traceparent")
	if traceparent != "" {
		if tc, err := ParseTraceparent(traceparent); err == nil && tc != nil {
			return tc
		}
	}

	return &TraceContext{
		TraceID: GenerateTraceID(),
		Sampled: true,
	}
}

// shouldSkipPath 检查路径是否应该跳过
func shouldSkipPath(path string, skipPaths []string) bool {
	for _, skip := range skipPaths {
		if path == skip || (len(skip) > 0 && skip[len(skip)-1] == '*' && len(path) >= len(skip)-1 && path[:len(skip)-1] == skip[:len(skip)-1]) {
			return true
		}
	}
	return false
}

// getSpanName 获取 Span 名称
func getSpanName(r *http.Request, customFunc func(*http.Request) string) string {
	if customFunc != nil {
		return customFunc(r)
	}
	return r.Method + " " + r.URL.Path
}

// getSpanStatus 根据状态码返回 Span 状态
func getSpanStatus(statusCode int) SpanStatus {
	if statusCode >= 400 {
		return SpanStatusError
	}
	return SpanStatusOK
}

// buildSpanAttributes 构建 Span 属性
func buildSpanAttributes(r *http.Request, capture *ResponseCapture, duration time.Duration) map[string]any {
	attrs := map[string]any{
		"http.method":        r.Method,
		"http.url":           r.URL.String(),
		"http.target":        r.URL.Path,
		"http.status_code":   capture.StatusCode(),
		"http.response_size": capture.Size(),
	}

	if r.Host != "" {
		attrs["http.host"] = r.Host
	}

	if ua := r.Header.Get("User-Agent"); ua != "" {
		attrs["http.user_agent"] = ua
	}

	if referer := r.Header.Get("Referer"); referer != "" {
		attrs["http.referer"] = referer
	}

	if r.URL.RawQuery != "" {
		attrs["http.query_string"] = r.URL.RawQuery
	}

	return attrs
}
