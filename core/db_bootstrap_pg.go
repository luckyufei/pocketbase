// Package core 提供 PocketBase 核心功能
package core

import (
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// T-8.1.1: PostgreSQL 连接检查
// ============================================================================

// IsPGConnectionString 检查是否为 PostgreSQL 连接字符串
func IsPGConnectionString(connStr string) bool {
	if connStr == "" {
		return false
	}

	// 检查 URL 格式
	if strings.HasPrefix(connStr, "postgres://") || strings.HasPrefix(connStr, "postgresql://") {
		return true
	}

	// 检查 key=value 格式
	if strings.Contains(connStr, "host=") || strings.Contains(connStr, "dbname=") {
		return true
	}

	return false
}

// PGConnectionParams PostgreSQL 连接参数
type PGConnectionParams struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
	Options  map[string]string
}

// PGConnectionValidator PostgreSQL 连接验证器
type PGConnectionValidator struct{}

// NewPGConnectionValidator 创建新的连接验证器
func NewPGConnectionValidator() *PGConnectionValidator {
	return &PGConnectionValidator{}
}

// ValidateFormat 验证连接字符串格式
func (v *PGConnectionValidator) ValidateFormat(connStr string) error {
	if connStr == "" {
		return fmt.Errorf("连接字符串不能为空")
	}

	if !IsPGConnectionString(connStr) {
		return fmt.Errorf("无效的 PostgreSQL 连接字符串格式")
	}

	return nil
}

// ParseConnectionString 解析连接字符串
func (v *PGConnectionValidator) ParseConnectionString(connStr string) (*PGConnectionParams, error) {
	params := &PGConnectionParams{
		Port:    5432, // 默认端口
		SSLMode: "prefer",
		Options: make(map[string]string),
	}

	// URL 格式
	if strings.HasPrefix(connStr, "postgres://") || strings.HasPrefix(connStr, "postgresql://") {
		u, err := url.Parse(connStr)
		if err != nil {
			return nil, fmt.Errorf("解析 URL 失败: %w", err)
		}

		params.Host = u.Hostname()
		if portStr := u.Port(); portStr != "" {
			if port, err := strconv.Atoi(portStr); err == nil {
				params.Port = port
			}
		}
		params.User = u.User.Username()
		params.Password, _ = u.User.Password()
		params.Database = strings.TrimPrefix(u.Path, "/")

		// 解析查询参数
		for key, values := range u.Query() {
			if len(values) > 0 {
				if key == "sslmode" {
					params.SSLMode = values[0]
				} else {
					params.Options[key] = values[0]
				}
			}
		}

		return params, nil
	}

	// key=value 格式
	parts := strings.Fields(connStr)
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.ToLower(kv[0])
		value := kv[1]

		switch key {
		case "host":
			params.Host = value
		case "port":
			if port, err := strconv.Atoi(value); err == nil {
				params.Port = port
			}
		case "user":
			params.User = value
		case "password":
			params.Password = value
		case "dbname":
			params.Database = value
		case "sslmode":
			params.SSLMode = value
		default:
			params.Options[key] = value
		}
	}

	return params, nil
}

// ============================================================================
// T-8.1.2: Schema 检查器
// ============================================================================

// PGSchemaChecker PostgreSQL Schema 检查器
type PGSchemaChecker struct{}

// NewPGSchemaChecker 创建新的 Schema 检查器
func NewPGSchemaChecker() *PGSchemaChecker {
	return &PGSchemaChecker{}
}

// TableExistsSQL 生成检查表是否存在的 SQL
func (c *PGSchemaChecker) TableExistsSQL(tableName string) string {
	return fmt.Sprintf(`
		SELECT EXISTS (
			SELECT FROM pg_tables 
			WHERE schemaname = 'public' 
			AND tablename = '%s'
		)
	`, tableName)
}

// TablesExistSQL 生成检查多个表是否存在的 SQL
func (c *PGSchemaChecker) TablesExistSQL(tableNames ...string) string {
	if len(tableNames) == 0 {
		return ""
	}

	var conditions []string
	for _, name := range tableNames {
		conditions = append(conditions, fmt.Sprintf("'%s'", name))
	}

	return fmt.Sprintf(`
		SELECT tablename FROM pg_tables 
		WHERE schemaname = 'public' 
		AND tablename IN (%s)
	`, strings.Join(conditions, ", "))
}

// ExtensionExistsSQL 生成检查扩展是否存在的 SQL
func (c *PGSchemaChecker) ExtensionExistsSQL(extName string) string {
	return fmt.Sprintf(`
		SELECT EXISTS (
			SELECT FROM pg_extension 
			WHERE extname = '%s'
		)
	`, extName)
}

// ============================================================================
// T-8.1.3: PostgreSQL 初始化器
// ============================================================================

// PGInitializer PostgreSQL 初始化器
type PGInitializer struct{}

// NewPGInitializer 创建新的初始化器
func NewPGInitializer() *PGInitializer {
	return &PGInitializer{}
}

// CreateExtensionsSQL 生成创建必要扩展的 SQL
func (i *PGInitializer) CreateExtensionsSQL() string {
	return `
		-- 创建必要的扩展
		CREATE EXTENSION IF NOT EXISTS pgcrypto;
		CREATE EXTENSION IF NOT EXISTS pg_trgm;
	`
}

// CreateCoreTablesSQL 生成创建核心表的 SQL
func (i *PGInitializer) CreateCoreTablesSQL() string {
	return `
		-- 系统参数表
		CREATE TABLE IF NOT EXISTS _params (
			id TEXT PRIMARY KEY,
			value JSONB,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- 超级用户表
		CREATE TABLE IF NOT EXISTS _superusers (
			id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
			email TEXT UNIQUE NOT NULL,
			tokenKey TEXT,
			password TEXT NOT NULL,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- 集合定义表
		CREATE TABLE IF NOT EXISTS _collections (
			id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
			name TEXT UNIQUE NOT NULL,
			type TEXT NOT NULL DEFAULT 'base',
			system BOOLEAN DEFAULT FALSE,
			schema JSONB DEFAULT '[]'::jsonb,
			indexes JSONB DEFAULT '[]'::jsonb,
			listRule TEXT,
			viewRule TEXT,
			createRule TEXT,
			updateRule TEXT,
			deleteRule TEXT,
			options JSONB DEFAULT '{}'::jsonb,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- 外部认证表
		CREATE TABLE IF NOT EXISTS _externalAuths (
			id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
			collectionRef TEXT NOT NULL,
			recordRef TEXT NOT NULL,
			provider TEXT NOT NULL,
			providerId TEXT NOT NULL,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(collectionRef, recordRef, provider)
		);

		-- MFA 表
		CREATE TABLE IF NOT EXISTS _mfas (
			id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
			collectionRef TEXT NOT NULL,
			recordRef TEXT NOT NULL,
			method TEXT NOT NULL,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- OTP 表
		CREATE TABLE IF NOT EXISTS _otps (
			id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
			collectionRef TEXT NOT NULL,
			recordRef TEXT NOT NULL,
			password TEXT NOT NULL,
			sentTo TEXT,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- 认证来源表
		CREATE TABLE IF NOT EXISTS _authOrigins (
			id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
			collectionRef TEXT NOT NULL,
			recordRef TEXT NOT NULL,
			fingerprint TEXT NOT NULL,
			created TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(collectionRef, recordRef, fingerprint)
		);
	`
}

// CreateIndexesSQL 生成创建索引的 SQL
func (i *PGInitializer) CreateIndexesSQL() string {
	return `
		-- 超级用户索引
		CREATE INDEX IF NOT EXISTS idx_superusers_email ON _superusers(email);
		CREATE INDEX IF NOT EXISTS idx_superusers_tokenKey ON _superusers(tokenKey);

		-- 集合索引
		CREATE INDEX IF NOT EXISTS idx_collections_name ON _collections(name);
		CREATE INDEX IF NOT EXISTS idx_collections_type ON _collections(type);

		-- 外部认证索引
		CREATE INDEX IF NOT EXISTS idx_externalAuths_collectionRef ON _externalAuths(collectionRef);
		CREATE INDEX IF NOT EXISTS idx_externalAuths_recordRef ON _externalAuths(recordRef);
		CREATE INDEX IF NOT EXISTS idx_externalAuths_provider ON _externalAuths(provider);

		-- MFA 索引
		CREATE INDEX IF NOT EXISTS idx_mfas_collectionRef ON _mfas(collectionRef);
		CREATE INDEX IF NOT EXISTS idx_mfas_recordRef ON _mfas(recordRef);

		-- OTP 索引
		CREATE INDEX IF NOT EXISTS idx_otps_collectionRef ON _otps(collectionRef);
		CREATE INDEX IF NOT EXISTS idx_otps_recordRef ON _otps(recordRef);

		-- 认证来源索引
		CREATE INDEX IF NOT EXISTS idx_authOrigins_collectionRef ON _authOrigins(collectionRef);
		CREATE INDEX IF NOT EXISTS idx_authOrigins_recordRef ON _authOrigins(recordRef);
	`
}

// FullInitSQL 生成完整的初始化 SQL
func (i *PGInitializer) FullInitSQL() string {
	return i.CreateExtensionsSQL() + "\n" + i.CreateCoreTablesSQL() + "\n" + i.CreateIndexesSQL()
}

// ============================================================================
// T-8.1.4: 超级用户引导
// ============================================================================

// PGSuperuserBootstrap PostgreSQL 超级用户引导
type PGSuperuserBootstrap struct {
	minPasswordLength int
}

// NewPGSuperuserBootstrap 创建新的超级用户引导
func NewPGSuperuserBootstrap() *PGSuperuserBootstrap {
	return &PGSuperuserBootstrap{
		minPasswordLength: 8,
	}
}

// SuperuserExistsSQL 生成检查超级用户是否存在的 SQL
func (b *PGSuperuserBootstrap) SuperuserExistsSQL() string {
	return `SELECT EXISTS (SELECT 1 FROM _superusers LIMIT 1)`
}

// CreateSuperuserSQL 生成创建超级用户的 SQL
func (b *PGSuperuserBootstrap) CreateSuperuserSQL(email, hashedPassword string) string {
	return fmt.Sprintf(`
		INSERT INTO _superusers (id, email, password, tokenKey, created, updated)
		VALUES (
			gen_random_uuid()::text,
			'%s',
			'%s',
			encode(gen_random_bytes(32), 'hex'),
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
	`, escapeSQLString(email), escapeSQLString(hashedPassword))
}

// ValidateEmail 验证邮箱格式
func (b *PGSuperuserBootstrap) ValidateEmail(email string) bool {
	if email == "" {
		return false
	}

	// 简单的邮箱格式验证
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// ValidatePassword 验证密码强度
func (b *PGSuperuserBootstrap) ValidatePassword(password string) bool {
	return len(password) >= b.minPasswordLength
}

// escapeSQLString 转义 SQL 字符串
func escapeSQLString(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

// ============================================================================
// T-8.1.5: 启动配置和状态
// ============================================================================

// PGBootstrapConfig PostgreSQL 启动配置
type PGBootstrapConfig struct {
	// MaxRetries 最大重试次数
	MaxRetries int

	// RetryInterval 重试间隔 (秒)
	RetryInterval int

	// ConnectionTimeout 连接超时 (秒)
	ConnectionTimeout int

	// AutoMigrate 是否自动迁移
	AutoMigrate bool

	// CreateExtensions 是否自动创建扩展
	CreateExtensions bool
}

// DefaultPGBootstrapConfig 返回默认配置
func DefaultPGBootstrapConfig() *PGBootstrapConfig {
	return &PGBootstrapConfig{
		MaxRetries:        3,
		RetryInterval:     5,
		ConnectionTimeout: 30,
		AutoMigrate:       true,
		CreateExtensions:  true,
	}
}

// PGBootstrapState PostgreSQL 启动状态
type PGBootstrapState struct {
	mu           sync.RWMutex
	connected    bool
	initialized  bool
	hasSuperuser bool
	lastError    error
	startTime    time.Time
}

// NewPGBootstrapState 创建新的启动状态
func NewPGBootstrapState() *PGBootstrapState {
	return &PGBootstrapState{
		startTime: time.Now(),
	}
}

// IsConnected 检查是否已连接
func (s *PGBootstrapState) IsConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.connected
}

// SetConnected 设置连接状态
func (s *PGBootstrapState) SetConnected(connected bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.connected = connected
}

// IsInitialized 检查是否已初始化
func (s *PGBootstrapState) IsInitialized() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.initialized
}

// SetInitialized 设置初始化状态
func (s *PGBootstrapState) SetInitialized(initialized bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.initialized = initialized
}

// HasSuperuser 检查是否有超级用户
func (s *PGBootstrapState) HasSuperuser() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.hasSuperuser
}

// SetHasSuperuser 设置超级用户状态
func (s *PGBootstrapState) SetHasSuperuser(hasSuperuser bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.hasSuperuser = hasSuperuser
}

// SetError 设置错误
func (s *PGBootstrapState) SetError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastError = err
}

// LastError 获取最后一个错误
func (s *PGBootstrapState) LastError() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastError
}

// Summary 返回状态摘要
func (s *PGBootstrapState) Summary() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var status []string

	if s.connected {
		status = append(status, "已连接")
	} else {
		status = append(status, "未连接")
	}

	if s.initialized {
		status = append(status, "已初始化")
	} else {
		status = append(status, "未初始化")
	}

	if s.hasSuperuser {
		status = append(status, "有超级用户")
	} else {
		status = append(status, "无超级用户")
	}

	elapsed := time.Since(s.startTime)

	return fmt.Sprintf("PostgreSQL 启动状态: %s (耗时: %v)", strings.Join(status, ", "), elapsed.Round(time.Millisecond))
}
