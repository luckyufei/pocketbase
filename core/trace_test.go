package core_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// Phase 3 & 4: Trace 核心功能测试
// ============================================================================

// mockRepository 用于测试的 mock repository
type mockRepository struct {
	spans   []*core.Span
	mu      sync.Mutex
	created bool
}

func (m *mockRepository) BatchWrite(spans []*core.Span) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.spans = append(m.spans, spans...)
	return nil
}

func (m *mockRepository) Query(params *core.FilterParams) ([]*core.Span, int64, error) {
	return m.spans, int64(len(m.spans)), nil
}

func (m *mockRepository) GetTrace(traceID string) ([]*core.Span, error) {
	var result []*core.Span
	for _, s := range m.spans {
		if s.TraceID == traceID {
			result = append(result, s)
		}
	}
	return result, nil
}

func (m *mockRepository) Stats(params *core.FilterParams) (*core.TraceStats, error) {
	return &core.TraceStats{TotalRequests: int64(len(m.spans))}, nil
}

func (m *mockRepository) Prune(before time.Time) (int64, error) {
	return 0, nil
}

func (m *mockRepository) CreateSchema() error {
	m.created = true
	return nil
}

func (m *mockRepository) Close() error {
	return nil
}

func (m *mockRepository) GetSpans() []*core.Span {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.spans
}

func TestNewTrace(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	if trace == nil {
		t.Fatal("NewTrace returned nil")
	}
}

func TestTraceRecordSpan(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	span := &core.Span{
		TraceID:   "0123456789abcdef0123456789abcdef",
		SpanID:    "0123456789abcdef",
		Name:      "test",
		Kind:      core.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Status:    core.SpanStatusOK,
	}

	trace.RecordSpan(span)

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}
}

func TestTraceStartSpan(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	ctx := context.Background()
	ctx, span := trace.StartSpan(ctx, "test-operation")

	if span == nil {
		t.Fatal("StartSpan returned nil span")
	}

	// 验证 context 中有 span
	ctxSpan := core.SpanFromContext(ctx)
	if ctxSpan == nil {
		t.Error("Context should contain span")
	}

	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}
	if spans[0].Name != "test-operation" {
		t.Errorf("Name = %q, want %q", spans[0].Name, "test-operation")
	}
}

func TestTraceStartSpanWithParent(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	// 创建父 span
	ctx := context.Background()
	ctx, parentSpan := trace.StartSpan(ctx, "parent")

	// 创建子 span
	ctx, childSpan := trace.StartSpan(ctx, "child")

	childSpan.End()
	parentSpan.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 2 {
		t.Fatalf("Expected 2 spans, got %d", len(spans))
	}

	// 找到子 span
	var child *core.Span
	for _, s := range spans {
		if s.Name == "child" {
			child = s
			break
		}
	}

	if child == nil {
		t.Fatal("Child span not found")
	}

	// 验证父子关系
	if child.ParentID == "" {
		t.Error("Child span should have parent_id")
	}
}

func TestSpanBuilderSetAttribute(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")

	span.SetAttribute("key1", "value1")
	span.SetAttribute("key2", 123)
	span.SetAttribute("key3", true)
	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	attrs := spans[0].Attributes
	if attrs["key1"] != "value1" {
		t.Errorf("key1 = %v", attrs["key1"])
	}
	if attrs["key2"] != 123 {
		t.Errorf("key2 = %v", attrs["key2"])
	}
	if attrs["key3"] != true {
		t.Errorf("key3 = %v", attrs["key3"])
	}
}

func TestSpanBuilderSetStatus(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")

	span.SetStatus(core.SpanStatusError, "something went wrong")
	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	if spans[0].Status != core.SpanStatusError {
		t.Errorf("Status = %q, want ERROR", spans[0].Status)
	}
	if spans[0].Attributes["error.message"] != "something went wrong" {
		t.Errorf("error.message = %v", spans[0].Attributes["error.message"])
	}
}

func TestSpanDuration(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")

	time.Sleep(10 * time.Millisecond)
	span.End()

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

func TestTraceEnabled(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{Enabled: false}
	trace := core.NewTrace(repo, config)

	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")

	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	// 禁用时不应该记录
	spans := repo.GetSpans()
	if len(spans) != 0 {
		t.Errorf("Expected 0 spans when disabled, got %d", len(spans))
	}
}

func TestTraceConcurrentRecording(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	var wg sync.WaitGroup
	numGoroutines := 10
	spansPerGoroutine := 50

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < spansPerGoroutine; j++ {
				ctx := context.Background()
				_, span := trace.StartSpan(ctx, "concurrent")
				span.SetAttribute("iteration", j)
				span.End()
			}
		}()
	}

	wg.Wait()

	// 等待 flush
	time.Sleep(100 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	expected := numGoroutines * spansPerGoroutine
	if len(spans) != expected {
		t.Errorf("Expected %d spans, got %d", expected, len(spans))
	}
}

func TestTraceQuery(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	// 记录一些 span
	for i := 0; i < 5; i++ {
		ctx := context.Background()
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	// 查询
	params := core.NewFilterParams()
	spans, total, err := trace.Query(params)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if total != 5 {
		t.Errorf("total = %d, want 5", total)
	}
	if len(spans) != 5 {
		t.Errorf("len(spans) = %d, want 5", len(spans))
	}
}

func TestTraceGetTrace(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	// 记录一个 trace
	ctx := context.Background()
	ctx, parentSpan := trace.StartSpan(ctx, "parent")
	_, childSpan := trace.StartSpan(ctx, "child")
	childSpan.End()
	parentSpan.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	// 获取 trace_id
	spans := repo.GetSpans()
	if len(spans) == 0 {
		t.Fatal("No spans recorded")
	}
	traceID := spans[0].TraceID

	// 查询完整调用链
	traceSpans, err := trace.GetTrace(traceID)
	if err != nil {
		t.Fatalf("GetTrace failed: %v", err)
	}

	if len(traceSpans) != 2 {
		t.Errorf("len(traceSpans) = %d, want 2", len(traceSpans))
	}
}

func TestTraceStats(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	// 记录一些 span
	for i := 0; i < 3; i++ {
		ctx := context.Background()
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	// 获取统计
	stats, err := trace.Stats(nil)
	if err != nil {
		t.Fatalf("Stats failed: %v", err)
	}

	if stats.TotalRequests != 3 {
		t.Errorf("TotalRequests = %d, want 3", stats.TotalRequests)
	}
}

func TestTraceStop(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	// 记录一些 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")
	span.End()

	// 停止 trace
	trace.Stop()

	// 验证 span 被 flush
	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span after stop, got %d", len(spans))
	}

	// 再次停止不应该 panic
	trace.Stop()
}

func TestTraceClose(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	// 记录一些 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")
	span.End()

	// 关闭 trace
	if err := trace.Close(); err != nil {
		t.Errorf("Close() failed: %v", err)
	}

	// 验证 span 被 flush
	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span after close, got %d", len(spans))
	}
}

func TestTracePrune(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		RetentionDays: 7,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// Prune 应该调用 repo.Prune
	deleted, err := trace.Prune()
	if err != nil {
		t.Errorf("Prune() failed: %v", err)
	}
	if deleted != 0 {
		t.Errorf("deleted = %d, want 0", deleted)
	}
}

func TestTracePruneDisabled(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		RetentionDays: 0, // 禁用清理
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// RetentionDays = 0 时不应该清理
	deleted, err := trace.Prune()
	if err != nil {
		t.Errorf("Prune() failed: %v", err)
	}
	if deleted != 0 {
		t.Errorf("deleted = %d, want 0", deleted)
	}
}

func TestSpanBuilderSetKind(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)

	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")

	span.SetKind(core.SpanKindClient)
	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	if spans[0].Kind != core.SpanKindClient {
		t.Errorf("Kind = %q, want CLIENT", spans[0].Kind)
	}
}

func TestNoopSpanBuilder(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{Enabled: false}
	trace := core.NewTrace(repo, config)

	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")

	// 这些调用不应该 panic
	span.SetAttribute("key", "value")
	span.SetStatus(core.SpanStatusError, "error")
	span.SetKind(core.SpanKindServer)
	span.End()

	// 禁用时不应该记录
	trace.Flush()
	spans := repo.GetSpans()
	if len(spans) != 0 {
		t.Errorf("Expected 0 spans when disabled, got %d", len(spans))
	}
}
