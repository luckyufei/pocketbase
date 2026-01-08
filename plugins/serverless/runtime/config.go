// Package runtime 提供 WASM 运行时核心功能
package runtime

import (
	"errors"
	"time"
)

// RuntimeConfig 定义单个运行时实例的配置
type RuntimeConfig struct {
	// MaxMemory 最大内存限制（字节）
	MaxMemory uint64

	// Timeout 执行超时时间
	Timeout time.Duration

	// MaxInstructions 最大指令数（防死循环）
	MaxInstructions uint64

	// EnableGC 启用垃圾回收
	EnableGC bool
}

// DefaultRuntimeConfig 返回默认运行时配置
// 适用于 HTTP Handler
func DefaultRuntimeConfig() RuntimeConfig {
	return RuntimeConfig{
		MaxMemory:       128 * 1024 * 1024, // 128MB
		Timeout:         30 * time.Second,
		MaxInstructions: 100_000_000, // 1 亿条指令
		EnableGC:        true,
	}
}

// CronRuntimeConfig 返回 Cron 任务的运行时配置
// Cron 任务允许更长的执行时间
func CronRuntimeConfig() RuntimeConfig {
	cfg := DefaultRuntimeConfig()
	cfg.Timeout = 15 * time.Minute
	cfg.MaxInstructions = 1_000_000_000 // 10 亿条指令
	return cfg
}

// Validate 验证配置有效性
func (c *RuntimeConfig) Validate() error {
	if c.MaxMemory == 0 {
		return errors.New("MaxMemory 必须大于 0")
	}
	if c.Timeout == 0 {
		return errors.New("Timeout 必须大于 0")
	}
	if c.MaxInstructions == 0 {
		return errors.New("MaxInstructions 必须大于 0")
	}
	return nil
}
