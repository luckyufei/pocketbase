package jobs

import (
	"os"
	"strconv"
	"time"
)

// Config 定义 jobs 插件配置
type Config struct {
	// Disabled 是否禁用插件（环境变量: PB_JOBS_DISABLED）
	Disabled bool

	// Workers Worker 池大小（环境变量: PB_JOBS_WORKERS，默认: 10）
	Workers int

	// PollInterval 轮询间隔（环境变量: PB_JOBS_POLL_INTERVAL，默认: 1s）
	PollInterval time.Duration

	// LockDuration 任务锁定时长（环境变量: PB_JOBS_LOCK_DURATION，默认: 5m）
	LockDuration time.Duration

	// BatchSize 批量获取任务数（环境变量: PB_JOBS_BATCH_SIZE，默认: 10）
	BatchSize int

	// MaxRetries 默认最大重试次数（默认: 3）
	MaxRetries int

	// MaxPayloadSize 最大 Payload 大小（默认: 1MB）
	MaxPayloadSize int64

	// HTTPEnabled 是否启用 HTTP API（环境变量: PB_JOBS_HTTP_ENABLED，默认: true）
	HTTPEnabled bool

	// EnqueueRule 入队权限规则（默认: "" 仅 Superuser）
	EnqueueRule string

	// ManageRule 管理权限规则（默认: "" 仅 Superuser）
	ManageRule string

	// AllowedTopics Topic 白名单（可选）
	AllowedTopics []string

	// AutoStart 是否自动启动 Dispatcher（环境变量: PB_JOBS_AUTO_START，默认: true）
	AutoStart bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		Disabled:       false,
		Workers:        10,
		PollInterval:   time.Second,
		LockDuration:   5 * time.Minute,
		BatchSize:      10,
		MaxRetries:     3,
		MaxPayloadSize: 1 << 20, // 1MB
		HTTPEnabled:    true,
		AutoStart:      true,
	}
}

// applyDefaults 应用默认值（仅对零值字段生效）
func applyDefaults(c Config) Config {
	d := DefaultConfig()
	if c.Workers <= 0 {
		c.Workers = d.Workers
	}
	if c.PollInterval <= 0 {
		c.PollInterval = d.PollInterval
	}
	if c.LockDuration <= 0 {
		c.LockDuration = d.LockDuration
	}
	if c.BatchSize <= 0 {
		c.BatchSize = d.BatchSize
	}
	if c.MaxRetries <= 0 {
		c.MaxRetries = d.MaxRetries
	}
	if c.MaxPayloadSize <= 0 {
		c.MaxPayloadSize = d.MaxPayloadSize
	}
	// 注意：HTTPEnabled 和 AutoStart 是 bool 类型，零值是 false
	// 无法区分 "用户明确设为 false" 和 "未设置使用默认值"
	// 所以这里不处理它们，在 DefaultConfig 中已经设为 true
	return c
}

// applyEnvOverrides 应用环境变量覆盖（环境变量优先级最高）
func applyEnvOverrides(c Config) Config {
	// PB_JOBS_DISABLED
	if v := os.Getenv("PB_JOBS_DISABLED"); v != "" {
		c.Disabled = v == "true" || v == "1"
	}

	// PB_JOBS_WORKERS
	if v := os.Getenv("PB_JOBS_WORKERS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			c.Workers = n
		}
	}

	// PB_JOBS_POLL_INTERVAL (支持 "1s", "500ms" 等格式)
	if v := os.Getenv("PB_JOBS_POLL_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			c.PollInterval = d
		}
	}

	// PB_JOBS_LOCK_DURATION
	if v := os.Getenv("PB_JOBS_LOCK_DURATION"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			c.LockDuration = d
		}
	}

	// PB_JOBS_BATCH_SIZE
	if v := os.Getenv("PB_JOBS_BATCH_SIZE"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			c.BatchSize = n
		}
	}

	// PB_JOBS_HTTP_ENABLED
	if v := os.Getenv("PB_JOBS_HTTP_ENABLED"); v != "" {
		c.HTTPEnabled = v == "true" || v == "1"
	}

	// PB_JOBS_AUTO_START
	if v := os.Getenv("PB_JOBS_AUTO_START"); v != "" {
		c.AutoStart = v == "true" || v == "1"
	}

	return c
}
