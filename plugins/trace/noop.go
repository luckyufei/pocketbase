package trace

import "context"

// NoopTracer 是 Tracer 接口的空实现
// 当追踪未注册或禁用时使用
type NoopTracer struct{}

// NewNoopTrace 创建一个新的 NoopTracer
func NewNoopTrace() *NoopTracer {
	return &NoopTracer{}
}

// StartSpan 返回原 context 和 NoopSpanBuilder
func (n *NoopTracer) StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder) {
	return ctx, &NoopSpanBuilder{}
}

// RecordSpan 不执行任何操作
func (n *NoopTracer) RecordSpan(span *Span) {}

// IsEnabled 始终返回 false
func (n *NoopTracer) IsEnabled() bool {
	return false
}

// Flush 不执行任何操作
func (n *NoopTracer) Flush() {}

// Prune 返回 0 和 nil
func (n *NoopTracer) Prune() (int64, error) {
	return 0, nil
}

// Close 返回 nil
func (n *NoopTracer) Close() error {
	return nil
}

// NoopSpanBuilder 是 SpanBuilder 接口的空实现
type NoopSpanBuilder struct{}

// SetAttribute 返回自身
func (n *NoopSpanBuilder) SetAttribute(key string, value any) SpanBuilder {
	return n
}

// SetStatus 返回自身
func (n *NoopSpanBuilder) SetStatus(status SpanStatus, message string) SpanBuilder {
	return n
}

// SetKind 返回自身
func (n *NoopSpanBuilder) SetKind(kind SpanKind) SpanBuilder {
	return n
}

// End 不执行任何操作
func (n *NoopSpanBuilder) End() {}

// 确保实现了接口
var _ Tracer = (*NoopTracer)(nil)
var _ SpanBuilder = (*NoopSpanBuilder)(nil)
