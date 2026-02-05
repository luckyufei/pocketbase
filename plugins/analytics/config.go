package analytics

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config 定义分析插件的配置
type Config struct {
	// Mode 运行模式 (off/conditional/full)
	Mode AnalyticsMode

	// Enabled 是否启用分析功能（向后兼容 analyticsEnabled）
	Enabled bool

	// Retention 数据保留天数
	Retention int

	// S3Bucket S3 存储桶名称（PostgreSQL 模式）
	S3Bucket string

	// S3Endpoint S3 端点（可选，用于兼容 S3 服务）
	S3Endpoint string

	// S3Region S3 区域
	S3Region string

	// S3AccessKey S3 访问密钥
	S3AccessKey string

	// S3SecretKey S3 密钥
	S3SecretKey string

	// FlushInterval 聚合数据刷新间隔
	FlushInterval time.Duration

	// MaxRawSize Raw Buffer 最大容量（字节）
	MaxRawSize int64
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		Mode:          ModeConditional,
		Enabled:       true,
		Retention:     90,
		FlushInterval: 10 * time.Second,
		MaxRawSize:    16 * 1024 * 1024, // 16MB
	}
}

// applyDefaults 应用默认值到配置
func applyDefaults(c Config) Config {
	if c.Mode == "" {
		c.Mode = ModeConditional
	}
	if c.Retention <= 0 {
		c.Retention = 90
	}
	if c.FlushInterval <= 0 {
		c.FlushInterval = 10 * time.Second
	}
	if c.MaxRawSize <= 0 {
		c.MaxRawSize = 16 * 1024 * 1024
	}
	return c
}

// applyEnvOverrides 应用环境变量覆盖
func applyEnvOverrides(c Config) Config {
	// PB_ANALYTICS_MODE
	if mode := os.Getenv("PB_ANALYTICS_MODE"); mode != "" {
		c.Mode = AnalyticsMode(mode)
	}

	// PB_ANALYTICS_ENABLED
	if enabled := os.Getenv("PB_ANALYTICS_ENABLED"); enabled != "" {
		c.Enabled = strings.ToLower(enabled) == "true" || enabled == "1"
	}

	// PB_ANALYTICS_RETENTION
	if retention := os.Getenv("PB_ANALYTICS_RETENTION"); retention != "" {
		if r, err := strconv.Atoi(retention); err == nil {
			c.Retention = r
		}
	}

	// PB_ANALYTICS_FLUSH_INTERVAL (秒)
	if interval := os.Getenv("PB_ANALYTICS_FLUSH_INTERVAL"); interval != "" {
		if i, err := strconv.Atoi(interval); err == nil {
			c.FlushInterval = time.Duration(i) * time.Second
		}
	}

	// PB_ANALYTICS_MAX_RAW_SIZE
	if maxSize := os.Getenv("PB_ANALYTICS_MAX_RAW_SIZE"); maxSize != "" {
		if s, err := strconv.ParseInt(maxSize, 10, 64); err == nil {
			c.MaxRawSize = s
		}
	}

	// S3 配置
	if bucket := os.Getenv("PB_ANALYTICS_S3_BUCKET"); bucket != "" {
		c.S3Bucket = bucket
	}
	if endpoint := os.Getenv("PB_ANALYTICS_S3_ENDPOINT"); endpoint != "" {
		c.S3Endpoint = endpoint
	}
	if region := os.Getenv("PB_ANALYTICS_S3_REGION"); region != "" {
		c.S3Region = region
	}
	if accessKey := os.Getenv("PB_ANALYTICS_S3_ACCESS_KEY"); accessKey != "" {
		c.S3AccessKey = accessKey
	}
	if secretKey := os.Getenv("PB_ANALYTICS_S3_SECRET_KEY"); secretKey != "" {
		c.S3SecretKey = secretKey
	}

	return c
}
