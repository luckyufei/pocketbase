package trace

import (
	"context"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// TestModeConstants 测试 TraceMode 常量定义
func TestModeConstants(t *testing.T) {
	// 验证三种模式的值
	if ModeOff != TraceMode("off") {
		t.Errorf("ModeOff should be 'off', got %s", ModeOff)
	}
	if ModeConditional != TraceMode("conditional") {
		t.Errorf("ModeConditional should be 'conditional', got %s", ModeConditional)
	}
	if ModeFull != TraceMode("full") {
		t.Errorf("ModeFull should be 'full', got %s", ModeFull)
	}
}

// TestNoopTrace 测试 NoopTrace 实现
func TestNoopTrace(t *testing.T) {
	noop := NewNoopTrace()

	t.Run("StartSpan returns NoopSpanBuilder", func(t *testing.T) {
		ctx := context.Background()
		newCtx, builder := noop.StartSpan(ctx, "test-span")

		// ctx 应该不变
		if newCtx != ctx {
			t.Error("NoopTrace.StartSpan should return the same context")
		}

		// builder 应该是 NoopSpanBuilder
		if _, ok := builder.(*NoopSpanBuilder); !ok {
			t.Error("NoopTrace.StartSpan should return NoopSpanBuilder")
		}
	})

	t.Run("RecordSpan does nothing without panic", func(t *testing.T) {
		// 不应该 panic
		noop.RecordSpan(nil)
		noop.RecordSpan(&Span{})
	})

	t.Run("IsEnabled returns false", func(t *testing.T) {
		if noop.IsEnabled() {
			t.Error("NoopTrace.IsEnabled should return false")
		}
	})

	t.Run("Flush does nothing without panic", func(t *testing.T) {
		noop.Flush()
	})

	t.Run("Prune returns zero without error", func(t *testing.T) {
		deleted, err := noop.Prune()
		if err != nil {
			t.Errorf("NoopTrace.Prune should not return error, got %v", err)
		}
		if deleted != 0 {
			t.Errorf("NoopTrace.Prune should return 0, got %d", deleted)
		}
	})

	t.Run("Close returns nil", func(t *testing.T) {
		if err := noop.Close(); err != nil {
			t.Errorf("NoopTrace.Close should return nil, got %v", err)
		}
	})
}

// TestNoopSpanBuilder 测试 NoopSpanBuilder 实现
func TestNoopSpanBuilder(t *testing.T) {
	builder := &NoopSpanBuilder{}

	t.Run("SetAttribute returns self", func(t *testing.T) {
		result := builder.SetAttribute("key", "value")
		if result != builder {
			t.Error("SetAttribute should return self")
		}
	})

	t.Run("SetStatus returns self", func(t *testing.T) {
		result := builder.SetStatus(SpanStatusOK, "")
		if result != builder {
			t.Error("SetStatus should return self")
		}
	})

	t.Run("SetKind returns self", func(t *testing.T) {
		result := builder.SetKind(SpanKindServer)
		if result != builder {
			t.Error("SetKind should return self")
		}
	})

	t.Run("End does nothing without panic", func(t *testing.T) {
		builder.End() // 不应该 panic
	})

	t.Run("Chained calls work", func(t *testing.T) {
		builder.SetAttribute("key", "value").
			SetStatus(SpanStatusOK, "").
			SetKind(SpanKindServer).
			End()
	})
}

// TestTracerInterface 测试 Tracer 接口是否正确定义
func TestTracerInterface(t *testing.T) {
	// 确保 NoopTracer 实现了 Tracer 接口
	var _ Tracer = (*NoopTracer)(nil)
}

// TestSpanBuilderInterface 测试 SpanBuilder 接口是否正确定义
func TestSpanBuilderInterface(t *testing.T) {
	// 确保 NoopSpanBuilder 实现了 SpanBuilder 接口
	var _ SpanBuilder = (*NoopSpanBuilder)(nil)
}

// TestSpanStatus 测试 SpanStatus 常量
func TestSpanStatus(t *testing.T) {
	if SpanStatusUnset != "unset" {
		t.Errorf("SpanStatusUnset should be 'unset', got %s", SpanStatusUnset)
	}
	if SpanStatusOK != "ok" {
		t.Errorf("SpanStatusOK should be 'ok', got %s", SpanStatusOK)
	}
	if SpanStatusError != "error" {
		t.Errorf("SpanStatusError should be 'error', got %s", SpanStatusError)
	}
}

// TestSpanKind 测试 SpanKind 常量
func TestSpanKind(t *testing.T) {
	if SpanKindInternal != "internal" {
		t.Errorf("SpanKindInternal should be 'internal', got %s", SpanKindInternal)
	}
	if SpanKindServer != "server" {
		t.Errorf("SpanKindServer should be 'server', got %s", SpanKindServer)
	}
	if SpanKindClient != "client" {
		t.Errorf("SpanKindClient should be 'client', got %s", SpanKindClient)
	}
}

// mockApp 用于测试的模拟 App
type mockApp struct {
	core.App
	tracer Tracer
}

func (m *mockApp) SetTracer(t Tracer) {
	m.tracer = t
}

func (m *mockApp) Tracer() Tracer {
	if m.tracer != nil {
		return m.tracer
	}
	return NewNoopTrace()
}
