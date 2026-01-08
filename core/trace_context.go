package core

import (
	"context"
	"crypto/rand"
	"encoding/hex"
)

// ============================================================================
// Context 键定义
// ============================================================================

type contextKey string

const (
	spanContextKey  contextKey = "pb_span"
	traceContextKey contextKey = "pb_trace_context"
)

// ============================================================================
// TraceContext - 用于跨进程传递的追踪上下文
// ============================================================================

// TraceContext 包含跨进程传递的追踪信息
type TraceContext struct {
	TraceID  string // 32-char Hex
	ParentID string // 16-char Hex
}

// ============================================================================
// Context 操作函数
// ============================================================================

// ContextWithSpan 将 Span 存入 Context
func ContextWithSpan(ctx context.Context, span *Span) context.Context {
	return context.WithValue(ctx, spanContextKey, span)
}

// SpanFromContext 从 Context 获取 Span
func SpanFromContext(ctx context.Context) *Span {
	if span, ok := ctx.Value(spanContextKey).(*Span); ok {
		return span
	}
	return nil
}

// ContextWithTraceContext 将 TraceContext 存入 Context
func ContextWithTraceContext(ctx context.Context, tc *TraceContext) context.Context {
	return context.WithValue(ctx, traceContextKey, tc)
}

// TraceContextFromContext 从 Context 获取 TraceContext
func TraceContextFromContext(ctx context.Context) *TraceContext {
	if tc, ok := ctx.Value(traceContextKey).(*TraceContext); ok {
		return tc
	}
	return nil
}

// ============================================================================
// ID 生成函数
// ============================================================================

// GenerateTraceID 生成 32 字符的 trace_id (128-bit)
func GenerateTraceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// GenerateSpanID 生成 16 字符的 span_id (64-bit)
func GenerateSpanID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
