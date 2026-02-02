package trace

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
)

// contextKey 是 context 中存储 trace 相关数据的 key 类型
type contextKey int

const (
	traceContextKey contextKey = iota
	spanContextKey
)

// TraceContext 表示 W3C Trace Context 信息
type TraceContext struct {
	TraceID  string // 32 字符 hex 字符串
	ParentID string // 16 字符 hex 字符串
	Sampled  bool   // 是否采样
}

// ContextWithTraceContext 将 TraceContext 存入 context
func ContextWithTraceContext(ctx context.Context, tc *TraceContext) context.Context {
	return context.WithValue(ctx, traceContextKey, tc)
}

// TraceContextFromContext 从 context 获取 TraceContext
func TraceContextFromContext(ctx context.Context) *TraceContext {
	if tc, ok := ctx.Value(traceContextKey).(*TraceContext); ok {
		return tc
	}
	return nil
}

// ContextWithSpan 将 Span 存入 context
func ContextWithSpan(ctx context.Context, span *Span) context.Context {
	return context.WithValue(ctx, spanContextKey, span)
}

// SpanFromContext 从 context 获取 Span
func SpanFromContext(ctx context.Context) *Span {
	if span, ok := ctx.Value(spanContextKey).(*Span); ok {
		return span
	}
	return nil
}

// GenerateTraceID 生成 32 字符 hex TraceID
func GenerateTraceID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// GenerateSpanID 生成 16 字符 hex SpanID
func GenerateSpanID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ParseTraceparent 解析 W3C Trace Context traceparent 头
// 格式: version-trace-id-parent-id-trace-flags
// 例如: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
func ParseTraceparent(header string) (*TraceContext, error) {
	if header == "" {
		return nil, errors.New("empty traceparent header")
	}

	parts := strings.Split(header, "-")
	if len(parts) != 4 {
		return nil, errors.New("invalid traceparent format: expected 4 parts")
	}

	version := parts[0]
	traceID := parts[1]
	parentID := parts[2]
	flags := parts[3]

	// 验证版本 (目前只支持 00)
	if version != "00" {
		return nil, errors.New("unsupported traceparent version")
	}

	// 验证 trace-id 长度 (32 字符)
	if len(traceID) != 32 {
		return nil, errors.New("invalid trace-id length")
	}

	// 验证 parent-id 长度 (16 字符)
	if len(parentID) != 16 {
		return nil, errors.New("invalid parent-id length")
	}

	// 解析 flags
	sampled := false
	if len(flags) >= 2 && flags[1] == '1' {
		sampled = true
	}

	return &TraceContext{
		TraceID:  traceID,
		ParentID: parentID,
		Sampled:  sampled,
	}, nil
}

// FormatTraceparent 格式化为 W3C Trace Context traceparent 头
func FormatTraceparent(tc *TraceContext) string {
	flags := "00"
	if tc.Sampled {
		flags = "01"
	}
	return "00-" + tc.TraceID + "-" + tc.ParentID + "-" + flags
}
