// Package dbutils 提供数据库工具函数
package dbutils

import (
	"database/sql"
	"strings"

	"github.com/pocketbase/dbx"
)

// DBType 表示数据库类型
type DBType int

const (
	// DBTypeSQLite 表示 SQLite 数据库
	DBTypeSQLite DBType = iota
	// DBTypePostgres 表示 PostgreSQL 数据库
	DBTypePostgres
	// DBTypeUnknown 表示未知数据库类型
	DBTypeUnknown
)

// String 返回数据库类型的字符串表示
func (t DBType) String() string {
	switch t {
	case DBTypeSQLite:
		return "sqlite"
	case DBTypePostgres:
		return "postgres"
	default:
		return "unknown"
	}
}

// IsSQLite 返回是否为 SQLite 数据库
func (t DBType) IsSQLite() bool {
	return t == DBTypeSQLite
}

// IsPostgres 返回是否为 PostgreSQL 数据库
func (t DBType) IsPostgres() bool {
	return t == DBTypePostgres
}

// DetectDBType 从 dbx.DB 实例检测数据库类型
func DetectDBType(db *dbx.DB) DBType {
	if db == nil {
		return DBTypeUnknown
	}

	// 获取底层 sql.DB 的驱动名称
	driverName := db.DriverName()
	return DetectDBTypeFromDriverName(driverName)
}

// DetectDBTypeFromBuilder 从 dbx.Builder 接口检测数据库类型
func DetectDBTypeFromBuilder(builder dbx.Builder) DBType {
	if builder == nil {
		return DBTypeUnknown
	}

	// 尝试类型断言获取 *dbx.DB
	if db, ok := builder.(*dbx.DB); ok {
		return DetectDBType(db)
	}

	// 对于 *dbx.Tx，我们无法直接获取驱动名称
	// 需要通过其他方式检测，例如执行特定查询
	return DBTypeUnknown
}

// DetectDBTypeFromDriverName 从驱动名称检测数据库类型
func DetectDBTypeFromDriverName(driverName string) DBType {
	driverName = strings.ToLower(driverName)

	switch {
	case strings.Contains(driverName, "sqlite"):
		return DBTypeSQLite
	case strings.Contains(driverName, "postgres"), strings.Contains(driverName, "pgx"):
		return DBTypePostgres
	default:
		return DBTypeUnknown
	}
}

// DetectDBTypeFromDB 从 sql.DB 实例检测数据库类型
// 通过执行特定查询来判断数据库类型
func DetectDBTypeFromDB(db *sql.DB) DBType {
	if db == nil {
		return DBTypeUnknown
	}

	// 尝试 SQLite 特有查询
	_, err := db.Exec("SELECT sqlite_version()")
	if err == nil {
		return DBTypeSQLite
	}

	// 尝试 PostgreSQL 特有查询
	_, err = db.Exec("SELECT version()")
	if err == nil {
		return DBTypePostgres
	}

	return DBTypeUnknown
}
