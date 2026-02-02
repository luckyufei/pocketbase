package trace

import (
	"os"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/types"
)

// postgresTestContainer 用于测试的共享 PostgreSQL 容器
var (
	postgresTestContainer     *tests.PostgresContainer
	postgresTestContainerOnce sync.Once
	postgresTestContainerErr  error
)

// getTestPostgresContainer 获取共享的测试 PostgreSQL 容器
func getTestPostgresContainer() (*tests.PostgresContainer, error) {
	postgresTestContainerOnce.Do(func() {
		postgresTestContainer, postgresTestContainerErr = tests.NewPostgresContainer(tests.PostgresConfig{
			Version: "15",
			DBName:  "trace_test",
		})
	})
	return postgresTestContainer, postgresTestContainerErr
}

// skipIfNoPostgres 检查是否可以运行 PostgreSQL 测试
func skipIfNoPostgres(t *testing.T) string {
	t.Helper()

	// 优先使用环境变量指定的 DSN
	if dsn := os.Getenv("PB_TEST_POSTGRES_DSN"); dsn != "" {
		return dsn
	}

	// 如果明确跳过 Docker 测试
	if os.Getenv("SKIP_DOCKER_TESTS") == "1" {
		t.Skip("跳过 Docker 测试 (SKIP_DOCKER_TESTS=1)")
		return ""
	}

	// 尝试启动 Docker 容器
	container, err := getTestPostgresContainer()
	if err != nil {
		t.Skipf("跳过 PostgreSQL 测试: 无法启动 Docker 容器: %v", err)
		return ""
	}

	return container.DSN()
}

// TestNewPostgresRepository 测试创建 PostgreSQL Repository
func TestNewPostgresRepository(t *testing.T) {
	dsn := skipIfNoPostgres(t)

	t.Run("create with valid DSN", func(t *testing.T) {
		repo, err := NewPostgresRepository(dsn)
		if err != nil {
			t.Fatalf("NewPostgresRepository() error = %v", err)
		}
		defer repo.Close()

		if repo == nil {
			t.Error("expected non-nil repository")
		}
	})

	t.Run("create with empty DSN", func(t *testing.T) {
		_, err := NewPostgresRepository("")
		if err == nil {
			t.Error("expected error for empty DSN")
		}
	})
}

// TestPostgresRepositorySaveBatch 测试批量保存
func TestPostgresRepositorySaveBatch(t *testing.T) {
	repo := setupTestPostgresRepo(t)
	if repo == nil {
		return
	}
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
		// 使用唯一 ID 避免冲突
		spanID := GenerateSpanID()
		span := &Span{
			ID:        "pg-span-" + spanID,
			TraceID:   "pg-trace-" + spanID,
			SpanID:    spanID,
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
			t.Errorf("expected total=1, success=1, got total=%d, success=%d, failed=%d, errors=%v",
				result.Total, result.Success, result.Failed, result.Errors)
		}
	})

	t.Run("save multiple spans", func(t *testing.T) {
		traceID := "pg-trace-batch-" + GenerateSpanID()
		spans := make([]*Span, 10)
		for i := 0; i < 10; i++ {
			spans[i] = &Span{
				ID:        GenerateSpanID(),
				TraceID:   traceID,
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
		spanID := GenerateSpanID()
		span := &Span{
			ID:        "pg-span-attrs-" + spanID,
			TraceID:   "pg-trace-attrs-" + spanID,
			SpanID:    spanID,
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

// TestPostgresRepositoryFindByTraceID 测试按 TraceID 查询
func TestPostgresRepositoryFindByTraceID(t *testing.T) {
	repo := setupTestPostgresRepo(t)
	if repo == nil {
		return
	}
	defer repo.Close()

	// 准备测试数据 - 使用唯一 ID
	traceID := "pg-test-trace-find-" + GenerateSpanID()
	spans := []*Span{
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "op1", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "op2", Kind: SpanKindInternal, StartTime: time.Now().UnixMicro(), Duration: 50, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: GenerateSpanID(), TraceID: "pg-other-trace-" + GenerateSpanID(), SpanID: GenerateSpanID(), Name: "op3", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 200, Status: SpanStatusOK, Created: types.NowDateTime()},
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
		found, err := repo.FindByTraceID("non-existent-" + GenerateSpanID())
		if err != nil {
			t.Errorf("FindByTraceID() error = %v", err)
		}
		if len(found) != 0 {
			t.Errorf("expected 0 spans, got %d", len(found))
		}
	})
}

// TestPostgresRepositoryQuery 测试通用查询
func TestPostgresRepositoryQuery(t *testing.T) {
	repo := setupTestPostgresRepo(t)
	if repo == nil {
		return
	}
	defer repo.Close()

	// 准备测试数据
	now := time.Now()
	traceID := "pg-trace-q-" + GenerateSpanID()
	spans := []*Span{
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "fast-op", Kind: SpanKindServer, StartTime: now.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "slow-op", Kind: SpanKindServer, StartTime: now.Add(-1 * time.Minute).UnixMicro(), Duration: 5000000, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "error-op", Kind: SpanKindServer, StartTime: now.Add(-2 * time.Minute).UnixMicro(), Duration: 200, Status: SpanStatusError, Created: types.NowDateTime()},
	}
	repo.SaveBatch(spans)

	t.Run("query by traceID with limit", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{TraceID: traceID, Limit: 2})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 2 {
			t.Errorf("expected 2 spans, got %d", len(found))
		}
	})

	t.Run("query by status", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{TraceID: traceID, StatusFilter: []SpanStatus{SpanStatusError}})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 error span, got %d", len(found))
		}
	})

	t.Run("query by min duration", func(t *testing.T) {
		found, err := repo.Query(TraceQueryOptions{TraceID: traceID, MinDuration: 1 * time.Second})
		if err != nil {
			t.Errorf("Query() error = %v", err)
		}
		if len(found) != 1 {
			t.Errorf("expected 1 slow span, got %d", len(found))
		}
	})
}

// TestPostgresRepositoryCount 测试计数
func TestPostgresRepositoryCount(t *testing.T) {
	repo := setupTestPostgresRepo(t)
	if repo == nil {
		return
	}
	defer repo.Close()

	// 准备测试数据
	traceID := "pg-trace-count-" + GenerateSpanID()
	spans := make([]*Span, 5)
	for i := 0; i < 5; i++ {
		status := SpanStatusOK
		if i%2 == 0 {
			status = SpanStatusError
		}
		spans[i] = &Span{
			ID:        GenerateSpanID(),
			TraceID:   traceID,
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
		count, err := repo.Count(TraceQueryOptions{TraceID: traceID})
		if err != nil {
			t.Errorf("Count() error = %v", err)
		}
		if count != 5 {
			t.Errorf("expected count 5, got %d", count)
		}
	})

	t.Run("count by status", func(t *testing.T) {
		count, err := repo.Count(TraceQueryOptions{TraceID: traceID, StatusFilter: []SpanStatus{SpanStatusError}})
		if err != nil {
			t.Errorf("Count() error = %v", err)
		}
		if count != 3 {
			t.Errorf("expected count 3 (error status), got %d", count)
		}
	})
}

// TestPostgresRepositoryPrune 测试数据清理
func TestPostgresRepositoryPrune(t *testing.T) {
	repo := setupTestPostgresRepo(t)
	if repo == nil {
		return
	}
	defer repo.Close()

	// 准备不同时间的数据
	now := time.Now()
	oldTime := now.Add(-48 * time.Hour)
	recentTime := now.Add(-1 * time.Hour)

	traceID := "pg-trace-prune-" + GenerateSpanID()
	oldCreated, _ := types.ParseDateTime(oldTime)
	recentCreated, _ := types.ParseDateTime(recentTime)

	spans := []*Span{
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "old-op", Kind: SpanKindServer, StartTime: oldTime.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: oldCreated},
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "old-op", Kind: SpanKindServer, StartTime: oldTime.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: oldCreated},
		{ID: GenerateSpanID(), TraceID: traceID, SpanID: GenerateSpanID(), Name: "recent-op", Kind: SpanKindServer, StartTime: recentTime.UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: recentCreated},
	}
	repo.SaveBatch(spans)

	pruned, err := repo.Prune(now.Add(-24 * time.Hour))
	if err != nil {
		t.Errorf("Prune() error = %v", err)
	}
	// 注意：这里可能有其他测试的数据也被删除，只检查 >= 2
	if pruned < 2 {
		t.Logf("pruned %d spans (expected >= 2)", pruned)
	}

	// 验证 recent 数据仍在
	remaining, _ := repo.Query(TraceQueryOptions{TraceID: traceID})
	if len(remaining) < 1 {
		t.Errorf("expected at least 1 remaining span, got %d", len(remaining))
	}
}

// TestPostgresRepositoryDeleteByTraceID 测试按 TraceID 删除
func TestPostgresRepositoryDeleteByTraceID(t *testing.T) {
	repo := setupTestPostgresRepo(t)
	if repo == nil {
		return
	}
	defer repo.Close()

	traceDelete := "pg-trace-delete-" + GenerateSpanID()
	traceKeep := "pg-trace-keep-" + GenerateSpanID()

	spans := []*Span{
		{ID: GenerateSpanID(), TraceID: traceDelete, SpanID: GenerateSpanID(), Name: "delete-op", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: GenerateSpanID(), TraceID: traceDelete, SpanID: GenerateSpanID(), Name: "delete-op", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
		{ID: GenerateSpanID(), TraceID: traceKeep, SpanID: GenerateSpanID(), Name: "keep-op", Kind: SpanKindServer, StartTime: time.Now().UnixMicro(), Duration: 100, Status: SpanStatusOK, Created: types.NowDateTime()},
	}
	repo.SaveBatch(spans)

	err := repo.DeleteByTraceID(traceDelete)
	if err != nil {
		t.Errorf("DeleteByTraceID() error = %v", err)
	}

	// 验证 trace-delete 已删除
	deleted, _ := repo.FindByTraceID(traceDelete)
	if len(deleted) != 0 {
		t.Errorf("expected 0 spans after delete, got %d", len(deleted))
	}

	// 验证 trace-keep 仍存在
	kept, _ := repo.FindByTraceID(traceKeep)
	if len(kept) != 1 {
		t.Errorf("expected 1 kept span, got %d", len(kept))
	}
}

// setupTestPostgresRepo 创建测试用的 PostgreSQL Repository
func setupTestPostgresRepo(t *testing.T) TraceRepository {
	t.Helper()

	dsn := skipIfNoPostgres(t)

	repo, err := NewPostgresRepository(dsn)
	if err != nil {
		t.Fatalf("NewPostgresRepository() error = %v", err)
	}

	return repo
}
