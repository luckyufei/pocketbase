package secrets

import (
	"os"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()

	if config.DefaultEnv != DefaultEnv {
		t.Errorf("expected DefaultEnv=%s, got %s", DefaultEnv, config.DefaultEnv)
	}
	if config.MaxKeyLength != DefaultMaxKeyLength {
		t.Errorf("expected MaxKeyLength=%d, got %d", DefaultMaxKeyLength, config.MaxKeyLength)
	}
	if config.MaxValueSize != DefaultMaxValueSize {
		t.Errorf("expected MaxValueSize=%d, got %d", DefaultMaxValueSize, config.MaxValueSize)
	}
	if !config.EnableEnvIsolation {
		t.Error("expected EnableEnvIsolation=true")
	}
	if !config.HTTPEnabled {
		t.Error("expected HTTPEnabled=true")
	}
}

func TestApplyEnvOverrides(t *testing.T) {
	// 设置环境变量
	os.Setenv("PB_SECRETS_DEFAULT_ENV", "prod")
	os.Setenv("PB_SECRETS_MAX_KEY_LENGTH", "512")
	os.Setenv("PB_SECRETS_MAX_VALUE_SIZE", "8192")
	os.Setenv("PB_SECRETS_HTTP_ENABLED", "false")
	os.Setenv("PB_SECRETS_ENV_ISOLATION", "false")
	defer func() {
		os.Unsetenv("PB_SECRETS_DEFAULT_ENV")
		os.Unsetenv("PB_SECRETS_MAX_KEY_LENGTH")
		os.Unsetenv("PB_SECRETS_MAX_VALUE_SIZE")
		os.Unsetenv("PB_SECRETS_HTTP_ENABLED")
		os.Unsetenv("PB_SECRETS_ENV_ISOLATION")
	}()

	config := applyEnvOverrides(Config{})

	if config.DefaultEnv != "prod" {
		t.Errorf("expected DefaultEnv=prod, got %s", config.DefaultEnv)
	}
	if config.MaxKeyLength != 512 {
		t.Errorf("expected MaxKeyLength=512, got %d", config.MaxKeyLength)
	}
	if config.MaxValueSize != 8192 {
		t.Errorf("expected MaxValueSize=8192, got %d", config.MaxValueSize)
	}
	if config.HTTPEnabled {
		t.Error("expected HTTPEnabled=false")
	}
	if config.EnableEnvIsolation {
		t.Error("expected EnableEnvIsolation=false")
	}
}

func TestApplyDefaults(t *testing.T) {
	config := applyDefaults(Config{})

	if config.DefaultEnv != DefaultEnv {
		t.Errorf("expected DefaultEnv=%s, got %s", DefaultEnv, config.DefaultEnv)
	}
	if config.MaxKeyLength != DefaultMaxKeyLength {
		t.Errorf("expected MaxKeyLength=%d, got %d", DefaultMaxKeyLength, config.MaxKeyLength)
	}
	if config.MaxValueSize != DefaultMaxValueSize {
		t.Errorf("expected MaxValueSize=%d, got %d", DefaultMaxValueSize, config.MaxValueSize)
	}
}
