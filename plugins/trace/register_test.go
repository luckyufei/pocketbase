package trace

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// TestRegister 测试 Register 函数
func TestRegister(t *testing.T) {
	t.Run("Register with valid config", func(t *testing.T) {
		app := &mockRegisterApp{
			onTerminate: &hook.Hook[*core.TerminateEvent]{},
		}
		config := DefaultConfig()

		err := Register(app, config)
		if err != nil {
			t.Errorf("Register should not return error, got %v", err)
		}

		tracer := GetTracer(app)
		if tracer == nil {
			t.Error("Register should set tracer")
		}
		if !tracer.IsEnabled() {
			t.Error("Tracer should be enabled")
		}
	})

	t.Run("Register with ModeOff", func(t *testing.T) {
		app := &mockRegisterApp{
			onTerminate: &hook.Hook[*core.TerminateEvent]{},
		}
		config := Config{Mode: ModeOff}

		err := Register(app, config)
		if err != nil {
			t.Errorf("Register should not return error, got %v", err)
		}

		// ModeOff 时应该设置 NoopTracer
		tracer := GetTracer(app)
		if _, ok := tracer.(*NoopTracer); !ok {
			t.Error("Register with ModeOff should set NoopTracer")
		}
	})

	t.Run("Register applies env overrides", func(t *testing.T) {
		app := &mockRegisterApp{
			onTerminate: &hook.Hook[*core.TerminateEvent]{},
		}
		config := Config{
			SampleRate: 0.5,
		}

		err := Register(app, config)
		if err != nil {
			t.Errorf("Register should not return error, got %v", err)
		}
	})
}

// TestMustRegister 测试 MustRegister 函数
func TestMustRegister(t *testing.T) {
	t.Run("MustRegister with valid config", func(t *testing.T) {
		app := &mockRegisterApp{
			onTerminate: &hook.Hook[*core.TerminateEvent]{},
		}
		config := DefaultConfig()

		// 不应该 panic
		MustRegister(app, config)

		tracer := GetTracer(app)
		if tracer == nil {
			t.Error("MustRegister should set tracer")
		}
	})
}

// TestGetTracer 测试 GetTracer 函数
func TestGetTracer(t *testing.T) {
	t.Run("returns NoopTracer for unregistered app", func(t *testing.T) {
		app := &mockRegisterApp{
			onTerminate: &hook.Hook[*core.TerminateEvent]{},
		}
		tracer := GetTracer(app)
		if _, ok := tracer.(*NoopTracer); !ok {
			t.Error("GetTracer should return NoopTracer for unregistered app")
		}
	})

	t.Run("returns registered tracer", func(t *testing.T) {
		app := &mockRegisterApp{
			onTerminate: &hook.Hook[*core.TerminateEvent]{},
		}
		config := Config{Mode: ModeFull}
		_ = Register(app, config)

		tracer := GetTracer(app)
		if _, ok := tracer.(*NoopTracer); ok {
			t.Error("GetTracer should return registered tracer, not NoopTracer")
		}
	})
}

// mockRegisterApp 用于测试的模拟 App
type mockRegisterApp struct {
	core.App
	onTerminate *hook.Hook[*core.TerminateEvent]
}

func (m *mockRegisterApp) OnTerminate() *hook.Hook[*core.TerminateEvent] {
	return m.onTerminate
}
