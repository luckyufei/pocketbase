package analytics

import (
	"context"
	"testing"
)

func TestNoopAnalytics_Track(t *testing.T) {
	noop := NewNoopAnalytics()

	// NoOp 应该静默成功
	err := noop.Track(&Event{})
	if err != nil {
		t.Errorf("NoopAnalytics.Track() error = %v, want nil", err)
	}

	// nil event 也应该成功
	err = noop.Track(nil)
	if err != nil {
		t.Errorf("NoopAnalytics.Track(nil) error = %v, want nil", err)
	}
}

func TestNoopAnalytics_Push(t *testing.T) {
	noop := NewNoopAnalytics()

	// Push 是 Track 的别名，应该静默成功
	err := noop.Push(&Event{})
	if err != nil {
		t.Errorf("NoopAnalytics.Push() error = %v, want nil", err)
	}

	// nil event 也应该成功
	err = noop.Push(nil)
	if err != nil {
		t.Errorf("NoopAnalytics.Push(nil) error = %v, want nil", err)
	}
}

func TestNoopAnalytics_IsEnabled(t *testing.T) {
	noop := NewNoopAnalytics()

	if noop.IsEnabled() {
		t.Error("NoopAnalytics.IsEnabled() should return false")
	}
}

func TestNoopAnalytics_Flush(t *testing.T) {
	noop := NewNoopAnalytics()

	// Flush 应该不 panic
	noop.Flush()
}

func TestNoopAnalytics_Close(t *testing.T) {
	noop := NewNoopAnalytics()

	err := noop.Close()
	if err != nil {
		t.Errorf("NoopAnalytics.Close() error = %v, want nil", err)
	}
}

func TestNoopAnalytics_Start(t *testing.T) {
	noop := NewNoopAnalytics()

	err := noop.Start(context.Background())
	if err != nil {
		t.Errorf("NoopAnalytics.Start() error = %v, want nil", err)
	}
}

func TestNoopAnalytics_Stop(t *testing.T) {
	noop := NewNoopAnalytics()

	err := noop.Stop(context.Background())
	if err != nil {
		t.Errorf("NoopAnalytics.Stop() error = %v, want nil", err)
	}
}

func TestNoopAnalytics_Repository(t *testing.T) {
	noop := NewNoopAnalytics()

	if noop.Repository() != nil {
		t.Error("NoopAnalytics.Repository() should return nil")
	}
}

func TestNoopAnalytics_Config(t *testing.T) {
	noop := NewNoopAnalytics()

	cfg := noop.Config()
	if cfg == nil {
		t.Error("NoopAnalytics.Config() should return non-nil")
	}
	if cfg.Mode != ModeOff {
		t.Errorf("NoopAnalytics.Config().Mode = %v, want %v", cfg.Mode, ModeOff)
	}
}

// BenchmarkNoopAnalytics_Track 验证 NoOp 模式零开销
func BenchmarkNoopAnalytics_Track(b *testing.B) {
	noop := NewNoopAnalytics()
	event := &Event{}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = noop.Track(event)
	}
}
