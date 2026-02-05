package secrets

import (
	"os"
	"strconv"
)

// 配置相关常量
const (
	// DefaultMaxKeyLength Key 最大长度
	DefaultMaxKeyLength = 256

	// DefaultMaxValueSize Value 最大大小 (4KB)
	DefaultMaxValueSize = 4 * 1024

	// DefaultEnv 默认环境
	DefaultEnv = "global"
)

// Config 定义 Secrets 插件配置
type Config struct {
	// EnableEnvIsolation 是否启用环境隔离（默认 true）
	EnableEnvIsolation bool

	// DefaultEnv 默认环境（默认 "global"）
	DefaultEnv string

	// MaxKeyLength Key 最大长度（默认 256）
	MaxKeyLength int

	// MaxValueSize 最大 Value 大小（默认 4KB）
	MaxValueSize int

	// HTTPEnabled 是否启用 HTTP API（默认 true）
	HTTPEnabled bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		EnableEnvIsolation: true,
		DefaultEnv:         DefaultEnv,
		MaxKeyLength:       DefaultMaxKeyLength,
		MaxValueSize:       DefaultMaxValueSize,
		HTTPEnabled:        true,
	}
}

// applyEnvOverrides 应用环境变量覆盖配置
func applyEnvOverrides(config Config) Config {
	// PB_SECRETS_DEFAULT_ENV
	if env := os.Getenv("PB_SECRETS_DEFAULT_ENV"); env != "" {
		config.DefaultEnv = env
	}

	// PB_SECRETS_MAX_KEY_LENGTH
	if v := os.Getenv("PB_SECRETS_MAX_KEY_LENGTH"); v != "" {
		if length, err := strconv.Atoi(v); err == nil && length > 0 {
			config.MaxKeyLength = length
		}
	}

	// PB_SECRETS_MAX_VALUE_SIZE
	if v := os.Getenv("PB_SECRETS_MAX_VALUE_SIZE"); v != "" {
		if size, err := strconv.Atoi(v); err == nil && size > 0 {
			config.MaxValueSize = size
		}
	}

	// PB_SECRETS_HTTP_ENABLED
	if v := os.Getenv("PB_SECRETS_HTTP_ENABLED"); v != "" {
		config.HTTPEnabled = v == "true" || v == "1"
	}

	// PB_SECRETS_ENV_ISOLATION
	if v := os.Getenv("PB_SECRETS_ENV_ISOLATION"); v != "" {
		config.EnableEnvIsolation = v == "true" || v == "1"
	}

	return config
}

// applyDefaults 应用默认值
func applyDefaults(config Config) Config {
	if config.DefaultEnv == "" {
		config.DefaultEnv = DefaultEnv
	}
	if config.MaxKeyLength <= 0 {
		config.MaxKeyLength = DefaultMaxKeyLength
	}
	if config.MaxValueSize <= 0 {
		config.MaxValueSize = DefaultMaxValueSize
	}
	return config
}
