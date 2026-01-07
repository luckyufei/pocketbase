//go:build !no_default_driver

// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/dbutils"
	"github.com/spf13/cast"
)

// SQLiteAdapter 实现 SQLite 数据库适配器
type SQLiteAdapter struct {
	db        *dbx.DB
	config    DBConfig
	jsonFuncs *dbutils.JSONFunctions
}

// NewSQLiteAdapter 创建新的 SQLite 适配器
func NewSQLiteAdapter() *SQLiteAdapter {
	return &SQLiteAdapter{
		jsonFuncs: dbutils.NewJSONFunctions(dbutils.DBTypeSQLite),
	}
}

// Type 返回数据库类型
func (a *SQLiteAdapter) Type() dbutils.DBType {
	return dbutils.DBTypeSQLite
}

// Connect 建立 SQLite 数据库连接
func (a *SQLiteAdapter) Connect(ctx context.Context, config DBConfig) (*dbx.DB, error) {
	a.config = config

	// 构建 DSN
	dsn := config.DSN
	if !strings.Contains(dsn, "?") {
		dsn += "?"
	}

	// 添加默认参数
	if !strings.Contains(dsn, "_pragma") {
		// 使用 modernc.org/sqlite 的参数格式
		params := []string{}

		// 设置 PRAGMA
		pragmas := config.Pragmas
		if pragmas == nil {
			pragmas = map[string]string{
				"journal_mode": "WAL",
				"busy_timeout": "10000",
				"synchronous":  "NORMAL",
				"cache_size":   "-64000",
				"foreign_keys": "ON",
			}
		}

		for key, val := range pragmas {
			params = append(params, fmt.Sprintf("_pragma=%s(%s)", key, val))
		}

		if len(params) > 0 {
			dsn += strings.Join(params, "&")
		}
	}

	// 打开数据库连接
	db, err := dbx.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 连接失败: %w", err)
	}

	// 配置连接池
	sqlDB := db.DB()

	// SQLite 使用单连接模式以避免并发写入问题
	maxOpen := config.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 1
	}
	sqlDB.SetMaxOpenConns(maxOpen)

	maxIdle := config.MaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 1
	}
	sqlDB.SetMaxIdleConns(maxIdle)

	if config.ConnMaxLifetime > 0 {
		sqlDB.SetConnMaxLifetime(config.ConnMaxLifetime)
	}

	if config.ConnMaxIdleTime > 0 {
		sqlDB.SetConnMaxIdleTime(config.ConnMaxIdleTime)
	}

	// 验证连接
	if err := sqlDB.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("SQLite 连接验证失败: %w", err)
	}

	a.db = db
	return db, nil
}

// Close 关闭数据库连接
func (a *SQLiteAdapter) Close() error {
	if a.db != nil {
		return a.db.Close()
	}
	return nil
}

// Ping 检查数据库连接
func (a *SQLiteAdapter) Ping(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("数据库未连接")
	}
	return a.db.DB().PingContext(ctx)
}

// TableColumns 返回表的所有列名
func (a *SQLiteAdapter) TableColumns(tableName string) ([]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	var columns []string
	err := a.db.NewQuery(fmt.Sprintf("SELECT name FROM pragma_table_info('%s') ORDER BY cid", tableName)).
		Column(&columns)

	return columns, err
}

// TableInfo 返回表的详细信息
func (a *SQLiteAdapter) TableInfo(tableName string) ([]*AdapterTableInfoRow, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	var rows []struct {
		CID        int    `db:"cid"`
		Name       string `db:"name"`
		Type       string `db:"type"`
		NotNull    int    `db:"notnull"`
		DefaultVal any    `db:"dflt_value"`
		PK         int    `db:"pk"`
	}

	err := a.db.NewQuery(fmt.Sprintf("PRAGMA table_info('%s')", tableName)).All(&rows)
	if err != nil {
		return nil, err
	}

	result := make([]*AdapterTableInfoRow, len(rows))
	for i, row := range rows {
		result[i] = &AdapterTableInfoRow{
			CID:        row.CID,
			Name:       row.Name,
			Type:       row.Type,
			NotNull:    row.NotNull != 0,
			DefaultVal: row.DefaultVal,
			PK:         row.PK,
		}
	}

	return result, nil
}

// TableIndexes 返回表的索引信息
func (a *SQLiteAdapter) TableIndexes(tableName string) (map[string]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	var indexes []struct {
		Name string `db:"name"`
		SQL  string `db:"sql"`
	}

	err := a.db.NewQuery(`
		SELECT name, sql 
		FROM sqlite_master 
		WHERE type = 'index' 
		AND tbl_name = {:tableName}
		AND sql IS NOT NULL
	`).Bind(dbx.Params{"tableName": tableName}).All(&indexes)

	if err != nil {
		return nil, err
	}

	result := make(map[string]string, len(indexes))
	for _, idx := range indexes {
		result[idx.Name] = idx.SQL
	}

	return result, nil
}

// HasTable 检查表是否存在
func (a *SQLiteAdapter) HasTable(tableName string) (bool, error) {
	if a.db == nil {
		return false, fmt.Errorf("数据库未连接")
	}

	var count int
	err := a.db.NewQuery(`
		SELECT COUNT(*) 
		FROM sqlite_master 
		WHERE type = 'table' 
		AND name = {:tableName}
	`).Bind(dbx.Params{"tableName": tableName}).Row(&count)

	return count > 0, err
}

// Vacuum 执行 SQLite VACUUM
func (a *SQLiteAdapter) Vacuum() error {
	if a.db == nil {
		return fmt.Errorf("数据库未连接")
	}

	_, err := a.db.NewQuery("VACUUM").Execute()
	return err
}

// BoolValue 将数据库值转换为 Go bool
// SQLite 使用 0/1 表示布尔值
func (a *SQLiteAdapter) BoolValue(val any) bool {
	if val == nil {
		return false
	}

	switch v := val.(type) {
	case bool:
		return v
	case int, int8, int16, int32, int64:
		return cast.ToInt64(v) != 0
	case uint, uint8, uint16, uint32, uint64:
		return cast.ToUint64(v) != 0
	case float32, float64:
		return cast.ToFloat64(v) != 0
	case string:
		s := strings.ToLower(v)
		return s == "1" || s == "true" || s == "yes" || s == "on"
	case []byte:
		s := strings.ToLower(string(v))
		return s == "1" || s == "true" || s == "yes" || s == "on"
	default:
		return false
	}
}

// FormatBool 将 Go bool 格式化为 SQLite 值
// SQLite 使用 0/1 表示布尔值
func (a *SQLiteAdapter) FormatBool(val bool) any {
	if val {
		return 1
	}
	return 0
}

// TimeValue 将数据库值转换为 Go time.Time
func (a *SQLiteAdapter) TimeValue(val any) (time.Time, error) {
	if val == nil {
		return time.Time{}, fmt.Errorf("值为 nil")
	}

	switch v := val.(type) {
	case time.Time:
		return v, nil
	case string:
		if v == "" {
			return time.Time{}, fmt.Errorf("空字符串")
		}
		return parseTimeString(v)
	case []byte:
		if len(v) == 0 {
			return time.Time{}, fmt.Errorf("空字节数组")
		}
		return parseTimeString(string(v))
	default:
		return time.Time{}, fmt.Errorf("不支持的类型: %T", val)
	}
}

// parseTimeString 解析时间字符串
func parseTimeString(s string) (time.Time, error) {
	// 尝试多种格式
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999Z",
		"2006-01-02 15:04:05.000Z",
		"2006-01-02 15:04:05Z",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, s); err == nil {
			return t.UTC(), nil
		}
	}

	return time.Time{}, fmt.Errorf("无法解析时间字符串: %s", s)
}

// FormatTime 将 Go time.Time 格式化为 SQLite 字符串
func (a *SQLiteAdapter) FormatTime(val time.Time) string {
	return val.UTC().Format("2006-01-02 15:04:05.000Z")
}

// JSONFunctions 返回 JSON 函数适配器
func (a *SQLiteAdapter) JSONFunctions() *dbutils.JSONFunctions {
	return a.jsonFuncs
}

// NoCaseCollation 返回大小写不敏感排序规则
func (a *SQLiteAdapter) NoCaseCollation() string {
	return "COLLATE NOCASE"
}

// IsUniqueViolation 检查错误是否为唯一约束违反
func (a *SQLiteAdapter) IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "unique constraint") ||
		strings.Contains(errStr, "unique_constraint") ||
		strings.Contains(errStr, "unique constraint failed") ||
		strings.Contains(errStr, "sqlite_constraint_unique")
}

// IsForeignKeyViolation 检查错误是否为外键约束违反
func (a *SQLiteAdapter) IsForeignKeyViolation(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "foreign key constraint") ||
		strings.Contains(errStr, "foreign_key_constraint") ||
		strings.Contains(errStr, "sqlite_constraint_foreignkey")
}

// DB 返回底层数据库连接
func (a *SQLiteAdapter) DB() *dbx.DB {
	return a.db
}

// Config 返回当前配置
func (a *SQLiteAdapter) Config() DBConfig {
	return a.config
}

// ExecPragma 执行 PRAGMA 语句
func (a *SQLiteAdapter) ExecPragma(pragma string, value string) error {
	if a.db == nil {
		return fmt.Errorf("数据库未连接")
	}

	_, err := a.db.NewQuery(fmt.Sprintf("PRAGMA %s = %s", pragma, value)).Execute()
	return err
}

// GetPragma 获取 PRAGMA 值
func (a *SQLiteAdapter) GetPragma(pragma string) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("数据库未连接")
	}

	var value string
	err := a.db.NewQuery(fmt.Sprintf("PRAGMA %s", pragma)).Row(&value)
	return value, err
}

// BeginTx 开始事务
func (a *SQLiteAdapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*dbx.Tx, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	return a.db.BeginTx(ctx, opts)
}
