package trace_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/trace"
)

// ============================================================================
// T071: 插件注册集成测试
// ============================================================================

func TestPluginRegistrationIntegration(t *testing.T) {
	const testDataDir = "./pb_trace_plugin_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 在 Bootstrap 前注册插件
	trace.MustRegister(app, trace.Config{
		Mode:       trace.ModeConditional,
		SampleRate: 1.0,
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	// 验证 Tracer 已注册
	tracer := trace.GetTracer(app)
	if tracer == nil {
		t.Fatal("Expected GetTracer() to return non-nil Tracer instance")
	}

	// 验证不是 NoopTracer
	if !tracer.IsEnabled() {
		t.Error("Expected tracer to be enabled")
	}
}

func TestPluginRegistrationWithModeOff(t *testing.T) {
	const testDataDir = "./pb_trace_plugin_test_off/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 注册 ModeOff 配置
	trace.MustRegister(app, trace.Config{
		Mode: trace.ModeOff,
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)
	if tracer == nil {
		t.Fatal("Expected GetTracer() to return non-nil Tracer instance")
	}

	// ModeOff 时应该返回 NoopTracer
	if tracer.IsEnabled() {
		t.Error("Expected tracer to be disabled in ModeOff")
	}
}

func TestPluginRegistrationWithDyeStore(t *testing.T) {
	const testDataDir = "./pb_trace_plugin_test_dye/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 注册带染色配置
	trace.MustRegister(app, trace.Config{
		Mode:          trace.ModeConditional,
		DyeMaxUsers:   100,
		DyeDefaultTTL: time.Hour,
		DyeUsers:      []string{"user1", "user2"},
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)

	// 验证染色用户已预设
	if !trace.IsDyed(tracer, "user1") {
		t.Error("Expected user1 to be dyed")
	}
	if !trace.IsDyed(tracer, "user2") {
		t.Error("Expected user2 to be dyed")
	}
	if trace.IsDyed(tracer, "user3") {
		t.Error("Expected user3 to not be dyed")
	}
}

// ============================================================================
// T072: HTTP 中间件集成测试
// ============================================================================

func TestMiddlewareIntegration(t *testing.T) {
	const testDataDir = "./pb_trace_middleware_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 注册插件
	trace.MustRegister(app, trace.Config{
		Mode:       trace.ModeFull,
		SampleRate: 1.0,
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)

	// 测试创建 Span
	ctx := context.Background()
	ctx, span := tracer.StartSpan(ctx, "test-request")
	if span == nil {
		t.Fatal("Expected span to be created")
	}
	span.SetAttribute("http.method", "GET")
	span.SetAttribute("http.url", "/api/test")
	span.End()
}

// ============================================================================
// T073: 条件采集端到端测试
// ============================================================================

func TestConditionalTraceIntegration(t *testing.T) {
	const testDataDir = "./pb_trace_conditional_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 注册条件模式
	trace.MustRegister(app, trace.Config{
		Mode:       trace.ModeConditional,
		SampleRate: 0.0, // 采样率为 0，默认不采集
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)
	if tracer == nil {
		t.Fatal("Expected tracer to be set")
	}

	// 条件模式下，Tracer 应该启用
	if !tracer.IsEnabled() {
		t.Error("Expected tracer to be enabled in conditional mode")
	}
}

// ============================================================================
// T074: 用户染色端到端测试
// ============================================================================

func TestUserDyeIntegration(t *testing.T) {
	const testDataDir = "./pb_trace_dye_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 注册带染色功能
	trace.MustRegister(app, trace.Config{
		Mode:          trace.ModeConditional,
		DyeMaxUsers:   10,
		DyeDefaultTTL: time.Hour,
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)

	// 测试动态添加染色用户
	err := trace.DyeUser(tracer, "test-user", time.Minute)
	if err != nil {
		t.Errorf("DyeUser failed: %v", err)
	}

	// 验证用户被染色
	if !trace.IsDyed(tracer, "test-user") {
		t.Error("Expected test-user to be dyed")
	}

	// 测试移除染色
	err = trace.UndyeUser(tracer, "test-user")
	if err != nil {
		t.Errorf("UndyeUser failed: %v", err)
	}

	// 验证用户不再被染色
	if trace.IsDyed(tracer, "test-user") {
		t.Error("Expected test-user to not be dyed after undye")
	}
}

func TestDyeUserLimit(t *testing.T) {
	const testDataDir = "./pb_trace_dye_limit_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	// 设置很小的染色用户上限
	trace.MustRegister(app, trace.Config{
		Mode:          trace.ModeConditional,
		DyeMaxUsers:   2,
		DyeDefaultTTL: time.Hour,
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)

	// 添加两个用户
	trace.DyeUser(tracer, "user1", time.Minute)
	trace.DyeUser(tracer, "user2", time.Minute)

	// 第三个用户应该失败
	err := trace.DyeUser(tracer, "user3", time.Minute)
	if err == nil {
		t.Error("Expected error when exceeding max dye users limit")
	}
}

// ============================================================================
// T075: 染色 API 集成测试
// ============================================================================

func TestListDyedUsersIntegration(t *testing.T) {
	const testDataDir = "./pb_trace_list_dyed_test/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	trace.MustRegister(app, trace.Config{
		Mode:          trace.ModeConditional,
		DyeMaxUsers:   10,
		DyeDefaultTTL: time.Hour,
		DyeUsers:      []string{"preset-user"},
	})

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	tracer := trace.GetTracer(app)

	// 添加更多用户
	trace.DyeUser(tracer, "dynamic-user", time.Minute)

	// 列出所有染色用户
	users := trace.ListDyedUsers(tracer)
	if len(users) != 2 {
		t.Errorf("Expected 2 dyed users, got %d", len(users))
	}

	// 验证用户存在
	foundPreset := false
	foundDynamic := false
	for _, u := range users {
		if u.UserID == "preset-user" {
			foundPreset = true
		}
		if u.UserID == "dynamic-user" {
			foundDynamic = true
		}
	}

	if !foundPreset {
		t.Error("Expected to find preset-user in dyed users list")
	}
	if !foundDynamic {
		t.Error("Expected to find dynamic-user in dyed users list")
	}
}
