package trace

import (
	"os"
	"testing"
	"time"
)

// TestConfigDefaults 测试默认配置
func TestConfigDefaults(t *testing.T) {
	config := DefaultConfig()

	if config.Mode != ModeConditional {
		t.Errorf("Mode should default to ModeConditional, got %s", config.Mode)
	}
	if config.BufferSize != 10000 {
		t.Errorf("BufferSize should default to 10000, got %d", config.BufferSize)
	}
	if config.FlushInterval != time.Second {
		t.Errorf("FlushInterval should default to 1s, got %v", config.FlushInterval)
	}
	if config.BatchSize != 100 {
		t.Errorf("BatchSize should default to 100, got %d", config.BatchSize)
	}
	if config.RetentionDays != 7 {
		t.Errorf("RetentionDays should default to 7, got %d", config.RetentionDays)
	}
	if config.SampleRate != 1.0 {
		t.Errorf("SampleRate should default to 1.0, got %f", config.SampleRate)
	}
}

// TestApplyDefaults 测试应用默认值
func TestApplyDefaults(t *testing.T) {
	tests := []struct {
		name     string
		input    Config
		expected Config
	}{
		{
			name:  "empty config gets defaults",
			input: Config{},
			expected: Config{
				Mode:          ModeConditional,
				BufferSize:    10000,
				FlushInterval: time.Second,
				BatchSize:     100,
				RetentionDays: 7,
				SampleRate:    1.0,
			},
		},
		{
			name: "valid values are preserved",
			input: Config{
				Mode:          ModeFull,
				BufferSize:    5000,
				FlushInterval: 2 * time.Second,
				BatchSize:     50,
				RetentionDays: 14,
				SampleRate:    0.5,
			},
			expected: Config{
				Mode:          ModeFull,
				BufferSize:    5000,
				FlushInterval: 2 * time.Second,
				BatchSize:     50,
				RetentionDays: 14,
				SampleRate:    0.5,
			},
		},
		{
			name: "invalid values get corrected",
			input: Config{
				BufferSize:    -1,
				FlushInterval: 0,
				BatchSize:     0,
				RetentionDays: -1,
				SampleRate:    2.0, // > 1.0
			},
			expected: Config{
				Mode:          ModeConditional,
				BufferSize:    10000,
				FlushInterval: time.Second,
				BatchSize:     100,
				RetentionDays: 7,
				SampleRate:    1.0,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := applyDefaults(tt.input)

			if result.Mode != tt.expected.Mode {
				t.Errorf("Mode: got %s, want %s", result.Mode, tt.expected.Mode)
			}
			if result.BufferSize != tt.expected.BufferSize {
				t.Errorf("BufferSize: got %d, want %d", result.BufferSize, tt.expected.BufferSize)
			}
			if result.FlushInterval != tt.expected.FlushInterval {
				t.Errorf("FlushInterval: got %v, want %v", result.FlushInterval, tt.expected.FlushInterval)
			}
			if result.BatchSize != tt.expected.BatchSize {
				t.Errorf("BatchSize: got %d, want %d", result.BatchSize, tt.expected.BatchSize)
			}
			if result.RetentionDays != tt.expected.RetentionDays {
				t.Errorf("RetentionDays: got %d, want %d", result.RetentionDays, tt.expected.RetentionDays)
			}
			if result.SampleRate != tt.expected.SampleRate {
				t.Errorf("SampleRate: got %f, want %f", result.SampleRate, tt.expected.SampleRate)
			}
		})
	}
}

// TestApplyEnvOverrides 测试环境变量覆盖
func TestApplyEnvOverrides(t *testing.T) {
	// 保存原始环境变量
	originalVars := map[string]string{
		"PB_TRACE_MODE":           os.Getenv("PB_TRACE_MODE"),
		"PB_TRACE_SAMPLE_RATE":    os.Getenv("PB_TRACE_SAMPLE_RATE"),
		"PB_TRACE_SLOW_THRESHOLD": os.Getenv("PB_TRACE_SLOW_THRESHOLD"),
		"PB_TRACE_ERROR_ONLY":     os.Getenv("PB_TRACE_ERROR_ONLY"),
		"PB_TRACE_PATH_EXCLUDE":   os.Getenv("PB_TRACE_PATH_EXCLUDE"),
		"PB_TRACE_RETENTION_DAYS": os.Getenv("PB_TRACE_RETENTION_DAYS"),
		"PB_TRACE_BUFFER_SIZE":    os.Getenv("PB_TRACE_BUFFER_SIZE"),
		"PB_TRACE_FLUSH_INTERVAL": os.Getenv("PB_TRACE_FLUSH_INTERVAL"),
	}

	// 清理函数
	cleanup := func() {
		for key, val := range originalVars {
			if val == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, val)
			}
		}
	}
	defer cleanup()

	t.Run("PB_TRACE_MODE", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_MODE", "full")

		config := applyEnvOverrides(Config{})
		if config.Mode != ModeFull {
			t.Errorf("Mode should be 'full', got %s", config.Mode)
		}
	})

	t.Run("PB_TRACE_MODE off", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_MODE", "off")

		config := applyEnvOverrides(Config{})
		if config.Mode != ModeOff {
			t.Errorf("Mode should be 'off', got %s", config.Mode)
		}
	})

	t.Run("PB_TRACE_SAMPLE_RATE", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_SAMPLE_RATE", "0.5")

		config := applyEnvOverrides(Config{})
		if config.SampleRate != 0.5 {
			t.Errorf("SampleRate should be 0.5, got %f", config.SampleRate)
		}
	})

	t.Run("PB_TRACE_RETENTION_DAYS", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_RETENTION_DAYS", "14")

		config := applyEnvOverrides(Config{})
		if config.RetentionDays != 14 {
			t.Errorf("RetentionDays should be 14, got %d", config.RetentionDays)
		}
	})

	t.Run("PB_TRACE_BUFFER_SIZE", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_BUFFER_SIZE", "5000")

		config := applyEnvOverrides(Config{})
		if config.BufferSize != 5000 {
			t.Errorf("BufferSize should be 5000, got %d", config.BufferSize)
		}
	})

	t.Run("PB_TRACE_FLUSH_INTERVAL", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_FLUSH_INTERVAL", "5")

		config := applyEnvOverrides(Config{})
		if config.FlushInterval != 5*time.Second {
			t.Errorf("FlushInterval should be 5s, got %v", config.FlushInterval)
		}
	})

	t.Run("invalid env values are ignored", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_SAMPLE_RATE", "invalid")
		os.Setenv("PB_TRACE_BUFFER_SIZE", "not-a-number")

		config := Config{SampleRate: 0.8, BufferSize: 1000}
		result := applyEnvOverrides(config)

		// 无效值应该保留原值
		if result.SampleRate != 0.8 {
			t.Errorf("SampleRate should remain 0.8, got %f", result.SampleRate)
		}
		if result.BufferSize != 1000 {
			t.Errorf("BufferSize should remain 1000, got %d", result.BufferSize)
		}
	})
}

// TestDyeConfig 测试染色配置
func TestDyeConfig(t *testing.T) {
	// 保存原始环境变量
	originalVars := map[string]string{
		"PB_TRACE_DYE_USERS": os.Getenv("PB_TRACE_DYE_USERS"),
		"PB_TRACE_DYE_MAX":   os.Getenv("PB_TRACE_DYE_MAX"),
		"PB_TRACE_DYE_TTL":   os.Getenv("PB_TRACE_DYE_TTL"),
	}

	cleanup := func() {
		for key, val := range originalVars {
			if val == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, val)
			}
		}
	}
	defer cleanup()

	t.Run("default dye config", func(t *testing.T) {
		config := DefaultConfig()

		if config.DyeMaxUsers != 100 {
			t.Errorf("DyeMaxUsers should default to 100, got %d", config.DyeMaxUsers)
		}
		if config.DyeDefaultTTL != time.Hour {
			t.Errorf("DyeDefaultTTL should default to 1h, got %v", config.DyeDefaultTTL)
		}
	})

	t.Run("PB_TRACE_DYE_USERS", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_DYE_USERS", "user1,user2,user3")

		config := applyEnvOverrides(Config{})
		expected := []string{"user1", "user2", "user3"}

		if len(config.DyeUsers) != len(expected) {
			t.Errorf("DyeUsers length should be %d, got %d", len(expected), len(config.DyeUsers))
		}
		for i, u := range expected {
			if i < len(config.DyeUsers) && config.DyeUsers[i] != u {
				t.Errorf("DyeUsers[%d] should be %s, got %s", i, u, config.DyeUsers[i])
			}
		}
	})

	t.Run("PB_TRACE_DYE_MAX", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_DYE_MAX", "50")

		config := applyEnvOverrides(Config{})
		if config.DyeMaxUsers != 50 {
			t.Errorf("DyeMaxUsers should be 50, got %d", config.DyeMaxUsers)
		}
	})

	t.Run("PB_TRACE_DYE_TTL", func(t *testing.T) {
		cleanup()
		os.Setenv("PB_TRACE_DYE_TTL", "2h")

		config := applyEnvOverrides(Config{})
		if config.DyeDefaultTTL != 2*time.Hour {
			t.Errorf("DyeDefaultTTL should be 2h, got %v", config.DyeDefaultTTL)
		}
	})
}
