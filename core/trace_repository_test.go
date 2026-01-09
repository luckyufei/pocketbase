package core_test

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// Phase 1: Repository 接口和 FilterParams 测试
// ============================================================================

func TestFilterParamsDefaults(t *testing.T) {
	params := core.NewFilterParams()

	if params.Limit != 50 {
		t.Errorf("Limit = %d, want 50", params.Limit)
	}
	if params.Offset != 0 {
		t.Errorf("Offset = %d, want 0", params.Offset)
	}
}

func TestFilterParamsWithTraceID(t *testing.T) {
	params := core.NewFilterParams().WithTraceID("abc123")

	if params.TraceID != "abc123" {
		t.Errorf("TraceID = %q, want %q", params.TraceID, "abc123")
	}
}

func TestFilterParamsWithTimeRange(t *testing.T) {
	start := time.Now().Add(-1 * time.Hour)
	end := time.Now()

	params := core.NewFilterParams().WithTimeRange(start, end)

	if params.StartTime != start.UnixMicro() {
		t.Errorf("StartTime = %d, want %d", params.StartTime, start.UnixMicro())
	}
	if params.EndTime != end.UnixMicro() {
		t.Errorf("EndTime = %d, want %d", params.EndTime, end.UnixMicro())
	}
}

func TestFilterParamsWithOperation(t *testing.T) {
	params := core.NewFilterParams().WithOperation("GET /api/users")

	if params.Operation != "GET /api/users" {
		t.Errorf("Operation = %q, want %q", params.Operation, "GET /api/users")
	}
}

func TestFilterParamsWithStatus(t *testing.T) {
	params := core.NewFilterParams().WithStatus(core.SpanStatusError)

	if params.Status != core.SpanStatusError {
		t.Errorf("Status = %q, want %q", params.Status, core.SpanStatusError)
	}
}

func TestFilterParamsWithPagination(t *testing.T) {
	params := core.NewFilterParams().WithPagination(100, 20)

	if params.Limit != 100 {
		t.Errorf("Limit = %d, want 100", params.Limit)
	}
	if params.Offset != 20 {
		t.Errorf("Offset = %d, want 20", params.Offset)
	}
}

func TestFilterParamsChaining(t *testing.T) {
	start := time.Now().Add(-1 * time.Hour)
	end := time.Now()

	params := core.NewFilterParams().
		WithTraceID("trace123").
		WithTimeRange(start, end).
		WithOperation("POST /api/items").
		WithStatus(core.SpanStatusOK).
		WithPagination(25, 50).
		WithRootOnly(true)

	if params.TraceID != "trace123" {
		t.Errorf("TraceID = %q", params.TraceID)
	}
	if params.Operation != "POST /api/items" {
		t.Errorf("Operation = %q", params.Operation)
	}
	if params.Status != core.SpanStatusOK {
		t.Errorf("Status = %q", params.Status)
	}
	if params.Limit != 25 {
		t.Errorf("Limit = %d", params.Limit)
	}
	if params.Offset != 50 {
		t.Errorf("Offset = %d", params.Offset)
	}
	if !params.RootOnly {
		t.Error("RootOnly should be true")
	}
}

func TestTraceStatsFields(t *testing.T) {
	stats := &core.TraceStats{
		TotalRequests: 1000,
		SuccessCount:  950,
		ErrorCount:    50,
		P50Latency:    100,
		P95Latency:    500,
		P99Latency:    1000,
	}

	if stats.TotalRequests != 1000 {
		t.Errorf("TotalRequests = %d", stats.TotalRequests)
	}
	if stats.SuccessCount != 950 {
		t.Errorf("SuccessCount = %d", stats.SuccessCount)
	}
	if stats.ErrorCount != 50 {
		t.Errorf("ErrorCount = %d", stats.ErrorCount)
	}
	if stats.P50Latency != 100 {
		t.Errorf("P50Latency = %d", stats.P50Latency)
	}
	if stats.P95Latency != 500 {
		t.Errorf("P95Latency = %d", stats.P95Latency)
	}
	if stats.P99Latency != 1000 {
		t.Errorf("P99Latency = %d", stats.P99Latency)
	}
}

func TestTraceStatsSuccessRate(t *testing.T) {
	tests := []struct {
		name          string
		total         int64
		success       int64
		expectedRate  float64
	}{
		{"100% success", 100, 100, 100.0},
		{"95% success", 1000, 950, 95.0},
		{"0 requests", 0, 0, 0.0},
		{"50% success", 200, 100, 50.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stats := &core.TraceStats{
				TotalRequests: tt.total,
				SuccessCount:  tt.success,
			}
			rate := stats.SuccessRate()
			if rate != tt.expectedRate {
				t.Errorf("SuccessRate() = %f, want %f", rate, tt.expectedRate)
			}
		})
	}
}

// TestTraceRepositoryInterface 验证接口定义是否正确
// 这是一个编译时检查，确保接口方法签名正确
func TestTraceRepositoryInterface(t *testing.T) {
	// 这个测试主要用于编译时验证接口定义
	// 实际的实现测试在 Phase 2 和 Phase 3
	var _ core.TraceRepository = (*mockTraceRepository)(nil)
}

// mockTraceRepository 用于验证接口定义
type mockTraceRepository struct{}

func (m *mockTraceRepository) BatchWrite(spans []*core.Span) error {
	return nil
}

func (m *mockTraceRepository) Query(params *core.FilterParams) ([]*core.Span, int64, error) {
	return nil, 0, nil
}

func (m *mockTraceRepository) GetTrace(traceID string) ([]*core.Span, error) {
	return nil, nil
}

func (m *mockTraceRepository) Stats(params *core.FilterParams) (*core.TraceStats, error) {
	return nil, nil
}

func (m *mockTraceRepository) Prune(before time.Time) (int64, error) {
	return 0, nil
}

func (m *mockTraceRepository) CreateSchema() error {
	return nil
}

func (m *mockTraceRepository) Close() error {
	return nil
}

func (m *mockTraceRepository) IsHealthy() bool {
	return true
}

func (m *mockTraceRepository) Recover() error {
	return nil
}
