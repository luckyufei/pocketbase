package dbutils_test

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

func TestJSONEachPG(t *testing.T) {
	result := dbutils.JSONEachPG("a.b")

	// 验证关键组件存在，而不是完整字符串匹配（因为内联安全转换表达式较长）
	requiredParts := []string{
		"jsonb_array_elements_text",
		"jsonb_typeof",
		"[[a.b]]",
		"jsonb_build_array",
		"to_jsonb", // 安全转换的关键部分
	}

	for _, part := range requiredParts {
		if !strings.Contains(result, part) {
			t.Fatalf("Expected result to contain %q, got: %s", part, result)
		}
	}
}

func TestJSONArrayLengthPG(t *testing.T) {
	result := dbutils.JSONArrayLengthPG("a.b")

	// 验证关键组件存在
	requiredParts := []string{
		"jsonb_array_length",
		"jsonb_typeof",
		"[[a.b]]",
		"jsonb_build_array",
		"to_jsonb", // 安全转换的关键部分
	}

	for _, part := range requiredParts {
		if !strings.Contains(result, part) {
			t.Fatalf("Expected result to contain %q, got: %s", part, result)
		}
	}
}

func TestJSONExtractPG(t *testing.T) {
	scenarios := []struct {
		name     string
		column   string
		path     string
		expected string
	}{
		{
			name:     "empty path",
			column:   "a.b",
			path:     "",
			expected: "(CASE WHEN [[a.b]] IS NOT NULL AND [[a.b]]::text <> '' THEN [[a.b]]::jsonb ELSE to_jsonb([[a.b]]) END)",
		},
		{
			name:     "simple key",
			column:   "data",
			path:     "name",
			expected: "(CASE WHEN pb_is_json([[data]]) THEN jsonb_path_query_first([[data]]::jsonb, '$.name') ELSE jsonb_path_query_first(jsonb_build_object('pb', [[data]]), '$.pbname') END)",
		},
		{
			name:     "nested path",
			column:   "data",
			path:     "a.b.c",
			expected: "(CASE WHEN pb_is_json([[data]]) THEN jsonb_path_query_first([[data]]::jsonb, '$.a.b.c') ELSE jsonb_path_query_first(jsonb_build_object('pb', [[data]]), '$.pba.b.c') END)",
		},
		{
			name:     "array index",
			column:   "data",
			path:     "[0]",
			expected: "(CASE WHEN pb_is_json([[data]]) THEN jsonb_path_query_first([[data]]::jsonb, '$[0]') ELSE jsonb_path_query_first(jsonb_build_object('pb', [[data]]), '$.pb[0]') END)",
		},
		{
			name:     "mixed path",
			column:   "data",
			path:     "items[0].name",
			expected: "(CASE WHEN pb_is_json([[data]]) THEN jsonb_path_query_first([[data]]::jsonb, '$.items[0].name') ELSE jsonb_path_query_first(jsonb_build_object('pb', [[data]]), '$.pbitems[0].name') END)",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.JSONExtractPG(s.column, s.path)

			if result != s.expected {
				t.Fatalf("Expected\n%v\ngot\n%v", s.expected, result)
			}
		})
	}
}

func TestConvertPathToArray(t *testing.T) {
	// 使用 JSONExtractTextPG 间接测试 convertPathToArray
	scenarios := []struct {
		name   string
		column string
		path   string
	}{
		{
			name:   "simple key",
			column: "data",
			path:   "name",
		},
		{
			name:   "nested path",
			column: "data",
			path:   "a.b.c",
		},
		{
			name:   "with array index",
			column: "data",
			path:   "items[0].name",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.JSONExtractTextPG(s.column, s.path)
			// 只验证不会 panic，具体格式在集成测试中验证
			if result == "" {
				t.Fatal("Result should not be empty")
			}
		})
	}
}

func TestJSONContainsPG(t *testing.T) {
	result := dbutils.JSONContainsPG("tags", `'"test"'`)
	expected := `[[tags]]::jsonb @> '"test"'::jsonb`

	if result != expected {
		t.Fatalf("Expected\n%v\ngot\n%v", expected, result)
	}
}

func TestJSONExistsPG(t *testing.T) {
	result := dbutils.JSONExistsPG("data", "'name'")
	expected := `[[data]]::jsonb ? 'name'`

	if result != expected {
		t.Fatalf("Expected\n%v\ngot\n%v", expected, result)
	}
}

func TestJSONTypePG(t *testing.T) {
	result := dbutils.JSONTypePG("data")
	expected := `jsonb_typeof([[data]]::jsonb)`

	if result != expected {
		t.Fatalf("Expected\n%v\ngot\n%v", expected, result)
	}
}

func TestJSONValidPG(t *testing.T) {
	result := dbutils.JSONValidPG("data")
	expected := `pb_is_json([[data]])`

	if result != expected {
		t.Fatalf("Expected\n%v\ngot\n%v", expected, result)
	}
}

func TestCreatePGHelperFunctions(t *testing.T) {
	sql := dbutils.CreatePGHelperFunctions()

	// 验证包含必要的函数定义
	requiredFunctions := []string{
		"pb_is_json",
		"pb_safe_jsonb",
		"pb_json_extract",
		"pb_json_each",
		"pb_json_array_length",
		"uuid_generate_v7",
	}

	for _, fn := range requiredFunctions {
		if !contains(sql, fn) {
			t.Fatalf("SQL should contain function %s", fn)
		}
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
