//go:build !no_default_driver

package core_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	_ "modernc.org/sqlite"
)

// ============================================================================
// Phase 6 & 7: SQLite Repository 集成测试
// ============================================================================

func setupSQLiteRepo(t *testing.T) (*core.SQLiteTraceRepository, func()) {
	t.Helper()

	// 创建临时目录
	tmpDir, err := os.MkdirTemp("", "trace_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "traces.db")
	repo, err := core.NewSQLiteTraceRepository(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create SQLite repo: %v", err)
	}

	if err := repo.CreateSchema(); err != nil {
		repo.Close()
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create schema: %v", err)
	}

	cleanup := func() {
		repo.Close()
		os.RemoveAll(tmpDir)
	}

	return repo, cleanup
}

func createTestSpanWithID(traceID, spanID, parentID, name string) *core.Span {
	return &core.Span{
		TraceID:   traceID,
		SpanID:    spanID,
		ParentID:  parentID,
		Name:      name,
		Kind:      core.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Duration:  1000,
		Status:    core.SpanStatusOK,
	}
}

func TestSQLiteTraceRepositoryCreateSchema(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// Schema 已在 setup 中创建，这里验证可以再次调用（幂等）
	if err := repo.CreateSchema(); err != nil {
		t.Errorf("CreateSchema() should be idempotent: %v", err)
	}
}

func TestSQLiteTraceRepositoryBatchWrite(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	spans := []*core.Span{
		createTestSpanWithID("0123456789abcdef0123456789abcdef", "0123456789abcdef", "", "span1"),
		createTestSpanWithID("0123456789abcdef0123456789abcdef", "fedcba9876543210", "0123456789abcdef", "span2"),
	}

	if err := repo.BatchWrite(spans); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	// 验证写入
	result, total, err := repo.Query(core.NewFilterParams())
	if err != nil {
		t.Fatalf("Query() failed: %v", err)
	}

	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(result) != 2 {
		t.Errorf("len(result) = %d, want 2", len(result))
	}
}

func TestSQLiteTraceRepositoryBatchWriteEmpty(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// 空写入不应该报错
	if err := repo.BatchWrite(nil); err != nil {
		t.Errorf("BatchWrite(nil) should not fail: %v", err)
	}
	if err := repo.BatchWrite([]*core.Span{}); err != nil {
		t.Errorf("BatchWrite([]) should not fail: %v", err)
	}
}

func TestSQLiteTraceRepositoryQuery(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// 写入测试数据
	spans := []*core.Span{
		createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1111111111111111", "", "GET /api/users"),
		createTestSpanWithID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2222222222222222", "", "POST /api/items"),
		createTestSpanWithID("cccccccccccccccccccccccccccccccc", "3333333333333333", "", "GET /api/users"),
	}
	spans[0].Status = core.SpanStatusOK
	spans[1].Status = core.SpanStatusError
	spans[2].Status = core.SpanStatusOK

	if err := repo.BatchWrite(spans); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	// 测试按 trace_id 查询
	t.Run("by trace_id", func(t *testing.T) {
		params := core.NewFilterParams().WithTraceID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
		result, total, err := repo.Query(params)
		if err != nil {
			t.Fatalf("Query() failed: %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(result) != 1 {
			t.Errorf("len(result) = %d, want 1", len(result))
		}
	})

	// 测试按 operation 查询
	t.Run("by operation", func(t *testing.T) {
		params := core.NewFilterParams().WithOperation("GET /api/users")
		result, total, err := repo.Query(params)
		if err != nil {
			t.Fatalf("Query() failed: %v", err)
		}
		if total != 2 {
			t.Errorf("total = %d, want 2", total)
		}
		if len(result) != 2 {
			t.Errorf("len(result) = %d, want 2", len(result))
		}
	})

	// 测试按 status 查询
	t.Run("by status", func(t *testing.T) {
		params := core.NewFilterParams().WithStatus(core.SpanStatusError)
		result, total, err := repo.Query(params)
		if err != nil {
			t.Fatalf("Query() failed: %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(result) != 1 {
			t.Errorf("len(result) = %d, want 1", len(result))
		}
	})

	// 测试分页
	t.Run("pagination", func(t *testing.T) {
		params := core.NewFilterParams().WithPagination(2, 0)
		result, total, err := repo.Query(params)
		if err != nil {
			t.Fatalf("Query() failed: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(result) != 2 {
			t.Errorf("len(result) = %d, want 2", len(result))
		}
	})

	// 测试 RootOnly
	t.Run("root only", func(t *testing.T) {
		// 添加一个子 span
		childSpan := createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "4444444444444444", "1111111111111111", "child")
		if err := repo.BatchWrite([]*core.Span{childSpan}); err != nil {
			t.Fatalf("BatchWrite() failed: %v", err)
		}

		params := core.NewFilterParams().WithRootOnly(true)
		result, total, err := repo.Query(params)
		if err != nil {
			t.Fatalf("Query() failed: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 (root spans only)", total)
		}
		if len(result) != 3 {
			t.Errorf("len(result) = %d, want 3", len(result))
		}
	})
}

func TestSQLiteTraceRepositoryGetTrace(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	traceID := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

	// 写入一个完整的调用链
	spans := []*core.Span{
		createTestSpanWithID(traceID, "1111111111111111", "", "root"),
		createTestSpanWithID(traceID, "2222222222222222", "1111111111111111", "child1"),
		createTestSpanWithID(traceID, "3333333333333333", "1111111111111111", "child2"),
		createTestSpanWithID(traceID, "4444444444444444", "2222222222222222", "grandchild"),
	}

	if err := repo.BatchWrite(spans); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	// 获取完整调用链
	result, err := repo.GetTrace(traceID)
	if err != nil {
		t.Fatalf("GetTrace() failed: %v", err)
	}

	if len(result) != 4 {
		t.Errorf("len(result) = %d, want 4", len(result))
	}

	// 验证按时间排序
	for i := 1; i < len(result); i++ {
		if result[i].StartTime < result[i-1].StartTime {
			t.Error("Results should be sorted by start_time ASC")
		}
	}
}

func TestSQLiteTraceRepositoryStats(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// 写入测试数据
	spans := []*core.Span{
		createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1111111111111111", "", "span1"),
		createTestSpanWithID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2222222222222222", "", "span2"),
		createTestSpanWithID("cccccccccccccccccccccccccccccccc", "3333333333333333", "", "span3"),
	}
	spans[0].Status = core.SpanStatusOK
	spans[0].Duration = 100
	spans[1].Status = core.SpanStatusOK
	spans[1].Duration = 200
	spans[2].Status = core.SpanStatusError
	spans[2].Duration = 300

	if err := repo.BatchWrite(spans); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	stats, err := repo.Stats(nil)
	if err != nil {
		t.Fatalf("Stats() failed: %v", err)
	}

	if stats.TotalRequests != 3 {
		t.Errorf("TotalRequests = %d, want 3", stats.TotalRequests)
	}
	if stats.SuccessCount != 2 {
		t.Errorf("SuccessCount = %d, want 2", stats.SuccessCount)
	}
	if stats.ErrorCount != 1 {
		t.Errorf("ErrorCount = %d, want 1", stats.ErrorCount)
	}

	// 验证百分位计算
	if stats.P50Latency != 200 {
		t.Errorf("P50Latency = %d, want 200", stats.P50Latency)
	}
}

func TestSQLiteTraceRepositoryPrune(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	now := time.Now()

	// 写入测试数据
	oldSpan := createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1111111111111111", "", "old")
	oldSpan.StartTime = now.Add(-48 * time.Hour).UnixMicro()

	newSpan := createTestSpanWithID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2222222222222222", "", "new")
	newSpan.StartTime = now.UnixMicro()

	if err := repo.BatchWrite([]*core.Span{oldSpan, newSpan}); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	// 清理 24 小时前的数据
	cutoff := now.Add(-24 * time.Hour)
	deleted, err := repo.Prune(cutoff)
	if err != nil {
		t.Fatalf("Prune() failed: %v", err)
	}

	if deleted != 1 {
		t.Errorf("deleted = %d, want 1", deleted)
	}

	// 验证只剩下新的 span
	result, total, err := repo.Query(core.NewFilterParams())
	if err != nil {
		t.Fatalf("Query() failed: %v", err)
	}

	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(result) != 1 {
		t.Errorf("len(result) = %d, want 1", len(result))
	}
	if result[0].Name != "new" {
		t.Errorf("remaining span name = %q, want 'new'", result[0].Name)
	}
}

func TestSQLiteTraceRepositoryQueryTimeRange(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	now := time.Now()

	// 写入不同时间的 span
	spans := []*core.Span{
		createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1111111111111111", "", "old"),
		createTestSpanWithID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2222222222222222", "", "recent"),
		createTestSpanWithID("cccccccccccccccccccccccccccccccc", "3333333333333333", "", "new"),
	}
	spans[0].StartTime = now.Add(-2 * time.Hour).UnixMicro()
	spans[1].StartTime = now.Add(-30 * time.Minute).UnixMicro()
	spans[2].StartTime = now.UnixMicro()

	if err := repo.BatchWrite(spans); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	// 查询最近 1 小时
	params := core.NewFilterParams().WithTimeRange(now.Add(-1*time.Hour), now.Add(1*time.Minute))
	result, total, err := repo.Query(params)
	if err != nil {
		t.Fatalf("Query() failed: %v", err)
	}

	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(result) != 2 {
		t.Errorf("len(result) = %d, want 2", len(result))
	}
}

func TestSQLiteTraceRepositoryWithAttributes(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	span := createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1111111111111111", "", "test")
	span.Attributes = map[string]any{
		"http.method":      "GET",
		"http.status_code": 200,
		"custom.key":       "value",
	}

	if err := repo.BatchWrite([]*core.Span{span}); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	result, _, err := repo.Query(core.NewFilterParams())
	if err != nil {
		t.Fatalf("Query() failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("len(result) = %d, want 1", len(result))
	}

	attrs := result[0].Attributes
	if attrs["http.method"] != "GET" {
		t.Errorf("http.method = %v", attrs["http.method"])
	}
	// JSON 反序列化后数字变成 float64
	if attrs["http.status_code"] != float64(200) {
		t.Errorf("http.status_code = %v (type: %T)", attrs["http.status_code"], attrs["http.status_code"])
	}
	if attrs["custom.key"] != "value" {
		t.Errorf("custom.key = %v", attrs["custom.key"])
	}
}

// TestSQLiteTraceRepositoryAttributeFilters 测试 AttributeFilters 查询功能
func TestSQLiteTraceRepositoryAttributeFilters(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// 创建多个测试 spans（使用正确的 ID 格式）
	spans := []*core.Span{
		{
			TraceID:   "0123456789abcdef0123456789abcde1",
			SpanID:    "0123456789abcde1",
			Name:      "GET /api/users",
			Kind:      core.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  1000,
			Status:    core.SpanStatusOK,
			Attributes: types.JSONMap[any]{
				"http.method": "GET",
				"http.path":   "/api/users",
				"user.id":     "123",
			},
			Created: types.NowDateTime(),
		},
		{
			TraceID:   "0123456789abcdef0123456789abcde2",
			SpanID:    "0123456789abcde2",
			Name:      "POST /api/users",
			Kind:      core.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  2000,
			Status:    core.SpanStatusError,
			Attributes: types.JSONMap[any]{
				"http.method": "POST",
				"http.path":   "/api/users",
				"user.id":     "456",
			},
			Created: types.NowDateTime(),
		},
		{
			TraceID:   "0123456789abcdef0123456789abcde3",
			SpanID:    "0123456789abcde3",
			Name:      "GET /api/posts",
			Kind:      core.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  1500,
			Status:    core.SpanStatusOK,
			Attributes: types.JSONMap[any]{
				"http.method": "GET",
				"http.path":   "/api/posts",
				"user.id":     "789",
			},
			Created: types.NowDateTime(),
		},
	}

	if err := repo.BatchWrite(spans); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	// 测试 1: 按 http.method=GET 过滤
	params := core.NewFilterParams()
	params.AttributeFilters = map[string]any{
		"http.method": "GET",
	}
	results, total, err := repo.Query(params)
	if err != nil {
		t.Fatalf("Query by http.method=GET failed: %v", err)
	}
	if total != 2 {
		t.Errorf("Expected 2 GET requests, got %d", total)
	}
	if len(results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(results))
	}

	// 测试 2: 按 user.id=123 过滤
	params = core.NewFilterParams()
	params.AttributeFilters = map[string]any{
		"user.id": "123",
	}
	results, total, err = repo.Query(params)
	if err != nil {
		t.Fatalf("Query by user.id=123 failed: %v", err)
	}
	if total != 1 {
		t.Errorf("Expected 1 user request, got %d", total)
	}
	if len(results) != 1 {
		t.Errorf("Expected 1 result, got %d", len(results))
	}
	if len(results) > 0 && results[0].Name != "GET /api/users" {
		t.Errorf("Expected 'GET /api/users', got %s", results[0].Name)
	}

	// 测试 3: 多条件过滤
	params = core.NewFilterParams()
	params.AttributeFilters = map[string]any{
		"http.method": "GET",
		"http.path":   "/api/posts",
	}
	results, total, err = repo.Query(params)
	if err != nil {
		t.Fatalf("Query by multiple attributes failed: %v", err)
	}
	if total != 1 {
		t.Errorf("Expected 1 matching request, got %d", total)
	}
	if len(results) > 0 && results[0].Name != "GET /api/posts" {
		t.Errorf("Expected 'GET /api/posts', got %s", results[0].Name)
	}

	// 测试 4: 不存在的属性值
	params = core.NewFilterParams()
	params.AttributeFilters = map[string]any{
		"http.method": "DELETE",
	}
	results, total, err = repo.Query(params)
	if err != nil {
		t.Fatalf("Query by non-existent value failed: %v", err)
	}
	if total != 0 {
		t.Errorf("Expected 0 results for non-existent value, got %d", total)
	}
}

func TestSQLiteTraceRepositoryIsHealthy(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// 新创建的 repository 应该是健康的
	if !repo.IsHealthy() {
		t.Error("Expected repository to be healthy")
	}
}

func TestSQLiteTraceRepositoryRecover(t *testing.T) {
	repo, cleanup := setupSQLiteRepo(t)
	defer cleanup()

	// 调用 Recover 不应该返回错误
	if err := repo.Recover(); err != nil {
		t.Errorf("Recover() failed: %v", err)
	}

	// Recover 后 repository 应该仍然健康
	if !repo.IsHealthy() {
		t.Error("Expected repository to be healthy after recover")
	}
}

func TestSQLiteTraceRepositoryNewWithDB(t *testing.T) {
	// 创建一个内存数据库
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// 使用现有连接创建 repository
	repo := core.NewSQLiteTraceRepositoryWithDB(db)
	if repo == nil {
		t.Fatal("NewSQLiteTraceRepositoryWithDB returned nil")
	}

	// 创建 schema
	if err := repo.CreateSchema(); err != nil {
		t.Fatalf("CreateSchema() failed: %v", err)
	}

	// 验证可以正常使用
	span := createTestSpanWithID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "1111111111111111", "", "test")
	if err := repo.BatchWrite([]*core.Span{span}); err != nil {
		t.Fatalf("BatchWrite() failed: %v", err)
	}

	results, total, err := repo.Query(core.NewFilterParams())
	if err != nil {
		t.Fatalf("Query() failed: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(results) != 1 {
		t.Errorf("len(results) = %d, want 1", len(results))
	}
}
