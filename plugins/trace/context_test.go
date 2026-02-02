package trace

import (
	"context"
	"testing"
)

// TestTraceContext 测试 TraceContext 结构
func TestTraceContext(t *testing.T) {
	tc := &TraceContext{
		TraceID:  "abc123",
		ParentID: "def456",
		Sampled:  true,
	}

	if tc.TraceID != "abc123" {
		t.Errorf("TraceID should be 'abc123', got %s", tc.TraceID)
	}
	if tc.ParentID != "def456" {
		t.Errorf("ParentID should be 'def456', got %s", tc.ParentID)
	}
	if !tc.Sampled {
		t.Error("Sampled should be true")
	}
}

// TestContextWithTraceContext 测试 Context 设置和获取
func TestContextWithTraceContext(t *testing.T) {
	t.Run("设置和获取 TraceContext", func(t *testing.T) {
		ctx := context.Background()
		tc := &TraceContext{
			TraceID:  "trace-123",
			ParentID: "span-456",
			Sampled:  true,
		}

		newCtx := ContextWithTraceContext(ctx, tc)
		retrieved := TraceContextFromContext(newCtx)

		if retrieved == nil {
			t.Fatal("TraceContextFromContext should not return nil")
		}
		if retrieved.TraceID != tc.TraceID {
			t.Errorf("TraceID should be %s, got %s", tc.TraceID, retrieved.TraceID)
		}
		if retrieved.ParentID != tc.ParentID {
			t.Errorf("ParentID should be %s, got %s", tc.ParentID, retrieved.ParentID)
		}
	})

	t.Run("从空 context 获取返回 nil", func(t *testing.T) {
		ctx := context.Background()
		tc := TraceContextFromContext(ctx)
		if tc != nil {
			t.Error("TraceContextFromContext should return nil for empty context")
		}
	})
}

// TestContextWithSpan 测试 Span 在 Context 中的传递
func TestContextWithSpan(t *testing.T) {
	t.Run("设置和获取 Span", func(t *testing.T) {
		ctx := context.Background()
		span := &Span{
			TraceID: "trace-123",
			SpanID:  "span-456",
			Name:    "test-span",
		}

		newCtx := ContextWithSpan(ctx, span)
		retrieved := SpanFromContext(newCtx)

		if retrieved == nil {
			t.Fatal("SpanFromContext should not return nil")
		}
		if retrieved.TraceID != span.TraceID {
			t.Errorf("TraceID should be %s, got %s", span.TraceID, retrieved.TraceID)
		}
		if retrieved.SpanID != span.SpanID {
			t.Errorf("SpanID should be %s, got %s", span.SpanID, retrieved.SpanID)
		}
	})

	t.Run("从空 context 获取返回 nil", func(t *testing.T) {
		ctx := context.Background()
		span := SpanFromContext(ctx)
		if span != nil {
			t.Error("SpanFromContext should return nil for empty context")
		}
	})
}

// TestGenerateTraceID 测试 TraceID 生成
func TestGenerateTraceID(t *testing.T) {
	t.Run("生成 32 字符 hex 字符串", func(t *testing.T) {
		id := GenerateTraceID()
		if len(id) != 32 {
			t.Errorf("TraceID should be 32 characters, got %d", len(id))
		}
	})

	t.Run("生成唯一 ID", func(t *testing.T) {
		ids := make(map[string]bool)
		for i := 0; i < 100; i++ {
			id := GenerateTraceID()
			if ids[id] {
				t.Error("Generated duplicate TraceID")
			}
			ids[id] = true
		}
	})
}

// TestGenerateSpanID 测试 SpanID 生成
func TestGenerateSpanID(t *testing.T) {
	t.Run("生成 16 字符 hex 字符串", func(t *testing.T) {
		id := GenerateSpanID()
		if len(id) != 16 {
			t.Errorf("SpanID should be 16 characters, got %d", len(id))
		}
	})

	t.Run("生成唯一 ID", func(t *testing.T) {
		ids := make(map[string]bool)
		for i := 0; i < 100; i++ {
			id := GenerateSpanID()
			if ids[id] {
				t.Error("Generated duplicate SpanID")
			}
			ids[id] = true
		}
	})
}

// TestParseTraceparent 测试 W3C Trace Context 解析
func TestParseTraceparent(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		valid    bool
		traceID  string
		parentID string
		sampled  bool
	}{
		{
			name:     "有效的 traceparent",
			input:    "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
			valid:    true,
			traceID:  "0af7651916cd43dd8448eb211c80319c",
			parentID: "b7ad6b7169203331",
			sampled:  true,
		},
		{
			name:     "不采样的 traceparent",
			input:    "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00",
			valid:    true,
			traceID:  "0af7651916cd43dd8448eb211c80319c",
			parentID: "b7ad6b7169203331",
			sampled:  false,
		},
		{
			name:  "空字符串",
			input: "",
			valid: false,
		},
		{
			name:  "格式错误",
			input: "invalid-format",
			valid: false,
		},
		{
			name:  "版本号错误",
			input: "ff-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
			valid: false,
		},
		{
			name:  "trace-id 长度错误",
			input: "00-0af7651916cd43dd-b7ad6b7169203331-01",
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tc, err := ParseTraceparent(tt.input)

			if tt.valid {
				if err != nil {
					t.Errorf("Expected valid traceparent, got error: %v", err)
					return
				}
				if tc.TraceID != tt.traceID {
					t.Errorf("TraceID should be %s, got %s", tt.traceID, tc.TraceID)
				}
				if tc.ParentID != tt.parentID {
					t.Errorf("ParentID should be %s, got %s", tt.parentID, tc.ParentID)
				}
				if tc.Sampled != tt.sampled {
					t.Errorf("Sampled should be %v, got %v", tt.sampled, tc.Sampled)
				}
			} else {
				if err == nil {
					t.Error("Expected error for invalid traceparent")
				}
			}
		})
	}
}

// TestFormatTraceparent 测试生成 W3C Trace Context 字符串
func TestFormatTraceparent(t *testing.T) {
	tc := &TraceContext{
		TraceID:  "0af7651916cd43dd8448eb211c80319c",
		ParentID: "b7ad6b7169203331",
		Sampled:  true,
	}

	result := FormatTraceparent(tc)
	expected := "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"

	if result != expected {
		t.Errorf("FormatTraceparent should return %s, got %s", expected, result)
	}

	// 测试不采样
	tc.Sampled = false
	result = FormatTraceparent(tc)
	expected = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00"

	if result != expected {
		t.Errorf("FormatTraceparent should return %s, got %s", expected, result)
	}
}
