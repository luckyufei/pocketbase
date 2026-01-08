// Package serverless 提供基于 WASM (QuickJS + wazero) 的 Serverless 运行时
package serverless

import (
	"testing"
)

// T001-T004: Setup 阶段测试

func TestPluginConfig(t *testing.T) {
	t.Run("默认配置应有合理默认值", func(t *testing.T) {
		cfg := DefaultConfig()

		if cfg.MaxMemoryMB <= 0 {
			t.Errorf("MaxMemoryMB 应大于 0, got %d", cfg.MaxMemoryMB)
		}
		if cfg.TimeoutSeconds <= 0 {
			t.Errorf("TimeoutSeconds 应大于 0, got %d", cfg.TimeoutSeconds)
		}
		if cfg.PoolSize <= 0 {
			t.Errorf("PoolSize 应大于 0, got %d", cfg.PoolSize)
		}
		if cfg.FunctionsDir == "" {
			t.Error("FunctionsDir 不应为空")
		}
		if cfg.CronTimeoutMinutes <= 0 {
			t.Errorf("CronTimeoutMinutes 应大于 0, got %d", cfg.CronTimeoutMinutes)
		}
		if !cfg.EnableBytecodeCache {
			t.Error("EnableBytecodeCache 默认应为 true")
		}
	})

	t.Run("配置可自定义", func(t *testing.T) {
		cfg := Config{
			MaxMemoryMB:         256,
			TimeoutSeconds:      60,
			CronTimeoutMinutes:  30,
			PoolSize:            10,
			FunctionsDir:        "/custom/path",
			NetworkWhitelist:    []string{"api.openai.com"},
			EnableBytecodeCache: false,
		}

		if cfg.MaxMemoryMB != 256 {
			t.Errorf("MaxMemoryMB = %d, want 256", cfg.MaxMemoryMB)
		}
		if cfg.TimeoutSeconds != 60 {
			t.Errorf("TimeoutSeconds = %d, want 60", cfg.TimeoutSeconds)
		}
		if cfg.CronTimeoutMinutes != 30 {
			t.Errorf("CronTimeoutMinutes = %d, want 30", cfg.CronTimeoutMinutes)
		}
		if len(cfg.NetworkWhitelist) != 1 {
			t.Errorf("NetworkWhitelist length = %d, want 1", len(cfg.NetworkWhitelist))
		}
	})
}

func TestPluginEntry(t *testing.T) {
	t.Run("Plugin 结构体应正确初始化", func(t *testing.T) {
		cfg := DefaultConfig()
		p := NewPlugin(nil, cfg)

		if p == nil {
			t.Fatal("NewPlugin 返回 nil")
		}
		if p.config.MaxMemoryMB != cfg.MaxMemoryMB {
			t.Errorf("config.MaxMemoryMB = %d, want %d", p.config.MaxMemoryMB, cfg.MaxMemoryMB)
		}
	})

	t.Run("Register 不应 panic", func(t *testing.T) {
		cfg := DefaultConfig()
		err := Register(nil, cfg)
		if err != nil {
			t.Errorf("Register() error = %v", err)
		}
	})

	t.Run("MustRegister 不应 panic", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("MustRegister() panicked: %v", r)
			}
		}()

		cfg := DefaultConfig()
		MustRegister(nil, cfg)
	})
}

func TestPluginRegister(t *testing.T) {
	t.Run("register 内部方法", func(t *testing.T) {
		cfg := DefaultConfig()
		p := NewPlugin(nil, cfg)

		err := p.register()
		if err != nil {
			t.Errorf("register() error = %v", err)
		}
	})
}
