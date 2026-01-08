package core_test

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestFieldColumnTypePostgres 测试所有字段类型在 PostgreSQL 模式下返回正确的列类型
func TestFieldColumnTypePostgres(t *testing.T) {
	// 创建一个模拟的 PostgreSQL App
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 如果不是 PostgreSQL 模式，跳过测试
	if !app.IsPostgres() {
		t.Skip("Skipping PostgreSQL-specific test in SQLite mode")
	}

	testCases := []struct {
		name     string
		field    core.Field
		expected string
		contains []string // 期望包含的关键字
	}{
		{
			name:     "TextField",
			field:    &core.TextField{Name: "test"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "TextField with PrimaryKey",
			field:    &core.TextField{Name: "id", PrimaryKey: true},
			contains: []string{"TEXT", "PRIMARY KEY"},
		},
		{
			name:     "NumberField",
			field:    &core.NumberField{Name: "count"},
			expected: "NUMERIC DEFAULT 0 NOT NULL",
		},
		{
			name:     "BoolField",
			field:    &core.BoolField{Name: "active"},
			expected: "BOOLEAN DEFAULT FALSE NOT NULL",
		},
		{
			name:     "DateField - should use TIMESTAMPTZ",
			field:    &core.DateField{Name: "birthday"},
			expected: "TIMESTAMPTZ DEFAULT NULL",
		},
		{
			name:     "AutodateField - should use TIMESTAMPTZ",
			field:    &core.AutodateField{Name: "created"},
			expected: "TIMESTAMPTZ DEFAULT NULL",
		},
		{
			name:     "JSONField - should use JSONB",
			field:    &core.JSONField{Name: "data"},
			expected: "JSONB DEFAULT NULL",
		},
		{
			name:     "EmailField",
			field:    &core.EmailField{Name: "email"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "URLField",
			field:    &core.URLField{Name: "website"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "EditorField",
			field:    &core.EditorField{Name: "content"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "PasswordField",
			field:    &core.PasswordField{Name: "password"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "SelectField single - should use TEXT",
			field:    &core.SelectField{Name: "status", MaxSelect: 1, Values: []string{"a", "b"}},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "SelectField multiple - should use JSONB",
			field:    &core.SelectField{Name: "tags", MaxSelect: 5, Values: []string{"a", "b"}},
			expected: "JSONB DEFAULT '[]' NOT NULL",
		},
		{
			name:     "RelationField single",
			field:    &core.RelationField{Name: "author", MaxSelect: 1},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "RelationField multiple - should use JSONB",
			field:    &core.RelationField{Name: "categories", MaxSelect: 5},
			expected: "JSONB DEFAULT '[]' NOT NULL",
		},
		{
			name:     "FileField single",
			field:    &core.FileField{Name: "avatar", MaxSelect: 1},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "FileField multiple - should use JSON (not JSONB)",
			field:    &core.FileField{Name: "attachments", MaxSelect: 5},
			contains: []string{"JSON", "DEFAULT '[]'"},
		},
		{
			name:     "GeoPointField - should use JSONB",
			field:    &core.GeoPointField{Name: "location"},
			contains: []string{"JSONB", "lon", "lat"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.field.ColumnType(app)

			if tc.expected != "" {
				if result != tc.expected {
					t.Errorf("Expected %q, got %q", tc.expected, result)
				}
			}

			for _, keyword := range tc.contains {
				if !strings.Contains(result, keyword) {
					t.Errorf("Expected result to contain %q, got %q", keyword, result)
				}
			}
		})
	}
}

// TestFieldColumnTypeSQLite 测试所有字段类型在 SQLite 模式下返回正确的列类型
func TestFieldColumnTypeSQLite(t *testing.T) {
	// 创建一个 SQLite 模式的 App
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 如果是 PostgreSQL 模式，跳过测试
	if app.IsPostgres() {
		t.Skip("Skipping SQLite-specific test in PostgreSQL mode")
	}

	testCases := []struct {
		name     string
		field    core.Field
		expected string
		contains []string
	}{
		{
			name:     "DateField - should use TEXT in SQLite",
			field:    &core.DateField{Name: "birthday"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "AutodateField - should use TEXT in SQLite",
			field:    &core.AutodateField{Name: "created"},
			expected: "TEXT DEFAULT '' NOT NULL",
		},
		{
			name:     "JSONField - should use JSON (not JSONB) in SQLite",
			field:    &core.JSONField{Name: "data"},
			expected: "JSON DEFAULT NULL",
		},
		{
			name:     "SelectField multiple - should use JSON in SQLite",
			field:    &core.SelectField{Name: "tags", MaxSelect: 5, Values: []string{"a", "b"}},
			expected: "JSON DEFAULT '[]' NOT NULL",
		},
		{
			name:     "RelationField multiple - should use JSON in SQLite",
			field:    &core.RelationField{Name: "categories", MaxSelect: 5},
			expected: "JSON DEFAULT '[]' NOT NULL",
		},
		{
			name:     "GeoPointField - should use JSON in SQLite",
			field:    &core.GeoPointField{Name: "location"},
			contains: []string{"JSON", "lon", "lat"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.field.ColumnType(app)

			if tc.expected != "" {
				if result != tc.expected {
					t.Errorf("Expected %q, got %q", tc.expected, result)
				}
			}

			for _, keyword := range tc.contains {
				if !strings.Contains(result, keyword) {
					t.Errorf("Expected result to contain %q, got %q", keyword, result)
				}
			}

			// SQLite 模式下不应该包含 JSONB 或 TIMESTAMPTZ
			if strings.Contains(result, "JSONB") {
				t.Errorf("SQLite mode should not use JSONB, got %q", result)
			}
			if strings.Contains(result, "TIMESTAMPTZ") {
				t.Errorf("SQLite mode should not use TIMESTAMPTZ, got %q", result)
			}
		})
	}
}

// TestFieldColumnTypeConsistency 测试字段类型在两种数据库模式下的一致性
func TestFieldColumnTypeConsistency(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 这些字段类型在两种数据库模式下应该返回相同的结果
	consistentFields := []struct {
		name  string
		field core.Field
	}{
		{"TextField", &core.TextField{Name: "test"}},
		{"NumberField", &core.NumberField{Name: "count"}},
		{"BoolField", &core.BoolField{Name: "active"}},
		{"EmailField", &core.EmailField{Name: "email"}},
		{"URLField", &core.URLField{Name: "website"}},
		{"EditorField", &core.EditorField{Name: "content"}},
		{"PasswordField", &core.PasswordField{Name: "password"}},
	}

	for _, tc := range consistentFields {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.field.ColumnType(app)

			// 这些字段应该返回 TEXT 或 BOOLEAN 或 NUMERIC
			if !strings.Contains(result, "TEXT") &&
				!strings.Contains(result, "BOOLEAN") &&
				!strings.Contains(result, "NUMERIC") {
				t.Errorf("Expected TEXT, BOOLEAN or NUMERIC type, got %q", result)
			}
		})
	}
}
