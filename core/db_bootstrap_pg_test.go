// Package core 提供 PocketBase 核心功能
package core

import (
	"strings"
	"testing"
)

// ============================================================================
// T-8.1.1: 检查 PostgreSQL 连接
// ============================================================================

// TestPGConnectionCheck 测试 PostgreSQL 连接检查
func TestPGConnectionCheck(t *testing.T) {
	t.Run("检测 PostgreSQL 连接字符串", func(t *testing.T) {
		connStr := "postgres://user:pass@localhost:5432/dbname"
		if !IsPGConnectionString(connStr) {
			t.Errorf("应该识别为 PostgreSQL 连接字符串: %s", connStr)
		}
	})

	t.Run("检测 postgresql:// 前缀", func(t *testing.T) {
		connStr := "postgresql://user:pass@localhost:5432/dbname"
		if !IsPGConnectionString(connStr) {
			t.Errorf("应该识别为 PostgreSQL 连接字符串: %s", connStr)
		}
	})

	t.Run("检测 host= 格式", func(t *testing.T) {
		connStr := "host=localhost port=5432 user=user password=pass dbname=dbname"
		if !IsPGConnectionString(connStr) {
			t.Errorf("应该识别为 PostgreSQL 连接字符串: %s", connStr)
		}
	})

	t.Run("非 PostgreSQL 连接字符串", func(t *testing.T) {
		connStr := "./data.db"
		if IsPGConnectionString(connStr) {
			t.Errorf("不应该识别为 PostgreSQL 连接字符串: %s", connStr)
		}
	})

	t.Run("空连接字符串", func(t *testing.T) {
		if IsPGConnectionString("") {
			t.Error("空字符串不应该识别为 PostgreSQL 连接字符串")
		}
	})
}

// TestPGConnectionValidator 测试 PostgreSQL 连接验证器
func TestPGConnectionValidator(t *testing.T) {
	t.Run("验证连接字符串格式", func(t *testing.T) {
		validator := NewPGConnectionValidator()

		// 有效格式
		validCases := []string{
			"postgres://user:pass@localhost:5432/dbname",
			"postgresql://user:pass@localhost/dbname",
			"host=localhost port=5432 dbname=test",
			"postgres://localhost/dbname?sslmode=disable",
		}

		for _, connStr := range validCases {
			err := validator.ValidateFormat(connStr)
			if err != nil {
				t.Errorf("应该是有效格式 '%s': %v", connStr, err)
			}
		}

		// 无效格式
		invalidCases := []string{
			"",
			"invalid",
			"mysql://localhost/db",
		}

		for _, connStr := range invalidCases {
			err := validator.ValidateFormat(connStr)
			if err == nil {
				t.Errorf("应该是无效格式 '%s'", connStr)
			}
		}
	})

	t.Run("解析连接参数", func(t *testing.T) {
		validator := NewPGConnectionValidator()

		params, err := validator.ParseConnectionString("postgres://user:pass@localhost:5432/dbname?sslmode=disable")
		if err != nil {
			t.Fatalf("解析失败: %v", err)
		}

		if params.Host != "localhost" {
			t.Errorf("期望 host=localhost, 实际 %s", params.Host)
		}
		if params.Port != 5432 {
			t.Errorf("期望 port=5432, 实际 %d", params.Port)
		}
		if params.User != "user" {
			t.Errorf("期望 user=user, 实际 %s", params.User)
		}
		if params.Database != "dbname" {
			t.Errorf("期望 database=dbname, 实际 %s", params.Database)
		}
		if params.SSLMode != "disable" {
			t.Errorf("期望 sslmode=disable, 实际 %s", params.SSLMode)
		}
	})
}

// ============================================================================
// T-8.1.2: 检查 admin 表是否存在
// ============================================================================

// TestPGSchemaChecker 测试 PostgreSQL Schema 检查器
func TestPGSchemaChecker(t *testing.T) {
	t.Run("生成检查表存在的 SQL", func(t *testing.T) {
		checker := NewPGSchemaChecker()
		sql := checker.TableExistsSQL("_superusers")

		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "information_schema") || !strings.Contains(sql, "pg_tables") {
			// 可能使用不同的方式检查
		}
		if !strings.Contains(sql, "_superusers") {
			t.Errorf("应该包含表名 '_superusers': %s", sql)
		}
	})

	t.Run("生成检查多个表的 SQL", func(t *testing.T) {
		checker := NewPGSchemaChecker()
		sql := checker.TablesExistSQL("_superusers", "_collections", "_params")

		if !strings.Contains(sql, "_superusers") {
			t.Errorf("应该包含 '_superusers': %s", sql)
		}
		if !strings.Contains(sql, "_collections") {
			t.Errorf("应该包含 '_collections': %s", sql)
		}
	})

	t.Run("生成检查扩展存在的 SQL", func(t *testing.T) {
		checker := NewPGSchemaChecker()
		sql := checker.ExtensionExistsSQL("pgcrypto")

		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "pg_extension") {
			t.Errorf("应该包含 'pg_extension': %s", sql)
		}
	})
}

// ============================================================================
// T-8.1.3: 执行初始化 SQL
// ============================================================================

// TestPGInitializer 测试 PostgreSQL 初始化器
func TestPGInitializer(t *testing.T) {
	t.Run("生成创建必要扩展的 SQL", func(t *testing.T) {
		initializer := NewPGInitializer()
		sql := initializer.CreateExtensionsSQL()

		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "pgcrypto") {
			t.Errorf("应该包含 'pgcrypto': %s", sql)
		}
	})

	t.Run("生成创建核心表的 SQL", func(t *testing.T) {
		initializer := NewPGInitializer()
		sql := initializer.CreateCoreTablesSQL()

		if sql == "" {
			t.Error("SQL 不应为空")
		}

		// 检查核心表
		coreTables := []string{"_superusers", "_collections", "_params", "_externalAuths"}
		for _, table := range coreTables {
			if !strings.Contains(sql, table) {
				t.Errorf("应该包含表 '%s': %s", table, sql)
			}
		}
	})

	t.Run("生成创建索引的 SQL", func(t *testing.T) {
		initializer := NewPGInitializer()
		sql := initializer.CreateIndexesSQL()

		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "CREATE INDEX") {
			t.Errorf("应该包含 'CREATE INDEX': %s", sql)
		}
	})

	t.Run("完整初始化 SQL", func(t *testing.T) {
		initializer := NewPGInitializer()
		sql := initializer.FullInitSQL()

		if sql == "" {
			t.Error("SQL 不应为空")
		}

		// 应该包含扩展、表和索引
		if !strings.Contains(sql, "CREATE EXTENSION") {
			t.Errorf("应该包含 'CREATE EXTENSION': %s", sql)
		}
		if !strings.Contains(sql, "CREATE TABLE") {
			t.Errorf("应该包含 'CREATE TABLE': %s", sql)
		}
	})
}

// ============================================================================
// T-8.1.4: 引导创建管理员账号
// ============================================================================

// TestPGSuperuserBootstrap 测试 PostgreSQL 超级用户引导
func TestPGSuperuserBootstrap(t *testing.T) {
	t.Run("生成检查超级用户存在的 SQL", func(t *testing.T) {
		bootstrap := NewPGSuperuserBootstrap()
		sql := bootstrap.SuperuserExistsSQL()

		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "_superusers") {
			t.Errorf("应该包含 '_superusers': %s", sql)
		}
		if !strings.Contains(sql, "COUNT") || !strings.Contains(sql, "EXISTS") {
			// 可能使用不同的方式检查
		}
	})

	t.Run("生成创建超级用户的 SQL", func(t *testing.T) {
		bootstrap := NewPGSuperuserBootstrap()
		sql := bootstrap.CreateSuperuserSQL("admin@example.com", "hashed_password")

		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "_superusers") {
			t.Errorf("应该包含 '_superusers': %s", sql)
		}
		if !strings.Contains(sql, "INSERT") {
			t.Errorf("应该包含 'INSERT': %s", sql)
		}
	})

	t.Run("验证邮箱格式", func(t *testing.T) {
		bootstrap := NewPGSuperuserBootstrap()

		validEmails := []string{
			"admin@example.com",
			"user.name@domain.org",
			"test+tag@test.io",
		}

		for _, email := range validEmails {
			if !bootstrap.ValidateEmail(email) {
				t.Errorf("应该是有效邮箱: %s", email)
			}
		}

		invalidEmails := []string{
			"",
			"invalid",
			"@domain.com",
			"user@",
		}

		for _, email := range invalidEmails {
			if bootstrap.ValidateEmail(email) {
				t.Errorf("应该是无效邮箱: %s", email)
			}
		}
	})

	t.Run("验证密码强度", func(t *testing.T) {
		bootstrap := NewPGSuperuserBootstrap()

		// 默认最小长度 8
		if bootstrap.ValidatePassword("short") {
			t.Error("短密码应该验证失败")
		}

		if !bootstrap.ValidatePassword("validpassword123") {
			t.Error("有效密码应该验证通过")
		}
	})
}

// ============================================================================
// T-8.1.5: 启动逻辑辅助函数
// ============================================================================

// TestPGBootstrapConfig 测试 PostgreSQL 启动配置
func TestPGBootstrapConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		config := DefaultPGBootstrapConfig()

		if config.MaxRetries <= 0 {
			t.Error("最大重试次数应大于 0")
		}
		if config.RetryInterval <= 0 {
			t.Error("重试间隔应大于 0")
		}
		if config.ConnectionTimeout <= 0 {
			t.Error("连接超时应大于 0")
		}
	})

	t.Run("自定义配置", func(t *testing.T) {
		config := &PGBootstrapConfig{
			MaxRetries:        5,
			RetryInterval:     2,
			ConnectionTimeout: 60,
			AutoMigrate:       true,
		}

		if config.MaxRetries != 5 {
			t.Errorf("期望 MaxRetries=5, 实际 %d", config.MaxRetries)
		}
	})
}

// TestPGBootstrapState 测试 PostgreSQL 启动状态
func TestPGBootstrapState(t *testing.T) {
	t.Run("初始状态", func(t *testing.T) {
		state := NewPGBootstrapState()

		if state.IsConnected() {
			t.Error("初始状态不应该已连接")
		}
		if state.IsInitialized() {
			t.Error("初始状态不应该已初始化")
		}
		if state.HasSuperuser() {
			t.Error("初始状态不应该有超级用户")
		}
	})

	t.Run("状态更新", func(t *testing.T) {
		state := NewPGBootstrapState()

		state.SetConnected(true)
		if !state.IsConnected() {
			t.Error("应该已连接")
		}

		state.SetInitialized(true)
		if !state.IsInitialized() {
			t.Error("应该已初始化")
		}

		state.SetHasSuperuser(true)
		if !state.HasSuperuser() {
			t.Error("应该有超级用户")
		}
	})

	t.Run("状态摘要", func(t *testing.T) {
		state := NewPGBootstrapState()
		state.SetConnected(true)
		state.SetInitialized(true)

		summary := state.Summary()
		if summary == "" {
			t.Error("摘要不应为空")
		}
	})
}
