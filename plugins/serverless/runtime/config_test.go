// Package runtime 提供 WASM 运行时核心功能
package runtime

import (
	"testing"
	"time"
)

// T003: 运行时配置测试

func TestRuntimeConfig(t *testing.T) {
	t.Run("默认运行时配置", func(t *testing.T) {
		cfg := DefaultRuntimeConfig()

		if cfg.MaxMemory != 128*1024*1024 {
			t.Errorf("MaxMemory = %d, want %d", cfg.MaxMemory, 128*1024*1024)
		}
		if cfg.Timeout != 30*time.Second {
			t.Errorf("Timeout = %v, want %v", cfg.Timeout, 30*time.Second)
		}
		if cfg.MaxInstructions <= 0 {
			t.Errorf("MaxInstructions 应大于 0, got %d", cfg.MaxInstructions)
		}
	})

	t.Run("Cron 运行时配置", func(t *testing.T) {
		cfg := CronRuntimeConfig()

		if cfg.Timeout != 15*time.Minute {
			t.Errorf("Cron Timeout = %v, want %v", cfg.Timeout, 15*time.Minute)
		}
	})

	t.Run("配置验证", func(t *testing.T) {
		cfg := RuntimeConfig{
			MaxMemory:       0, // 无效
			Timeout:         0, // 无效
			MaxInstructions: 0, // 无效
		}

		err := cfg.Validate()
		if err == nil {
			t.Error("无效配置应返回错误")
		}
	})
}
