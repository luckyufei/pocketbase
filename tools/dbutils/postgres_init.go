package dbutils

import (
	"github.com/pocketbase/dbx"
)

// PostgresInitSQL 返回 PostgreSQL 初始化 SQL
// 包含辅助函数和扩展
func PostgresInitSQL() string {
	return CreatePGHelperFunctions() + `

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建 CITEXT 扩展用于大小写不敏感比较
CREATE EXTENSION IF NOT EXISTS "citext";
`
}

// InitPostgresHelpers 初始化 PostgreSQL 辅助函数
// 应在数据库连接后、迁移前调用
func InitPostgresHelpers(db dbx.Builder) error {
	// 检查是否为 PostgreSQL
	dbType := DetectDBTypeFromBuilder(db)
	if !dbType.IsPostgres() {
		return nil // 非 PostgreSQL，跳过
	}

	// 执行初始化 SQL
	_, err := db.NewQuery(PostgresInitSQL()).Execute()
	return err
}

// PostgresCollectionsTableSQL 返回 PostgreSQL 版本的 _collections 表创建 SQL
func PostgresCollectionsTableSQL() string {
	return `
		CREATE TABLE IF NOT EXISTS "_collections" (
			"id"         TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
			"system"     BOOLEAN DEFAULT FALSE NOT NULL,
			"type"       TEXT DEFAULT 'base' NOT NULL,
			"name"       TEXT UNIQUE NOT NULL,
			"fields"     JSONB DEFAULT '[]'::jsonb NOT NULL,
			"indexes"    JSONB DEFAULT '[]'::jsonb NOT NULL,
			"listRule"   TEXT DEFAULT NULL,
			"viewRule"   TEXT DEFAULT NULL,
			"createRule" TEXT DEFAULT NULL,
			"updateRule" TEXT DEFAULT NULL,
			"deleteRule" TEXT DEFAULT NULL,
			"options"    JSONB DEFAULT '{}'::jsonb NOT NULL,
			"created"    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
			"updated"    TIMESTAMPTZ DEFAULT NOW() NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx__collections_type ON "_collections" ("type");
	`
}

// PostgresParamsTableSQL 返回 PostgreSQL 版本的 _params 表创建 SQL
func PostgresParamsTableSQL() string {
	return `
		CREATE TABLE IF NOT EXISTS "_params" (
			"id"      TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
			"value"   JSONB DEFAULT NULL,
			"created" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
			"updated" TIMESTAMPTZ DEFAULT NOW() NOT NULL
		);
	`
}

// GeneratePostgresRecordTableSQL 生成 PostgreSQL 版本的记录表创建 SQL
func GeneratePostgresRecordTableSQL(tableName string, fields []FieldDef) string {
	sql := `CREATE TABLE IF NOT EXISTS "` + tableName + `" (`
	sql += `"id" TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL`

	for _, field := range fields {
		sql += `, "` + field.Name + `" ` + field.PostgresType
		if field.NotNull {
			sql += " NOT NULL"
		}
		if field.Default != "" {
			sql += " DEFAULT " + field.Default
		}
	}

	sql += ");"
	return sql
}

// FieldDef 定义字段结构
type FieldDef struct {
	Name         string
	SQLiteType   string
	PostgresType string
	NotNull      bool
	Default      string
}

// TypeMapping 提供 SQLite 到 PostgreSQL 的类型映射
var TypeMapping = map[string]string{
	"TEXT":     "TEXT",
	"INTEGER":  "INTEGER",
	"REAL":     "DOUBLE PRECISION",
	"BLOB":     "BYTEA",
	"BOOLEAN":  "BOOLEAN",
	"JSON":     "JSONB",
	"DATETIME": "TIMESTAMPTZ",
}

// ConvertSQLiteTypeToPostgres 将 SQLite 类型转换为 PostgreSQL 类型
func ConvertSQLiteTypeToPostgres(sqliteType string) string {
	if pgType, ok := TypeMapping[sqliteType]; ok {
		return pgType
	}
	return sqliteType
}
