package metrics

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config 插件配置
type Config struct {
	// Disabled 禁用插件
	Disabled bool

	// CollectionInterval 采集间隔（默认 60 秒）
	CollectionInterval time.Duration

	// RetentionDays 数据保留天数（默认 7 天）
	RetentionDays int

	// LatencyBufferSize 延迟 Ring Buffer 大小（默认 1000）
	LatencyBufferSize int

	// EnableMiddleware 是否自动注册请求追踪中间件（默认 true）
	EnableMiddleware bool

	// CleanupCron 清理任务 Cron 表达式（默认 "0 3 * * *"）
	CleanupCron string

	// ResetLatencyBufferOnCollect 每次采集后是否重置延迟 buffer（默认 false）
	// 设为 true 时，P95 反映的是「采集周期内」的延迟分布
	// 设为 false 时，P95 反映的是「最近 N 个请求」的延迟分布
	ResetLatencyBufferOnCollect bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		Disabled:                    false,
		CollectionInterval:          DefaultCollectionInterval,
		RetentionDays:               DefaultRetentionDays,
		LatencyBufferSize:           DefaultLatencyBufferSize,
		EnableMiddleware:            true,
		CleanupCron:                 DefaultCleanupCron,
		ResetLatencyBufferOnCollect: false,
	}
}

// applyDefaults 应用默认值
func applyDefaults(config Config) Config {
	if config.CollectionInterval <= 0 {
		config.CollectionInterval = DefaultCollectionInterval
	}
	if config.RetentionDays <= 0 {
		config.RetentionDays = DefaultRetentionDays
	}
	if config.LatencyBufferSize <= 0 {
		config.LatencyBufferSize = DefaultLatencyBufferSize
	}
	if config.CleanupCron == "" {
		config.CleanupCron = DefaultCleanupCron
	}
	return config
}

// applyEnvOverrides 应用环境变量覆盖
func applyEnvOverrides(config Config) Config {
	// PB_METRICS_DISABLED
	if v := os.Getenv("PB_METRICS_DISABLED"); v != "" {
		config.Disabled = strings.EqualFold(v, "true") || v == "1"
	}

	// PB_METRICS_INTERVAL (秒)
	if v := os.Getenv("PB_METRICS_INTERVAL"); v != "" {
		if seconds, err := strconv.Atoi(v); err == nil && seconds > 0 {
			config.CollectionInterval = time.Duration(seconds) * time.Second
		}
	}

	// PB_METRICS_RETENTION_DAYS
	if v := os.Getenv("PB_METRICS_RETENTION_DAYS"); v != "" {
		if days, err := strconv.Atoi(v); err == nil && days > 0 {
			config.RetentionDays = days
		}
	}

	// PB_METRICS_BUFFER_SIZE
	if v := os.Getenv("PB_METRICS_BUFFER_SIZE"); v != "" {
		if size, err := strconv.Atoi(v); err == nil && size > 0 {
			config.LatencyBufferSize = size
		}
	}

	// PB_METRICS_MIDDLEWARE
	if v := os.Getenv("PB_METRICS_MIDDLEWARE"); v != "" {
		config.EnableMiddleware = strings.EqualFold(v, "true") || v == "1"
	}

	// PB_METRICS_CLEANUP_CRON
	if v := os.Getenv("PB_METRICS_CLEANUP_CRON"); v != "" {
		config.CleanupCron = v
	}

	// PB_METRICS_RESET_LATENCY_BUFFER
	if v := os.Getenv("PB_METRICS_RESET_LATENCY_BUFFER"); v != "" {
		config.ResetLatencyBufferOnCollect = strings.EqualFold(v, "true") || v == "1"
	}

	return config
}
