package analytics

import (
	"context"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func TestRegister(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 测试注册
	err = Register(app, Config{
		Mode:    ModeConditional,
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// 获取实例
	analytics := GetAnalytics(app)
	if analytics == nil {
		t.Fatal("GetAnalytics() returned nil")
	}
	if !analytics.IsEnabled() {
		t.Error("Analytics should be enabled")
	}
}

func TestRegister_ModeOff(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 测试 Off 模式
	err = Register(app, Config{
		Mode: ModeOff,
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// 获取实例应该返回 NoOp
	analytics := GetAnalytics(app)
	if analytics == nil {
		t.Fatal("GetAnalytics() returned nil")
	}
	if analytics.IsEnabled() {
		t.Error("Analytics should be disabled in ModeOff")
	}
}

func TestGetAnalytics_NotRegistered(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 未注册时应返回 NoOp
	analytics := GetAnalytics(app)
	if analytics == nil {
		t.Fatal("GetAnalytics() should return NoOp, not nil")
	}
	if analytics.IsEnabled() {
		t.Error("Unregistered analytics should be disabled (NoOp)")
	}
}

func TestMustRegister(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// MustRegister 不应 panic
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("MustRegister() panicked: %v", r)
		}
	}()

	MustRegister(app, Config{
		Mode:    ModeConditional,
		Enabled: true,
	})
}

func TestRegister_MultipleApps(t *testing.T) {
	app1, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app1.Cleanup()

	app2, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app2.Cleanup()

	// 注册到不同的 app
	Register(app1, Config{Mode: ModeFull, Enabled: true})
	Register(app2, Config{Mode: ModeOff})

	// 获取各自的实例
	a1 := GetAnalytics(app1)
	a2 := GetAnalytics(app2)

	if !a1.IsEnabled() {
		t.Error("app1 analytics should be enabled")
	}
	if a2.IsEnabled() {
		t.Error("app2 analytics should be disabled")
	}
}

func TestAnalyticsImpl_Track(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// Track 应该成功（即使是空实现）
	err = analytics.Track(&Event{
		Event:     "page_view",
		Path:      "/home",
		SessionID: "test-session",
	})
	if err != nil {
		t.Errorf("Track() error = %v", err)
	}
}

func TestAnalyticsImpl_StartStop(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// Start 应该成功
	ctx := context.Background()
	err = analytics.Start(ctx)
	if err != nil {
		t.Errorf("Start() error = %v", err)
	}

	// Stop 应该成功
	err = analytics.Stop(ctx)
	if err != nil {
		t.Errorf("Stop() error = %v", err)
	}
}

func TestAnalyticsImpl_Flush(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// Flush 不应 panic
	analytics.Flush()
}

func TestAnalyticsImpl_Repository(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// Repository 当前返回 nil（Phase 2 实现）
	repo := analytics.Repository()
	if repo != nil {
		t.Error("Repository() should return nil (not yet implemented)")
	}
}

func TestAnalyticsImpl_Config(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true, Retention: 30})
	analytics := GetAnalytics(app)

	cfg := analytics.Config()
	if cfg == nil {
		t.Fatal("Config() should not return nil")
	}
	if cfg.Mode != ModeConditional {
		t.Errorf("Config().Mode = %v, want %v", cfg.Mode, ModeConditional)
	}
	if cfg.Retention != 30 {
		t.Errorf("Config().Retention = %d, want 30", cfg.Retention)
	}
}

func TestAnalyticsImpl_Close(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	err = analytics.Close()
	if err != nil {
		t.Errorf("Close() error = %v", err)
	}
}

func TestRegister_DisabledMode(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 测试 Enabled=false
	Register(app, Config{Mode: ModeConditional, Enabled: false})
	analytics := GetAnalytics(app)

	if analytics.IsEnabled() {
		t.Error("Analytics should be disabled when Enabled=false")
	}
}

func TestAnalyticsImpl_Push(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册并获取实例
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// Push 是 Track 的别名
	err = analytics.Push(&Event{
		Event:     "page_view",
		Path:      "/home",
		SessionID: "test-session",
	})
	if err != nil {
		t.Errorf("Push() error = %v", err)
	}
}

func TestAnalyticsImpl_TrackDisabled(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册 disabled 模式
	Register(app, Config{Mode: ModeOff, Enabled: false})
	analytics := GetAnalytics(app)

	// Track 应该返回 nil（NoOp 的行为）
	err = analytics.Track(&Event{
		Event: "page_view",
		Path:  "/home",
	})
	// NoOp 总是返回 nil
	if err != nil {
		t.Errorf("Track() on NoOp should return nil, got %v", err)
	}
}

func TestAnalyticsImpl_TrackWhenDisabled(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册 enabled 模式但之后禁用
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// 先停止
	_ = analytics.Stop(context.Background())

	// 如果 analytics 仍然启用，Track 应该工作
	// 因为 IsEnabled 只检查 config，不检查 running 状态
	if analytics.IsEnabled() {
		err = analytics.Track(&Event{
			Event: "page_view",
			Path:  "/home",
		})
		if err != nil {
			t.Errorf("Track() should work even after Stop(), got %v", err)
		}
	}
}

// TestRegister_CronJob 测试 Cron 清理任务是否被注册
func TestRegister_CronJob(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册 analytics（启用模式）
	err = Register(app, Config{
		Mode:      ModeConditional,
		Enabled:   true,
		Retention: 30, // 30 天保留期
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// 检查 Cron 任务是否已注册
	// __pbAnalyticsPrune__ 是我们的 Cron 任务 ID
	cron := app.Cron()
	jobs := cron.Jobs()

	found := false
	for _, job := range jobs {
		if job.Id() == "__pbAnalyticsPrune__" {
			found = true
			break
		}
	}

	if !found {
		t.Error("Cron job __pbAnalyticsPrune__ should be registered")
	}
}

// TestRegister_CronJob_Disabled 测试禁用模式下不注册 Cron 任务
func TestRegister_CronJob_Disabled(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册 analytics（禁用模式）
	err = Register(app, Config{
		Mode:    ModeOff,
		Enabled: false,
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// 检查 Cron 任务是否未注册
	cron := app.Cron()
	jobs := cron.Jobs()

	for _, job := range jobs {
		if job.Id() == "__pbAnalyticsPrune__" {
			t.Error("Cron job should NOT be registered when analytics is disabled")
			break
		}
	}
}
