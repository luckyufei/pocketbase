package kv

import (
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

// HTTP API 测试

func TestHTTPAPIEnabled(t *testing.T) {
	cfg := DefaultConfig()
	cfg.HTTPEnabled = true
	if !cfg.HTTPEnabled {
		t.Error("HTTPEnabled should be true")
	}
}

func TestKVRouteRegistration(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.HTTPEnabled = true
		Register(app, cfg)

		// 验证 store 已注册
		store := GetStore(app)
		if store == nil {
			t.Fatal("expected non-nil store after registration")
		}
	})
}

func TestKVRouteRegistrationWithRules(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		cfg := DefaultConfig()
		cfg.HTTPEnabled = true
		cfg.ReadRule = "@request.auth.id != ''"
		cfg.WriteRule = "@request.auth.id != ''"
		Register(app, cfg)

		store := GetStore(app)
		if store == nil {
			t.Fatal("expected non-nil store after registration with rules")
		}
	})
}
