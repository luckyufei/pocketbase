package trace

import (
	"context"
	"testing"
)

// TestTraceImplIsEnabled 测试 traceImpl.IsEnabled 方法
func TestTraceImplIsEnabled(t *testing.T) {
	tests := []struct {
		name     string
		mode     TraceMode
		expected bool
	}{
		{"ModeOff returns false", ModeOff, false},
		{"ModeConditional returns true", ModeConditional, true},
		{"ModeFull returns true", ModeFull, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tracer := &traceImpl{config: Config{Mode: tt.mode}}
			if got := tracer.IsEnabled(); got != tt.expected {
				t.Errorf("traceImpl.IsEnabled() = %v, want %v", got, tt.expected)
			}
		})
	}
}

// TestTraceImplStartSpan 测试 traceImpl.StartSpan 方法
func TestTraceImplStartSpan(t *testing.T) {
	tracer := &traceImpl{config: DefaultConfig()}
	ctx := context.Background()

	newCtx, builder := tracer.StartSpan(ctx, "test-span")

	// 现在返回 NoopSpanBuilder（TODO 实现后会更新）
	if newCtx != ctx {
		t.Error("StartSpan should return same context for now")
	}
	if _, ok := builder.(*NoopSpanBuilder); !ok {
		t.Error("StartSpan should return NoopSpanBuilder for now")
	}
}

// TestTraceImplRecordSpan 测试 traceImpl.RecordSpan 方法
func TestTraceImplRecordSpan(t *testing.T) {
	tracer := &traceImpl{config: DefaultConfig()}

	// 不应该 panic
	tracer.RecordSpan(nil)
	tracer.RecordSpan(&Span{})
}

// TestTraceImplFlush 测试 traceImpl.Flush 方法
func TestTraceImplFlush(t *testing.T) {
	tracer := &traceImpl{config: DefaultConfig()}

	// 不应该 panic
	tracer.Flush()
}

// TestTraceImplPrune 测试 traceImpl.Prune 方法
func TestTraceImplPrune(t *testing.T) {
	tracer := &traceImpl{config: DefaultConfig()}

	deleted, err := tracer.Prune()
	if err != nil {
		t.Errorf("Prune should not return error, got %v", err)
	}
	if deleted != 0 {
		t.Errorf("Prune should return 0, got %d", deleted)
	}
}

// TestTraceImplClose 测试 traceImpl.Close 方法
func TestTraceImplClose(t *testing.T) {
	tracer := &traceImpl{config: DefaultConfig()}

	if err := tracer.Close(); err != nil {
		t.Errorf("Close should return nil, got %v", err)
	}
}

// TestTraceImplImplementsTracer 测试 traceImpl 实现了 Tracer 接口
func TestTraceImplImplementsTracer(t *testing.T) {
	var _ Tracer = (*traceImpl)(nil)
}
