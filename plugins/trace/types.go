package trace

import (
	"context"

	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// Tracer 接口定义
// ============================================================================

// SpanStatus 表示 Span 的状态
type SpanStatus string

const (
	SpanStatusUnset SpanStatus = "unset"
	SpanStatusOK    SpanStatus = "ok"
	SpanStatusError SpanStatus = "error"
)

// SpanKind 表示 Span 的类型
type SpanKind string

const (
	SpanKindInternal SpanKind = "internal"
	SpanKindServer   SpanKind = "server"
	SpanKindClient   SpanKind = "client"
	SpanKindProducer SpanKind = "producer"
	SpanKindConsumer SpanKind = "consumer"
)

// Span 表示一个追踪 Span
type Span struct {
	ID         string            `json:"id"`
	TraceID    string            `json:"traceId"`
	SpanID     string            `json:"spanId"`
	ParentID   string            `json:"parentId,omitempty"`
	Name       string            `json:"name"`
	Kind       SpanKind          `json:"kind"`
	StartTime  int64             `json:"startTime"` // 微秒时间戳
	Duration   int64             `json:"duration"`  // 微秒
	Status     SpanStatus        `json:"status"`
	Attributes map[string]any    `json:"attributes,omitempty"`
	Created    types.DateTime    `json:"created"`
}

// SpanBuilder 用于构建和完成 Span
type SpanBuilder interface {
	// SetAttribute 设置 Span 属性
	SetAttribute(key string, value any) SpanBuilder
	// SetStatus 设置 Span 状态
	SetStatus(status SpanStatus, message string) SpanBuilder
	// SetKind 设置 Span 类型
	SetKind(kind SpanKind) SpanBuilder
	// End 结束 Span
	End()
}

// Tracer 定义追踪器接口
type Tracer interface {
	// StartSpan 创建并开始一个新的 Span
	StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder)
	// RecordSpan 记录一个完成的 Span
	RecordSpan(span *Span)
	// IsEnabled 返回追踪是否启用
	IsEnabled() bool
	// Flush 刷新缓冲区
	Flush()
	// Prune 清理过期数据
	Prune() (int64, error)
	// Close 关闭追踪器
	Close() error
}
