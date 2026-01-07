// Package core 提供 PocketBase 核心功能
package core

import (
	"strings"
	"testing"
)

// ============================================================================
// T-8.2.1: 拦截 Admin UI 备份请求
// ============================================================================

// TestPGBackupInterceptor 测试 PostgreSQL 备份拦截器
func TestPGBackupInterceptor(t *testing.T) {
	t.Run("识别备份请求", func(t *testing.T) {
		interceptor := NewPGBackupInterceptor()

		// 备份请求路径
		backupPaths := []string{
			"/api/backups",
			"/api/backups/create",
			"/api/backups/download",
		}

		for _, path := range backupPaths {
			if !interceptor.IsBackupRequest(path) {
				t.Errorf("应该识别为备份请求: %s", path)
			}
		}

		// 非备份请求
		nonBackupPaths := []string{
			"/api/collections",
			"/api/records",
			"/api/settings",
		}

		for _, path := range nonBackupPaths {
			if interceptor.IsBackupRequest(path) {
				t.Errorf("不应该识别为备份请求: %s", path)
			}
		}
	})

	t.Run("检测数据库类型", func(t *testing.T) {
		interceptor := NewPGBackupInterceptor()

		// PostgreSQL 连接
		if !interceptor.ShouldUsePGDump("postgres://localhost/db") {
			t.Error("PostgreSQL 连接应该使用 pg_dump")
		}

		// SQLite 连接
		if interceptor.ShouldUsePGDump("./data.db") {
			t.Error("SQLite 连接不应该使用 pg_dump")
		}
	})
}

// ============================================================================
// T-8.2.2: 调用 pg_dump 生成转储
// ============================================================================

// TestPGDumpCommand 测试 pg_dump 命令生成
func TestPGDumpCommand(t *testing.T) {
	t.Run("生成基本 pg_dump 命令", func(t *testing.T) {
		dumper := NewPGDumper()
		cmd := dumper.BuildCommand("postgres://user:pass@localhost:5432/dbname")

		if cmd == "" {
			t.Error("命令不应为空")
		}
		if !strings.Contains(cmd, "pg_dump") {
			t.Errorf("应该包含 'pg_dump': %s", cmd)
		}
	})

	t.Run("生成带选项的 pg_dump 命令", func(t *testing.T) {
		dumper := NewPGDumper()
		dumper.SetFormat(PGDumpFormatCustom)
		dumper.SetCompression(9)

		cmd := dumper.BuildCommand("postgres://localhost/db")

		if !strings.Contains(cmd, "-Fc") {
			t.Errorf("应该包含 '-Fc' (custom format): %s", cmd)
		}
		if !strings.Contains(cmd, "-Z") || !strings.Contains(cmd, "9") {
			t.Errorf("应该包含压缩选项: %s", cmd)
		}
	})

	t.Run("生成 schema-only 命令", func(t *testing.T) {
		dumper := NewPGDumper()
		dumper.SetSchemaOnly(true)

		cmd := dumper.BuildCommand("postgres://localhost/db")

		if !strings.Contains(cmd, "--schema-only") && !strings.Contains(cmd, "-s") {
			t.Errorf("应该包含 '--schema-only': %s", cmd)
		}
	})

	t.Run("生成 data-only 命令", func(t *testing.T) {
		dumper := NewPGDumper()
		dumper.SetDataOnly(true)

		cmd := dumper.BuildCommand("postgres://localhost/db")

		if !strings.Contains(cmd, "--data-only") && !strings.Contains(cmd, "-a") {
			t.Errorf("应该包含 '--data-only': %s", cmd)
		}
	})

	t.Run("排除表", func(t *testing.T) {
		dumper := NewPGDumper()
		dumper.ExcludeTables("_logs", "_temp")

		cmd := dumper.BuildCommand("postgres://localhost/db")

		if !strings.Contains(cmd, "--exclude-table") && !strings.Contains(cmd, "-T") {
			t.Errorf("应该包含排除表选项: %s", cmd)
		}
	})
}

// TestPGDumpConfig 测试 pg_dump 配置
func TestPGDumpConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		config := DefaultPGDumpConfig()

		if config.Format == "" {
			t.Error("格式不应为空")
		}
		if config.Compression < 0 || config.Compression > 9 {
			t.Errorf("压缩级别应在 0-9 之间: %d", config.Compression)
		}
	})

	t.Run("自定义配置", func(t *testing.T) {
		config := &PGDumpConfig{
			Format:      PGDumpFormatPlain,
			Compression: 6,
			SchemaOnly:  false,
			DataOnly:    false,
		}

		if config.Format != PGDumpFormatPlain {
			t.Errorf("期望 plain 格式, 实际 %s", config.Format)
		}
	})
}

// ============================================================================
// T-8.2.3: 流式写入 ZIP
// ============================================================================

// TestPGBackupZipWriter 测试 ZIP 写入器
func TestPGBackupZipWriter(t *testing.T) {
	t.Run("创建 ZIP 写入器", func(t *testing.T) {
		writer := NewPGBackupZipWriter()

		if writer == nil {
			t.Error("写入器不应为 nil")
		}
	})

	t.Run("添加数据库转储", func(t *testing.T) {
		writer := NewPGBackupZipWriter()

		err := writer.AddDatabaseDump("test.sql", []byte("-- test dump"))
		if err != nil {
			t.Errorf("添加转储失败: %v", err)
		}

		if !writer.HasFile("test.sql") {
			t.Error("应该包含 test.sql 文件")
		}
	})

	t.Run("添加元数据", func(t *testing.T) {
		writer := NewPGBackupZipWriter()

		metadata := &BackupMetadata{
			Version:     "0.23.0",
			DBType:      "postgresql",
			CreatedAt:   "2026-01-07T12:00:00Z",
			Collections: []string{"posts", "users"},
		}

		err := writer.AddMetadata(metadata)
		if err != nil {
			t.Errorf("添加元数据失败: %v", err)
		}

		if !writer.HasFile("metadata.json") {
			t.Error("应该包含 metadata.json 文件")
		}
	})

	t.Run("获取文件列表", func(t *testing.T) {
		writer := NewPGBackupZipWriter()
		_ = writer.AddDatabaseDump("dump.sql", []byte("-- dump"))

		files := writer.ListFiles()
		if len(files) == 0 {
			t.Error("文件列表不应为空")
		}
	})
}

// ============================================================================
// T-8.2.4: 包含上传文件打包
// ============================================================================

// TestPGBackupFileCollector 测试文件收集器
func TestPGBackupFileCollector(t *testing.T) {
	t.Run("创建文件收集器", func(t *testing.T) {
		collector := NewPGBackupFileCollector("/path/to/storage")

		if collector == nil {
			t.Error("收集器不应为 nil")
		}
	})

	t.Run("设置包含模式", func(t *testing.T) {
		collector := NewPGBackupFileCollector("/path/to/storage")
		collector.SetIncludePatterns("*.jpg", "*.png", "*.pdf")

		patterns := collector.GetIncludePatterns()
		if len(patterns) != 3 {
			t.Errorf("期望 3 个模式, 实际 %d", len(patterns))
		}
	})

	t.Run("设置排除模式", func(t *testing.T) {
		collector := NewPGBackupFileCollector("/path/to/storage")
		collector.SetExcludePatterns("*.tmp", "*.log")

		patterns := collector.GetExcludePatterns()
		if len(patterns) != 2 {
			t.Errorf("期望 2 个模式, 实际 %d", len(patterns))
		}
	})

	t.Run("设置大小限制", func(t *testing.T) {
		collector := NewPGBackupFileCollector("/path/to/storage")
		collector.SetMaxFileSize(100 * 1024 * 1024) // 100MB

		if collector.GetMaxFileSize() != 100*1024*1024 {
			t.Error("大小限制设置错误")
		}
	})
}

// ============================================================================
// T-8.2.5: 实现定时自动备份
// ============================================================================

// TestPGAutoBackupScheduler 测试自动备份调度器
func TestPGAutoBackupScheduler(t *testing.T) {
	t.Run("创建调度器", func(t *testing.T) {
		scheduler := NewPGAutoBackupScheduler()

		if scheduler == nil {
			t.Error("调度器不应为 nil")
		}
	})

	t.Run("设置备份间隔", func(t *testing.T) {
		scheduler := NewPGAutoBackupScheduler()
		scheduler.SetInterval(24 * 60 * 60) // 24 小时

		if scheduler.GetInterval() != 24*60*60 {
			t.Error("间隔设置错误")
		}
	})

	t.Run("设置 Cron 表达式", func(t *testing.T) {
		scheduler := NewPGAutoBackupScheduler()
		err := scheduler.SetCronExpression("0 2 * * *") // 每天凌晨 2 点

		if err != nil {
			t.Errorf("设置 Cron 表达式失败: %v", err)
		}

		if scheduler.GetCronExpression() != "0 2 * * *" {
			t.Error("Cron 表达式设置错误")
		}
	})

	t.Run("无效的 Cron 表达式", func(t *testing.T) {
		scheduler := NewPGAutoBackupScheduler()
		err := scheduler.SetCronExpression("invalid")

		if err == nil {
			t.Error("无效的 Cron 表达式应该返回错误")
		}
	})

	t.Run("设置保留策略", func(t *testing.T) {
		scheduler := NewPGAutoBackupScheduler()
		scheduler.SetRetentionPolicy(&BackupRetentionPolicy{
			MaxBackups: 7,
			MaxAgeDays: 30,
		})

		policy := scheduler.GetRetentionPolicy()
		if policy.MaxBackups != 7 {
			t.Errorf("期望 MaxBackups=7, 实际 %d", policy.MaxBackups)
		}
	})

	t.Run("启动和停止", func(t *testing.T) {
		scheduler := NewPGAutoBackupScheduler()

		if scheduler.IsRunning() {
			t.Error("初始状态不应该在运行")
		}

		scheduler.Start()
		if !scheduler.IsRunning() {
			t.Error("启动后应该在运行")
		}

		scheduler.Stop()
		if scheduler.IsRunning() {
			t.Error("停止后不应该在运行")
		}
	})
}

// TestBackupRetentionPolicy 测试备份保留策略
func TestBackupRetentionPolicy(t *testing.T) {
	t.Run("默认策略", func(t *testing.T) {
		policy := DefaultBackupRetentionPolicy()

		if policy.MaxBackups <= 0 {
			t.Error("最大备份数应大于 0")
		}
		if policy.MaxAgeDays <= 0 {
			t.Error("最大保留天数应大于 0")
		}
	})

	t.Run("验证策略", func(t *testing.T) {
		policy := &BackupRetentionPolicy{
			MaxBackups: 5,
			MaxAgeDays: 14,
		}

		if err := policy.Validate(); err != nil {
			t.Errorf("有效策略不应返回错误: %v", err)
		}

		invalidPolicy := &BackupRetentionPolicy{
			MaxBackups: 0,
			MaxAgeDays: 0,
		}

		if err := invalidPolicy.Validate(); err == nil {
			t.Error("无效策略应返回错误")
		}
	})
}
