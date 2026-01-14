package apis

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func TestPgTypeForValue(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		name     string
		value    any
		field    core.Field
		expected string
	}{
		// 根据字段类型判断
		{
			name:     "TextField",
			value:    "test",
			field:    &core.TextField{Name: "test"},
			expected: "::text",
		},
		{
			name:     "EmailField",
			value:    "test@example.com",
			field:    &core.EmailField{Name: "email"},
			expected: "::text",
		},
		{
			name:     "URLField",
			value:    "https://example.com",
			field:    &core.URLField{Name: "url"},
			expected: "::text",
		},
		{
			name:     "EditorField",
			value:    "<p>content</p>",
			field:    &core.EditorField{Name: "editor"},
			expected: "::text",
		},
		{
			name:     "NumberField with 0",
			value:    float64(0),
			field:    &core.NumberField{Name: "number"},
			expected: "::numeric",
		},
		{
			name:     "NumberField with value",
			value:    float64(123.45),
			field:    &core.NumberField{Name: "number"},
			expected: "::numeric",
		},
		{
			name:     "BoolField true",
			value:    true,
			field:    &core.BoolField{Name: "bool"},
			expected: "::boolean",
		},
		{
			name:     "BoolField false",
			value:    false,
			field:    &core.BoolField{Name: "bool"},
			expected: "::boolean",
		},
		{
			name:     "DateField",
			value:    "2024-01-01 00:00:00.000Z",
			field:    &core.DateField{Name: "date"},
			expected: "::timestamptz",
		},
		{
			name:     "AutodateField",
			value:    "2024-01-01 00:00:00.000Z",
			field:    &core.AutodateField{Name: "created"},
			expected: "::timestamptz",
		},
		{
			name:     "JSONField",
			value:    map[string]any{"key": "value"},
			field:    &core.JSONField{Name: "json"},
			expected: "::jsonb",
		},
		{
			name:     "GeoPointField",
			value:    map[string]any{"lon": 0, "lat": 0},
			field:    &core.GeoPointField{Name: "geo"},
			expected: "::jsonb",
		},
		{
			name:     "SelectField single",
			value:    "option1",
			field:    &core.SelectField{Name: "select", MaxSelect: 1, Values: []string{"option1", "option2"}},
			expected: "::text",
		},
		{
			name:     "SelectField multiple",
			value:    []string{"option1", "option2"},
			field:    &core.SelectField{Name: "select", MaxSelect: 2, Values: []string{"option1", "option2"}},
			expected: "::jsonb",
		},
		{
			name:     "RelationField single",
			value:    "record_id",
			field:    &core.RelationField{Name: "relation", MaxSelect: 1},
			expected: "::text",
		},
		{
			name:     "RelationField multiple",
			value:    []string{"id1", "id2"},
			field:    &core.RelationField{Name: "relation", MaxSelect: 2},
			expected: "::jsonb",
		},
		{
			name:     "FileField single",
			value:    "file.txt",
			field:    &core.FileField{Name: "file", MaxSelect: 1, MaxSize: 1024},
			expected: "::text",
		},
		{
			name:     "FileField multiple",
			value:    []string{"file1.txt", "file2.txt"},
			field:    &core.FileField{Name: "file", MaxSelect: 2, MaxSize: 1024},
			expected: "::jsonb",
		},

		// 根据值类型推断（无字段信息）
		{
			name:     "string value without field",
			value:    "test",
			field:    nil,
			expected: "::text",
		},
		{
			name:     "int value without field",
			value:    int(123),
			field:    nil,
			expected: "::numeric",
		},
		{
			name:     "int64 value without field",
			value:    int64(123),
			field:    nil,
			expected: "::numeric",
		},
		{
			name:     "float64 value without field",
			value:    float64(123.45),
			field:    nil,
			expected: "::numeric",
		},
		{
			name:     "bool value without field",
			value:    true,
			field:    nil,
			expected: "::boolean",
		},
		{
			name:     "nil value without field",
			value:    nil,
			field:    nil,
			expected: "::text",
		},
		{
			name:     "zero int without field",
			value:    int(0),
			field:    nil,
			expected: "::numeric",
		},
		{
			name:     "zero float64 without field",
			value:    float64(0),
			field:    nil,
			expected: "::numeric",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := pgTypeForValue(s.value, s.field)
			if result != s.expected {
				t.Errorf("Expected %q, got %q", s.expected, result)
			}
		})
	}
}

func TestIsEmptyDateValue(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		name     string
		value    any
		field    core.Field
		expected bool
	}{
		// 日期字段空字符串
		{
			name:     "DateField with empty string",
			value:    "",
			field:    &core.DateField{Name: "date"},
			expected: true,
		},
		{
			name:     "AutodateField with empty string",
			value:    "",
			field:    &core.AutodateField{Name: "created"},
			expected: true,
		},
		// 日期字段零值 DateTime（DBExport 返回的实际类型）
		{
			name:     "DateField with zero DateTime",
			value:    types.DateTime{},
			field:    &core.DateField{Name: "date"},
			expected: true,
		},
		{
			name:     "AutodateField with zero DateTime",
			value:    types.DateTime{},
			field:    &core.AutodateField{Name: "created"},
			expected: true,
		},
		// 日期字段非空值
		{
			name:     "DateField with value",
			value:    "2024-01-01 00:00:00.000Z",
			field:    &core.DateField{Name: "date"},
			expected: false,
		},
		{
			name:     "AutodateField with value",
			value:    "2024-01-01 00:00:00.000Z",
			field:    &core.AutodateField{Name: "created"},
			expected: false,
		},
		// 日期字段非零 DateTime
		{
			name:     "DateField with non-zero DateTime",
			value:    types.NowDateTime(),
			field:    &core.DateField{Name: "date"},
			expected: false,
		},
		// 非日期字段
		{
			name:     "TextField with empty string",
			value:    "",
			field:    &core.TextField{Name: "text"},
			expected: false,
		},
		{
			name:     "NumberField with zero",
			value:    float64(0),
			field:    &core.NumberField{Name: "number"},
			expected: false,
		},
		// 无字段信息
		{
			name:     "nil field with empty string",
			value:    "",
			field:    nil,
			expected: false,
		},
		// nil 值
		{
			name:     "DateField with nil",
			value:    nil,
			field:    &core.DateField{Name: "date"},
			expected: false,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := isEmptyDateValue(s.value, s.field)
			if result != s.expected {
				t.Errorf("Expected %v, got %v", s.expected, result)
			}
		})
	}
}
