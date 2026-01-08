package apis

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// ============================================================================
// Trace 中间件常量
// ============================================================================

const (
	DefaultTraceMiddlewarePriority = DefaultPanicRecoverMiddlewarePriority - 5
	DefaultTraceMiddlewareId       = "pbTrace"
)

// ============================================================================
// Trace 中间件
// ============================================================================

// traceMiddleware 返回 PocketBase 风格的追踪中间件
// 用于自动追踪所有 HTTP 请求
func traceMiddleware(app core.App) *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id:       DefaultTraceMiddlewareId,
		Priority: DefaultTraceMiddlewarePriority,
		Func: func(e *core.RequestEvent) error {
			ctx := e.Request.Context()
			trace := app.Trace()

			// 解析 traceparent 头
			if tp := e.Request.Header.Get("traceparent"); tp != "" {
				traceID, parentID, valid := ParseTraceparent(tp)
				if valid {
					ctx = core.ContextWithTraceContext(ctx, &core.TraceContext{
						TraceID:  traceID,
						ParentID: parentID,
					})
				}
			}

			// 创建 Root Span
			spanName := fmt.Sprintf("%s %s", e.Request.Method, e.Request.URL.Path)
			ctx, span := trace.StartSpan(ctx, spanName)

			// 设置 HTTP 属性
			span.SetKind(core.SpanKindServer)
			span.SetAttribute("http.method", e.Request.Method)
			span.SetAttribute("http.url", e.Request.URL.String())
			span.SetAttribute("http.host", e.Request.Host)
			span.SetAttribute("http.scheme", getScheme(e.Request))
			span.SetAttribute("http.user_agent", e.Request.UserAgent())

			// 注入 Context
			e.Request = e.Request.WithContext(ctx)

			// 执行请求
			err := e.Next()

			// 设置响应属性和状态
			// 注意：在 PocketBase 中，我们无法直接获取状态码，
			// 所以根据错误来设置 span 状态
			if err != nil {
				span.SetStatus(core.SpanStatusError, "")
			} else {
				span.SetStatus(core.SpanStatusOK, "")
			}

			span.End()
			return err
		},
	}
}

// TraceMiddleware 返回一个 HTTP 中间件，用于自动追踪所有 HTTP 请求
// 它会：
// 1. 解析 traceparent 头（W3C Trace Context）
// 2. 创建 Root Span
// 3. 记录 HTTP 属性（method, url, status_code）
// 4. 根据响应码设置 Span 状态
func TraceMiddleware(trace *core.Trace) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// 解析 traceparent 头
			if tp := r.Header.Get("traceparent"); tp != "" {
				traceID, parentID, valid := ParseTraceparent(tp)
				if valid {
					ctx = core.ContextWithTraceContext(ctx, &core.TraceContext{
						TraceID:  traceID,
						ParentID: parentID,
					})
				}
			}

			// 创建 Root Span
			spanName := fmt.Sprintf("%s %s", r.Method, r.URL.Path)
			ctx, span := trace.StartSpan(ctx, spanName)

			// 设置 HTTP 属性
			span.SetKind(core.SpanKindServer)
			span.SetAttribute("http.method", r.Method)
			span.SetAttribute("http.url", r.URL.String())
			span.SetAttribute("http.host", r.Host)
			span.SetAttribute("http.scheme", getScheme(r))
			span.SetAttribute("http.user_agent", r.UserAgent())

			// 使用 ResponseWriter wrapper 来捕获状态码
			rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// 注入 Context
			r = r.WithContext(ctx)

			// 执行请求
			next.ServeHTTP(rw, r)

			// 设置响应属性
			span.SetAttribute("http.status_code", rw.statusCode)

			// 根据状态码设置 Span 状态
			if rw.statusCode >= 400 {
				span.SetStatus(core.SpanStatusError, "")
			} else {
				span.SetStatus(core.SpanStatusOK, "")
			}

			span.End()
		})
	}
}

// ============================================================================
// W3C Trace Context 解析
// ============================================================================

// ParseTraceparent 解析 W3C Trace Context traceparent 头
// 格式: {version}-{trace_id}-{parent_id}-{flags}
// 示例: 00-0123456789abcdef0123456789abcdef-fedcba9876543210-01
func ParseTraceparent(tp string) (traceID, parentID string, valid bool) {
	if tp == "" {
		return "", "", false
	}

	parts := strings.Split(tp, "-")
	if len(parts) != 4 {
		return "", "", false
	}

	version := parts[0]
	traceID = parts[1]
	parentID = parts[2]

	// 验证版本（目前只支持 00）
	if version != "00" {
		return "", "", false
	}

	// 验证 trace_id 长度（32 chars）
	if len(traceID) != 32 {
		return "", "", false
	}

	// 验证 parent_id 长度（16 chars）
	if len(parentID) != 16 {
		return "", "", false
	}

	// 验证是否为有效的 hex
	if !isValidHex(traceID) || !isValidHex(parentID) {
		return "", "", false
	}

	return traceID, parentID, true
}

// ============================================================================
// 辅助类型和函数
// ============================================================================

// responseWriter 包装 http.ResponseWriter 以捕获状态码
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
	}
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.written = true
	}
	return rw.ResponseWriter.Write(b)
}

// getScheme 获取请求的 scheme
func getScheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if scheme := r.Header.Get("X-Forwarded-Proto"); scheme != "" {
		return scheme
	}
	return "http"
}

// isValidHex 验证字符串是否为有效的 hex
func isValidHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}
