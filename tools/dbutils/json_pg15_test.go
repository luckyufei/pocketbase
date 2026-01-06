package dbutils_test

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestJSONExtract_PG15Compatible 验证 JSONExtract 生成的 SQL 兼容 PostgreSQL 15
// 设计决策:
// - 保留 json_query_or_null 自定义函数用于错误处理
// - 但该函数内部必须使用 jsonb_path_query_first (PG12+) 而非 JSON_QUERY (PG17+)
// - Go 代码生成的 SQL 仍然调用 json_query_or_null
// - 添加 ::jsonb 后缀用于类型推断
func TestJSONExtract_PG15Compatible(t *testing.T) {
	scenarios := []struct {
		name     string
		column   string
		path     string
		expected string
	}{
		{
			"empty path",
			"a.b",
			"",
			// 使用自定义函数 json_query_or_null，添加 ::jsonb 后缀用于类型推断
			`json_query_or_null([[a.b]], '$')::jsonb`,
		},
		{
			"array index path",
			"a.b",
			"[1].a[2]",
			`json_query_or_null([[a.b]], '$[1].a[2]')::jsonb`,
		},
		{
			"nested key path",
			"a.b",
			"a.b[2].c",
			`json_query_or_null([[a.b]], '$.a.b[2].c')::jsonb`,
		},
		{
			"simple key path",
			"data",
			"name",
			`json_query_or_null([[data]], '$.name')::jsonb`,
		},
		{
			"deep nested path",
			"config",
			"settings.theme.colors[0]",
			`json_query_or_null([[config]], '$.settings.theme.colors[0]')::jsonb`,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.JSONExtract(s.column, s.path)

			if result != s.expected {
				t.Fatalf("Expected\n%v\ngot\n%v", s.expected, result)
			}
		})
	}
}

// TestJSONExtract_NoPG17OnlyFunctions 确保生成的 SQL 不包含 PG17+ 专有函数
func TestJSONExtract_NoPG17OnlyFunctions(t *testing.T) {
	testCases := []struct {
		column string
		path   string
	}{
		{"data", ""},
		{"data", "key"},
		{"data", "a.b.c"},
		{"data", "[0]"},
		{"data", "arr[0].nested"},
	}

	pg17OnlyFunctions := []string{
		"JSON_QUERY(",  // SQL/JSON 标准函数, PG17+
		"JSON_VALUE(",  // SQL/JSON 标准函数, PG17+
		"JSON_EXISTS(", // SQL/JSON 标准函数, PG17+
		"JSON_TABLE(",  // SQL/JSON 标准函数, PG17+
	}

	for _, tc := range testCases {
		result := dbutils.JSONExtract(tc.column, tc.path)

		for _, fn := range pg17OnlyFunctions {
			if strings.Contains(strings.ToUpper(result), fn) {
				t.Errorf("JSONExtract(%q, %q) contains PG17+ only function %s: %s",
					tc.column, tc.path, fn, result)
			}
		}
	}
}


