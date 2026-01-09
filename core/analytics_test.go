package core

import (
	"context"
	"testing"
)

func TestDefaultAnalyticsConfig(t *testing.T) {
	config := DefaultAnalyticsConfig()

	if !config.Enabled {
		t.Error("Enabled should be true by default")
	}
	if config.Retention != 90 {
		t.Errorf("Retention = %d, want 90", config.Retention)
	}
	if config.FlushInterval != 10 {
		t.Errorf("FlushInterval = %d, want 10", config.FlushInterval)
	}
	if config.RawBufferSize != 16*1024*1024 {
		t.Errorf("RawBufferSize = %d, want 16MB", config.RawBufferSize)
	}
}

func TestNewAnalytics(t *testing.T) {
	analytics := NewAnalytics(nil, nil)

	if analytics == nil {
		t.Fatal("NewAnalytics returned nil")
	}
	if analytics.config == nil {
		t.Error("config should not be nil")
	}
	if !analytics.IsEnabled() {
		t.Error("IsEnabled should be true with default config")
	}
}

func TestAnalyticsIsEnabled(t *testing.T) {
	tests := []struct {
		name    string
		config  *AnalyticsConfig
		want    bool
	}{
		{
			name:   "nil config",
			config: nil,
			want:   true, // 使用默认配置
		},
		{
			name:   "enabled true",
			config: &AnalyticsConfig{Enabled: true},
			want:   true,
		},
		{
			name:   "enabled false",
			config: &AnalyticsConfig{Enabled: false},
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			analytics := NewAnalytics(nil, tt.config)
			if got := analytics.IsEnabled(); got != tt.want {
				t.Errorf("IsEnabled() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAnalyticsStartStop(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:       true,
		RawBufferSize: 1024,
	}
	analytics := NewAnalytics(nil, config)

	ctx := context.Background()

	// 启动
	err := analytics.Start(ctx)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}

	// 验证缓冲区已创建
	if analytics.buffer == nil {
		t.Error("buffer should not be nil after Start")
	}

	// 重复启动应该是幂等的
	err = analytics.Start(ctx)
	if err != nil {
		t.Fatalf("Start() second call error = %v", err)
	}

	// 停止
	err = analytics.Stop(ctx)
	if err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
}

func TestAnalyticsStartDisabled(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled: false,
	}
	analytics := NewAnalytics(nil, config)

	ctx := context.Background()
	err := analytics.Start(ctx)

	if err != ErrAnalyticsDisabled {
		t.Errorf("Start() error = %v, want ErrAnalyticsDisabled", err)
	}
}

func TestAnalyticsPushDisabled(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled: false,
	}
	analytics := NewAnalytics(nil, config)

	event := &AnalyticsEvent{
		Event:     "page_view",
		Path:      "/home",
		SessionID: "sess_123",
	}

	err := analytics.Push(event)
	if err != ErrAnalyticsDisabled {
		t.Errorf("Push() error = %v, want ErrAnalyticsDisabled", err)
	}
}

func TestAnalyticsPushWithoutStart(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled: true,
	}
	analytics := NewAnalytics(nil, config)

	event := &AnalyticsEvent{
		Event:     "page_view",
		Path:      "/home",
		SessionID: "sess_123",
	}

	// 未启动时 buffer 为 nil
	err := analytics.Push(event)
	if err != ErrAnalyticsDisabled {
		t.Errorf("Push() error = %v, want ErrAnalyticsDisabled", err)
	}
}

func TestAnalyticsPushAfterStart(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:       true,
		RawBufferSize: 1024 * 1024,
	}
	analytics := NewAnalytics(nil, config)

	ctx := context.Background()
	if err := analytics.Start(ctx); err != nil {
		t.Fatalf("Start() error = %v", err)
	}

	event := &AnalyticsEvent{
		Event:     "page_view",
		Path:      "/home",
		SessionID: "sess_123",
	}

	err := analytics.Push(event)
	if err != nil {
		t.Errorf("Push() error = %v", err)
	}

	// 验证事件已入队
	if analytics.buffer.Len() != 1 {
		t.Errorf("buffer.Len() = %d, want 1", analytics.buffer.Len())
	}
}
