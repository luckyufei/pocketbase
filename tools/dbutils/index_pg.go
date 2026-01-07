package dbutils

import (
	"fmt"
	"strings"
)

// GIN 索引操作符类常量
const (
	GINOpClassDefault  = ""              // jsonb_ops (默认)
	GINOpClassPathOps  = "jsonb_path_ops" // 仅支持 @> 但更小更快
	GINOpClassTrgm     = "gin_trgm_ops"   // pg_trgm 扩展，用于 LIKE/ILIKE
)

// PostgreSQL 索引方法常量
const (
	IndexMethodBTREE = "BTREE"
	IndexMethodGIN   = "GIN"
	IndexMethodGIST  = "GIST"
	IndexMethodBRIN  = "BRIN"
	IndexMethodHASH  = "HASH"
)

// IsGIN 检查索引是否为 GIN 类型
func (idx Index) IsGIN() bool {
	return strings.EqualFold(idx.Method, IndexMethodGIN)
}

// IsGIST 检查索引是否为 GIST 类型
func (idx Index) IsGIST() bool {
	return strings.EqualFold(idx.Method, IndexMethodGIST)
}

// IsBRIN 检查索引是否为 BRIN 类型
func (idx Index) IsBRIN() bool {
	return strings.EqualFold(idx.Method, IndexMethodBRIN)
}

// BuildPG 返回 PostgreSQL 风格的 CREATE INDEX SQL (使用双引号)
func (idx Index) BuildPG() string {
	if !idx.IsValid() {
		return ""
	}

	var str strings.Builder

	str.WriteString("CREATE ")

	if idx.Unique {
		str.WriteString("UNIQUE ")
	}

	str.WriteString("INDEX ")

	if idx.Optional {
		str.WriteString("IF NOT EXISTS ")
	}

	if idx.SchemaName != "" {
		str.WriteString("\"")
		str.WriteString(idx.SchemaName)
		str.WriteString("\".")
	}

	str.WriteString("\"")
	str.WriteString(idx.IndexName)
	str.WriteString("\" ")

	str.WriteString("ON \"")
	str.WriteString(idx.TableName)
	str.WriteString("\" ")

	// PostgreSQL USING method (GIN, GIST, BRIN, HASH, BTREE)
	if idx.Method != "" {
		str.WriteString("USING ")
		str.WriteString(strings.ToUpper(idx.Method))
		str.WriteString(" ")
	}

	str.WriteString("(")

	if len(idx.Columns) > 1 {
		str.WriteString("\n  ")
	}

	var hasCol bool
	for _, col := range idx.Columns {
		trimmedColName := strings.TrimSpace(col.Name)
		if trimmedColName == "" {
			continue
		}

		if hasCol {
			str.WriteString(",\n  ")
		}

		if strings.Contains(col.Name, "(") || strings.Contains(col.Name, " ") {
			// most likely an expression
			str.WriteString(trimmedColName)
		} else {
			// regular identifier - PostgreSQL uses double quotes
			str.WriteString("\"")
			str.WriteString(trimmedColName)
			str.WriteString("\"")
		}

		// PostgreSQL operator class (e.g., jsonb_path_ops, gin_trgm_ops)
		if col.OpClass != "" {
			str.WriteString(" ")
			str.WriteString(col.OpClass)
		}

		if col.Collate != "" {
			str.WriteString(" COLLATE ")
			str.WriteString(col.Collate)
		}

		if col.Sort != "" {
			str.WriteString(" ")
			str.WriteString(strings.ToUpper(col.Sort))
		}

		hasCol = true
	}

	if hasCol && len(idx.Columns) > 1 {
		str.WriteString("\n")
	}

	str.WriteString(")")

	if idx.Where != "" {
		str.WriteString(" WHERE ")
		str.WriteString(idx.Where)
	}

	return str.String()
}

// BuildGINIndex 为 JSONB 字段构建 GIN 索引 SQL (PostgreSQL 风格)
// tableName: 表名
// column: JSONB 列名
// opClass: 操作符类 (可选，默认为 jsonb_ops)
func BuildGINIndex(tableName, column, opClass string) string {
	idx := Index{
		IndexName: fmt.Sprintf("idx_%s_%s_gin", tableName, column),
		TableName: tableName,
		Columns:   []IndexColumn{{Name: column, OpClass: opClass}},
		Method:    IndexMethodGIN,
		Optional:  true, // IF NOT EXISTS
	}
	return idx.BuildPG()
}

// BuildGINIndexSQL 为 JSONB 字段构建 GIN 索引 SQL (简化版)
func BuildGINIndexSQL(tableName, column, opClass string) string {
	return BuildGINIndex(tableName, column, opClass)
}

// BuildTextSearchIndex 为文本搜索构建 GIN 索引 (需要 pg_trgm 扩展)
func BuildTextSearchIndex(tableName, column string) string {
	idx := Index{
		IndexName: fmt.Sprintf("idx_%s_%s_trgm", tableName, column),
		TableName: tableName,
		Columns:   []IndexColumn{{Name: column, OpClass: GINOpClassTrgm}},
		Method:    IndexMethodGIN,
		Optional:  true,
	}
	return idx.BuildPG()
}

// BuildBRINIndex 为时间序列数据构建 BRIN 索引
func BuildBRINIndex(tableName, column string) string {
	idx := Index{
		IndexName: fmt.Sprintf("idx_%s_%s_brin", tableName, column),
		TableName: tableName,
		Columns:   []IndexColumn{{Name: column}},
		Method:    IndexMethodBRIN,
		Optional:  true,
	}
	return idx.BuildPG()
}

// ShouldCreateGINIndex 判断字段是否应该创建 GIN 索引
// 返回 true 如果字段类型是 JSON/JSONB 且适合 GIN 索引
func ShouldCreateGINIndex(fieldType string) bool {
	fieldType = strings.ToLower(fieldType)
	return fieldType == "json" || fieldType == "jsonb" ||
		strings.Contains(fieldType, "json") ||
		// PocketBase 的多值字段类型
		fieldType == "select" || fieldType == "file" || fieldType == "relation"
}

// GetGINIndexesForCollection 获取集合应该创建的 GIN 索引列表
// 返回需要创建的 GIN 索引 SQL 列表
func GetGINIndexesForCollection(tableName string, jsonbColumns []string) []string {
	var indexes []string
	for _, col := range jsonbColumns {
		indexes = append(indexes, BuildGINIndex(tableName, col, GINOpClassDefault))
	}
	return indexes
}

// ParseGINIndexFromSQL 从 SQL 中解析 GIN 索引信息
// 这是 ParseIndex 的包装，专门用于 GIN 索引
func ParseGINIndexFromSQL(sql string) (Index, bool) {
	idx := ParseIndex(sql)
	if idx.IsGIN() {
		return idx, true
	}
	return Index{}, false
}
