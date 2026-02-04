package kv

import (
	"os"
	"testing"
	"time"
)

// ==================== T005-T006: Config 测试 ====================

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	// 测试默认值
	if !cfg.L1Enabled {
		t.Error("L1Enabled should be true by default")
	}
	if cfg.L1TTL != 5*time.Second {
		t.Errorf("expected L1TTL 5s, got %v", cfg.L1TTL)
	}
	if cfg.L1MaxSize != 100*1024*1024 {
		t.Errorf("expected L1MaxSize 100MB, got %v", cfg.L1MaxSize)
	}
	if cfg.CleanupInterval != time.Minute {
		t.Errorf("expected CleanupInterval 1min, got %v", cfg.CleanupInterval)
	}
	if cfg.MaxKeyLength != 256 {
		t.Errorf("expected MaxKeyLength 256, got %d", cfg.MaxKeyLength)
	}
	if cfg.MaxValueSize != 1<<20 {
		t.Errorf("expected MaxValueSize 1MB, got %d", cfg.MaxValueSize)
	}
	if cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be false by default")
	}
}

func TestApplyDefaults(t *testing.T) {
	cfg := Config{} // 空配置
	cfg = applyDefaults(cfg)

	// 验证默认值被应用
	if cfg.L1TTL <= 0 {
		t.Error("L1TTL should be positive after applyDefaults")
	}
	if cfg.L1MaxSize <= 0 {
		t.Error("L1MaxSize should be positive after applyDefaults")
	}
	if cfg.CleanupInterval <= 0 {
		t.Error("CleanupInterval should be positive after applyDefaults")
	}
	if cfg.MaxKeyLength <= 0 {
		t.Error("MaxKeyLength should be positive after applyDefaults")
	}
	if cfg.MaxValueSize <= 0 {
		t.Error("MaxValueSize should be positive after applyDefaults")
	}
}

func TestApplyEnvOverrides_L1Enabled(t *testing.T) {
	// 测试 PB_KV_L1_ENABLED
	os.Setenv("PB_KV_L1_ENABLED", "false")
	defer os.Unsetenv("PB_KV_L1_ENABLED")

	cfg := Config{L1Enabled: true}
	cfg = applyEnvOverrides(cfg)

	if cfg.L1Enabled {
		t.Error("L1Enabled should be false from env")
	}
}

func TestApplyEnvOverrides_L1TTL(t *testing.T) {
	// 测试 PB_KV_L1_TTL (秒)
	os.Setenv("PB_KV_L1_TTL", "10")
	defer os.Unsetenv("PB_KV_L1_TTL")

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	if cfg.L1TTL != 10*time.Second {
		t.Errorf("expected L1TTL 10s, got %v", cfg.L1TTL)
	}
}

func TestApplyEnvOverrides_L1MaxSize(t *testing.T) {
	// 测试 PB_KV_L1_MAX_SIZE (MB)
	os.Setenv("PB_KV_L1_MAX_SIZE", "200")
	defer os.Unsetenv("PB_KV_L1_MAX_SIZE")

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	expected := int64(200 * 1024 * 1024)
	if cfg.L1MaxSize != expected {
		t.Errorf("expected L1MaxSize %d, got %d", expected, cfg.L1MaxSize)
	}
}

func TestApplyEnvOverrides_CleanupInterval(t *testing.T) {
	// 测试 PB_KV_CLEANUP_INTERVAL (秒)
	os.Setenv("PB_KV_CLEANUP_INTERVAL", "120")
	defer os.Unsetenv("PB_KV_CLEANUP_INTERVAL")

	cfg := Config{}
	cfg = applyEnvOverrides(cfg)

	if cfg.CleanupInterval != 120*time.Second {
		t.Errorf("expected CleanupInterval 120s, got %v", cfg.CleanupInterval)
	}
}

func TestApplyEnvOverrides_HTTPEnabled(t *testing.T) {
	// 测试 PB_KV_HTTP_ENABLED
	os.Setenv("PB_KV_HTTP_ENABLED", "true")
	defer os.Unsetenv("PB_KV_HTTP_ENABLED")

	cfg := Config{HTTPEnabled: false}
	cfg = applyEnvOverrides(cfg)

	if !cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be true from env")
	}
}

func TestApplyEnvOverrides_HTTPEnabled_WithOne(t *testing.T) {
	// 测试 PB_KV_HTTP_ENABLED=1
	os.Setenv("PB_KV_HTTP_ENABLED", "1")
	defer os.Unsetenv("PB_KV_HTTP_ENABLED")

	cfg := Config{HTTPEnabled: false}
	cfg = applyEnvOverrides(cfg)

	if !cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be true when env=1")
	}
}

func TestApplyEnvOverrides_InvalidValues(t *testing.T) {
	// 测试无效的环境变量值
	os.Setenv("PB_KV_L1_TTL", "invalid")
	os.Setenv("PB_KV_L1_MAX_SIZE", "invalid")
	defer func() {
		os.Unsetenv("PB_KV_L1_TTL")
		os.Unsetenv("PB_KV_L1_MAX_SIZE")
	}()

	cfg := Config{
		L1TTL:     5 * time.Second,
		L1MaxSize: 100,
	}
	cfg = applyEnvOverrides(cfg)

	// 无效值应该保持原值
	if cfg.L1TTL != 5*time.Second {
		t.Errorf("invalid env should not change L1TTL, got %v", cfg.L1TTL)
	}
	if cfg.L1MaxSize != 100 {
		t.Errorf("invalid env should not change L1MaxSize, got %d", cfg.L1MaxSize)
	}
}
