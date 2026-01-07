// Package dbutils 提供数据库工具函数
package dbutils

import (
	"fmt"
	"strings"
)

// JSONFunctions 提供统一的 JSON 函数接口
type JSONFunctions struct {
	dbType DBType
}

// NewJSONFunctions 创建新的 JSON 函数实例
func NewJSONFunctions(dbType DBType) *JSONFunctions {
	return &JSONFunctions{dbType: dbType}
}

// Each 返回 JSON 数组展开表达式
func (j *JSONFunctions) Each(column string) string {
	if j.dbType.IsPostgres() {
		return JSONEachPG(column)
	}
	return JSONEach(column)
}

// ArrayLength 返回 JSON 数组长度表达式
func (j *JSONFunctions) ArrayLength(column string) string {
	if j.dbType.IsPostgres() {
		return JSONArrayLengthPG(column)
	}
	return JSONArrayLength(column)
}

// Extract 返回 JSON 提取表达式
func (j *JSONFunctions) Extract(column string, path string) string {
	if j.dbType.IsPostgres() {
		return JSONExtractPG(column, path)
	}
	return JSONExtract(column, path)
}

// ExtractText 返回 JSON 提取文本表达式 (仅 PostgreSQL)
func (j *JSONFunctions) ExtractText(column string, path string) string {
	if j.dbType.IsPostgres() {
		return JSONExtractTextPG(column, path)
	}
	// SQLite 的 JSON_EXTRACT 已经返回文本
	return JSONExtract(column, path)
}

// Contains 返回 JSON 包含检查表达式
func (j *JSONFunctions) Contains(column string, value string) string {
	if j.dbType.IsPostgres() {
		return JSONContainsPG(column, value)
	}
	// SQLite 没有直接的包含操作，使用 json_each + EXISTS
	return fmt.Sprintf(
		"EXISTS (SELECT 1 FROM %s WHERE value = %s)",
		JSONEach(column),
		value,
	)
}

// Exists 返回 JSON 键存在检查表达式
func (j *JSONFunctions) Exists(column string, key string) string {
	if j.dbType.IsPostgres() {
		return JSONExistsPG(column, key)
	}
	// SQLite 使用 json_extract 检查
	return fmt.Sprintf("JSON_EXTRACT([[%s]], '$.%s') IS NOT NULL", column, key)
}

// Type 返回 JSON 类型检查表达式
func (j *JSONFunctions) Type(column string) string {
	if j.dbType.IsPostgres() {
		return JSONTypePG(column)
	}
	return fmt.Sprintf("json_type([[%s]])", column)
}

// Valid 返回 JSON 有效性检查表达式
func (j *JSONFunctions) Valid(column string) string {
	if j.dbType.IsPostgres() {
		return JSONValidPG(column)
	}
	return fmt.Sprintf("json_valid([[%s]])", column)
}

// BuildObject 返回构建 JSON 对象的表达式
func (j *JSONFunctions) BuildObject(pairs ...string) string {
	if len(pairs)%2 != 0 {
		return "'{}'"
	}

	if j.dbType.IsPostgres() {
		return fmt.Sprintf("jsonb_build_object(%s)", strings.Join(pairs, ", "))
	}
	return fmt.Sprintf("json_object(%s)", strings.Join(pairs, ", "))
}

// BuildArray 返回构建 JSON 数组的表达式
func (j *JSONFunctions) BuildArray(elements ...string) string {
	if j.dbType.IsPostgres() {
		return fmt.Sprintf("jsonb_build_array(%s)", strings.Join(elements, ", "))
	}
	return fmt.Sprintf("json_array(%s)", strings.Join(elements, ", "))
}

// Agg 返回 JSON 聚合表达式
func (j *JSONFunctions) Agg(column string) string {
	if j.dbType.IsPostgres() {
		return fmt.Sprintf("jsonb_agg([[%s]])", column)
	}
	return fmt.Sprintf("json_group_array([[%s]])", column)
}

// ObjectAgg 返回 JSON 对象聚合表达式
func (j *JSONFunctions) ObjectAgg(keyColumn, valueColumn string) string {
	if j.dbType.IsPostgres() {
		return fmt.Sprintf("jsonb_object_agg([[%s]], [[%s]])", keyColumn, valueColumn)
	}
	return fmt.Sprintf("json_group_object([[%s]], [[%s]])", keyColumn, valueColumn)
}

// Cast 返回将值转换为 JSON 的表达式
func (j *JSONFunctions) Cast(value string) string {
	if j.dbType.IsPostgres() {
		return fmt.Sprintf("(%s)::jsonb", value)
	}
	return fmt.Sprintf("json(%s)", value)
}

// DBType 返回当前数据库类型
func (j *JSONFunctions) DBType() DBType {
	return j.dbType
}
