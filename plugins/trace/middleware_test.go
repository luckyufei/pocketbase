package trace

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// TestTraceMiddleware 测试追踪中间件
func TestTraceMiddleware(t *testing.T) {
	t.Run("creates span for request in full mode", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeFull})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if !tracer.spanRecorded {
			t.Error("expected span to be recorded")
		}
		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})

	t.Run("skips when tracer disabled", func(t *testing.T) {
		tracer := &mockTracer{enabled: false}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeFull})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.spanRecorded {
			t.Error("expected no span to be recorded")
		}
	})

	t.Run("skips when mode is off", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeOff})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.spanRecorded {
			t.Error("expected no span to be recorded when mode is off")
		}
	})

	t.Run("propagates traceparent header", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeFull})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		req.Header.Set("traceparent", "00-12345678901234567890123456789012-1234567890123456-01")
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.lastSpan == nil {
			t.Fatal("expected span to be recorded")
		}
		if tracer.lastSpan.TraceID != "12345678901234567890123456789012" {
			t.Errorf("expected TraceID from header, got %s", tracer.lastSpan.TraceID)
		}
	})

	t.Run("sets span attributes", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeFull})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test?foo=bar", nil)
		req.Header.Set("User-Agent", "TestAgent/1.0")
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.lastSpan == nil {
			t.Fatal("expected span to be recorded")
		}
		attrs := tracer.lastSpan.Attributes
		if attrs == nil {
			t.Fatal("expected attributes")
		}
		if attrs["http.method"] != "GET" {
			t.Errorf("expected http.method=GET, got %v", attrs["http.method"])
		}
		if attrs["http.status_code"] != 200 {
			t.Errorf("expected http.status_code=200, got %v", attrs["http.status_code"])
		}
	})

	t.Run("captures error status", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeFull})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.lastSpan == nil {
			t.Fatal("expected span to be recorded")
		}
		if tracer.lastSpan.Status != SpanStatusError {
			t.Errorf("expected error status, got %s", tracer.lastSpan.Status)
		}
	})

	t.Run("skips configured paths", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{
			Mode:      ModeFull,
			SkipPaths: []string{"/health", "/metrics*"},
		})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		// Test exact match
		req := httptest.NewRequest("GET", "/health", nil)
		rec := httptest.NewRecorder()
		middleware(handler).ServeHTTP(rec, req)
		if tracer.spanRecorded {
			t.Error("expected no span for /health")
		}

		// Test wildcard match
		tracer.spanRecorded = false
		req = httptest.NewRequest("GET", "/metrics/cpu", nil)
		rec = httptest.NewRecorder()
		middleware(handler).ServeHTTP(rec, req)
		if tracer.spanRecorded {
			t.Error("expected no span for /metrics/cpu")
		}

		// Test non-skipped path
		tracer.spanRecorded = false
		req = httptest.NewRequest("GET", "/api/users", nil)
		rec = httptest.NewRecorder()
		middleware(handler).ServeHTTP(rec, req)
		if !tracer.spanRecorded {
			t.Error("expected span for /api/users")
		}
	})

	t.Run("uses nil config with defaults", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, nil)

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		// 默认 ModeConditional 没有过滤器，不会记录
		if tracer.spanRecorded {
			t.Error("expected no span in conditional mode without filters")
		}
	})

	t.Run("dyed user always traced in conditional mode", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		dyeStore := &mockDyeStore{dyedUsers: map[string]bool{"user-123": true}}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{
			Mode:     ModeConditional,
			DyeStore: dyeStore,
			GetUserID: func(r *http.Request) string {
				return r.Header.Get("X-User-ID")
			},
		})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		req.Header.Set("X-User-ID", "user-123")
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if !tracer.spanRecorded {
			t.Error("expected span to be recorded for dyed user")
		}
		if tracer.lastSpan.Attributes["trace.dyed"] != true {
			t.Error("expected trace.dyed=true attribute")
		}
	})

	t.Run("custom span name function", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{
			Mode: ModeFull,
			SpanNameFunc: func(r *http.Request) string {
				return "custom-" + r.URL.Path
			},
		})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.lastSpan == nil {
			t.Fatal("expected span to be recorded")
		}
		if tracer.lastSpan.Name != "custom-/api/test" {
			t.Errorf("expected custom span name, got %s", tracer.lastSpan.Name)
		}
	})

	t.Run("with referer header", func(t *testing.T) {
		tracer := &mockTracer{enabled: true}
		middleware := TraceMiddleware(tracer, &MiddlewareConfig{Mode: ModeFull})

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/api/test", nil)
		req.Header.Set("Referer", "http://example.com/page")
		rec := httptest.NewRecorder()

		middleware(handler).ServeHTTP(rec, req)

		if tracer.lastSpan == nil {
			t.Fatal("expected span to be recorded")
		}
		if tracer.lastSpan.Attributes["http.referer"] != "http://example.com/page" {
			t.Errorf("expected referer attribute, got %v", tracer.lastSpan.Attributes["http.referer"])
		}
	})
}

// TestMiddlewareConfig 测试中间件配置
func TestMiddlewareConfig(t *testing.T) {
	t.Run("default config", func(t *testing.T) {
		config := DefaultMiddlewareConfig()
		if config == nil {
			t.Fatal("expected non-nil config")
		}
	})

	t.Run("with filters", func(t *testing.T) {
		config := &MiddlewareConfig{
			Mode:    ModeConditional,
			Filters: []Filter{},
		}
		if config.Mode != ModeConditional {
			t.Errorf("expected mode conditional, got %s", config.Mode)
		}
	})
}

// TestLazySpan 测试延迟 Span 创建
func TestLazySpan(t *testing.T) {
	t.Run("creates span on demand", func(t *testing.T) {
		ls := NewLazySpan("test-op", func() string { return GenerateTraceID() }, func() string { return GenerateSpanID() })
		if ls.IsCreated() {
			t.Error("span should not be created yet")
		}

		span := ls.GetOrCreate()
		if span == nil {
			t.Fatal("expected non-nil span")
		}
		if !ls.IsCreated() {
			t.Error("span should be created now")
		}
	})

	t.Run("returns same span on multiple calls", func(t *testing.T) {
		ls := NewLazySpan("test-op", func() string { return GenerateTraceID() }, func() string { return GenerateSpanID() })
		span1 := ls.GetOrCreate()
		span2 := ls.GetOrCreate()
		if span1 != span2 {
			t.Error("expected same span instance")
		}
	})

	t.Run("nil when not created", func(t *testing.T) {
		ls := NewLazySpan("test-op", func() string { return GenerateTraceID() }, func() string { return GenerateSpanID() })
		span := ls.GetIfCreated()
		if span != nil {
			t.Error("expected nil span")
		}
	})
}

// TestResponseCapture 测试响应捕获
func TestResponseCapture(t *testing.T) {
	t.Run("captures status code", func(t *testing.T) {
		rec := httptest.NewRecorder()
		capture := NewResponseCapture(rec)

		capture.WriteHeader(http.StatusNotFound)
		if capture.StatusCode() != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", capture.StatusCode())
		}
	})

	t.Run("captures response size", func(t *testing.T) {
		rec := httptest.NewRecorder()
		capture := NewResponseCapture(rec)

		capture.Write([]byte("hello world"))
		if capture.Size() != 11 {
			t.Errorf("expected size 11, got %d", capture.Size())
		}
	})

	t.Run("default status is 200", func(t *testing.T) {
		rec := httptest.NewRecorder()
		capture := NewResponseCapture(rec)

		capture.Write([]byte("data"))
		if capture.StatusCode() != http.StatusOK {
			t.Errorf("expected status 200, got %d", capture.StatusCode())
		}
	})
}

// mockTracer 用于测试的 mock tracer
type mockTracer struct {
	enabled      bool
	spanRecorded bool
	lastSpan     *Span
}

func (m *mockTracer) IsEnabled() bool {
	return m.enabled
}

func (m *mockTracer) RecordSpan(span *Span) {
	m.spanRecorded = true
	m.lastSpan = span
}

func (m *mockTracer) StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder) {
	return ctx, &mockSpanBuilder{}
}

func (m *mockTracer) Flush() {}

func (m *mockTracer) Prune() (int64, error) {
	return 0, nil
}

func (m *mockTracer) Close() error {
	return nil
}

// mockSpanBuilder 用于测试
type mockSpanBuilder struct{}

func (b *mockSpanBuilder) SetAttribute(key string, value any) SpanBuilder { return b }
func (b *mockSpanBuilder) SetStatus(status SpanStatus, msg string) SpanBuilder { return b }
func (b *mockSpanBuilder) SetKind(kind SpanKind) SpanBuilder { return b }
func (b *mockSpanBuilder) End() {}

// mockDyeStore 用于测试的 mock dye store
type mockDyeStore struct {
	dyedUsers map[string]bool
}

func (m *mockDyeStore) IsDyed(userID string) bool {
	return m.dyedUsers[userID]
}

// Helper function to create test spans
func createTestSpan(name string, duration time.Duration, status SpanStatus) *Span {
	return &Span{
		ID:        GenerateSpanID(),
		TraceID:   GenerateTraceID(),
		SpanID:    GenerateSpanID(),
		Name:      name,
		Kind:      SpanKindServer,
		StartTime: time.Now().Add(-duration).UnixMicro(),
		Duration:  duration.Microseconds(),
		Status:    status,
		Created:   types.NowDateTime(),
	}
}
