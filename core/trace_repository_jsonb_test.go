package core_test

import (
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// TestJSONBQueryPostgreSQL 测试 PostgreSQL JSONB 查询功能
func TestJSONBQueryPostgreSQL(t *testing.T) {
	// 跳过，因为需要 PostgreSQL 环境
	t.Skip("PostgreSQL environment required")

	// TODO: 实现 PostgreSQL 测试
}

// TestJSONQuerySQLite 测试 SQLite JSON 查询功能
func TestJSONQuerySQLite(t *testing.T) {
	const testDataDir = "./pb_trace_json_query_test/"
	defer os.RemoveAll(testDataDir)

	// 创建 SQLite repository
	repo, err := core.NewSQLiteTraceRepository(testDataDir + "test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close()

	if err := repo.CreateSchema(); err != nil {
		t.Fatal(err)
	}

	// 创建测试数据
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
				"http.method":     "GET",
				"http.status_code": 200,
				"user.id":         "123",
			},
			Created: time.Now(),
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
				"http.method":     "POST",
				"http.status_code": 500,
				"user.id":         "456",
			},
			Created: time.Now(),
		},
	}

	// 写入测试数据
	if err := repo.BatchWrite(spans); err != nil {
		t.Fatal(err)
	}

	// 测试 JSON 查询 - 按 http.method 过滤
	params := core.NewFilterParams()
	params.AttributeFilters = map[string]any{
		"http.method": "GET",
	}

	results, total, err := repo.Query(params)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if total != 1 {
		t.Errorf("Expected 1 result, got %d", total)
	}

	if len(results) != 1 {
		t.Errorf("Expected 1 result, got %d", len(results))
	}

	if len(results) > 0 && results[0].Name != "GET /api/users" {
		t.Errorf("Expected 'GET /api/users', got %s", results[0].Name)
	}

	// 测试 JSON 查询 - 按 http.status_code 过滤
	params = core.NewFilterParams()
	params.AttributeFilters = map[string]any{
		"http.status_code": 500,
	}

	results, total, err = repo.Query(params)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if total != 1 {
		t.Errorf("Expected 1 result, got %d", total)
	}

	if len(results) > 0 && results[0].Name != "POST /api/users" {
		t.Errorf("Expected 'POST /api/users', got %s", results[0].Name)
	}
}