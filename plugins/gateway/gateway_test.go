package gateway

import (
	"testing"
)

// TestConfig 测试 Plugin Config 结构体
func TestConfig(t *testing.T) {
	// 默认配置
	cfg := Config{}
	if cfg.Disabled {
		t.Error("default Disabled should be false")
	}

	// 带值配置
	cfg = Config{Disabled: true}
	if !cfg.Disabled {
		t.Error("Disabled should be true")
	}
}

// TestDefaultFlushInterval 测试默认 FlushInterval
func TestDefaultFlushInterval(t *testing.T) {
	if DefaultFlushInterval.Milliseconds() != 100 {
		t.Errorf("DefaultFlushInterval = %v, want 100ms", DefaultFlushInterval)
	}
}
