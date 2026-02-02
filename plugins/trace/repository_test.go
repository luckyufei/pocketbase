package trace

import (
	"testing"
	"time"
)

// TestTraceRepositoryInterface 验证 TraceRepository 接口定义
func TestTraceRepositoryInterface(t *testing.T) {
	// 验证接口类型存在
	var _ TraceRepository = (*mockRepository)(nil)
}

// TestTraceQueryOptions 测试查询选项
func TestTraceQueryOptions(t *testing.T) {
	t.Run("default options", func(t *testing.T) {
		opts := TraceQueryOptions{}
		if opts.Limit != 0 {
			t.Errorf("expected default limit 0, got %d", opts.Limit)
		}
		if opts.Offset != 0 {
			t.Errorf("expected default offset 0, got %d", opts.Offset)
		}
	})

	t.Run("with values", func(t *testing.T) {
		opts := TraceQueryOptions{
			TraceID:       "trace-123",
			ParentSpanID:  "span-456",
			MinDuration:   100 * time.Millisecond,
			MaxDuration:   5 * time.Second,
			StatusFilter:  []SpanStatus{SpanStatusError},
			StartTimeFrom: time.Now().Add(-1 * time.Hour),
			StartTimeTo:   time.Now(),
			Limit:         100,
			Offset:        20,
		}
		if opts.TraceID != "trace-123" {
			t.Errorf("expected TraceID 'trace-123', got '%s'", opts.TraceID)
		}
		if opts.Limit != 100 {
			t.Errorf("expected limit 100, got %d", opts.Limit)
		}
	})
}

// TestBatchSaveResult 测试批量保存结果
func TestBatchSaveResult(t *testing.T) {
	result := BatchSaveResult{
		Total:   100,
		Success: 95,
		Failed:  5,
	}

	if result.Total != 100 {
		t.Errorf("expected total 100, got %d", result.Total)
	}
	if result.Success != 95 {
		t.Errorf("expected success 95, got %d", result.Success)
	}
	if result.Failed != 5 {
		t.Errorf("expected failed 5, got %d", result.Failed)
	}
}

// mockRepository 用于测试接口定义
type mockRepository struct{}

func (m *mockRepository) SaveBatch(spans []*Span) (BatchSaveResult, error) {
	return BatchSaveResult{Total: len(spans), Success: len(spans)}, nil
}

func (m *mockRepository) FindByTraceID(traceID string) ([]*Span, error) {
	return nil, nil
}

func (m *mockRepository) FindBySpanID(spanID string) (*Span, error) {
	return nil, nil
}

func (m *mockRepository) Query(opts TraceQueryOptions) ([]*Span, error) {
	return nil, nil
}

func (m *mockRepository) Count(opts TraceQueryOptions) (int64, error) {
	return 0, nil
}

func (m *mockRepository) Prune(before time.Time) (int64, error) {
	return 0, nil
}

func (m *mockRepository) DeleteByTraceID(traceID string) error {
	return nil
}

func (m *mockRepository) Close() error {
	return nil
}
