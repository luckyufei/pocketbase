// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// DBAdapter 定义数据库适配器接口
// 该接口抽象了不同数据库（SQLite、PostgreSQL）的差异
type DBAdapter interface {
	// Type 返回数据库类型
	Type() dbutils.DBType

	// Connect 建立数据库连接
	Connect(ctx context.Context, config DBConfig) (*dbx.DB, error)

	// Close 关闭数据库连接
	Close() error

	// Ping 检查数据库连接是否正常
	Ping(ctx context.Context) error

	// TableColumns 返回表的所有列名
	TableColumns(tableName string) ([]string, error)

	// TableInfo 返回表的详细信息
	TableInfo(tableName string) ([]*AdapterTableInfoRow, error)

	// TableIndexes 返回表的索引信息
	// 返回 map[索引名]索引SQL
	TableIndexes(tableName string) (map[string]string, error)

	// HasTable 检查表是否存在
	HasTable(tableName string) (bool, error)

	// Vacuum 执行数据库清理操作
	// SQLite: VACUUM
	// PostgreSQL: VACUUM ANALYZE
	Vacuum() error

	// BoolValue 将数据库值转换为 Go bool
	// SQLite: 0/1 -> false/true
	// PostgreSQL: false/true -> false/true
	BoolValue(val any) bool

	// FormatBool 将 Go bool 格式化为数据库值
	// SQLite: bool -> 0/1
	// PostgreSQL: bool -> bool
	FormatBool(val bool) any

	// TimeValue 将数据库值转换为 Go time.Time
	TimeValue(val any) (time.Time, error)

	// FormatTime 将 Go time.Time 格式化为数据库字符串
	FormatTime(val time.Time) string

	// JSONFunctions 返回 JSON 函数适配器
	JSONFunctions() *dbutils.JSONFunctions

	// NoCaseCollation 返回大小写不敏感排序规则
	// SQLite: COLLATE NOCASE
	// PostgreSQL: COLLATE "nocase"
	NoCaseCollation() string

	// IsUniqueViolation 检查错误是否为唯一约束违反
	IsUniqueViolation(err error) bool

	// IsForeignKeyViolation 检查错误是否为外键约束违反
	IsForeignKeyViolation(err error) bool
}

// DBConfig 定义数据库连接配置
type DBConfig struct {
	// DSN 数据库连接字符串
	// SQLite: 文件路径或 :memory:
	// PostgreSQL: postgres://user:pass@host:port/dbname?sslmode=disable
	DSN string

	// MaxOpenConns 最大打开连接数
	// SQLite 默认: 1 (单连接模式)
	// PostgreSQL 默认: 25
	MaxOpenConns int

	// MaxIdleConns 最大空闲连接数
	// SQLite 默认: 1
	// PostgreSQL 默认: 5
	MaxIdleConns int

	// ConnMaxLifetime 连接最大生命周期
	// 默认: 5 分钟
	ConnMaxLifetime time.Duration

	// ConnMaxIdleTime 连接最大空闲时间
	// 默认: 5 分钟
	ConnMaxIdleTime time.Duration

	// QueryTimeout 查询超时时间
	// 默认: 30 秒
	QueryTimeout time.Duration

	// Pragmas SQLite 特有的 PRAGMA 设置
	// 仅对 SQLite 有效
	Pragmas map[string]string

	// RuntimeParams PostgreSQL 运行时参数
	// 仅对 PostgreSQL 有效
	RuntimeParams map[string]string
}

// AdapterTableInfoRow 表示适配器返回的表结构信息
// 与 core.TableInfoRow 兼容，用于适配器内部使用
type AdapterTableInfoRow struct {
	// CID 列 ID (SQLite) 或序号 (PostgreSQL)
	CID int

	// Name 列名
	Name string

	// Type 列类型
	Type string

	// NotNull 是否非空
	NotNull bool

	// DefaultVal 默认值
	DefaultVal any

	// PK 主键标记
	// SQLite: 1 表示主键
	// PostgreSQL: 主键序号
	PK int
}

// DefaultDBConfig 返回默认的数据库配置
// 根据 DSN 自动检测数据库类型并设置合适的默认值
func DefaultDBConfig(dsn string) DBConfig {
	config := DBConfig{
		DSN:             dsn,
		ConnMaxLifetime: 5 * time.Minute,
		ConnMaxIdleTime: 5 * time.Minute,
		QueryTimeout:    30 * time.Second,
	}

	// 根据 DSN 类型设置不同的默认值
	if isPostgresDSN(dsn) {
		// PostgreSQL 支持并发连接
		config.MaxOpenConns = 25
		config.MaxIdleConns = 5
		config.RuntimeParams = map[string]string{
			"timezone":         "UTC",
			"application_name": "pocketbase",
		}
	} else {
		// SQLite 单连接模式
		config.MaxOpenConns = 1
		config.MaxIdleConns = 1
		config.Pragmas = map[string]string{
			"journal_mode": "WAL",
			"busy_timeout": "10000",
			"synchronous":  "NORMAL",
			"cache_size":   "-64000",
			"foreign_keys": "ON",
		}
	}

	return config
}

// DetectAdapterType 根据 DSN 检测数据库类型
func DetectAdapterType(dsn string) dbutils.DBType {
	if isPostgresDSN(dsn) {
		return dbutils.DBTypePostgres
	}
	return dbutils.DBTypeSQLite
}

// NewDBAdapter 根据 DSN 创建对应的数据库适配器
func NewDBAdapter(dsn string) DBAdapter {
	if isPostgresDSN(dsn) {
		return NewPostgresAdapter()
	}
	return NewSQLiteAdapter()
}

// isPostgresDSN 检查 DSN 是否为 PostgreSQL 格式
func isPostgresDSN(dsn string) bool {
	dsn = strings.ToLower(dsn)
	return strings.HasPrefix(dsn, "postgres://") ||
		strings.HasPrefix(dsn, "postgresql://") ||
		strings.Contains(dsn, "host=") ||
		strings.Contains(dsn, "dbname=")
}
