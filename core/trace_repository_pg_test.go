package core_test

import (
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// setupPostgreSQLRepo 创建测试用的 PostgreSQL repository
func setupPostgreSQLRepo(t *testing.T) (*core.PgTraceRepository, func()) {
	// 跳过测试如果没有 PostgreSQL 连接
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("Skipping PostgreSQL tests: TEST_POSTGRES_DSN not set")
	}

	repo, err := core.NewPgTraceRepository(dsn)
	if err != nil {
		t.Fatalf("Failed to create PostgreSQL repository: %v", err)
	}

	if err := repo.CreateSchema(); err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	cleanup := func() {
		// 清理测试数据
		repo.Close()
	}

	return repo, cleanup
}

// TestPostgreSQLTraceRepositoryAttributeFilters 测试 PostgreSQL JSONB 查询功能
func TestPostgreSQLTraceRepositoryAttributeFilters(t *testing.T) {
	repo, cleanup := setupPostgreSQLRepo(t)
	defer cleanup()

	// 创建多个测试 spans
	spans := []*core.Span{
		{
			TraceID:   "trace1",
			SpanID:    "span1",
			Name:      "GET /api/users",
			Kind:      core.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  1000,
			Status:    core.SpanStatusOK,
			Attributes: map[string]any{
				"http.method": "GET",
				"http.path":   "/api/users",
				"user.id":     "123",
			},
			Created: types.NowDateTime(),
		},
		{
			TraceID:   "trace2",
			SpanID:    "span2",
			Name:      "POST /api/users",
			Kind:      core.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  2000,
			Status:    core.SpanStatusError,
			Attributes: map[string]any{
				"http.method": "POST",
				"http.path":   "/api/users",
				"user.id":     "456",
			},
			Created: types.NowDateTime(),
		},
		{
			TraceID:   "trace3",
			SpanID:    "span3",
			Name:      "GET /api/posts",
			Kind:      core.SpanKindServer,
			StartTime: time.Now().UnixMicro(),
			Duration:  1500,
			Status:    core.SpanStatusOK,
			Attributes: map[string]any{
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