package trace

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// TestRegisterRoutes 测试路由注册
func TestRegisterRoutes(t *testing.T) {
	t.Run("registers all trace routes", func(t *testing.T) {
		repo := &routesMockRepository{}
		handler := NewTraceAPIHandler(repo)

		mux := http.NewServeMux()
		handler.RegisterRoutes(mux, "/api/_/trace")

		// Just verify the handler is created and can register routes
		if handler == nil {
			t.Error("expected handler to be non-nil")
		}
	})
}

// TestTraceAPIHandler_ListSpans 测试列表查询
func TestTraceAPIHandler_ListSpans(t *testing.T) {
	t.Run("returns spans with pagination", func(t *testing.T) {
		repo := &routesMockRepository{
			querySpans: []*Span{
				createTestSpanForAPI("span-1", "trace-1", 100*time.Millisecond, SpanStatusOK),
				createTestSpanForAPI("span-2", "trace-1", 200*time.Millisecond, SpanStatusOK),
			},
			countResult: 2,
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans?limit=10", nil)
		rec := httptest.NewRecorder()

		handler.ListSpans(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var response SpanListResponse
		json.Unmarshal(rec.Body.Bytes(), &response)

		if len(response.Items) != 2 {
			t.Errorf("expected 2 items, got %d", len(response.Items))
		}
		if response.TotalCount != 2 {
			t.Errorf("expected total 2, got %d", response.TotalCount)
		}
	})

	t.Run("filters by status", func(t *testing.T) {
		repo := &routesMockRepository{
			querySpans: []*Span{
				createTestSpanForAPI("span-error", "trace-1", 100*time.Millisecond, SpanStatusError),
			},
			countResult: 1,
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans?status=error", nil)
		rec := httptest.NewRecorder()

		handler.ListSpans(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})
}

// TestTraceAPIHandler_GetSpansByTraceID 测试按 TraceID 获取
func TestTraceAPIHandler_GetSpansByTraceID(t *testing.T) {
	t.Run("returns spans for trace", func(t *testing.T) {
		repo := &routesMockRepository{
			spansByTraceID: []*Span{
				createTestSpanForAPI("span-1", "trace-123", 100*time.Millisecond, SpanStatusOK),
				createTestSpanForAPI("span-2", "trace-123", 50*time.Millisecond, SpanStatusOK),
			},
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		handler.GetSpansByTraceID(rec, req, "trace-123")

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var spans []*Span
		json.Unmarshal(rec.Body.Bytes(), &spans)

		if len(spans) != 2 {
			t.Errorf("expected 2 spans, got %d", len(spans))
		}
	})

	t.Run("returns empty array for non-existing trace", func(t *testing.T) {
		repo := &routesMockRepository{
			spansByTraceID: []*Span{},
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/non-existing", nil)
		rec := httptest.NewRecorder()

		handler.GetSpansByTraceID(rec, req, "non-existing")

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})
}

// TestTraceAPIHandler_GetSpan 测试获取单个 Span
func TestTraceAPIHandler_GetSpan(t *testing.T) {
	t.Run("returns span by ID", func(t *testing.T) {
		span := createTestSpanForAPI("target-span", "trace-123", 100*time.Millisecond, SpanStatusOK)
		repo := &routesMockRepository{
			spanByID: span,
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123/target-span", nil)
		rec := httptest.NewRecorder()

		handler.GetSpan(rec, req, "trace-123", "target-span")

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})

	t.Run("returns 404 for non-existing span", func(t *testing.T) {
		repo := &routesMockRepository{
			spanByID: nil,
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123/non-existing", nil)
		rec := httptest.NewRecorder()

		handler.GetSpan(rec, req, "trace-123", "non-existing")

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", rec.Code)
		}
	})
}

// TestTraceAPIHandler_DeleteByTraceID 测试按 TraceID 删除
func TestTraceAPIHandler_DeleteByTraceID(t *testing.T) {
	t.Run("deletes trace successfully", func(t *testing.T) {
		repo := &routesMockRepository{}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("DELETE", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		handler.DeleteByTraceID(rec, req, "trace-123")

		if rec.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", rec.Code)
		}
	})

	t.Run("returns error on delete failure", func(t *testing.T) {
		repo := &routesMockRepository{err: errors.New("delete failed")}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("DELETE", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		handler.DeleteByTraceID(rec, req, "trace-123")

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})
}

// TestTraceAPIHandler_ListSpansError 测试列表查询错误场景
func TestTraceAPIHandler_ListSpansError(t *testing.T) {
	t.Run("returns error on query failure", func(t *testing.T) {
		repo := &routesMockRepository{err: errors.New("query failed")}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans", nil)
		rec := httptest.NewRecorder()

		handler.ListSpans(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})

	t.Run("returns error on count failure", func(t *testing.T) {
		repo := &routesMockRepository{
			querySpans:  []*Span{},
			countErr:    errors.New("count failed"),
		}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans", nil)
		rec := httptest.NewRecorder()

		handler.ListSpans(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})
}

// TestTraceAPIHandler_GetSpansByTraceIDError 测试获取 TraceID 错误场景
func TestTraceAPIHandler_GetSpansByTraceIDError(t *testing.T) {
	t.Run("returns error on find failure", func(t *testing.T) {
		repo := &routesMockRepository{err: errors.New("find failed")}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		handler.GetSpansByTraceID(rec, req, "trace-123")

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})

	t.Run("returns nil as empty array", func(t *testing.T) {
		repo := &routesMockRepository{spansByTraceID: nil}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		handler.GetSpansByTraceID(rec, req, "trace-123")

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var spans []*Span
		json.Unmarshal(rec.Body.Bytes(), &spans)
		if spans == nil {
			t.Error("expected non-nil empty array")
		}
	})
}

// TestTraceAPIHandler_GetSpanError 测试获取单个 Span 错误场景
func TestTraceAPIHandler_GetSpanError(t *testing.T) {
	t.Run("returns error on find failure", func(t *testing.T) {
		repo := &routesMockRepository{err: errors.New("find failed")}
		handler := NewTraceAPIHandler(repo)

		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123/span-456", nil)
		rec := httptest.NewRecorder()

		handler.GetSpan(rec, req, "trace-123", "span-456")

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})
}

// TestParseQueryOptions 测试查询参数解析
func TestParseQueryOptions(t *testing.T) {
	t.Run("parses all query parameters", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans?traceId=t1&parentSpanId=p1&name=test&orderBy=duration&orderDir=asc&limit=50&offset=10&minDuration=100&maxDuration=5000&status=error,ok&startTimeFrom=2024-01-01T00:00:00Z&startTimeTo=2024-12-31T23:59:59Z", nil)

		opts := parseQueryOptions(req)

		if opts.TraceID != "t1" {
			t.Errorf("expected traceId t1, got %s", opts.TraceID)
		}
		if opts.ParentSpanID != "p1" {
			t.Errorf("expected parentSpanId p1, got %s", opts.ParentSpanID)
		}
		if opts.SpanName != "test" {
			t.Errorf("expected name test, got %s", opts.SpanName)
		}
		if opts.OrderBy != "duration" {
			t.Errorf("expected orderBy duration, got %s", opts.OrderBy)
		}
		if opts.OrderDesc {
			t.Error("expected orderDir asc (OrderDesc=false)")
		}
		if opts.Limit != 50 {
			t.Errorf("expected limit 50, got %d", opts.Limit)
		}
		if opts.Offset != 10 {
			t.Errorf("expected offset 10, got %d", opts.Offset)
		}
		if opts.MinDuration != 100*time.Millisecond {
			t.Errorf("expected minDuration 100ms, got %v", opts.MinDuration)
		}
		if opts.MaxDuration != 5000*time.Millisecond {
			t.Errorf("expected maxDuration 5000ms, got %v", opts.MaxDuration)
		}
		if len(opts.StatusFilter) != 2 {
			t.Errorf("expected 2 status filters, got %d", len(opts.StatusFilter))
		}
		if opts.StartTimeFrom.IsZero() {
			t.Error("expected non-zero startTimeFrom")
		}
		if opts.StartTimeTo.IsZero() {
			t.Error("expected non-zero startTimeTo")
		}
	})

	t.Run("uses page parameter for offset calculation", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans?page=3&limit=20", nil)

		opts := parseQueryOptions(req)

		// page 3 with limit 20 = offset 40
		if opts.Offset != 40 {
			t.Errorf("expected offset 40 for page 3, got %d", opts.Offset)
		}
	})

	t.Run("uses default limit when not specified", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans", nil)

		opts := parseQueryOptions(req)

		if opts.Limit != 20 {
			t.Errorf("expected default limit 20, got %d", opts.Limit)
		}
	})

	t.Run("ignores invalid numeric values", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans?limit=abc&offset=xyz&page=-1&minDuration=bad", nil)

		opts := parseQueryOptions(req)

		// Should use defaults
		if opts.Limit != 20 {
			t.Errorf("expected default limit 20, got %d", opts.Limit)
		}
		if opts.Offset != 0 {
			t.Errorf("expected offset 0 for invalid value, got %d", opts.Offset)
		}
	})

	t.Run("ignores invalid time values", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans?startTimeFrom=invalid&startTimeTo=also-invalid", nil)

		opts := parseQueryOptions(req)

		if !opts.StartTimeFrom.IsZero() {
			t.Error("expected zero startTimeFrom for invalid value")
		}
		if !opts.StartTimeTo.IsZero() {
			t.Error("expected zero startTimeTo for invalid value")
		}
	})
}

// TestRegisterRoutesHTTPMethods 测试路由 HTTP 方法处理
func TestRegisterRoutesHTTPMethods(t *testing.T) {
	repo := &routesMockRepository{
		querySpans:     []*Span{},
		countResult:    0,
		spansByTraceID: []*Span{},
	}
	handler := NewTraceAPIHandler(repo)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, "/api/_/trace/")

	t.Run("POST to /spans returns method not allowed", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/_/trace/spans", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected status 405, got %d", rec.Code)
		}
	})

	t.Run("PUT to /spans/trace-id returns method not allowed", func(t *testing.T) {
		req := httptest.NewRequest("PUT", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected status 405, got %d", rec.Code)
		}
	})

	t.Run("POST to /spans/trace-id/span-id returns method not allowed", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/_/trace/spans/trace-123/span-456", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected status 405, got %d", rec.Code)
		}
	})

	t.Run("GET /spans/{traceId} works", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})

	t.Run("DELETE /spans/{traceId} works", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/_/trace/spans/trace-123", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", rec.Code)
		}
	})
}

// TestRegisterRoutesPathParsing 测试路由路径解析
func TestRegisterRoutesPathParsing(t *testing.T) {
	repo := &routesMockRepository{
		spanByID: createTestSpanForAPI("span-1", "trace-1", 100*time.Millisecond, SpanStatusOK),
	}
	handler := NewTraceAPIHandler(repo)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, "/api/_/trace")

	t.Run("handles empty path parts", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans/", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		// Empty traceID should result in 404
		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status 404 for empty path, got %d", rec.Code)
		}
	})

	t.Run("handles GET /spans/{traceId}/{spanId}", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123/span-456", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})

	t.Run("handles extra path segments as 404", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/_/trace/spans/trace-123/span-456/extra", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status 404 for extra path segments, got %d", rec.Code)
		}
	})
}

// TestSpanListResponse 测试响应结构
func TestSpanListResponse(t *testing.T) {
	response := SpanListResponse{
		Items:      []*Span{},
		TotalCount: 100,
		Page:       1,
		PerPage:    20,
	}

	if response.TotalCount != 100 {
		t.Errorf("expected total 100, got %d", response.TotalCount)
	}
}

// routesMockRepository 用于路由测试的 mock repository
type routesMockRepository struct {
	querySpans     []*Span
	countResult    int64
	countErr       error
	spansByTraceID []*Span
	spanByID       *Span
	err            error
}

func (m *routesMockRepository) SaveBatch(spans []*Span) (BatchSaveResult, error) {
	return BatchSaveResult{Total: len(spans), Success: len(spans)}, m.err
}

func (m *routesMockRepository) FindByTraceID(traceID string) ([]*Span, error) {
	return m.spansByTraceID, m.err
}

func (m *routesMockRepository) FindBySpanID(spanID string) (*Span, error) {
	return m.spanByID, m.err
}

func (m *routesMockRepository) Query(opts TraceQueryOptions) ([]*Span, error) {
	return m.querySpans, m.err
}

func (m *routesMockRepository) Count(opts TraceQueryOptions) (int64, error) {
	if m.countErr != nil {
		return 0, m.countErr
	}
	return m.countResult, m.err
}

func (m *routesMockRepository) Prune(before time.Time) (int64, error) {
	return 0, m.err
}

func (m *routesMockRepository) DeleteByTraceID(traceID string) error {
	return m.err
}

func (m *routesMockRepository) Close() error {
	return nil
}

// createTestSpanForAPI 创建测试用 Span
func createTestSpanForAPI(id, traceID string, duration time.Duration, status SpanStatus) *Span {
	return &Span{
		ID:        id,
		TraceID:   traceID,
		SpanID:    GenerateSpanID(),
		Name:      "test-operation",
		Kind:      SpanKindServer,
		StartTime: time.Now().Add(-duration).UnixMicro(),
		Duration:  duration.Microseconds(),
		Status:    status,
		Created:   types.NowDateTime(),
	}
}
