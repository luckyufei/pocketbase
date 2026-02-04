package kv

import (
	"os"
	"strconv"
	"time"
)

// Config 定义 kv 插件的配置选项
type Config struct {
	// L1Enabled 是否启用 L1 进程内缓存
	L1Enabled bool

	// L1TTL L1 缓存的默认 TTL
	L1TTL time.Duration

	// L1MaxSize L1 缓存的最大大小（字节）
	L1MaxSize int64

	// CleanupInterval 过期数据清理间隔
	CleanupInterval time.Duration

	// MaxKeyLength Key 最大长度
	MaxKeyLength int

	// MaxValueSize Value 最大大小（字节）
	MaxValueSize int64

	// HTTPEnabled 是否启用 HTTP API
	HTTPEnabled bool

	// ReadRule HTTP API 读权限规则
	ReadRule string

	// WriteRule HTTP API 写权限规则
	WriteRule string

	// AllowedPrefixes HTTP API 允许的 key 前缀
	AllowedPrefixes []string
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		L1Enabled:       true,
		L1TTL:           5 * time.Second,
		L1MaxSize:       100 * 1024 * 1024, // 100MB
		CleanupInterval: time.Minute,
		MaxKeyLength:    256,
		MaxValueSize:    1 << 20, // 1MB
		HTTPEnabled:     false,
		ReadRule:        "",
		WriteRule:       "",
	}
}

// applyDefaults 应用默认值
func applyDefaults(c Config) Config {
	d := DefaultConfig()
	if c.L1TTL <= 0 {
		c.L1TTL = d.L1TTL
	}
	if c.L1MaxSize <= 0 {
		c.L1MaxSize = d.L1MaxSize
	}
	if c.CleanupInterval <= 0 {
		c.CleanupInterval = d.CleanupInterval
	}
	if c.MaxKeyLength <= 0 {
		c.MaxKeyLength = d.MaxKeyLength
	}
	if c.MaxValueSize <= 0 {
		c.MaxValueSize = d.MaxValueSize
	}
	return c
}

// applyEnvOverrides 应用环境变量覆盖
func applyEnvOverrides(c Config) Config {
	if v := os.Getenv("PB_KV_L1_ENABLED"); v != "" {
		c.L1Enabled = v == "true" || v == "1"
	}
	if v := os.Getenv("PB_KV_L1_TTL"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.L1TTL = time.Duration(n) * time.Second
		}
	}
	if v := os.Getenv("PB_KV_L1_MAX_SIZE"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			c.L1MaxSize = n * 1024 * 1024 // MB to bytes
		}
	}
	if v := os.Getenv("PB_KV_CLEANUP_INTERVAL"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.CleanupInterval = time.Duration(n) * time.Second
		}
	}
	if v := os.Getenv("PB_KV_HTTP_ENABLED"); v != "" {
		c.HTTPEnabled = v == "true" || v == "1"
	}
	return c
}
