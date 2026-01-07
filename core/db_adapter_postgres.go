//go:build !no_default_driver

// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/dbutils"
	"github.com/spf13/cast"
)

// PostgreSQL 错误码常量
const (
	PGErrUniqueViolation     = "23505"
	PGErrForeignKeyViolation = "23503"
	PGErrNotNullViolation    = "23502"
	PGErrCheckViolation      = "23514"
)

// PostgresAdapter 实现 PostgreSQL 数据库适配器
type PostgresAdapter struct {
	db        *dbx.DB
	config    DBConfig
	jsonFuncs *dbutils.JSONFunctions
}

// NewPostgresAdapter 创建新的 PostgreSQL 适配器
func NewPostgresAdapter() *PostgresAdapter {
	return &PostgresAdapter{
		jsonFuncs: dbutils.NewJSONFunctions(dbutils.DBTypePostgres),
	}
}

// Type 返回数据库类型
func (a *PostgresAdapter) Type() dbutils.DBType {
	return dbutils.DBTypePostgres
}

// Connect 建立 PostgreSQL 数据库连接
func (a *PostgresAdapter) Connect(ctx context.Context, config DBConfig) (*dbx.DB, error) {
	a.config = config

	if config.DSN == "" {
		return nil, fmt.Errorf("PostgreSQL DSN 不能为空")
	}

	// 解析 pgx 配置
	pgxConfig, err := pgx.ParseConfig(config.DSN)
	if err != nil {
		return nil, fmt.Errorf("解析 PostgreSQL 配置失败: %w", err)
	}

	// 设置运行时参数
	if pgxConfig.RuntimeParams == nil {
		pgxConfig.RuntimeParams = make(map[string]string)
	}

	// 合并自定义运行时参数
	if config.RuntimeParams != nil {
		for k, v := range config.RuntimeParams {
			pgxConfig.RuntimeParams[k] = v
		}
	}

	// 设置默认参数
	if _, ok := pgxConfig.RuntimeParams["timezone"]; !ok {
		pgxConfig.RuntimeParams["timezone"] = "UTC"
	}
	if _, ok := pgxConfig.RuntimeParams["application_name"]; !ok {
		pgxConfig.RuntimeParams["application_name"] = "pocketbase"
	}

	// 注册 pgx 驱动并获取连接字符串
	connStr := stdlib.RegisterConnConfig(pgxConfig)

	// 打开数据库连接
	db, err := dbx.Open("pgx", connStr)
	if err != nil {
		return nil, fmt.Errorf("打开 PostgreSQL 连接失败: %w", err)
	}

	// 配置连接池
	sqlDB := db.DB()

	maxOpen := config.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 25
	}
	sqlDB.SetMaxOpenConns(maxOpen)

	maxIdle := config.MaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 5
	}
	sqlDB.SetMaxIdleConns(maxIdle)

	if config.ConnMaxLifetime > 0 {
		sqlDB.SetConnMaxLifetime(config.ConnMaxLifetime)
	} else {
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
	}

	if config.ConnMaxIdleTime > 0 {
		sqlDB.SetConnMaxIdleTime(config.ConnMaxIdleTime)
	} else {
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}

	// 验证连接
	if err := sqlDB.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("PostgreSQL 连接验证失败: %w", err)
	}

	a.db = db
	return db, nil
}

// Close 关闭数据库连接
func (a *PostgresAdapter) Close() error {
	if a.db != nil {
		return a.db.Close()
	}
	return nil
}

// Ping 检查数据库连接
func (a *PostgresAdapter) Ping(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("数据库未连接")
	}
	return a.db.DB().PingContext(ctx)
}

// TableColumns 返回表的所有列名
func (a *PostgresAdapter) TableColumns(tableName string) ([]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	var columns []string
	err := a.db.NewQuery(`
		SELECT column_name 
		FROM information_schema.columns 
		WHERE table_name = {:tableName}
		AND table_schema = 'public'
		ORDER BY ordinal_position
	`).Bind(dbx.Params{"tableName": tableName}).Column(&columns)

	return columns, err
}

// TableInfo 返回表的详细信息
func (a *PostgresAdapter) TableInfo(tableName string) ([]*AdapterTableInfoRow, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	var rows []struct {
		OrdinalPosition int    `db:"ordinal_position"`
		ColumnName      string `db:"column_name"`
		DataType        string `db:"data_type"`
		IsNullable      string `db:"is_nullable"`
		ColumnDefault   any    `db:"column_default"`
		IsPK            int    `db:"is_pk"`
	}

	err := a.db.NewQuery(`
		SELECT 
			c.ordinal_position,
			c.column_name,
			c.data_type,
			c.is_nullable,
			c.column_default,
			CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END as is_pk
		FROM information_schema.columns c
		LEFT JOIN (
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu 
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			WHERE tc.constraint_type = 'PRIMARY KEY'
			AND tc.table_name = {:tableName}
			AND tc.table_schema = 'public'
		) pk ON c.column_name = pk.column_name
		WHERE c.table_name = {:tableName}
		AND c.table_schema = 'public'
		ORDER BY c.ordinal_position
	`).Bind(dbx.Params{"tableName": tableName}).All(&rows)

	if err != nil {
		return nil, err
	}

	result := make([]*AdapterTableInfoRow, len(rows))
	for i, row := range rows {
		result[i] = &AdapterTableInfoRow{
			CID:        row.OrdinalPosition - 1, // 转换为 0-based
			Name:       row.ColumnName,
			Type:       strings.ToUpper(row.DataType),
			NotNull:    row.IsNullable == "NO",
			DefaultVal: row.ColumnDefault,
			PK:         row.IsPK,
		}
	}

	return result, nil
}

// TableIndexes 返回表的索引信息
func (a *PostgresAdapter) TableIndexes(tableName string) (map[string]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	var indexes []struct {
		IndexName  string `db:"indexname"`
		IndexDef   string `db:"indexdef"`
	}

	err := a.db.NewQuery(`
		SELECT indexname, indexdef 
		FROM pg_indexes 
		WHERE tablename = {:tableName}
		AND schemaname = 'public'
	`).Bind(dbx.Params{"tableName": tableName}).All(&indexes)

	if err != nil {
		return nil, err
	}

	result := make(map[string]string, len(indexes))
	for _, idx := range indexes {
		result[idx.IndexName] = idx.IndexDef
	}

	return result, nil
}

// HasTable 检查表是否存在
func (a *PostgresAdapter) HasTable(tableName string) (bool, error) {
	if a.db == nil {
		return false, fmt.Errorf("数据库未连接")
	}

	var exists bool
	err := a.db.NewQuery(`
		SELECT EXISTS (
			SELECT 1 
			FROM information_schema.tables 
			WHERE table_name = {:tableName}
			AND table_schema = 'public'
		)
	`).Bind(dbx.Params{"tableName": tableName}).Row(&exists)

	return exists, err
}

// Vacuum 执行 PostgreSQL VACUUM ANALYZE
func (a *PostgresAdapter) Vacuum() error {
	if a.db == nil {
		return fmt.Errorf("数据库未连接")
	}

	// PostgreSQL 的 VACUUM 不能在事务中执行
	// 使用 VACUUM ANALYZE 进行统计信息更新
	_, err := a.db.NewQuery("VACUUM ANALYZE").Execute()
	return err
}

// BoolValue 将数据库值转换为 Go bool
// PostgreSQL 使用原生布尔类型
func (a *PostgresAdapter) BoolValue(val any) bool {
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
	case string:
		s := strings.ToLower(v)
		return s == "true" || s == "t" || s == "1" || s == "yes" || s == "on"
	case []byte:
		s := strings.ToLower(string(v))
		return s == "true" || s == "t" || s == "1" || s == "yes" || s == "on"
	default:
		return false
	}
}

// FormatBool 将 Go bool 格式化为 PostgreSQL 值
// PostgreSQL 使用原生布尔类型
func (a *PostgresAdapter) FormatBool(val bool) any {
	return val
}

// TimeValue 将数据库值转换为 Go time.Time
func (a *PostgresAdapter) TimeValue(val any) (time.Time, error) {
	if val == nil {
		return time.Time{}, fmt.Errorf("值为 nil")
	}

	switch v := val.(type) {
	case time.Time:
		return v.UTC(), nil
	case string:
		if v == "" {
			return time.Time{}, fmt.Errorf("空字符串")
		}
		return parsePostgresTimeString(v)
	case []byte:
		if len(v) == 0 {
			return time.Time{}, fmt.Errorf("空字节数组")
		}
		return parsePostgresTimeString(string(v))
	default:
		return time.Time{}, fmt.Errorf("不支持的类型: %T", val)
	}
}

// parsePostgresTimeString 解析 PostgreSQL 时间字符串
func parsePostgresTimeString(s string) (time.Time, error) {
	// 尝试多种格式
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999999Z07:00",
		"2006-01-02 15:04:05.999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05+00",
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

// FormatTime 将 Go time.Time 格式化为 PostgreSQL 字符串
func (a *PostgresAdapter) FormatTime(val time.Time) string {
	return val.UTC().Format(time.RFC3339)
}

// JSONFunctions 返回 JSON 函数适配器
func (a *PostgresAdapter) JSONFunctions() *dbutils.JSONFunctions {
	return a.jsonFuncs
}

// NoCaseCollation 返回大小写不敏感排序规则
// PostgreSQL 可以使用 COLLATE "und-x-icu" 或在查询中使用 LOWER()/ILIKE
// 这里返回一个提示字符串，实际使用时调用者应该使用 ILIKE 或 LOWER() 函数
func (a *PostgresAdapter) NoCaseCollation() string {
	// 返回 LOWER() 提示，调用者需要在比较时使用 LOWER() 函数
	// 例如: WHERE LOWER(column) = LOWER(value)
	return "LOWER"
}

// IsUniqueViolation 检查错误是否为唯一约束违反
func (a *PostgresAdapter) IsUniqueViolation(err error) bool {
	return getPGErrorCode(err) == PGErrUniqueViolation
}

// IsForeignKeyViolation 检查错误是否为外键约束违反
func (a *PostgresAdapter) IsForeignKeyViolation(err error) bool {
	return getPGErrorCode(err) == PGErrForeignKeyViolation
}

// getPGErrorCode 从错误中提取 PostgreSQL 错误码
func getPGErrorCode(err error) string {
	if err == nil {
		return ""
	}

	// 尝试获取 pgconn.PgError
	var pgErr *pgconn.PgError
	if ok := extractPgError(err, &pgErr); ok && pgErr != nil {
		return pgErr.Code
	}

	return ""
}

// extractPgError 从错误链中提取 PgError
func extractPgError(err error, target **pgconn.PgError) bool {
	if err == nil {
		return false
	}

	// 直接类型断言
	if pgErr, ok := err.(*pgconn.PgError); ok {
		*target = pgErr
		return true
	}

	// 检查 Unwrap
	type unwrapper interface {
		Unwrap() error
	}
	if u, ok := err.(unwrapper); ok {
		return extractPgError(u.Unwrap(), target)
	}

	// 检查 Unwrap 返回多个错误
	type multiUnwrapper interface {
		Unwrap() []error
	}
	if mu, ok := err.(multiUnwrapper); ok {
		for _, e := range mu.Unwrap() {
			if extractPgError(e, target) {
				return true
			}
		}
	}

	return false
}

// DB 返回底层数据库连接
func (a *PostgresAdapter) DB() *dbx.DB {
	return a.db
}

// Config 返回当前配置
func (a *PostgresAdapter) Config() DBConfig {
	return a.config
}

// BeginTx 开始事务
func (a *PostgresAdapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*dbx.Tx, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	return a.db.BeginTx(ctx, opts)
}

// ExecRaw 执行原始 SQL
func (a *PostgresAdapter) ExecRaw(ctx context.Context, sql string, args ...any) (sql.Result, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	return a.db.DB().ExecContext(ctx, sql, args...)
}

// QueryRaw 执行原始查询
func (a *PostgresAdapter) QueryRaw(ctx context.Context, sql string, args ...any) (*sql.Rows, error) {
	if a.db == nil {
		return nil, fmt.Errorf("数据库未连接")
	}

	return a.db.DB().QueryContext(ctx, sql, args...)
}
