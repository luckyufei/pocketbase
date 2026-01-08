package apis_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// ============================================================================
// Phase 5: Trace 中间件测试
// ============================================================================

// mockTraceRepo 用于测试的 mock repository
type mockTraceRepo struct {
	spans   []*core.Span
	mu      sync.Mutex
	created bool
}

func (m *mockTraceRepo) BatchWrite(spans []*core.Span) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.spans = append(m.spans, spans...)
	return nil
}

func (m *mockTraceRepo) Query(params *core.FilterParams) ([]*core.Span, int64, error) {
	return m.spans, int64(len(m.spans)), nil
}

func (m *mockTraceRepo) GetTrace(traceID string) ([]*core.Span, error) {
	var result []*core.Span
	for _, s := range m.spans {
		if s.TraceID == traceID {
			result = append(result, s)
		}
	}
	return result, nil
}

func (m *mockTraceRepo) Stats(params *core.FilterParams) (*core.TraceStats, error) {
	return &core.TraceStats{TotalRequests: int64(len(m.spans))}, nil
}

func (m *mockTraceRepo) Prune(before time.Time) (int64, error) {
	return 0, nil
}

func (m *mockTraceRepo) CreateSchema() error {
	m.created = true
	return nil
}

func (m *mockTraceRepo) Close() error {
	return nil
}

func (m *mockTraceRepo) GetSpans() []*core.Span {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.spans
}

func TestTraceMiddleware(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
		checkSpan      func(t *testing.T, span *core.Span)
	}{
		{
			name:           "GET request",
			method:         "GET",
			path:           "/api/test",
			expectedStatus: 200,
			checkSpan: func(t *testing.T, span *core.Span) {
				if span.Name != "GET /api/test" {
					t.Errorf("Name = %q, want %q", span.Name, "GET /api/test")
				}
				if span.Attributes["http.method"] != "GET" {
					t.Errorf("http.method = %v", span.Attributes["http.method"])
				}
				if span.Status != core.SpanStatusOK {
					t.Errorf("Status = %q, want OK", span.Status)
				}
			},
		},
		{
			name:           "POST request",
			method:         "POST",
			path:           "/api/items",
			expectedStatus: 200,
			checkSpan: func(t *testing.T, span *core.Span) {
				if span.Name != "POST /api/items" {
					t.Errorf("Name = %q, want %q", span.Name, "POST /api/items")
				}
				if span.Attributes["http.method"] != "POST" {
					t.Errorf("http.method = %v", span.Attributes["http.method"])
				}
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			app, _ := tests.NewTestApp()
			defer app.Cleanup()

			repo := &mockTraceRepo{}
			trace := core.NewTrace(repo, nil)

			// 注册测试路由
			app.OnServe().BindFunc(func(se *core.ServeEvent) error {
				se.Router.GET("/api/test", func(e *core.RequestEvent) error {
					return e.JSON(200, map[string]string{"status": "ok"})
				})
				se.Router.POST("/api/items", func(e *core.RequestEvent) error {
					return e.JSON(200, map[string]string{"status": "created"})
				})
				return se.Next()
			})

			// 创建请求
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(s.method, s.path, nil)

			// 应用中间件
			handler := apis.TraceMiddleware(trace)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(s.expectedStatus)
			}))

			handler.ServeHTTP(rec, req)

			// 等待 flush
			time.Sleep(50 * time.Millisecond)
			trace.Flush()

			// 验证 span
			spans := repo.GetSpans()
			if len(spans) != 1 {
				t.Fatalf("Expected 1 span, got %d", len(spans))
			}

			s.checkSpan(t, spans[0])
		})
	}
}

func TestTraceMiddlewareWithTraceparent(t *testing.T) {
	repo := &mockTraceRepo{}
	trace := core.NewTrace(repo, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("traceparent", "00-0123456789abcdef0123456789abcdef-fedcba9876543210-01")

	handler := apis.TraceMiddleware(trace)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	handler.ServeHTTP(rec, req)

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	span := spans[0]
	// 验证 trace_id 从 traceparent 继承
	if span.TraceID != "0123456789abcdef0123456789abcdef" {
		t.Errorf("TraceID = %q, want inherited from traceparent", span.TraceID)
	}
	// 验证 parent_id 从 traceparent 继承
	if span.ParentID != "fedcba9876543210" {
		t.Errorf("ParentID = %q, want inherited from traceparent", span.ParentID)
	}
}

func TestTraceMiddlewareErrorStatus(t *testing.T) {
	repo := &mockTraceRepo{}
	trace := core.NewTrace(repo, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/error", nil)

	handler := apis.TraceMiddleware(trace)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))

	handler.ServeHTTP(rec, req)

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	span := spans[0]
	if span.Status != core.SpanStatusError {
		t.Errorf("Status = %q, want ERROR for 500 response", span.Status)
	}
	if span.Attributes["http.status_code"] != 500 {
		t.Errorf("http.status_code = %v, want 500", span.Attributes["http.status_code"])
	}
}

func TestTraceMiddlewareRecordsDuration(t *testing.T) {
	repo := &mockTraceRepo{}
	trace := core.NewTrace(repo, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/slow", nil)

	handler := apis.TraceMiddleware(trace)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(200)
	}))

	handler.ServeHTTP(rec, req)

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	// Duration 应该大于 10ms (10000 微秒)
	if spans[0].Duration < 10000 {
		t.Errorf("Duration = %d, want >= 10000", spans[0].Duration)
	}
}

func TestParseTraceparent(t *testing.T) {
	tests := []struct {
		name           string
		traceparent    string
		expectedTrace  string
		expectedParent string
		expectedValid  bool
	}{
		{
			name:           "valid traceparent",
			traceparent:    "00-0123456789abcdef0123456789abcdef-fedcba9876543210-01",
			expectedTrace:  "0123456789abcdef0123456789abcdef",
			expectedParent: "fedcba9876543210",
			expectedValid:  true,
		},
		{
			name:           "invalid format",
			traceparent:    "invalid",
			expectedTrace:  "",
			expectedParent: "",
			expectedValid:  false,
		},
		{
			name:           "empty",
			traceparent:    "",
			expectedTrace:  "",
			expectedParent: "",
			expectedValid:  false,
		},
		{
			name:           "wrong version",
			traceparent:    "ff-0123456789abcdef0123456789abcdef-fedcba9876543210-01",
			expectedTrace:  "",
			expectedParent: "",
			expectedValid:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			traceID, parentID, valid := apis.ParseTraceparent(tt.traceparent)
			if valid != tt.expectedValid {
				t.Errorf("valid = %v, want %v", valid, tt.expectedValid)
			}
			if traceID != tt.expectedTrace {
				t.Errorf("traceID = %q, want %q", traceID, tt.expectedTrace)
			}
			if parentID != tt.expectedParent {
				t.Errorf("parentID = %q, want %q", parentID, tt.expectedParent)
			}
		})
	}
}

func TestTraceMiddlewareSpanKind(t *testing.T) {
	repo := &mockTraceRepo{}
	trace := core.NewTrace(repo, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/test", nil)

	handler := apis.TraceMiddleware(trace)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	handler.ServeHTTP(rec, req)

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	// HTTP 请求应该是 SERVER kind
	if spans[0].Kind != core.SpanKindServer {
		t.Errorf("Kind = %q, want SERVER", spans[0].Kind)
	}
}

func TestTraceMiddlewareRecordsURL(t *testing.T) {
	repo := &mockTraceRepo{}
	trace := core.NewTrace(repo, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/users?page=1&limit=10", nil)
	req.Host = "example.com"

	handler := apis.TraceMiddleware(trace)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	handler.ServeHTTP(rec, req)

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	span := spans[0]
	if span.Attributes["http.host"] != "example.com" {
		t.Errorf("http.host = %v", span.Attributes["http.host"])
	}
	url := span.Attributes["http.url"].(string)
	if !strings.Contains(url, "/api/users") {
		t.Errorf("http.url = %v, should contain /api/users", url)
	}
}
