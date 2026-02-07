package jobs

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

// ==================== TDD: Register 测试 ====================

func TestGetJobStore_Unregistered(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 未注册时返回 nil
	store := GetJobStore(app)
	if store != nil {
		t.Error("GetJobStore should return nil when not registered")
	}
}

func TestRegister_Disabled(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 禁用时返回 nil，不注册
	err = Register(app, Config{Disabled: true})
	if err != nil {
		t.Errorf("Register with Disabled should return nil, got %v", err)
	}

	store := GetJobStore(app)
	if store != nil {
		t.Error("GetJobStore should return nil when Disabled=true")
	}
}

func TestRegister_DisabledByEnv(t *testing.T) {
	os.Setenv("PB_JOBS_DISABLED", "1")
	defer os.Unsetenv("PB_JOBS_DISABLED")

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 环境变量禁用
	err = Register(app, Config{})
	if err != nil {
		t.Errorf("Register should return nil when disabled by env, got %v", err)
	}

	store := GetJobStore(app)
	if store != nil {
		t.Error("GetJobStore should return nil when disabled by env")
	}
}

func TestRegister_Success(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 正常注册
	err = Register(app, DefaultConfig())
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	store := GetJobStore(app)
	if store == nil {
		t.Error("GetJobStore should return non-nil after registration")
	}
}

func TestMustRegister_Success(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 不应该 panic
	MustRegister(app, DefaultConfig())

	store := GetJobStore(app)
	if store == nil {
		t.Error("GetJobStore should return non-nil after MustRegister")
	}
}

func TestRegister_DoubleRegistration(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 第一次注册
	err = Register(app, DefaultConfig())
	if err != nil {
		t.Fatalf("First Register failed: %v", err)
	}

	// 第二次注册应该覆盖（或返回已存在错误）
	err = Register(app, Config{Workers: 20})
	if err != nil {
		t.Fatalf("Second Register failed: %v", err)
	}

	store := GetJobStore(app)
	if store == nil {
		t.Error("GetJobStore should return non-nil after double registration")
	}
}

func TestRegister_ConfigApplied(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 自定义配置
	cfg := Config{
		Workers:    20,
		AutoStart:  false,
		BatchSize:  50,
	}
	err = Register(app, cfg)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	store := GetJobStore(app)
	if store == nil {
		t.Fatal("GetJobStore should return non-nil")
	}

	// 验证配置被应用
	storeImpl, ok := store.(*JobStore)
	if !ok {
		t.Fatal("store should be *JobStore")
	}
	if storeImpl.config.Workers != 20 {
		t.Errorf("expected Workers 20, got %d", storeImpl.config.Workers)
	}
	if storeImpl.config.AutoStart {
		t.Error("AutoStart should be false")
	}
	if storeImpl.config.BatchSize != 50 {
		t.Errorf("expected BatchSize 50, got %d", storeImpl.config.BatchSize)
	}
}
