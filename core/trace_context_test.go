package core_test

import (
	"context"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// Phase 2: Context 传递工具测试
// ============================================================================

func TestContextWithSpan(t *testing.T) {
	span := &core.Span{
		TraceID: "0123456789abcdef0123456789abcdef",
		SpanID:  "0123456789abcdef",
		Name:    "test",
	}

	ctx := core.ContextWithSpan(context.Background(), span)

	retrieved := core.SpanFromContext(ctx)
	if retrieved == nil {
		t.Fatal("SpanFromContext returned nil")
	}
	if retrieved.TraceID != span.TraceID {
		t.Errorf("TraceID = %q, want %q", retrieved.TraceID, span.TraceID)
	}
}

func TestSpanFromContextEmpty(t *testing.T) {
	ctx := context.Background()

	span := core.SpanFromContext(ctx)
	if span != nil {
		t.Error("SpanFromContext should return nil for empty context")
	}
}

func TestTraceContextFromContext(t *testing.T) {
	traceCtx := &core.TraceContext{
		TraceID:  "0123456789abcdef0123456789abcdef",
		ParentID: "fedcba9876543210",
	}

	ctx := core.ContextWithTraceContext(context.Background(), traceCtx)

	retrieved := core.TraceContextFromContext(ctx)
	if retrieved == nil {
		t.Fatal("TraceContextFromContext returned nil")
	}
	if retrieved.TraceID != traceCtx.TraceID {
		t.Errorf("TraceID = %q, want %q", retrieved.TraceID, traceCtx.TraceID)
	}
	if retrieved.ParentID != traceCtx.ParentID {
		t.Errorf("ParentID = %q, want %q", retrieved.ParentID, traceCtx.ParentID)
	}
}

func TestTraceContextFromContextEmpty(t *testing.T) {
	ctx := context.Background()

	traceCtx := core.TraceContextFromContext(ctx)
	if traceCtx != nil {
		t.Error("TraceContextFromContext should return nil for empty context")
	}
}

func TestGenerateTraceID(t *testing.T) {
	id := core.GenerateTraceID()

	if len(id) != 32 {
		t.Errorf("GenerateTraceID() length = %d, want 32", len(id))
	}

	// 验证是 hex 格式
	for _, c := range id {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("GenerateTraceID() contains invalid char: %c", c)
		}
	}

	// 验证唯一性
	id2 := core.GenerateTraceID()
	if id == id2 {
		t.Error("GenerateTraceID() should generate unique IDs")
	}
}

func TestGenerateSpanID(t *testing.T) {
	id := core.GenerateSpanID()

	if len(id) != 16 {
		t.Errorf("GenerateSpanID() length = %d, want 16", len(id))
	}

	// 验证是 hex 格式
	for _, c := range id {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("GenerateSpanID() contains invalid char: %c", c)
		}
	}

	// 验证唯一性
	id2 := core.GenerateSpanID()
	if id == id2 {
		t.Error("GenerateSpanID() should generate unique IDs")
	}
}
