package search_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
	"github.com/pocketbase/pocketbase/tools/search"
)

// TestFilterDataBuildExprPostgres 测试 PostgreSQL 过滤器表达式构建
func TestFilterDataBuildExprPostgres(t *testing.T) {
	resolver := search.NewSimpleFieldResolver("test1", "test2", "test3", "test4_sub", "test5")

	scenarios := []struct {
		name           string
		filter         string
		dbType         dbutils.DBType
		expectContains []string
		expectNotContains []string
	}{
		{
			name:   "PostgreSQL 布尔值 true",
			filter: "test1 = true",
			dbType: dbutils.DBTypePostgres,
			expectContains: []string{"TRUE"},
			expectNotContains: []string{"= 1"},
		},
		{
			name:   "PostgreSQL 布尔值 false",
			filter: "test1 = false",
			dbType: dbutils.DBTypePostgres,
			expectContains: []string{"FALSE"},
			expectNotContains: []string{"= 0"},
		},
		{
			name:   "SQLite 布尔值 true",
			filter: "test1 = true",
			dbType: dbutils.DBTypeSQLite,
			expectContains: []string{"= 1"},
		},
		{
			name:   "SQLite 布尔值 false",
			filter: "test1 = false",
			dbType: dbutils.DBTypeSQLite,
			expectContains: []string{"= 0"},
		},
		{
			name:   "PostgreSQL IS DISTINCT FROM",
			filter: "test1 != test2",
			dbType: dbutils.DBTypePostgres,
			expectContains: []string{"IS DISTINCT FROM"},
			expectNotContains: []string{"IS NOT"},
		},
		{
			name:   "SQLite IS NOT",
			filter: "test1 != test2",
			dbType: dbutils.DBTypeSQLite,
			expectContains: []string{"IS NOT"},
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			// 创建带数据库类型的解析器
			resolverWithDBType := search.NewSimpleFieldResolverWithDBType(
				s.dbType,
				"test1", "test2", "test3", "test4_sub", "test5",
			)

			expr, err := search.FilterData(s.filter).BuildExpr(resolverWithDBType)
			if err != nil {
				t.Fatalf("构建表达式失败: %v", err)
			}

			exprStr := expr.Build(nil, nil)

			for _, expected := range s.expectContains {
				if !containsString(exprStr, expected) {
					t.Errorf("表达式应包含 %q, 实际: %s", expected, exprStr)
				}
			}

			for _, notExpected := range s.expectNotContains {
				if containsString(exprStr, notExpected) {
					t.Errorf("表达式不应包含 %q, 实际: %s", notExpected, exprStr)
				}
			}
		})
	}

	// 测试默认解析器 (SQLite)
	t.Run("默认解析器使用 SQLite 语法", func(t *testing.T) {
		expr, err := search.FilterData("test1 = true").BuildExpr(resolver)
		if err != nil {
			t.Fatalf("构建表达式失败: %v", err)
		}

		exprStr := expr.Build(nil, nil)
		if !containsString(exprStr, "= 1") {
			t.Errorf("默认解析器应使用 SQLite 语法 (= 1), 实际: %s", exprStr)
		}
	})
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && len(substr) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
