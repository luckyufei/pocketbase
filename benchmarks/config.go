// Package benchmarks 提供 PocketBase 性能基准测试套件
// 支持 SQLite 和 PostgreSQL，可在不同环境下重复执行
package benchmarks

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
)

// Environment 测试环境类型
type Environment string

const (
	EnvLocal      Environment = "local"      // 本地开发环境 (MacBook)
	EnvDocker     Environment = "docker"     // Docker 容器环境
	EnvProduction Environment = "production" // 生产服务器环境
)

// DatabaseType 数据库类型
type DatabaseType string

const (
	DBSQLite     DatabaseType = "sqlite"
	DBPostgreSQL DatabaseType = "postgresql"
)

// Scale 测试规模
type Scale string

const (
	ScaleSmall  Scale = "small"  // 小规模: 1K 用户, 10K 文章
	ScaleMedium Scale = "medium" // 中规模: 10K 用户, 100K 文章
	ScaleLarge  Scale = "large"  // 大规模: 100K 用户, 1M 文章
)

// Config 基准测试配置
type Config struct {
	// 环境配置
	Environment Environment  `json:"environment"`
	Database    DatabaseType `json:"database"`
	Scale       Scale        `json:"scale"`

	// 数据库连接
	SQLitePath    string `json:"sqlite_path,omitempty"`
	PostgresDSN   string `json:"postgres_dsn,omitempty"`
	PostgresHost  string `json:"postgres_host,omitempty"`
	PostgresPort  int    `json:"postgres_port,omitempty"`
	PostgresUser  string `json:"postgres_user,omitempty"`
	PostgresPass  string `json:"postgres_pass,omitempty"`
	PostgresDB    string `json:"postgres_db,omitempty"`

	// 测试参数
	Iterations        int   `json:"iterations"`
	WarmupIterations  int   `json:"warmup_iterations"`
	ConcurrencyLevels []int `json:"concurrency_levels"`
	DataSize          int   `json:"data_size"`
	DurationSeconds   int   `json:"duration_seconds"`
	Seed              int64 `json:"seed"`

	// 输出配置
	OutputDir    string `json:"output_dir"`
	ReportFormat string `json:"report_format"` // json, html, markdown
	Verbose      bool   `json:"verbose"`

	// 测试选项
	EnableWAL          bool `json:"enable_wal"`           // SQLite WAL 模式
	EnableConnectionPool bool `json:"enable_connection_pool"` // 连接池
	PoolSize           int  `json:"pool_size"`
}

// DefaultConfig 返回默认配置
func DefaultConfig() *Config {
	return &Config{
		Environment:        EnvLocal,
		Database:           DBSQLite,
		Scale:              ScaleSmall,
		SQLitePath:         "./benchmark.db",
		PostgresHost:       "localhost",
		PostgresPort:       5432,
		PostgresUser:       "postgres",
		PostgresPass:       "postgres",
		PostgresDB:         "benchmark",
		Iterations:         1000,
		WarmupIterations:   100,
		ConcurrencyLevels:  []int{1, 10, 50, 100},
		DataSize:           10000,
		DurationSeconds:    60,
		Seed:               42,
		OutputDir:          "./results",
		ReportFormat:       "json",
		Verbose:            false,
		EnableWAL:          true,
		EnableConnectionPool: true,
		PoolSize:           10,
	}
}

// LoadConfig 从文件加载配置
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	cfg := DefaultConfig()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return cfg, nil
}

// SaveConfig 保存配置到文件
func (c *Config) SaveConfig(path string) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// Validate 验证配置
func (c *Config) Validate() error {
	if c.Iterations <= 0 {
		return fmt.Errorf("iterations must be positive")
	}
	if len(c.ConcurrencyLevels) == 0 {
		return fmt.Errorf("concurrency levels must not be empty")
	}
	if c.Database == DBSQLite && c.SQLitePath == "" {
		return fmt.Errorf("sqlite_path is required for SQLite")
	}
	if c.Database == DBPostgreSQL && c.PostgresDSN == "" && c.PostgresHost == "" {
		return fmt.Errorf("postgres connection info is required")
	}
	return nil
}

// GetPostgresDSN 获取 PostgreSQL 连接字符串
func (c *Config) GetPostgresDSN() string {
	if c.PostgresDSN != "" {
		return c.PostgresDSN
	}
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		c.PostgresHost, c.PostgresPort, c.PostgresUser, c.PostgresPass, c.PostgresDB)
}

// GetScaleConfig 获取规模配置
func (c *Config) GetScaleConfig() ScaleConfig {
	switch c.Scale {
	case ScaleSmall:
		return ScaleConfig{Users: 1000, Articles: 10000, Comments: 50000, Files: 5000}
	case ScaleMedium:
		return ScaleConfig{Users: 10000, Articles: 100000, Comments: 500000, Files: 50000}
	case ScaleLarge:
		return ScaleConfig{Users: 100000, Articles: 1000000, Comments: 5000000, Files: 500000}
	default:
		return ScaleConfig{Users: 1000, Articles: 10000, Comments: 50000, Files: 5000}
	}
}

// ScaleConfig 规模配置
type ScaleConfig struct {
	Users    int
	Articles int
	Comments int
	Files    int
}

// SystemInfo 系统信息
type SystemInfo struct {
	OS           string `json:"os"`
	Arch         string `json:"arch"`
	NumCPU       int    `json:"num_cpu"`
	GoVersion    string `json:"go_version"`
	Hostname     string `json:"hostname"`
	Environment  string `json:"environment"`
}

// GetSystemInfo 获取系统信息
func GetSystemInfo() SystemInfo {
	hostname, _ := os.Hostname()
	return SystemInfo{
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		NumCPU:    runtime.NumCPU(),
		GoVersion: runtime.Version(),
		Hostname:  hostname,
	}
}
