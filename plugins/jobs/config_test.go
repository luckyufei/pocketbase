package jobs

import (
	"os"
	"testing"
	"time"
)

// ==================== TDD: Config 测试 ====================

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	// 测试默认值
	if cfg.Disabled {
		t.Error("Disabled should be false by default")
	}
	if cfg.Workers != 10 {
		t.Errorf("expected Workers 10, got %d", cfg.Workers)
	}
	if cfg.PollInterval != time.Second {
		t.Errorf("expected PollInterval 1s, got %v", cfg.PollInterval)
	}
	if cfg.LockDuration != 5*time.Minute {
		t.Errorf("expected LockDuration 5m, got %v", cfg.LockDuration)
	}
	if cfg.BatchSize != 10 {
		t.Errorf("expected BatchSize 10, got %d", cfg.BatchSize)
	}
	if cfg.MaxRetries != 3 {
		t.Errorf("expected MaxRetries 3, got %d", cfg.MaxRetries)
	}
	if cfg.MaxPayloadSize != 1<<20 {
		t.Errorf("expected MaxPayloadSize 1MB, got %d", cfg.MaxPayloadSize)
	}
	if !cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be true by default")
	}
	if !cfg.AutoStart {
		t.Error("AutoStart should be true by default")
	}
}

func TestApplyDefaults(t *testing.T) {
	cfg := Config{} // 空配置
	cfg = applyDefaults(cfg)

	// 验证默认值被应用
	if cfg.Workers <= 0 {
		t.Error("Workers should be positive after applyDefaults")
	}
	if cfg.PollInterval <= 0 {
		t.Error("PollInterval should be positive after applyDefaults")
	}
	if cfg.LockDuration <= 0 {
		t.Error("LockDuration should be positive after applyDefaults")
	}
	if cfg.BatchSize <= 0 {
		t.Error("BatchSize should be positive after applyDefaults")
	}
	if cfg.MaxRetries <= 0 {
		t.Error("MaxRetries should be positive after applyDefaults")
	}
	if cfg.MaxPayloadSize <= 0 {
		t.Error("MaxPayloadSize should be positive after applyDefaults")
	}
}

func TestApplyDefaults_PreservesExistingValues(t *testing.T) {
	cfg := Config{
		Workers:      20,
		PollInterval: 2 * time.Second,
	}
	cfg = applyDefaults(cfg)

	if cfg.Workers != 20 {
		t.Errorf("expected Workers 20, got %d", cfg.Workers)
	}
	if cfg.PollInterval != 2*time.Second {
		t.Errorf("expected PollInterval 2s, got %v", cfg.PollInterval)
	}
}

// ==================== 环境变量覆盖测试 ====================

func TestApplyEnvOverrides_Disabled(t *testing.T) {
	os.Setenv("PB_JOBS_DISABLED", "1")
	defer os.Unsetenv("PB_JOBS_DISABLED")

	cfg := Config{Disabled: false}
	cfg = applyEnvOverrides(cfg)

	if !cfg.Disabled {
		t.Error("Disabled should be true from env PB_JOBS_DISABLED=1")
	}
}

func TestApplyEnvOverrides_Disabled_True(t *testing.T) {
	os.Setenv("PB_JOBS_DISABLED", "true")
	defer os.Unsetenv("PB_JOBS_DISABLED")

	cfg := Config{Disabled: false}
	cfg = applyEnvOverrides(cfg)

	if !cfg.Disabled {
		t.Error("Disabled should be true from env PB_JOBS_DISABLED=true")
	}
}

func TestApplyEnvOverrides_Workers(t *testing.T) {
	os.Setenv("PB_JOBS_WORKERS", "20")
	defer os.Unsetenv("PB_JOBS_WORKERS")

	cfg := Config{Workers: 10}
	cfg = applyEnvOverrides(cfg)

	if cfg.Workers != 20 {
		t.Errorf("expected Workers 20, got %d", cfg.Workers)
	}
}

func TestApplyEnvOverrides_PollInterval(t *testing.T) {
	os.Setenv("PB_JOBS_POLL_INTERVAL", "2s")
	defer os.Unsetenv("PB_JOBS_POLL_INTERVAL")

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	if cfg.PollInterval != 2*time.Second {
		t.Errorf("expected PollInterval 2s, got %v", cfg.PollInterval)
	}
}

func TestApplyEnvOverrides_LockDuration(t *testing.T) {
	os.Setenv("PB_JOBS_LOCK_DURATION", "10m")
	defer os.Unsetenv("PB_JOBS_LOCK_DURATION")

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	if cfg.LockDuration != 10*time.Minute {
		t.Errorf("expected LockDuration 10m, got %v", cfg.LockDuration)
	}
}

func TestApplyEnvOverrides_BatchSize(t *testing.T) {
	os.Setenv("PB_JOBS_BATCH_SIZE", "50")
	defer os.Unsetenv("PB_JOBS_BATCH_SIZE")

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	if cfg.BatchSize != 50 {
		t.Errorf("expected BatchSize 50, got %d", cfg.BatchSize)
	}
}

func TestApplyEnvOverrides_HTTPEnabled_False(t *testing.T) {
	os.Setenv("PB_JOBS_HTTP_ENABLED", "false")
	defer os.Unsetenv("PB_JOBS_HTTP_ENABLED")

	cfg := Config{HTTPEnabled: true}
	cfg = applyEnvOverrides(cfg)

	if cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be false from env")
	}
}

func TestApplyEnvOverrides_HTTPEnabled_Zero(t *testing.T) {
	os.Setenv("PB_JOBS_HTTP_ENABLED", "0")
	defer os.Unsetenv("PB_JOBS_HTTP_ENABLED")

	cfg := Config{HTTPEnabled: true}
	cfg = applyEnvOverrides(cfg)

	if cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be false from env PB_JOBS_HTTP_ENABLED=0")
	}
}

func TestApplyEnvOverrides_AutoStart_False(t *testing.T) {
	os.Setenv("PB_JOBS_AUTO_START", "false")
	defer os.Unsetenv("PB_JOBS_AUTO_START")

	cfg := Config{AutoStart: true}
	cfg = applyEnvOverrides(cfg)

	if cfg.AutoStart {
		t.Error("AutoStart should be false from env")
	}
}

func TestApplyEnvOverrides_InvalidValues(t *testing.T) {
	// 测试无效的环境变量值
	os.Setenv("PB_JOBS_WORKERS", "invalid")
	os.Setenv("PB_JOBS_BATCH_SIZE", "invalid")
	defer func() {
		os.Unsetenv("PB_JOBS_WORKERS")
		os.Unsetenv("PB_JOBS_BATCH_SIZE")
	}()

	cfg := Config{
		Workers:   10,
		BatchSize: 10,
	}
	cfg = applyEnvOverrides(cfg)

	// 无效值应该保持原值
	if cfg.Workers != 10 {
		t.Errorf("invalid env should not change Workers, got %d", cfg.Workers)
	}
	if cfg.BatchSize != 10 {
		t.Errorf("invalid env should not change BatchSize, got %d", cfg.BatchSize)
	}
}

func TestApplyEnvOverrides_InvalidDuration(t *testing.T) {
	os.Setenv("PB_JOBS_POLL_INTERVAL", "invalid")
	defer os.Unsetenv("PB_JOBS_POLL_INTERVAL")

	cfg := Config{PollInterval: 5 * time.Second}
	cfg = applyEnvOverrides(cfg)

	// 无效值应该保持原值
	if cfg.PollInterval != 5*time.Second {
		t.Errorf("invalid env should not change PollInterval, got %v", cfg.PollInterval)
	}
}

// ==================== 环境变量优先级测试 ====================

func TestEnvOverridesPriority(t *testing.T) {
	// 环境变量应该覆盖代码中的配置
	os.Setenv("PB_JOBS_WORKERS", "50")
	defer os.Unsetenv("PB_JOBS_WORKERS")

	cfg := Config{Workers: 10}
	cfg = applyEnvOverrides(cfg)
	cfg = applyDefaults(cfg)

	if cfg.Workers != 50 {
		t.Errorf("env should override config, expected 50, got %d", cfg.Workers)
	}
}
