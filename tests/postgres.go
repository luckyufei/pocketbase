// Package tests 提供 PocketBase 应用测试的通用辅助函数和 mock
package tests

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/ory/dockertest/v3"
	"github.com/ory/dockertest/v3/docker"
	"github.com/pocketbase/dbx"

	// PostgreSQL 驱动
	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresContainer 封装 PostgreSQL Docker 容器的管理
type PostgresContainer struct {
	pool     *dockertest.Pool
	resource *dockertest.Resource
	db       *sql.DB
	dbx      *dbx.DB
	host     string
	port     string
	user     string
	password string
	dbName   string
}

// PostgresConfig 定义 PostgreSQL 容器配置
type PostgresConfig struct {
	// PostgreSQL 版本，默认 "15"
	Version string
	// 数据库名称，默认 "pocketbase_test"
	DBName string
	// 用户名，默认 "postgres"
	User string
	// 密码，默认 "postgres"
	Password string
	// 最大等待时间，默认 120 秒
	MaxWait time.Duration
}

// DefaultPostgresConfig 返回默认的 PostgreSQL 配置
func DefaultPostgresConfig() PostgresConfig {
	return PostgresConfig{
		Version:  "15",
		DBName:   "pocketbase_test",
		User:     "postgres",
		Password: "postgres",
		MaxWait:  120 * time.Second,
	}
}

// NewPostgresContainer 创建并启动一个新的 PostgreSQL 容器
func NewPostgresContainer(config ...PostgresConfig) (*PostgresContainer, error) {
	cfg := DefaultPostgresConfig()
	if len(config) > 0 {
		if config[0].Version != "" {
			cfg.Version = config[0].Version
		}
		if config[0].DBName != "" {
			cfg.DBName = config[0].DBName
		}
		if config[0].User != "" {
			cfg.User = config[0].User
		}
		if config[0].Password != "" {
			cfg.Password = config[0].Password
		}
		if config[0].MaxWait > 0 {
			cfg.MaxWait = config[0].MaxWait
		}
	}

	// 获取 Docker socket 路径 (支持 colima)
	dockerEndpoint := getDockerEndpoint()

	// 创建 Docker 连接池
	pool, err := dockertest.NewPool(dockerEndpoint)
	if err != nil {
		return nil, fmt.Errorf("无法连接到 Docker: %w", err)
	}

	// 设置超时
	pool.MaxWait = cfg.MaxWait

	// 启动 PostgreSQL 容器
	resource, err := pool.RunWithOptions(&dockertest.RunOptions{
		Repository: "postgres",
		Tag:        cfg.Version,
		Env: []string{
			"POSTGRES_USER=" + cfg.User,
			"POSTGRES_PASSWORD=" + cfg.Password,
			"POSTGRES_DB=" + cfg.DBName,
			"listen_addresses='*'",
		},
	}, func(config *docker.HostConfig) {
		// 设置自动删除
		config.AutoRemove = true
		config.RestartPolicy = docker.RestartPolicy{Name: "no"}
	})
	if err != nil {
		return nil, fmt.Errorf("无法启动 PostgreSQL 容器: %w", err)
	}

	// 设置容器 10 分钟后自动过期（防止泄漏）
	if err := resource.Expire(600); err != nil {
		log.Printf("警告: 无法设置容器过期时间: %v", err)
	}

	container := &PostgresContainer{
		pool:     pool,
		resource: resource,
		host:     "localhost",
		port:     resource.GetPort("5432/tcp"),
		user:     cfg.User,
		password: cfg.Password,
		dbName:   cfg.DBName,
	}

	// 等待数据库就绪
	if err := pool.Retry(func() error {
		var retryErr error
		container.db, retryErr = sql.Open("pgx", container.DSN())
		if retryErr != nil {
			return retryErr
		}
		return container.db.Ping()
	}); err != nil {
		container.Close()
		return nil, fmt.Errorf("无法连接到 PostgreSQL: %w", err)
	}

	// 创建 dbx.DB 实例
	container.dbx = dbx.NewFromDB(container.db, "pgx")

	return container, nil
}

// DSN 返回数据库连接字符串
func (c *PostgresContainer) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		c.user, c.password, c.host, c.port, c.dbName,
	)
}

// DB 返回 sql.DB 实例
func (c *PostgresContainer) DB() *sql.DB {
	return c.db
}

// DBX 返回 dbx.DB 实例
func (c *PostgresContainer) DBX() *dbx.DB {
	return c.dbx
}

// Host 返回容器主机地址
func (c *PostgresContainer) Host() string {
	return c.host
}

// Port 返回容器端口
func (c *PostgresContainer) Port() string {
	return c.port
}

// Close 关闭数据库连接并销毁容器
func (c *PostgresContainer) Close() error {
	if c.db != nil {
		c.db.Close()
	}
	if c.pool != nil && c.resource != nil {
		return c.pool.Purge(c.resource)
	}
	return nil
}

// ExecSQL 执行 SQL 语句
func (c *PostgresContainer) ExecSQL(sql string) error {
	_, err := c.db.Exec(sql)
	return err
}

// ExecSQLFile 执行 SQL 文件
func (c *PostgresContainer) ExecSQLFile(filepath string) error {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return fmt.Errorf("无法读取 SQL 文件: %w", err)
	}
	return c.ExecSQL(string(content))
}

// CreateDatabase 创建新数据库
func (c *PostgresContainer) CreateDatabase(name string) error {
	// 需要先断开当前数据库连接
	_, err := c.db.Exec(fmt.Sprintf("CREATE DATABASE %s", name))
	return err
}

// CreateDatabaseWithTemplate 使用模板创建新数据库
// 如果模板数据库存在且有数据，新数据库会继承这些数据
func (c *PostgresContainer) CreateDatabaseWithTemplate(name string) error {
	// 直接创建新数据库（PostgreSQL 会自动使用 template1）
	_, err := c.db.Exec(fmt.Sprintf("CREATE DATABASE %q", name))
	return err
}

// DSNWithDatabase 返回指定数据库的连接字符串
func (c *PostgresContainer) DSNWithDatabase(dbName string) string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		c.user, c.password, c.host, c.port, dbName,
	)
}

// DropDatabase 删除数据库
func (c *PostgresContainer) DropDatabase(name string) error {
	_, err := c.db.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %q", name))
	return err
}

// ResetDatabase 重置数据库（删除所有表）
func (c *PostgresContainer) ResetDatabase() error {
	// 删除所有表
	_, err := c.db.Exec(`
		DO $$ DECLARE
			r RECORD;
		BEGIN
			FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
				EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
			END LOOP;
		END $$;
	`)
	return err
}

// TableExists 检查表是否存在
func (c *PostgresContainer) TableExists(tableName string) (bool, error) {
	var exists bool
	err := c.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = $1
		)
	`, tableName).Scan(&exists)
	return exists, err
}

// GetPostgresVersion 获取 PostgreSQL 版本
func (c *PostgresContainer) GetPostgresVersion() (string, error) {
	var version string
	err := c.db.QueryRow("SELECT version()").Scan(&version)
	return version, err
}

// IsUniqueViolation 检查错误是否为唯一约束违反 (PostgreSQL 错误码 23505)
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// PostgreSQL 唯一约束违反错误码: 23505
	return contains(errStr, "23505") ||
		contains(errStr, "unique constraint") ||
		contains(errStr, "duplicate key")
}

// IsDeadlock 检查错误是否为死锁 (PostgreSQL 错误码 40P01)
func IsDeadlock(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// PostgreSQL 死锁错误码: 40P01
	return contains(errStr, "40P01") ||
		contains(errStr, "deadlock detected")
}

// IsForeignKeyViolation 检查错误是否为外键约束违反 (PostgreSQL 错误码 23503)
func IsForeignKeyViolation(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return contains(errStr, "23503") ||
		contains(errStr, "foreign key constraint")
}

// IsSerializationFailure 检查错误是否为序列化失败 (PostgreSQL 错误码 40001)
func IsSerializationFailure(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return contains(errStr, "40001") ||
		contains(errStr, "serialization_failure") ||
		contains(errStr, "could not serialize access")
}

// contains 检查字符串是否包含子串 (不区分大小写)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			len(s) > 0 && len(substr) > 0 &&
				(s[0] == substr[0] || s[0]+32 == substr[0] || s[0] == substr[0]+32) &&
				containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			c1, c2 := s[i+j], substr[j]
			if c1 != c2 && c1+32 != c2 && c1 != c2+32 {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

// getDockerEndpoint 获取 Docker socket 路径
// 支持 Linux、Docker Desktop 和 macOS colima
func getDockerEndpoint() string {
	// 优先使用环境变量
	if endpoint := os.Getenv("DOCKER_HOST"); endpoint != "" {
		return endpoint
	}

	// 检查常见的 Docker socket 路径
	dockerSockets := []string{
		"/var/run/docker.sock",                                      // Linux / Docker Desktop
		os.Getenv("HOME") + "/.colima/docker.sock",                  // macOS colima
		os.Getenv("HOME") + "/.colima/default/docker.sock",          // macOS colima (alternative)
		os.Getenv("HOME") + "/.docker/run/docker.sock",              // Docker Desktop for Mac
	}

	for _, sock := range dockerSockets {
		if _, err := os.Stat(sock); err == nil {
			return "unix://" + sock
		}
	}

	// 返回空字符串让 dockertest 使用默认值
	return ""
}
