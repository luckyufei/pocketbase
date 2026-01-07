// Package core 提供 PocketBase 核心功能
package core

import (
	"strings"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// ShouldCreateGINIndex 判断字段是否应该创建 GIN 索引
// 返回 true 如果字段类型是 JSON/JSONB 且适合 GIN 索引
// 适用于: JSONField, 多选 SelectField, 多选 RelationField, 多选 FileField
func ShouldCreateGINIndex(field Field) bool {
	switch f := field.(type) {
	case *JSONField:
		// JSON 字段总是需要 GIN 索引
		return true
	case *SelectField:
		// 多选 Select 存储为 JSON 数组
		return f.IsMultiple()
	case *RelationField:
		// 多选 Relation 存储为 JSON 数组
		return f.IsMultiple()
	case *FileField:
		// 多选 File 存储为 JSON 数组
		return f.IsMultiple()
	default:
		return false
	}
}

// GetJSONBFieldsForCollection 获取集合中所有需要 GIN 索引的字段名
// 返回字段名列表
func GetJSONBFieldsForCollection(collection *Collection) []string {
	var fields []string
	for _, field := range collection.Fields {
		if ShouldCreateGINIndex(field) {
			fields = append(fields, field.GetName())
		}
	}
	return fields
}

// BuildGINIndexesForCollection 为集合构建所有需要的 GIN 索引 SQL
// 返回 CREATE INDEX 语句列表
func BuildGINIndexesForCollection(collection *Collection) []string {
	jsonbFields := GetJSONBFieldsForCollection(collection)
	return dbutils.GetGINIndexesForCollection(collection.Name, jsonbFields)
}

// CollectionHasGINIndexForField 检查集合是否已有指定字段的 GIN 索引
func CollectionHasGINIndexForField(collection *Collection, fieldName string) bool {
	for _, idx := range collection.Indexes {
		parsed := dbutils.ParseIndex(idx)
		if !parsed.IsGIN() {
			continue
		}
		// 检查索引是否包含该字段
		for _, col := range parsed.Columns {
			if strings.EqualFold(col.Name, fieldName) {
				return true
			}
		}
	}
	return false
}

// GetMissingGINIndexes 获取集合中缺失的 GIN 索引
// 返回需要创建的 CREATE INDEX 语句列表
func GetMissingGINIndexes(collection *Collection) []string {
	var missing []string

	jsonbFields := GetJSONBFieldsForCollection(collection)
	for _, fieldName := range jsonbFields {
		if !CollectionHasGINIndexForField(collection, fieldName) {
			missing = append(missing, dbutils.BuildGINIndex(collection.Name, fieldName, ""))
		}
	}

	return missing
}

// CreateGINIndexesForCollection 为集合创建所有缺失的 GIN 索引
// 仅在 PostgreSQL 数据库上执行
// 返回创建的索引数量和可能的错误
func CreateGINIndexesForCollection(app App, collection *Collection) (int, error) {
	// 只在 PostgreSQL 上创建 GIN 索引
	if !app.IsPostgres() {
		return 0, nil
	}

	// 视图不需要索引
	if collection.IsView() {
		return 0, nil
	}

	missing := GetMissingGINIndexes(collection)
	if len(missing) == 0 {
		return 0, nil
	}

	var created int
	err := app.RunInTransaction(func(txApp App) error {
		for _, indexSQL := range missing {
			if _, err := txApp.DB().NewQuery(indexSQL).Execute(); err != nil {
				// 忽略已存在的索引错误 (IF NOT EXISTS 应该处理这种情况)
				// 但某些情况下可能仍然报错，记录日志但继续
				app.Logger().Warn("创建 GIN 索引失败",
					"sql", indexSQL,
					"error", err.Error(),
				)
				continue
			}
			created++
		}
		return nil
	})

	return created, err
}

// EnsureGINIndexes 确保集合有所有必要的 GIN 索引
// 这是一个便捷方法，可以在集合创建/更新后调用
func EnsureGINIndexes(app App, collection *Collection) error {
	_, err := CreateGINIndexesForCollection(app, collection)
	return err
}
