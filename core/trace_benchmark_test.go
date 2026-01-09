//go:build !no_default_driver

package core_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// 使用 context 避免 unused import 错误
var _ = context.Background

// BenchmarkSQLiteTraceRepository 测试 SQLite Trace Repository 性能
func BenchmarkSQLiteTraceRepository(b *testing.B) {
	tempDir := b.TempDir()
	dbPath := filepath.Join(tempDir, "benchmark.db")

	repo, err := core.NewSQLiteTraceRepository(dbPath)
	if err != nil {
		b.Fatalf("Failed to create repository: %v", err)
	}
	defer repo.Close()

	if err := repo.CreateSchema(); err != nil {
		b.Fatalf("Failed to create schema: %v", err)
	}

	b.Run("BatchWrite", func(b *testing.B) {
		benchmarkBatchWrite(b, repo)
	})

	b.Run("Query", func(b *testing.B) {
		benchmarkQuery(b, repo)
	})

	b.Run("GetTrace", func(b *testing.B) {
		benchmarkGetTrace(b, repo)
	})

	b.Run("Stats", func(b *testing.B) {
		benchmarkStats(b, repo)
	})
}

// BenchmarkPostgreSQLTraceRepository 测试 PostgreSQL Trace Repository 性能
func BenchmarkPostgreSQLTraceRepository(b *testing.B) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		b.Skip("Skipping PostgreSQL benchmark: TEST_POSTGRES_DSN not set")
	}

	repo, err := core.NewPgTraceRepository(dsn)
	if err != nil {
		b.Fatalf("Failed to create repository: %v", err)
	}
	defer repo.Close()

	if err := repo.CreateSchema(); err != nil {
		b.Fatalf("Failed to create schema: %v", err)
	}

	b.Run("BatchWrite", func(b *testing.B) {
		benchmarkBatchWritePG(b, repo)
	})

	b.Run("Query", func(b *testing.B) {
		benchmarkQueryPG(b, repo)
	})

	b.Run("GetTrace", func(b *testing.B) {
		benchmarkGetTracePG(b, repo)
	})

	b.Run("Stats", func(b *testing.B) {
		benchmarkStatsPG(b, repo)
	})
}

// BenchmarkTraceBuffer 测试 Ring Buffer 性能
func BenchmarkTraceBuffer(b *testing.B) {
	buffer := core.NewRingBuffer(10000)

	b.Run("Push", func(b *testing.B) {
		span := createBenchmarkSpan("trace1", "span1", "", "test")
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			buffer.Push(span)
		}
	})

	// 先填充一些数据
	for i := 0; i < 1000; i++ {
		span := createBenchmarkSpan("trace1", "span1", "", "test")
		buffer.Push(span)
	}

	b.Run("Flush", func(b *testing.B) {
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			buffer.Flush(100)
		}
	})
}

// BenchmarkTrace 测试完整 Trace 系统性能
func BenchmarkTrace(b *testing.B) {
	tempDir := b.TempDir()
	dbPath := filepath.Join(tempDir, "benchmark.db")

	repo, err := core.NewSQLiteTraceRepository(dbPath)
	if err != nil {
		b.Fatalf("Failed to create repository: %v", err)
	}
	defer repo.Close()

	if err := repo.CreateSchema(); err != nil {
		b.Fatalf("Failed to create schema: %v", err)
	}

	config := &core.TraceConfig{
		BufferSize:    1000,
		FlushInterval: 100 * time.Millisecond,
		BatchSize:     50,
		RetentionDays: 1,
	}

	trace := core.NewTrace(repo, config)
	defer trace.Close()

	b.Run("RecordSpan", func(b *testing.B) {
		span := createBenchmarkSpan("trace1", "span1", "", "test")
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			trace.RecordSpan(span)
		}
	})

	b.Run("StartSpan", func(b *testing.B) {
		ctx := context.Background()
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			_, span := trace.StartSpan(ctx, "benchmark")
			span.End()
		}
	})

	// 先创建一些数据
	for i := 0; i < 100; i++ {
		span := createBenchmarkSpan("trace1", "span1", "", "test")
		trace.RecordSpan(span)
	}
	trace.Flush()

	b.Run("Query", func(b *testing.B) {
		params := core.NewFilterParams()
		params.Limit = 50
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			_, _, err := trace.Query(params)
			if err != nil {
				b.Fatalf("Query failed: %v", err)
			}
		}
	})
}

// 辅助函数：创建基准测试用的 Span
func createBenchmarkSpan(traceID, spanID, parentID, name string) *core.Span {
	return &core.Span{
		TraceID:   traceID,
		SpanID:    spanID,
		ParentID:  parentID,
		Name:      name,
		Kind:      core.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Duration:  1000,
		Status:    core.SpanStatusOK,
		Attributes: map[string]any{
			"http.method": "GET",
			"http.path":   "/api/test",
		},
		Created: types.NowDateTime(),
	}
}

// SQLite 基准测试函数
func benchmarkBatchWrite(b *testing.B, repo *core.SQLiteTraceRepository) {
	spans := make([]*core.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = createBenchmarkSpan("trace1", "span1", "", "test")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := repo.BatchWrite(spans); err != nil {
			b.Fatalf("BatchWrite failed: %v", err)
		}
	}
}

func benchmarkQuery(b *testing.B, repo *core.SQLiteTraceRepository) {
	// 先写入一些数据
	spans := make([]*core.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = createBenchmarkSpan("trace1", "span1", "", "test")
	}
	repo.BatchWrite(spans)

	params := core.NewFilterParams()
	params.Limit = 50

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, err := repo.Query(params)
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
	}
}

func benchmarkGetTrace(b *testing.B, repo *core.SQLiteTraceRepository) {
	// 先写入一些数据
	spans := make([]*core.Span, 10)
	for i := 0; i < 10; i++ {
		spans[i] = createBenchmarkSpan("benchmark-trace", "span1", "", "test")
	}
	repo.BatchWrite(spans)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.GetTrace("benchmark-trace")
		if err != nil {
			b.Fatalf("GetTrace failed: %v", err)
		}
	}
}

func benchmarkStats(b *testing.B, repo *core.SQLiteTraceRepository) {
	// 先写入一些数据
	spans := make([]*core.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = createBenchmarkSpan("trace1", "span1", "", "test")
	}
	repo.BatchWrite(spans)

	params := core.NewFilterParams()
	params.RootOnly = true

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Stats(params)
		if err != nil {
			b.Fatalf("Stats failed: %v", err)
		}
	}
}

// PostgreSQL 基准测试函数
func benchmarkBatchWritePG(b *testing.B, repo *core.PgTraceRepository) {
	spans := make([]*core.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = createBenchmarkSpan("trace1", "span1", "", "test")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := repo.BatchWrite(spans); err != nil {
			b.Fatalf("BatchWrite failed: %v", err)
		}
	}
}

func benchmarkQueryPG(b *testing.B, repo *core.PgTraceRepository) {
	// 先写入一些数据
	spans := make([]*core.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = createBenchmarkSpan("trace1", "span1", "", "test")
	}
	repo.BatchWrite(spans)

	params := core.NewFilterParams()
	params.Limit = 50

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, err := repo.Query(params)
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
	}
}

func benchmarkGetTracePG(b *testing.B, repo *core.PgTraceRepository) {
	// 先写入一些数据
	spans := make([]*core.Span, 10)
	for i := 0; i < 10; i++ {
		spans[i] = createBenchmarkSpan("benchmark-trace", "span1", "", "test")
	}
	repo.BatchWrite(spans)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.GetTrace("benchmark-trace")
		if err != nil {
			b.Fatalf("GetTrace failed: %v", err)
		}
	}
}

func benchmarkStatsPG(b *testing.B, repo *core.PgTraceRepository) {
	// 先写入一些数据
	spans := make([]*core.Span, 100)
	for i := 0; i < 100; i++ {
		spans[i] = createBenchmarkSpan("trace1", "span1", "", "test")
	}
	repo.BatchWrite(spans)

	params := core.NewFilterParams()
	params.RootOnly = true

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Stats(params)
		if err != nil {
			b.Fatalf("Stats failed: %v", err)
		}
	}
}