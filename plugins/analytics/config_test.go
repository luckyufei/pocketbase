package analytics

import (
	"os"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Mode != ModeConditional {
		t.Errorf("DefaultConfig().Mode = %v, want %v", cfg.Mode, ModeConditional)
	}
	if !cfg.Enabled {
		t.Error("DefaultConfig().Enabled should be true")
	}
	if cfg.Retention != 90 {
		t.Errorf("DefaultConfig().Retention = %v, want 90", cfg.Retention)
	}
	if cfg.FlushInterval != 10*time.Second {
		t.Errorf("DefaultConfig().FlushInterval = %v, want 10s", cfg.FlushInterval)
	}
	if cfg.MaxRawSize != 16*1024*1024 {
		t.Errorf("DefaultConfig().MaxRawSize = %v, want 16MB", cfg.MaxRawSize)
	}
}

func TestApplyDefaults(t *testing.T) {
	// 空配置应该应用默认值
	cfg := Config{}
	cfg = applyDefaults(cfg)

	if cfg.Mode != ModeConditional {
		t.Errorf("applyDefaults().Mode = %v, want %v", cfg.Mode, ModeConditional)
	}
	if cfg.Retention != 90 {
		t.Errorf("applyDefaults().Retention = %v, want 90", cfg.Retention)
	}
	if cfg.FlushInterval != 10*time.Second {
		t.Errorf("applyDefaults().FlushInterval = %v, want 10s", cfg.FlushInterval)
	}
	if cfg.MaxRawSize != 16*1024*1024 {
		t.Errorf("applyDefaults().MaxRawSize = %v, want 16MB", cfg.MaxRawSize)
	}
}

func TestApplyDefaults_PreservesValues(t *testing.T) {
	// 已设置的值不应被覆盖
	cfg := Config{
		Mode:          ModeFull,
		Enabled:       false,
		Retention:     30,
		FlushInterval: 5 * time.Second,
		MaxRawSize:    8 * 1024 * 1024,
	}
	cfg = applyDefaults(cfg)

	if cfg.Mode != ModeFull {
		t.Errorf("applyDefaults() should preserve Mode, got %v", cfg.Mode)
	}
	if cfg.Enabled {
		t.Error("applyDefaults() should preserve Enabled=false")
	}
	if cfg.Retention != 30 {
		t.Errorf("applyDefaults() should preserve Retention, got %v", cfg.Retention)
	}
	if cfg.FlushInterval != 5*time.Second {
		t.Errorf("applyDefaults() should preserve FlushInterval, got %v", cfg.FlushInterval)
	}
	if cfg.MaxRawSize != 8*1024*1024 {
		t.Errorf("applyDefaults() should preserve MaxRawSize, got %v", cfg.MaxRawSize)
	}
}

func TestApplyEnvOverrides(t *testing.T) {
	// 设置环境变量
	os.Setenv("PB_ANALYTICS_MODE", "full")
	os.Setenv("PB_ANALYTICS_ENABLED", "false")
	os.Setenv("PB_ANALYTICS_RETENTION", "30")
	os.Setenv("PB_ANALYTICS_FLUSH_INTERVAL", "5")
	os.Setenv("PB_ANALYTICS_MAX_RAW_SIZE", "8388608")
	os.Setenv("PB_ANALYTICS_S3_BUCKET", "my-bucket")
	defer func() {
		os.Unsetenv("PB_ANALYTICS_MODE")
		os.Unsetenv("PB_ANALYTICS_ENABLED")
		os.Unsetenv("PB_ANALYTICS_RETENTION")
		os.Unsetenv("PB_ANALYTICS_FLUSH_INTERVAL")
		os.Unsetenv("PB_ANALYTICS_MAX_RAW_SIZE")
		os.Unsetenv("PB_ANALYTICS_S3_BUCKET")
	}()

	cfg := Config{
		Mode:    ModeConditional,
		Enabled: true,
	}
	cfg = applyEnvOverrides(cfg)

	if cfg.Mode != ModeFull {
		t.Errorf("applyEnvOverrides().Mode = %v, want %v", cfg.Mode, ModeFull)
	}
	if cfg.Enabled {
		t.Error("applyEnvOverrides().Enabled should be false")
	}
	if cfg.Retention != 30 {
		t.Errorf("applyEnvOverrides().Retention = %v, want 30", cfg.Retention)
	}
	if cfg.FlushInterval != 5*time.Second {
		t.Errorf("applyEnvOverrides().FlushInterval = %v, want 5s", cfg.FlushInterval)
	}
	if cfg.MaxRawSize != 8388608 {
		t.Errorf("applyEnvOverrides().MaxRawSize = %v, want 8388608", cfg.MaxRawSize)
	}
	if cfg.S3Bucket != "my-bucket" {
		t.Errorf("applyEnvOverrides().S3Bucket = %v, want my-bucket", cfg.S3Bucket)
	}
}

func TestApplyEnvOverrides_InvalidValues(t *testing.T) {
	// 设置无效的环境变量值
	os.Setenv("PB_ANALYTICS_RETENTION", "invalid")
	os.Setenv("PB_ANALYTICS_FLUSH_INTERVAL", "invalid")
	os.Setenv("PB_ANALYTICS_MAX_RAW_SIZE", "invalid")
	defer func() {
		os.Unsetenv("PB_ANALYTICS_RETENTION")
		os.Unsetenv("PB_ANALYTICS_FLUSH_INTERVAL")
		os.Unsetenv("PB_ANALYTICS_MAX_RAW_SIZE")
	}()

	cfg := Config{
		Retention:     90,
		FlushInterval: 10 * time.Second,
		MaxRawSize:    16 * 1024 * 1024,
	}
	cfg = applyEnvOverrides(cfg)

	// 无效值不应改变原有配置
	if cfg.Retention != 90 {
		t.Errorf("applyEnvOverrides() should ignore invalid Retention, got %v", cfg.Retention)
	}
	if cfg.FlushInterval != 10*time.Second {
		t.Errorf("applyEnvOverrides() should ignore invalid FlushInterval, got %v", cfg.FlushInterval)
	}
	if cfg.MaxRawSize != 16*1024*1024 {
		t.Errorf("applyEnvOverrides() should ignore invalid MaxRawSize, got %v", cfg.MaxRawSize)
	}
}

func TestApplyEnvOverrides_EnabledTrue(t *testing.T) {
	// 测试 PB_ANALYTICS_ENABLED=true
	os.Setenv("PB_ANALYTICS_ENABLED", "true")
	defer os.Unsetenv("PB_ANALYTICS_ENABLED")

	cfg := Config{Enabled: false}
	cfg = applyEnvOverrides(cfg)

	if !cfg.Enabled {
		t.Error("applyEnvOverrides() should set Enabled=true when env is 'true'")
	}
}

func TestApplyEnvOverrides_Enabled1(t *testing.T) {
	// 测试 PB_ANALYTICS_ENABLED=1
	os.Setenv("PB_ANALYTICS_ENABLED", "1")
	defer os.Unsetenv("PB_ANALYTICS_ENABLED")

	cfg := Config{Enabled: false}
	cfg = applyEnvOverrides(cfg)

	if !cfg.Enabled {
		t.Error("applyEnvOverrides() should set Enabled=true when env is '1'")
	}
}

func TestApplyEnvOverrides_S3Config(t *testing.T) {
	// 设置所有 S3 环境变量
	os.Setenv("PB_ANALYTICS_S3_BUCKET", "test-bucket")
	os.Setenv("PB_ANALYTICS_S3_ENDPOINT", "https://s3.example.com")
	os.Setenv("PB_ANALYTICS_S3_REGION", "us-east-1")
	os.Setenv("PB_ANALYTICS_S3_ACCESS_KEY", "access-key")
	os.Setenv("PB_ANALYTICS_S3_SECRET_KEY", "secret-key")
	defer func() {
		os.Unsetenv("PB_ANALYTICS_S3_BUCKET")
		os.Unsetenv("PB_ANALYTICS_S3_ENDPOINT")
		os.Unsetenv("PB_ANALYTICS_S3_REGION")
		os.Unsetenv("PB_ANALYTICS_S3_ACCESS_KEY")
		os.Unsetenv("PB_ANALYTICS_S3_SECRET_KEY")
	}()

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	if cfg.S3Bucket != "test-bucket" {
		t.Errorf("S3Bucket = %v, want test-bucket", cfg.S3Bucket)
	}
	if cfg.S3Endpoint != "https://s3.example.com" {
		t.Errorf("S3Endpoint = %v, want https://s3.example.com", cfg.S3Endpoint)
	}
	if cfg.S3Region != "us-east-1" {
		t.Errorf("S3Region = %v, want us-east-1", cfg.S3Region)
	}
	if cfg.S3AccessKey != "access-key" {
		t.Errorf("S3AccessKey = %v, want access-key", cfg.S3AccessKey)
	}
	if cfg.S3SecretKey != "secret-key" {
		t.Errorf("S3SecretKey = %v, want secret-key", cfg.S3SecretKey)
	}
}

func TestApplyEnvOverrides_EmptyEnv(t *testing.T) {
	// 确保没有设置任何环境变量
	os.Unsetenv("PB_ANALYTICS_MODE")
	os.Unsetenv("PB_ANALYTICS_ENABLED")
	os.Unsetenv("PB_ANALYTICS_RETENTION")
	os.Unsetenv("PB_ANALYTICS_FLUSH_INTERVAL")
	os.Unsetenv("PB_ANALYTICS_MAX_RAW_SIZE")
	os.Unsetenv("PB_ANALYTICS_S3_BUCKET")

	cfg := Config{
		Mode:          ModeFull,
		Enabled:       true,
		Retention:     30,
		FlushInterval: 5 * time.Second,
		MaxRawSize:    8 * 1024 * 1024,
	}
	original := cfg
	cfg = applyEnvOverrides(cfg)

	// 没有环境变量时，配置不应改变
	if cfg.Mode != original.Mode {
		t.Error("Mode should not change without env var")
	}
	if cfg.Enabled != original.Enabled {
		t.Error("Enabled should not change without env var")
	}
	if cfg.Retention != original.Retention {
		t.Error("Retention should not change without env var")
	}
	if cfg.FlushInterval != original.FlushInterval {
		t.Error("FlushInterval should not change without env var")
	}
	if cfg.MaxRawSize != original.MaxRawSize {
		t.Error("MaxRawSize should not change without env var")
	}
}
