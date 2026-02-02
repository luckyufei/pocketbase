package trace

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config 定义 trace 插件配置
type Config struct {
	// Mode 追踪模式 (off/conditional/full)
	Mode TraceMode
	// Filters 过滤器列表
	Filters []Filter
	// BufferSize Ring Buffer 大小
	BufferSize int
	// FlushInterval 刷新间隔
	FlushInterval time.Duration
	// BatchSize 批量写入大小
	BatchSize int
	// RetentionDays 数据保留天数
	RetentionDays int
	// SampleRate 采样率 (0.0-1.0)
	SampleRate float64
	// DebugLevel 是否启用 Debug 日志
	DebugLevel bool

	// 染色相关配置
	// DyeUsers 预设染色用户 ID 列表（通过环境变量设置）
	DyeUsers []string
	// DyeMaxUsers 最大染色用户数量
	DyeMaxUsers int
	// DyeDefaultTTL 默认染色 TTL
	DyeDefaultTTL time.Duration
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		Mode:          ModeConditional,
		BufferSize:    10000,
		FlushInterval: time.Second,
		BatchSize:     100,
		RetentionDays: 7,
		SampleRate:    1.0,
		DebugLevel:    false,
		DyeMaxUsers:   100,
		DyeDefaultTTL: time.Hour,
	}
}

// applyDefaults 应用默认值到配置
func applyDefaults(c Config) Config {
	if c.Mode == "" {
		c.Mode = ModeConditional
	}
	if c.BufferSize <= 0 {
		c.BufferSize = 10000
	}
	if c.FlushInterval <= 0 {
		c.FlushInterval = time.Second
	}
	if c.BatchSize <= 0 {
		c.BatchSize = 100
	}
	if c.RetentionDays <= 0 {
		c.RetentionDays = 7
	}
	if c.SampleRate <= 0 || c.SampleRate > 1.0 {
		c.SampleRate = 1.0
	}
	if c.DyeMaxUsers <= 0 {
		c.DyeMaxUsers = 100
	}
	if c.DyeDefaultTTL <= 0 {
		c.DyeDefaultTTL = time.Hour
	}
	return c
}

// applyEnvOverrides 应用环境变量覆盖
func applyEnvOverrides(c Config) Config {
	// PB_TRACE_MODE
	if mode := os.Getenv("PB_TRACE_MODE"); mode != "" {
		c.Mode = TraceMode(mode)
	}

	// PB_TRACE_SAMPLE_RATE
	if rate := os.Getenv("PB_TRACE_SAMPLE_RATE"); rate != "" {
		if r, err := strconv.ParseFloat(rate, 64); err == nil {
			c.SampleRate = r
		}
	}

	// PB_TRACE_RETENTION_DAYS
	if days := os.Getenv("PB_TRACE_RETENTION_DAYS"); days != "" {
		if d, err := strconv.Atoi(days); err == nil {
			c.RetentionDays = d
		}
	}

	// PB_TRACE_BUFFER_SIZE
	if size := os.Getenv("PB_TRACE_BUFFER_SIZE"); size != "" {
		if s, err := strconv.Atoi(size); err == nil {
			c.BufferSize = s
		}
	}

	// PB_TRACE_FLUSH_INTERVAL (秒)
	if interval := os.Getenv("PB_TRACE_FLUSH_INTERVAL"); interval != "" {
		if i, err := strconv.Atoi(interval); err == nil {
			c.FlushInterval = time.Duration(i) * time.Second
		}
	}

	// 染色相关环境变量
	// PB_TRACE_DYE_USERS
	if users := os.Getenv("PB_TRACE_DYE_USERS"); users != "" {
		c.DyeUsers = strings.Split(users, ",")
		// 清理空白
		for i := range c.DyeUsers {
			c.DyeUsers[i] = strings.TrimSpace(c.DyeUsers[i])
		}
	}

	// PB_TRACE_DYE_MAX
	if max := os.Getenv("PB_TRACE_DYE_MAX"); max != "" {
		if m, err := strconv.Atoi(max); err == nil {
			c.DyeMaxUsers = m
		}
	}

	// PB_TRACE_DYE_TTL (格式: "1h", "30m", "2h30m")
	if ttl := os.Getenv("PB_TRACE_DYE_TTL"); ttl != "" {
		if d, err := time.ParseDuration(ttl); err == nil {
			c.DyeDefaultTTL = d
		}
	}

	return c
}
