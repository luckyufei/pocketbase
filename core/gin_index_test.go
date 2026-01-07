package core

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestShouldCreateGINIndex 测试判断字段是否需要 GIN 索引
func TestShouldCreateGINIndex(t *testing.T) {
	testCases := []struct {
		name     string
		field    Field
		expected bool
	}{
		{
			name:     "JSONField 需要 GIN 索引",
			field:    &JSONField{Name: "data"},
			expected: true,
		},
		{
			name:     "多选 SelectField 需要 GIN 索引",
			field:    &SelectField{Name: "tags", MaxSelect: 5},
			expected: true,
		},
		{
			name:     "单选 SelectField 不需要 GIN 索引",
			field:    &SelectField{Name: "status", MaxSelect: 1},
			expected: false,
		},
		{
			name:     "多选 RelationField 需要 GIN 索引",
			field:    &RelationField{Name: "categories", MaxSelect: 10},
			expected: true,
		},
		{
			name:     "单选 RelationField 不需要 GIN 索引",
			field:    &RelationField{Name: "author", MaxSelect: 1},
			expected: false,
		},
		{
			name:     "多选 FileField 需要 GIN 索引",
			field:    &FileField{Name: "attachments", MaxSelect: 5},
			expected: true,
		},
		{
			name:     "单选 FileField 不需要 GIN 索引",
			field:    &FileField{Name: "avatar", MaxSelect: 1},
			expected: false,
		},
		{
			name:     "TextField 不需要 GIN 索引",
			field:    &TextField{Name: "title"},
			expected: false,
		},
		{
			name:     "NumberField 不需要 GIN 索引",
			field:    &NumberField{Name: "count"},
			expected: false,
		},
		{
			name:     "BoolField 不需要 GIN 索引",
			field:    &BoolField{Name: "active"},
			expected: false,
		},
		{
			name:     "DateField 不需要 GIN 索引",
			field:    &DateField{Name: "created"},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := ShouldCreateGINIndex(tc.field)
			if result != tc.expected {
				t.Errorf("ShouldCreateGINIndex(%s) = %v, 期望 %v", tc.field.GetName(), result, tc.expected)
			}
		})
	}
}

// TestGetJSONBFieldsForCollection 测试获取集合的 JSONB 字段列表
func TestGetJSONBFieldsForCollection(t *testing.T) {
	// 创建测试集合
	collection := NewBaseCollection("test_collection")

	// 添加各种字段
	collection.Fields = append(collection.Fields,
		&TextField{Name: "title", Id: "f1"},
		&JSONField{Name: "metadata", Id: "f2"},
		&SelectField{Name: "tags", MaxSelect: 5, Id: "f3"},
		&SelectField{Name: "status", MaxSelect: 1, Id: "f4"},
		&RelationField{Name: "categories", MaxSelect: 10, Id: "f5"},
		&RelationField{Name: "author", MaxSelect: 1, Id: "f6"},
		&FileField{Name: "attachments", MaxSelect: 5, Id: "f7"},
		&FileField{Name: "avatar", MaxSelect: 1, Id: "f8"},
		&NumberField{Name: "count", Id: "f9"},
	)

	jsonbFields := GetJSONBFieldsForCollection(collection)

	// 期望的 JSONB 字段: metadata, tags, categories, attachments
	expectedFields := []string{"metadata", "tags", "categories", "attachments"}

	if len(jsonbFields) != len(expectedFields) {
		t.Errorf("期望 %d 个 JSONB 字段, 实际 %d 个", len(expectedFields), len(jsonbFields))
	}

	for _, expected := range expectedFields {
		found := false
		for _, field := range jsonbFields {
			if field == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("期望字段 %s 在 JSONB 列表中", expected)
		}
	}
}

// TestBuildGINIndexesForCollection 测试为集合构建 GIN 索引 SQL
func TestBuildGINIndexesForCollection(t *testing.T) {
	collection := NewBaseCollection("posts")

	collection.Fields = append(collection.Fields,
		&TextField{Name: "title", Id: "f1"},
		&JSONField{Name: "metadata", Id: "f2"},
		&SelectField{Name: "tags", MaxSelect: 5, Id: "f3"},
	)

	indexes := BuildGINIndexesForCollection(collection)

	// 期望 2 个 GIN 索引: metadata, tags
	if len(indexes) != 2 {
		t.Errorf("期望 2 个 GIN 索引, 实际 %d 个", len(indexes))
	}

	// 检查索引 SQL
	for _, idx := range indexes {
		if !strings.Contains(idx, "USING GIN") {
			t.Errorf("索引应包含 'USING GIN': %s", idx)
		}
		if !strings.Contains(idx, "posts") {
			t.Errorf("索引应包含表名 'posts': %s", idx)
		}
	}
}

// TestGINIndexNaming 测试 GIN 索引命名规则
func TestGINIndexNaming(t *testing.T) {
	testCases := []struct {
		tableName  string
		columnName string
		expected   string
	}{
		{
			tableName:  "posts",
			columnName: "metadata",
			expected:   "idx_posts_metadata_gin",
		},
		{
			tableName:  "users",
			columnName: "profile",
			expected:   "idx_users_profile_gin",
		},
		{
			tableName:  "my_table",
			columnName: "json_data",
			expected:   "idx_my_table_json_data_gin",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.tableName+"_"+tc.columnName, func(t *testing.T) {
			sql := dbutils.BuildGINIndex(tc.tableName, tc.columnName, "")
			if !strings.Contains(sql, tc.expected) {
				t.Errorf("索引名应为 %s, SQL: %s", tc.expected, sql)
			}
		})
	}
}

// TestGINIndexWithOpClass 测试带操作符类的 GIN 索引
func TestGINIndexWithOpClass(t *testing.T) {
	testCases := []struct {
		name     string
		opClass  string
		expected string
	}{
		{
			name:     "默认操作符类",
			opClass:  "",
			expected: `USING GIN ("data")`, // PostgreSQL 使用双引号
		},
		{
			name:     "jsonb_path_ops",
			opClass:  dbutils.GINOpClassPathOps,
			expected: `USING GIN ("data" jsonb_path_ops)`, // PostgreSQL 使用双引号
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sql := dbutils.BuildGINIndex("test", "data", tc.opClass)
			if !strings.Contains(sql, tc.expected) {
				t.Errorf("期望包含 %q, 实际 SQL: %s", tc.expected, sql)
			}
		})
	}
}

// TestGINIndexIdempotent 测试 GIN 索引的幂等性 (IF NOT EXISTS)
func TestGINIndexIdempotent(t *testing.T) {
	sql := dbutils.BuildGINIndex("posts", "metadata", "")

	if !strings.Contains(sql, "IF NOT EXISTS") {
		t.Error("GIN 索引应包含 IF NOT EXISTS 以保证幂等性")
	}
}

// TestCollectionHasGINIndexForField 测试检查集合是否已有字段的 GIN 索引
func TestCollectionHasGINIndexForField(t *testing.T) {
	collection := NewBaseCollection("posts")
	collection.Indexes = []string{
		"CREATE INDEX idx_posts_title ON posts (title)",
		"CREATE INDEX IF NOT EXISTS idx_posts_metadata_gin ON posts USING GIN (metadata)",
	}

	testCases := []struct {
		fieldName string
		expected  bool
	}{
		{"metadata", true},
		{"tags", false},
		{"title", false}, // 有索引但不是 GIN
	}

	for _, tc := range testCases {
		t.Run(tc.fieldName, func(t *testing.T) {
			result := CollectionHasGINIndexForField(collection, tc.fieldName)
			if result != tc.expected {
				t.Errorf("CollectionHasGINIndexForField(%s) = %v, 期望 %v", tc.fieldName, result, tc.expected)
			}
		})
	}
}

// TestGetMissingGINIndexes 测试获取缺失的 GIN 索引
func TestGetMissingGINIndexes(t *testing.T) {
	collection := NewBaseCollection("posts")
	collection.Indexes = []string{
		"CREATE INDEX IF NOT EXISTS idx_posts_metadata_gin ON posts USING GIN (metadata)",
	}

	collection.Fields = append(collection.Fields,
		&JSONField{Name: "metadata", Id: "f1"},
		&JSONField{Name: "extra_data", Id: "f2"},
		&SelectField{Name: "tags", MaxSelect: 5, Id: "f3"},
	)

	missing := GetMissingGINIndexes(collection)

	// metadata 已有索引，应该只返回 extra_data 和 tags
	if len(missing) != 2 {
		t.Errorf("期望 2 个缺失索引, 实际 %d 个", len(missing))
	}

	// 检查缺失的是正确的字段
	hasExtraData := false
	hasTags := false
	for _, idx := range missing {
		if strings.Contains(idx, "extra_data") {
			hasExtraData = true
		}
		if strings.Contains(idx, "tags") {
			hasTags = true
		}
	}

	if !hasExtraData {
		t.Error("应该包含 extra_data 的 GIN 索引")
	}
	if !hasTags {
		t.Error("应该包含 tags 的 GIN 索引")
	}
}
