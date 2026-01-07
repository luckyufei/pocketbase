package dbutils

import (
	"strings"
	"testing"
)

// TestParseGINIndex 测试解析 GIN 索引
func TestParseGINIndex(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		expected Index
	}{
		{
			name:  "基本 GIN 索引",
			input: "CREATE INDEX idx_data_gin ON records USING GIN (data)",
			expected: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
			},
		},
		{
			name:  "GIN 索引带操作符类",
			input: "CREATE INDEX idx_data_gin ON records USING GIN (data jsonb_path_ops)",
			expected: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data", OpClass: "jsonb_path_ops"}},
				Method:    "GIN",
			},
		},
		{
			name:  "GIN 索引多列",
			input: "CREATE INDEX idx_multi_gin ON records USING GIN (data, tags)",
			expected: Index{
				IndexName: "idx_multi_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}, {Name: "tags"}},
				Method:    "GIN",
			},
		},
		{
			name:  "GIN 索引带 WHERE",
			input: "CREATE INDEX idx_data_gin ON records USING GIN (data) WHERE active = true",
			expected: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Where:     "active = true",
			},
		},
		{
			name:  "BTREE 索引 (默认)",
			input: "CREATE INDEX idx_name ON records (name)",
			expected: Index{
				IndexName: "idx_name",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "name"}},
				Method:    "", // 默认 BTREE 不显式设置
			},
		},
		{
			name:  "显式 BTREE 索引",
			input: "CREATE INDEX idx_name ON records USING BTREE (name)",
			expected: Index{
				IndexName: "idx_name",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "name"}},
				Method:    "BTREE",
			},
		},
		{
			name:  "GIST 索引",
			input: "CREATE INDEX idx_geo ON locations USING GIST (geom)",
			expected: Index{
				IndexName: "idx_geo",
				TableName: "locations",
				Columns:   []IndexColumn{{Name: "geom"}},
				Method:    "GIST",
			},
		},
		{
			name:  "BRIN 索引",
			input: "CREATE INDEX idx_time_brin ON logs USING BRIN (created_at)",
			expected: Index{
				IndexName: "idx_time_brin",
				TableName: "logs",
				Columns:   []IndexColumn{{Name: "created_at"}},
				Method:    "BRIN",
			},
		},
		{
			name:  "HASH 索引",
			input: "CREATE INDEX idx_hash ON records USING HASH (id)",
			expected: Index{
				IndexName: "idx_hash",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "id"}},
				Method:    "HASH",
			},
		},
		{
			name:  "唯一 GIN 索引 (理论上)",
			input: "CREATE UNIQUE INDEX idx_unique_gin ON records USING GIN (data)",
			expected: Index{
				IndexName: "idx_unique_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Unique:    true,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := ParseIndex(tc.input)

			if result.IndexName != tc.expected.IndexName {
				t.Errorf("IndexName: expected %q, got %q", tc.expected.IndexName, result.IndexName)
			}
			if result.TableName != tc.expected.TableName {
				t.Errorf("TableName: expected %q, got %q", tc.expected.TableName, result.TableName)
			}
			if result.Method != tc.expected.Method {
				t.Errorf("Method: expected %q, got %q", tc.expected.Method, result.Method)
			}
			if result.Unique != tc.expected.Unique {
				t.Errorf("Unique: expected %v, got %v", tc.expected.Unique, result.Unique)
			}
			if result.Where != tc.expected.Where {
				t.Errorf("Where: expected %q, got %q", tc.expected.Where, result.Where)
			}
			if len(result.Columns) != len(tc.expected.Columns) {
				t.Errorf("Columns length: expected %d, got %d", len(tc.expected.Columns), len(result.Columns))
			} else {
				for i, col := range tc.expected.Columns {
					if result.Columns[i].Name != col.Name {
						t.Errorf("Column[%d].Name: expected %q, got %q", i, col.Name, result.Columns[i].Name)
					}
					if result.Columns[i].OpClass != col.OpClass {
						t.Errorf("Column[%d].OpClass: expected %q, got %q", i, col.OpClass, result.Columns[i].OpClass)
					}
				}
			}
		})
	}
}

// TestBuildGINIndex 测试构建 GIN 索引 SQL
func TestBuildGINIndex(t *testing.T) {
	testCases := []struct {
		name     string
		index    Index
		expected string
	}{
		{
			name: "基本 GIN 索引 (SQLite 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
			},
			expected: "CREATE INDEX `idx_data_gin` ON `records` USING GIN (`data`)",
		},
		{
			name: "GIN 索引带操作符类 (SQLite 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data", OpClass: "jsonb_path_ops"}},
				Method:    "GIN",
			},
			expected: "CREATE INDEX `idx_data_gin` ON `records` USING GIN (`data` jsonb_path_ops)",
		},
		{
			name: "GIN 索引带 WHERE (SQLite 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Where:     "active = true",
			},
			expected: "CREATE INDEX `idx_data_gin` ON `records` USING GIN (`data`) WHERE active = true",
		},
		{
			name: "普通索引 (无 Method)",
			index: Index{
				IndexName: "idx_name",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "name"}},
			},
			expected: "CREATE INDEX `idx_name` ON `records` (`name`)",
		},
		{
			name: "唯一 GIN 索引 (SQLite 风格)",
			index: Index{
				IndexName: "idx_unique_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Unique:    true,
			},
			expected: "CREATE UNIQUE INDEX `idx_unique_gin` ON `records` USING GIN (`data`)",
		},
		{
			name: "IF NOT EXISTS GIN 索引 (SQLite 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Optional:  true,
			},
			expected: "CREATE INDEX IF NOT EXISTS `idx_data_gin` ON `records` USING GIN (`data`)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.index.Build()
			if result != tc.expected {
				t.Errorf("\nexpected: %s\ngot:      %s", tc.expected, result)
			}
		})
	}
}

// TestBuildGINIndexPG 测试构建 PostgreSQL 风格的 GIN 索引 SQL
func TestBuildGINIndexPG(t *testing.T) {
	testCases := []struct {
		name     string
		index    Index
		expected string
	}{
		{
			name: "基本 GIN 索引 (PostgreSQL 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
			},
			expected: `CREATE INDEX "idx_data_gin" ON "records" USING GIN ("data")`,
		},
		{
			name: "GIN 索引带操作符类 (PostgreSQL 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data", OpClass: "jsonb_path_ops"}},
				Method:    "GIN",
			},
			expected: `CREATE INDEX "idx_data_gin" ON "records" USING GIN ("data" jsonb_path_ops)`,
		},
		{
			name: "GIN 索引带 WHERE (PostgreSQL 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Where:     "active = true",
			},
			expected: `CREATE INDEX "idx_data_gin" ON "records" USING GIN ("data") WHERE active = true`,
		},
		{
			name: "唯一 GIN 索引 (PostgreSQL 风格)",
			index: Index{
				IndexName: "idx_unique_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Unique:    true,
			},
			expected: `CREATE UNIQUE INDEX "idx_unique_gin" ON "records" USING GIN ("data")`,
		},
		{
			name: "IF NOT EXISTS GIN 索引 (PostgreSQL 风格)",
			index: Index{
				IndexName: "idx_data_gin",
				TableName: "records",
				Columns:   []IndexColumn{{Name: "data"}},
				Method:    "GIN",
				Optional:  true,
			},
			expected: `CREATE INDEX IF NOT EXISTS "idx_data_gin" ON "records" USING GIN ("data")`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.index.BuildPG()
			if result != tc.expected {
				t.Errorf("\nexpected: %s\ngot:      %s", tc.expected, result)
			}
		})
	}
}

// TestAutoGINIndexForJSONB 测试自动为 JSONB 字段创建 GIN 索引
func TestAutoGINIndexForJSONB(t *testing.T) {
	testCases := []struct {
		name      string
		tableName string
		column    string
		opClass   string
		expected  string
	}{
		{
			name:      "默认 GIN 索引 (PostgreSQL 风格)",
			tableName: "records",
			column:    "data",
			opClass:   "",
			expected:  `CREATE INDEX IF NOT EXISTS "idx_records_data_gin" ON "records" USING GIN ("data")`,
		},
		{
			name:      "带 jsonb_path_ops (PostgreSQL 风格)",
			tableName: "records",
			column:    "metadata",
			opClass:   "jsonb_path_ops",
			expected:  `CREATE INDEX IF NOT EXISTS "idx_records_metadata_gin" ON "records" USING GIN ("metadata" jsonb_path_ops)`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := BuildGINIndex(tc.tableName, tc.column, tc.opClass)
			if result != tc.expected {
				t.Errorf("\nexpected: %s\ngot:      %s", tc.expected, result)
			}
		})
	}
}

// TestIsGINIndex 测试判断是否为 GIN 索引
func TestIsGINIndex(t *testing.T) {
	testCases := []struct {
		input    string
		expected bool
	}{
		{"CREATE INDEX idx_gin ON t USING GIN (data)", true},
		{"CREATE INDEX idx_gin ON t USING gin (data)", true},
		{"CREATE INDEX idx_btree ON t (name)", false},
		{"CREATE INDEX idx_btree ON t USING BTREE (name)", false},
		{"CREATE INDEX idx_gist ON t USING GIST (geom)", false},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			idx := ParseIndex(tc.input)
			result := idx.IsGIN()
			if result != tc.expected {
				t.Errorf("IsGIN(): expected %v, got %v", tc.expected, result)
			}
		})
	}
}

// TestGINIndexOperatorClasses 测试 GIN 索引操作符类
func TestGINIndexOperatorClasses(t *testing.T) {
	// PostgreSQL JSONB GIN 操作符类:
	// - jsonb_ops (默认): 支持 @>, ?, ?|, ?&, @?, @@
	// - jsonb_path_ops: 仅支持 @>, 但更小更快

	testCases := []struct {
		name     string
		input    string
		opClass  string
		supports []string
	}{
		{
			name:     "jsonb_ops (默认)",
			input:    "CREATE INDEX idx ON t USING GIN (data)",
			opClass:  "",
			supports: []string{"@>", "?", "?|", "?&"},
		},
		{
			name:     "jsonb_path_ops",
			input:    "CREATE INDEX idx ON t USING GIN (data jsonb_path_ops)",
			opClass:  "jsonb_path_ops",
			supports: []string{"@>"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			idx := ParseIndex(tc.input)
			if len(idx.Columns) > 0 && idx.Columns[0].OpClass != tc.opClass {
				t.Errorf("OpClass: expected %q, got %q", tc.opClass, idx.Columns[0].OpClass)
			}
		})
	}
}

// TestBuildGINIndexSQL 测试生成 GIN 索引 SQL 的辅助函数
func TestBuildGINIndexSQL(t *testing.T) {
	// 测试 BuildGINIndexSQL 函数
	sql := BuildGINIndexSQL("users", "profile", GINOpClassDefault)
	if !strings.Contains(sql, "USING GIN") {
		t.Error("SQL should contain 'USING GIN'")
	}
	if !strings.Contains(sql, "profile") {
		t.Error("SQL should contain column name 'profile'")
	}

	// 测试带 jsonb_path_ops
	sql = BuildGINIndexSQL("users", "profile", GINOpClassPathOps)
	if !strings.Contains(sql, "jsonb_path_ops") {
		t.Error("SQL should contain 'jsonb_path_ops'")
	}
}
