//go:build !no_default_driver

package core

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pocketbase/dbx"
)

// PostgresConfig 定义 PostgreSQL 连接配置
type PostgresConfig struct {
	// DSN 数据库连接字符串
	// 格式: postgres://user:password@host:port/dbname?sslmode=disable
	DSN string

	// MaxOpenConns 最大打开连接数，默认 25
	MaxOpenConns int

	// MaxIdleConns 最大空闲连接数，默认 5
	MaxIdleConns int

	// ConnMaxLifetime 连接最大生命周期，默认 5 分钟
	ConnMaxLifetime time.Duration

	// ConnMaxIdleTime 连接最大空闲时间，默认 5 分钟
	ConnMaxIdleTime time.Duration
}

// DefaultPostgresConfig 返回默认的 PostgreSQL 配置
func DefaultPostgresConfig(dsn string) PostgresConfig {
	return PostgresConfig{
		DSN:             dsn,
		MaxOpenConns:    25,
		MaxIdleConns:    5,
		ConnMaxLifetime: 5 * time.Minute,
		ConnMaxIdleTime: 5 * time.Minute,
	}
}

// PostgresDBConnect 创建 PostgreSQL 数据库连接
func PostgresDBConnect(config PostgresConfig) (*dbx.DB, error) {
	if config.DSN == "" {
		return nil, fmt.Errorf("PostgreSQL DSN 不能为空")
	}

	// 解析并验证 DSN
	parsedDSN, err := parsePostgresDSN(config.DSN)
	if err != nil {
		return nil, fmt.Errorf("无效的 PostgreSQL DSN: %w", err)
	}

	// 使用 pgx 配置
	pgxConfig, err := pgx.ParseConfig(parsedDSN)
	if err != nil {
		return nil, fmt.Errorf("解析 PostgreSQL 配置失败: %w", err)
	}

	// 设置默认参数
	if pgxConfig.RuntimeParams == nil {
		pgxConfig.RuntimeParams = make(map[string]string)
	}

	// 设置时区为 UTC
	pgxConfig.RuntimeParams["timezone"] = "UTC"

	// 设置应用名称
	pgxConfig.RuntimeParams["application_name"] = "pocketbase"

	// 注册 pgx 驱动并获取连接字符串
	connStr := stdlib.RegisterConnConfig(pgxConfig)

	// 打开数据库连接
	db, err := dbx.Open("pgx", connStr)
	if err != nil {
		return nil, fmt.Errorf("打开 PostgreSQL 连接失败: %w", err)
	}

	// 配置连接池
	sqlDB := db.DB()
	if config.MaxOpenConns > 0 {
		sqlDB.SetMaxOpenConns(config.MaxOpenConns)
	}
	if config.MaxIdleConns > 0 {
		sqlDB.SetMaxIdleConns(config.MaxIdleConns)
	}
	if config.ConnMaxLifetime > 0 {
		sqlDB.SetConnMaxLifetime(config.ConnMaxLifetime)
	}
	if config.ConnMaxIdleTime > 0 {
		sqlDB.SetConnMaxIdleTime(config.ConnMaxIdleTime)
	}

	// 验证连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("PostgreSQL 连接验证失败: %w", err)
	}

	// 初始化必要的 PostgreSQL 扩展
	// pgcrypto: 提供 gen_random_bytes() 用于生成随机 ID
	// pg_trgm: 提供三元组索引用于模糊搜索
	initSQL := `
		CREATE EXTENSION IF NOT EXISTS pgcrypto;
		CREATE EXTENSION IF NOT EXISTS pg_trgm;
	`
	if _, err := db.NewQuery(initSQL).Execute(); err != nil {
		db.Close()
		return nil, fmt.Errorf("初始化 PostgreSQL 扩展失败: %w", err)
	}

	return db, nil
}

// parsePostgresDSN 解析并规范化 PostgreSQL DSN
func parsePostgresDSN(dsn string) (string, error) {
	// 如果已经是标准格式，直接返回
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		return dsn, nil
	}

	// 尝试解析为 URL
	if !strings.Contains(dsn, "://") {
		dsn = "postgres://" + dsn
	}

	u, err := url.Parse(dsn)
	if err != nil {
		return "", err
	}

	// 验证必要参数
	if u.Host == "" {
		return "", fmt.Errorf("缺少主机地址")
	}

	return u.String(), nil
}

// IsPostgresDSN 检查 DSN 是否为 PostgreSQL 格式
func IsPostgresDSN(dsn string) bool {
	dsn = strings.ToLower(dsn)
	return strings.HasPrefix(dsn, "postgres://") ||
		strings.HasPrefix(dsn, "postgresql://") ||
		strings.Contains(dsn, "host=") ||
		strings.Contains(dsn, "dbname=")
}

// IsSQLitePath 检查路径是否为 SQLite 数据库路径
func IsSQLitePath(path string) bool {
	// 如果是 PostgreSQL DSN，返回 false
	if IsPostgresDSN(path) {
		return false
	}

	// 检查常见的 SQLite 文件扩展名
	lowerPath := strings.ToLower(path)
	if strings.HasSuffix(lowerPath, ".db") ||
		strings.HasSuffix(lowerPath, ".sqlite") ||
		strings.HasSuffix(lowerPath, ".sqlite3") {
		return true
	}

	// 检查内存数据库
	if strings.Contains(lowerPath, ":memory:") ||
		strings.Contains(lowerPath, "mode=memory") {
		return true
	}

	// 默认假设是 SQLite（向后兼容）
	return true
}

// DBConnect 根据 DSN 自动选择数据库类型并建立连接
func DBConnect(dsn string) (*dbx.DB, error) {
	if IsPostgresDSN(dsn) {
		return PostgresDBConnect(DefaultPostgresConfig(dsn))
	}
	return DefaultDBConnect(dsn)
}
