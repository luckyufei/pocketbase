package trace_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace"
	"github.com/pocketbase/pocketbase/plugins/trace/dye"
	"github.com/pocketbase/pocketbase/plugins/trace/filters"
)

// ============================================================================
// T076: NoopTrace 基准测试
// ============================================================================

func BenchmarkNoopTracerStartSpan(b *testing.B) {
	tracer := trace.NewNoopTrace()
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, span := tracer.StartSpan(ctx, "test-operation")
		span.End()
	}
}

func BenchmarkNoopTracerRecordSpan(b *testing.B) {
	tracer := trace.NewNoopTrace()
	span := &trace.Span{
		ID:        "test-span-id",
		TraceID:   "test-trace-id",
		SpanID:    "test-span-id",
		Name:      "test-operation",
		Kind:      trace.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Duration:  1000,
		Status:    trace.SpanStatusOK,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		tracer.RecordSpan(span)
	}
}

func BenchmarkNoopTracerIsEnabled(b *testing.B) {
	tracer := trace.NewNoopTrace()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = tracer.IsEnabled()
	}
}

// ============================================================================
// T077: 过滤器检查基准测试
// ============================================================================

func BenchmarkErrorOnlyFilter(b *testing.B) {
	filter := filters.ErrorOnly()
	ctx := &trace.FilterContext{
		Response: &trace.Response{StatusCode: 500},
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		filter.ShouldTrace(ctx)
	}
}

func BenchmarkSlowRequestFilter(b *testing.B) {
	filter := filters.SlowRequest(100 * time.Millisecond)
	ctx := &trace.FilterContext{
		Duration: 200 * time.Millisecond,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		filter.ShouldTrace(ctx)
	}
}

func BenchmarkPathPrefixFilter(b *testing.B) {
	filter := filters.PathPrefix("/api/", "/admin/", "/v1/", "/v2/")
	req := httptest.NewRequest(http.MethodGet, "/api/users/123", nil)
	ctx := &trace.FilterContext{
		Request: req,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		filter.ShouldTrace(ctx)
	}
}

func BenchmarkPathExcludeFilter(b *testing.B) {
	filter := filters.PathExclude("/health", "/metrics", "/favicon.ico")
	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := &trace.FilterContext{
		Request: req,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		filter.ShouldTrace(ctx)
	}
}

func BenchmarkSampleRateFilter(b *testing.B) {
	filter := filters.SampleRate(0.5)
	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := &trace.FilterContext{
		Request: req,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		filter.ShouldTrace(ctx)
	}
}

// ============================================================================
// T079: 染色用户查找基准测试
// ============================================================================

func BenchmarkDyeStoreIsDyed_Hit(b *testing.B) {
	store := dye.NewMemoryDyeStore(1000, time.Hour)
	defer store.Close()

	// 添加目标用户
	store.Add("target-user", time.Hour, "bench", "test")

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		store.IsDyed("target-user")
	}
}

func BenchmarkDyeStoreIsDyed_Miss(b *testing.B) {
	store := dye.NewMemoryDyeStore(1000, time.Hour)
	defer store.Close()

	// 添加其他用户
	for i := 0; i < 100; i++ {
		store.Add("user-"+string(rune(i+'0')), time.Hour, "bench", "test")
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		store.IsDyed("non-existent-user")
	}
}

func BenchmarkDyeStoreAdd(b *testing.B) {
	store := dye.NewMemoryDyeStore(100000, time.Hour)
	defer store.Close()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		store.Add("user-"+string(rune(i%1000+'0')), time.Hour, "bench", "test")
	}
}

func BenchmarkDyeStoreList_Small(b *testing.B) {
	store := dye.NewMemoryDyeStore(1000, time.Hour)
	defer store.Close()

	// 添加 10 个用户
	for i := 0; i < 10; i++ {
		store.Add("user-"+string(rune(i+'0')), time.Hour, "bench", "test")
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = store.List()
	}
}

func BenchmarkDyeStoreList_Large(b *testing.B) {
	store := dye.NewMemoryDyeStore(1000, time.Hour)
	defer store.Close()

	// 添加 100 个用户
	for i := 0; i < 100; i++ {
		store.Add("user-"+string(rune(i)), time.Hour, "bench", "test")
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = store.List()
	}
}

// BenchmarkDyedUserFilter 测试染色用户过滤器性能
func BenchmarkDyedUserFilter(b *testing.B) {
	store := dye.NewMemoryDyeStore(1000, time.Hour)
	defer store.Close()

	// 添加目标用户
	store.Add("target-user", time.Hour, "bench", "test")

	filter := filters.DyedUser(store)

	// 创建包含 userID 的 context
	ctx := context.WithValue(context.Background(), "userID", "target-user")
	filterCtx := &trace.FilterContext{
		Context: ctx,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		filter.ShouldTrace(filterCtx)
	}
}

// ============================================================================
// Buffer 基准测试
// ============================================================================

func BenchmarkRingBufferPush(b *testing.B) {
	buffer := trace.NewRingBuffer(10000)

	span := &trace.Span{
		ID:        "test-span",
		TraceID:   "test-trace",
		SpanID:    "test-span",
		Name:      "test-op",
		Kind:      trace.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Duration:  1000,
		Status:    trace.SpanStatusOK,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		buffer.Push(span)
	}
}

func BenchmarkRingBufferFlush(b *testing.B) {
	buffer := trace.NewRingBuffer(1000)

	// 预填充数据
	span := &trace.Span{
		ID:        "test-span",
		TraceID:   "test-trace",
		SpanID:    "test-span",
		Name:      "test-op",
		Kind:      trace.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Duration:  1000,
		Status:    trace.SpanStatusOK,
	}

	for i := 0; i < 500; i++ {
		buffer.Push(span)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// 重新填充
		for j := 0; j < 100; j++ {
			buffer.Push(span)
		}
		_ = buffer.Flush(100)
	}
}

// ============================================================================
// Repository 基准测试
// ============================================================================

func BenchmarkSQLiteRepositorySaveBatch(b *testing.B) {
	repo, err := trace.NewSQLiteRepository(":memory:")
	if err != nil {
		b.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	spans := make([]*trace.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = &trace.Span{
			ID:        trace.GenerateSpanID(),
			TraceID:   "bench-trace",
			SpanID:    trace.GenerateSpanID(),
			Name:      "bench-op",
			Kind:      trace.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  1000,
			Status:    trace.SpanStatusOK,
		}
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		repo.SaveBatch(spans)
	}
}

func BenchmarkSQLiteRepositoryQuery(b *testing.B) {
	repo, err := trace.NewSQLiteRepository(":memory:")
	if err != nil {
		b.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	// 预填充数据
	spans := make([]*trace.Span, 1000)
	for i := 0; i < 1000; i++ {
		spans[i] = &trace.Span{
			ID:        trace.GenerateSpanID(),
			TraceID:   "bench-trace-" + string(rune(i%10+'0')),
			SpanID:    trace.GenerateSpanID(),
			Name:      "bench-op",
			Kind:      trace.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  int64(i * 100),
			Status:    trace.SpanStatusOK,
		}
	}
	repo.SaveBatch(spans)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		repo.Query(trace.TraceQueryOptions{
			TraceID: "bench-trace-5",
			Limit:   100,
		})
	}
}
