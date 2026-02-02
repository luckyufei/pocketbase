package trace

import (
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// TestNewSQLiteRepository 测试创建 SQLite Repository
func TestNewSQLiteRepository(t *testing.T) {
	t.Run("create with valid DSN", func(t *testing.T) {
		tmpFile, err := os.CreateTemp("", "trace_test_*.db")
		if err != nil {
			t.Fatalf("failed to create temp file: %v", err)
		}
		defer os.Remove(tmpFile.Name())
		tmpFile.Close()

		repo, err := NewSQLiteRepository(tmpFile.Name())
		if err != nil {
			t.Fatalf("NewSQLiteRepository() error = %v", err)
		}
		defer repo.Close()

		if repo == nil {
			t.Error("expected non-nil repository")
		}
	})

	t.Run("create with empty DSN", func(t *testing.T) {
		_, err := NewSQLiteRepository("")
		if err == nil {
			t.Error("expected error for empty DSN")
		}
	})
}

// TestSQLiteRepositorySaveBatch 测试批量保存
func TestSQLiteRepositorySaveBatch(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	t.Run("save empty batch", func(t *testing.T) {
		result, err := repo.SaveBatch(nil)
		if err != nil {
			t.Errorf("SaveBatch() error = %v", err)
		}
		if result.Total != 0 {
			t.Errorf("expected total 0, got %d", result.Total)
		}
	})

	t.Run("save single span", func(t *testing.T) {
		span := &Span{
			ID:        "span-1",
			TraceID:   "trace-1",
			SpanID:    "spanid-1",
			Name:      "test-operation",
			Kind:      SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  1000,
			Status:    SpanStatusOK,
			Created:   types.NowDateTime(),
		}

		result, err := repo.SaveBatch([]*Span{span})
		if err != nil {
			t.Errorf("SaveBatch() error = %v", err)
		}
		if result.Total != 1 || result.Success != 1 {
			t.Errorf("expected total=1, success=1, got total=%d, success=%d", result.Total, result.Success)
		}
	})

	t.Run("save multiple spans", func(t *testing.T) {
		spans := make([]*Span, 10)
		for i := 0; i < 10; i++ {
			spans[i] = &Span{
				ID:        GenerateSpanID(),
				TraceID:   "trace-batch-1",
				SpanID:    GenerateSpanID(),
				Name:      "batch-operation",
				Kind:      SpanKindInternal,
				StartTime: time.Now().UnixMicro(),
				Duration:  int64(i * 100),
				Status:    SpanStatusOK,
				Created:   types.NowDateTime(),
			}
		}

		result, err := repo.SaveBatch(spans)
		if err != nil {
			t.Errorf("SaveBatch() error = %v", err)
		}
		if result.Total != 10 || result.Success != 10 {
			t.Errorf("expected total=10, success=10, got total=%d, success=%d", result.Total, result.Success)
		}
	})

	t.Run("save span with attributes", func(t *testing.T) {
		span := &Span{
			ID:        "span-attrs",
			TraceID:   "trace-attrs",
			SpanID:    "spanid-attrs",
			Name:      "with-attrs",
			Kind:      SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  500,
			Status:    SpanStatusOK,
			Attributes: map[string]any{
				"http.method":      "GET",
				"http.status_code": 200,
				"user.id":          "user-123",
			},
			Created: types.NowDateTime(),
		}

		result, err := repo.SaveBatch([]*Span{span})
		if err != nil {
			t.Errorf("SaveBatch() error = %v", err)
		}
		if result.Success != 1 {
			t.Errorf("expected success=1, got success=%d", result.Success)
		}
	})
}

// TestSQLiteRepositoryFindByTraceID 测试按 TraceID 查询
func TestSQLiteRepositoryFindByTraceID(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	// 准备测试数据
	traceID := "test-trace-find"
	spans := []*Span{
		{ID: "s1", TraceID: traceID, SpanID: "sp1", Name: "op1", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: "s2", TraceID: traceID, SpanID: "sp2", ParentID: "sp1", Name: "op2", Kind: SpanKindInternal, StartTime: time.Now().UnixMicro(), Duration: 50, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: "s3", TraceID: "other-trace", SpanID: "sp3", Name: "op3", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 200, Status: SpanStatusOK, Created: types.NowDateTime()},
	}
	repo.SaveBatch(spans)

	t.Run("find existing trace", func(t *testing.T) {
		found, err := repo.FindByTraceID(traceID)
		if err != nil {
			t.Errorf("FindByTraceID() error = %v", err)
		}
		if len(found) != 2 {
			t.Errorf("expected 2 spans, got %d", len(found))
		}
	})

	t.Run("find non-existing trace", func(t *testing.T) {
		found, err := repo.FindByTraceID("non-existent")
		if err != nil {
			t.Errorf("FindByTraceID() error = %v", err)
		}
		if len(found) != 0 {
			t.Errorf("expected 0 spans, got %d", len(found))
		}
	})
}

// TestSQLiteRepositoryFindBySpanID 测试按 SpanID 查询
func TestSQLiteRepositoryFindBySpanID(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	span := &Span{
		ID:        "find-span-test",
		TraceID:   "trace-find-span",
		SpanID:    "target-span-id",
		Name:      "find-me",
		Kind:      SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Duration:  100,
		Status:    SpanStatusOK,
		Created:   types.NowDateTime(),
	}
	repo.SaveBatch([]*Span{span})

	t.Run("find existing span", func(t *testing.T) {
		found, err := repo.FindBySpanID("target-span-id")
		if err != nil {
			t.Errorf("FindBySpanID() error = %v", err)
		}
		if found == nil {
			t.Error("expected non-nil span")
			return
		}
		if found.Name != "find-me" {
			t.Errorf("expected name 'find-me', got '%s'", found.Name)
		}
	})

	t.Run("find non-existing span", func(t *testing.T) {
		found, err := repo.FindBySpanID("non-existent")
		if err != nil {
			t.Errorf("FindBySpanID() error = %v", err)
		}
		if found != nil {
			t.Error("expected nil span")
		}
	})
}

// TestSQLiteRepositoryQuery 测试通用查询
func TestSQLiteRepositoryQuery(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	// 准备测试数据
	now := time.Now()
	spans := []*Span{
		{ID: "q1", TraceID: "trace-q", SpanID: "sp-q1", Name: "fast-op", Kind: SpanKindServer, StartTime: now.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: "q2", TraceID: "trace-q", SpanID: "sp-q2", Name: "slow-op", Kind: SpanKindServer, StartTime: now.Add(-1 * time.Minute).UnixMicro(), Duration: 5000000, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: "q3", TraceID: "trace-q", SpanID: "sp-q3", Name: "error-op", Kind: SpanKindServer, StartTime: now.Add(-2 * time.Minute).UnixMicro(), Duration: 200, Status: SpanStatusError, Created: types.NowDateTime()},
	}
	repo.SaveBatch(spans)

	t.Run("query with limit", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{Limit: 2})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 2 {
			t.Errorf("expected 2 spans, got %d", len(found))
		}
	})

	t.Run("query by status", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{StatusFilter: []SpanStatus{SpanStatusError}})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 error span, got %d", len(found))
		}
	})

	t.Run("query by min duration", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{MinDuration: 1 * time.Second})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 slow span, got %d", len(found))
		}
	})

	t.Run("query with offset", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{Limit: 10, Offset: 2})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 span after offset, got %d", len(found))
		}
	})
}

// TestSQLiteRepositoryCount 测试计数
func TestSQLiteRepositoryCount(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	// 准备测试数据
	spans := make([]*Span, 5)
	for i := 0; i < 5; i++ {
		status := SpanStatusOK
		if i%2 == 0 {
			status = SpanStatusError
		}
		spans[i] = &Span{
			ID:        GenerateSpanID(),
			TraceID:   "trace-count",
			SpanID:    GenerateSpanID(),
			Name:      "count-op",
			Kind:      SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  int64(i * 100),
			Status:    status,
			Created:   types.NowDateTime(),
		}
	}
	repo.SaveBatch(spans)

	t.Run("count all", func(t *testing.T) {
		count, err := repo.Count(TraceQueryOptions{TraceID: "trace-count"})
		if err != nil {
			t.Errorf("Count() error = %v", err)
		}
		if count != 5 {
			t.Errorf("expected count 5, got %d", count)
		}
	})

	t.Run("count by status", func(t *testing.T) {
		count, err := repo.Count(TraceQueryOptions{StatusFilter: []SpanStatus{SpanStatusError}})
		if err != nil {
			t.Errorf("Count() error = %v", err)
		}
		if count != 3 {
			t.Errorf("expected count 3 (error status), got %d", count)
		}
	})
}

// TestSQLiteRepositoryPrune 测试数据清理
func TestSQLiteRepositoryPrune(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	// 准备不同时间的数据
	now := time.Now()
	oldTime := now.Add(-48 * time.Hour)
	recentTime := now.Add(-1 * time.Hour)

	oldCreated, _ := types.ParseDateTime(oldTime)
	recentCreated, _ := types.ParseDateTime(recentTime)
	spans := []*Span{
		{ID: "old-1", TraceID: "trace-old", SpanID: "sp-old-1", Name: "old-op", Kind: SpanKindServer, StartTime: oldTime.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: oldCreated},
		{ID: "old-2", TraceID: "trace-old", SpanID: "sp-old-2", Name: "old-op", Kind: SpanKindServer, StartTime: oldTime.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: oldCreated},
		{ID: "recent-1", TraceID: "trace-recent", SpanID: "sp-recent-1", Name: "recent-op", Kind: SpanKindServer, StartTime: recentTime.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: recentCreated},
	}
	repo.SaveBatch(spans)

	pruned, err := repo.Prune(now.Add(-24 * time.Hour))
	if err != nil {
		t.Errorf("Prune() error = %v", err)
	}
	if pruned != 2 {
		t.Errorf("expected 2 pruned spans, got %d", pruned)
	}

	// 验证只剩下 recent 数据
	remaining, _ := repo.Query(TraceQueryOptions{})
	if len(remaining) != 1 {
		t.Errorf("expected 1 remaining span, got %d", len(remaining))
	}
}

// TestSQLiteRepositoryDeleteByTraceID 测试按 TraceID 删除
func TestSQLiteRepositoryDeleteByTraceID(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	spans := []*Span{
		{ID: "d1", TraceID: "trace-delete", SpanID: "sp-d1", Name: "delete-op", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: "d2", TraceID: "trace-delete", SpanID: "sp-d2", Name: "delete-op", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: "d3", TraceID: "trace-keep", SpanID: "sp-d3", Name: "keep-op", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
	}
	repo.SaveBatch(spans)

	err := repo.DeleteByTraceID("trace-delete")
	if err != nil {
		t.Errorf("DeleteByTraceID() error = %v", err)
	}

	// 验证 trace-delete 已删除
	deleted, _ := repo.FindByTraceID("trace-delete")
	if len(deleted) != 0 {
		t.Errorf("expected 0 spans after delete, got %d", len(deleted))
	}

	// 验证 trace-keep 仍存在
	kept, _ := repo.FindByTraceID("trace-keep")
	if len(kept) != 1 {
		t.Errorf("expected 1 kept span, got %d", len(kept))
	}
}

// TestSQLiteRepositoryQueryAdvanced 测试高级查询选项
func TestSQLiteRepositoryQueryAdvanced(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	// 准备测试数据
	now := time.Now()
	spans := []*Span{
		{ID: "adv1", TraceID: "trace-adv", SpanID: "sp-adv1", ParentID: "parent-1", Name: "get-users", Kind: SpanKindServer, StartTime: now.UnixMicro(), Duration: 100000, Status: SpanStatusOK, Created: types.NowDateTime(), Attributes: map[string]any{"http.method": "GET", "user.id": "u1"}},
		{ID: "adv2", TraceID: "trace-adv", SpanID: "sp-adv2", ParentID: "parent-1", Name: "db-query", Kind: SpanKindInternal, StartTime: now.Add(-1 * time.Second).UnixMicro(), Duration: 50000, Status: SpanStatusOK, Created: types.NowDateTime(), Attributes: map[string]any{"db.type": "sqlite"}},
		{ID: "adv3", TraceID: "trace-adv", SpanID: "sp-adv3", ParentID: "parent-2", Name: "post-data", Kind: SpanKindClient, StartTime: now.Add(-2 * time.Second).UnixMicro(), Duration: 200000, Status: SpanStatusError, Created: types.NowDateTime(), Attributes: map[string]any{"http.method": "POST"}},
	}
	repo.SaveBatch(spans)

	t.Run("query by parent span ID", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{ParentSpanID: "parent-1"})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 2 {
			t.Errorf("expected 2 spans with parent-1, got %d", len(found))
		}
	})

	t.Run("query by span name", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{SpanName: "get"})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 span with 'get' in name, got %d", len(found))
		}
	})

	t.Run("query by kind filter", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{KindFilter: []SpanKind{SpanKindInternal, SpanKindClient}})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 2 {
			t.Errorf("expected 2 spans with internal/client kind, got %d", len(found))
		}
	})

	t.Run("query by max duration", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{MaxDuration: 100 * time.Millisecond})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		// 100ms = 100000 微秒，应该找到 adv1 和 adv2
		if len(found) < 1 {
			t.Errorf("expected at least 1 span with duration <= 100ms, got %d", len(found))
		}
	})

	t.Run("query by time range", func(t *testing.T) {
		from := now.Add(-3 * time.Second)
		to := now.Add(-500 * time.Millisecond)
		found, err := repo.Query(TraceQueryOptions{
			StartTimeFrom: from,
			StartTimeTo:   to,
		})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		// 应该找到 adv2 和 adv3
		if len(found) != 2 {
			t.Errorf("expected 2 spans in time range, got %d", len(found))
		}
	})

	t.Run("query with attribute filter", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{
			AttributeFilters: map[string]any{
				"http.method": "GET",
			},
		})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 span with http.method=GET, got %d", len(found))
		}
	})

	t.Run("query with order by ascending", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{
			OrderBy:   "duration",
			OrderDesc: false,
		})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) < 2 {
			t.Errorf("expected multiple spans, got %d", len(found))
		}
		// 第一个应该是 duration 最小的
		if len(found) >= 2 && found[0].Duration > found[1].Duration {
			t.Error("expected ascending order by duration")
		}
	})

	t.Run("query with order by descending", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{
			OrderBy:   "duration",
			OrderDesc: true,
		})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) < 2 {
			t.Errorf("expected multiple spans, got %d", len(found))
		}
		// 第一个应该是 duration 最大的
		if len(found) >= 2 && found[0].Duration < found[1].Duration {
			t.Error("expected descending order by duration")
		}
	})

	t.Run("query with multiple status filters", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{
			StatusFilter: []SpanStatus{SpanStatusOK, SpanStatusError},
		})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 3 {
			t.Errorf("expected 3 spans (all statuses), got %d", len(found))
		}
	})
}

// TestSQLiteRepositorySaveNilSpan 测试保存 nil span
func TestSQLiteRepositorySaveNilSpan(t *testing.T) {
	repo := setupTestSQLiteRepo(t)
	defer repo.Close()

	// 批量中包含 nil span
	spans := []*Span{
		{ID: "valid-1", TraceID: "trace-nil", SpanID: "sp-1", Name: "valid", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		nil, // nil span 应该被跳过
		{ID: "valid-2", TraceID: "trace-nil", SpanID: "sp-2", Name: "valid", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
	}

	result, err := repo.SaveBatch(spans)
	if err != nil {
		t.Errorf("SaveBatch() error = %v", err)
	}

	// nil span 不应该导致错误，只是被跳过
	if result.Total != 3 {
		t.Errorf("expected total 3, got %d", result.Total)
	}
	if result.Success != 2 {
		t.Errorf("expected success 2, got %d", result.Success)
	}
}

// setupTestSQLiteRepo 创建测试用的 SQLite Repository
func setupTestSQLiteRepo(t *testing.T) TraceRepository {
	t.Helper()

	tmpFile, err := os.CreateTemp("", "trace_test_*.db")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	t.Cleanup(func() { os.Remove(tmpFile.Name()) })
	tmpFile.Close()

	repo, err := NewSQLiteRepository(tmpFile.Name())
	if err != nil {
		t.Fatalf("NewSQLiteRepository() error = %v", err)
	}

	return repo
}
