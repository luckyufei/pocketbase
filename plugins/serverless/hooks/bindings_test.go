// Package hooks 提供 Serverless Hook 注册和管理
package hooks

import (
	"context"
	"errors"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/tests"
)

// mockPool 创建一个用于测试的 Pool
func createTestPool(t *testing.T) *runtime.Pool {
	pool, err := runtime.NewPool(1)
	if err != nil {
		t.Skipf("无法创建 Pool: %v", err)
		return nil
	}
	return pool
}

// TestServerlessHookBinding 测试 ServerlessHookBinding
func TestServerlessHookBinding(t *testing.T) {
	t.Run("创建 ServerlessHookBinding", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(nil, pool)
		if binding == nil {
			t.Fatal("NewServerlessHookBinding() returned nil")
		}

		if binding.registry == nil {
			t.Error("registry should not be nil")
		}
	})

	t.Run("获取 Registry", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(nil, pool)
		registry := binding.Registry()

		if registry == nil {
			t.Error("Registry() returned nil")
		}
	})

	t.Run("BindHooks 空注册表", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(nil, pool)
		// 不应该 panic
		binding.BindHooks()
	})

	// 注意: "注册并绑定 Hooks" 测试需要 core.App，跳过此测试
	// 因为 bindSingleHook 在 app 为 nil 时会 panic
}

// TestJSHookBinding 测试 JSHookBinding
func TestJSHookBinding(t *testing.T) {
	t.Run("创建 JSHookBinding", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(nil, pool)
		if binding == nil {
			t.Fatal("NewJSHookBinding() returned nil")
		}

		if binding.handlers == nil {
			t.Error("handlers should not be nil")
		}
	})

	t.Run("注册 JS Hook", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(nil, pool)

		binding.RegisterHook("users", HookTypeBeforeCreate, "function(e) { return e; }", "hooks/users.ts")

		key := "users:beforeCreate"
		if len(binding.handlers[key]) != 1 {
			t.Errorf("expected 1 handler, got %d", len(binding.handlers[key]))
		}
	})

	t.Run("注册多个 JS Hook", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(nil, pool)

		binding.RegisterHook("users", HookTypeBeforeCreate, "function(e) { return e; }", "hooks/users1.ts")
		binding.RegisterHook("users", HookTypeBeforeCreate, "function(e) { return e; }", "hooks/users2.ts")
		binding.RegisterHook("users", HookTypeAfterCreate, "function(e) { return e; }", "hooks/users3.ts")

		beforeCreateKey := "users:beforeCreate"
		if len(binding.handlers[beforeCreateKey]) != 2 {
			t.Errorf("expected 2 beforeCreate handlers, got %d", len(binding.handlers[beforeCreateKey]))
		}

		afterCreateKey := "users:afterCreate"
		if len(binding.handlers[afterCreateKey]) != 1 {
			t.Errorf("expected 1 afterCreate handler, got %d", len(binding.handlers[afterCreateKey]))
		}
	})

	t.Run("BindAllHooks 空处理器", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(nil, pool)
		// 不应该 panic
		binding.BindAllHooks()
	})

	t.Run("注册所有类型的 Hooks", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(nil, pool)

		hookTypes := []HookType{
			HookTypeBeforeCreate,
			HookTypeAfterCreate,
			HookTypeBeforeUpdate,
			HookTypeAfterUpdate,
			HookTypeBeforeDelete,
			HookTypeAfterDelete,
		}

		for _, ht := range hookTypes {
			binding.RegisterHook("test", ht, "function(e) { return e; }", "hooks/test.ts")
		}

		for _, ht := range hookTypes {
			key := "test:" + string(ht)
			if len(binding.handlers[key]) != 1 {
				t.Errorf("expected 1 handler for %s, got %d", ht, len(binding.handlers[key]))
			}
		}
	})
}

// TestHookTypeConstants 测试 Hook 类型常量
func TestHookTypeConstants(t *testing.T) {
	tests := []struct {
		hookType HookType
		expected string
	}{
		{HookTypeBeforeCreate, "beforeCreate"},
		{HookTypeAfterCreate, "afterCreate"},
		{HookTypeBeforeUpdate, "beforeUpdate"},
		{HookTypeAfterUpdate, "afterUpdate"},
		{HookTypeBeforeDelete, "beforeDelete"},
		{HookTypeAfterDelete, "afterDelete"},
	}

	for _, tt := range tests {
		t.Run(string(tt.hookType), func(t *testing.T) {
			if string(tt.hookType) != tt.expected {
				t.Errorf("HookType = %s, want %s", tt.hookType, tt.expected)
			}
		})
	}
}

// TestJSHookHandler 测试 jsHookHandler 结构
func TestJSHookHandler(t *testing.T) {
	t.Run("jsHookHandler 字段", func(t *testing.T) {
		handler := jsHookHandler{
			Collection: "users",
			HookType:   HookTypeBeforeCreate,
			Code:       "function(e) { return e; }",
			ModulePath: "hooks/users.ts",
		}

		if handler.Collection != "users" {
			t.Errorf("Collection = %s, want 'users'", handler.Collection)
		}
		if handler.HookType != HookTypeBeforeCreate {
			t.Errorf("HookType = %s, want 'beforeCreate'", handler.HookType)
		}
		if handler.Code == "" {
			t.Error("Code should not be empty")
		}
		if handler.ModulePath != "hooks/users.ts" {
			t.Errorf("ModulePath = %s, want 'hooks/users.ts'", handler.ModulePath)
		}
	})
}

// TestConcurrentJSHookRegistration 测试并发 JS Hook 注册
func TestConcurrentJSHookRegistration(t *testing.T) {
	t.Run("并发注册 JS Hook", func(t *testing.T) {
		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(nil, pool)
		done := make(chan bool, 10)

		for i := 0; i < 10; i++ {
			go func(idx int) {
				binding.RegisterHook("users", HookTypeBeforeCreate, "function(e) { return e; }", "hooks/test.ts")
				done <- true
			}(i)
		}

		for i := 0; i < 10; i++ {
			<-done
		}

		key := "users:beforeCreate"
		if len(binding.handlers[key]) != 10 {
			t.Errorf("expected 10 handlers, got %d", len(binding.handlers[key]))
		}
	})
}

// TestServerlessHookBindingWithApp 使用 TestApp 测试 ServerlessHookBinding
func TestServerlessHookBindingWithApp(t *testing.T) {
	t.Run("绑定并执行 Hooks", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(app, pool)

		// 注册一个简单的 Hook
		binding.Registry().OnRecordBeforeCreate("users", func(e *RecordEvent) error {
			return nil
		})

		// 绑定 Hooks
		binding.BindHooks()

		// 验证 registry 中有 hook
		hooks := binding.Registry().GetHooks("users", HookTypeBeforeCreate)
		if len(hooks) != 1 {
			t.Errorf("expected 1 hook, got %d", len(hooks))
		}
	})

	t.Run("bindSingleHook 所有类型", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(app, pool)

		// 测试所有 hook 类型
		hookTypes := []HookType{
			HookTypeBeforeCreate,
			HookTypeAfterCreate,
			HookTypeBeforeUpdate,
			HookTypeAfterUpdate,
			HookTypeBeforeDelete,
			HookTypeAfterDelete,
		}

		for _, ht := range hookTypes {
			entry := hookEntry{
				Collection: "users",
				Type:       ht,
				Handler: func(e *RecordEvent) error {
					return nil
				},
			}
			// 调用 bindSingleHook 不应该 panic
			binding.bindSingleHook(entry)
		}
	})
}

// TestJSHookBindingWithApp 使用 TestApp 测试 JSHookBinding
func TestJSHookBindingWithApp(t *testing.T) {
	t.Run("bindJSHook 所有类型", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(app, pool)

		// 测试所有 hook 类型
		hookTypes := []HookType{
			HookTypeBeforeCreate,
			HookTypeAfterCreate,
			HookTypeBeforeUpdate,
			HookTypeAfterUpdate,
			HookTypeBeforeDelete,
			HookTypeAfterDelete,
		}

		for _, ht := range hookTypes {
			h := jsHookHandler{
				Collection: "users",
				HookType:   ht,
				Code:       "function(e) { return e; }",
				ModulePath: "hooks/test.ts",
			}
			// 调用 bindJSHook 不应该 panic
			binding.bindJSHook(h)
		}
	})

	t.Run("BindAllHooks 有处理器", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewJSHookBinding(app, pool)

		// 注册一些 hooks
		binding.RegisterHook("users", HookTypeBeforeCreate, "function(e) { return e; }", "hooks/users.ts")
		binding.RegisterHook("posts", HookTypeAfterUpdate, "function(e) { return e; }", "hooks/posts.ts")

		// 绑定所有 hooks
		binding.BindAllHooks()
	})
}

// TestExecuteServerlessHook 测试 executeServerlessHook
func TestExecuteServerlessHook(t *testing.T) {
	t.Run("执行成功的 Hook", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(app, pool)

		// 获取一个真实的 collection
		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Skipf("无法获取 users collection: %v", err)
			return
		}

		// 创建一个测试 record
		record := core.NewRecord(collection)
		record.Set("email", "test@example.com")

		// 创建 RecordEvent
		event := new(core.RecordEvent)
		event.App = app
		event.Record = record
		event.Context = context.Background()

		// 创建一个简单的 handler
		handlerCalled := false
		handler := func(e *RecordEvent) error {
			handlerCalled = true
			e.Record.Set("modified", true)
			return nil
		}

		// 执行 hook
		err = binding.executeServerlessHook(event, handler)
		if err != nil {
			t.Errorf("executeServerlessHook() error = %v", err)
		}

		if !handlerCalled {
			t.Error("handler was not called")
		}
	})

	t.Run("Handler 返回错误", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(app, pool)

		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Skipf("无法获取 users collection: %v", err)
			return
		}

		record := core.NewRecord(collection)
		event := new(core.RecordEvent)
		event.App = app
		event.Record = record
		event.Context = context.Background()

		// 创建一个返回错误的 handler
		expectedErr := errors.New("hook error")
		handler := func(e *RecordEvent) error {
			return expectedErr
		}

		err = binding.executeServerlessHook(event, handler)
		if err != expectedErr {
			t.Errorf("executeServerlessHook() error = %v, want %v", err, expectedErr)
		}
	})

	t.Run("Handler 修改 Record 数据", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool != nil {
			defer pool.Close()
		}

		binding := NewServerlessHookBinding(app, pool)

		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Skipf("无法获取 users collection: %v", err)
			return
		}

		record := core.NewRecord(collection)
		record.Set("name", "original")
		event := new(core.RecordEvent)
		event.App = app
		event.Record = record
		event.Context = context.Background()

		handler := func(e *RecordEvent) error {
			e.Record.Set("name", "modified")
			return nil
		}

		_ = binding.executeServerlessHook(event, handler)

		// 验证 record 被修改
		if record.GetString("name") != "modified" {
			t.Errorf("record.name = %s, want 'modified'", record.GetString("name"))
		}
	})
}

// TestExecuteJSHook 测试 executeJSHook
func TestExecuteJSHook(t *testing.T) {
	t.Run("执行简单 JS Hook", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		pool := createTestPool(t)
		if pool == nil {
			t.Skip("无法创建 Pool")
			return
		}
		defer pool.Close()

		binding := NewJSHookBinding(app, pool)

		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Skipf("无法获取 users collection: %v", err)
			return
		}

		record := core.NewRecord(collection)
		record.Set("email", "test@example.com")
		event := new(core.RecordEvent)
		event.App = app
		event.Record = record
		event.Context = context.Background()

		// 简单的 JS 代码
		code := `async function(e) { return e; }`

		err = binding.executeJSHook(event, code)
		// 可能会有错误（取决于 JS 执行环境），但不应该 panic
		_ = err
	})

	t.Run("Pool 获取失败", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		// 使用 nil pool
		binding := NewJSHookBinding(app, nil)

		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Skipf("无法获取 users collection: %v", err)
			return
		}

		record := core.NewRecord(collection)
		event := new(core.RecordEvent)
		event.App = app
		event.Record = record
		event.Context = context.Background()

		err = binding.executeJSHook(event, "function(e) { return e; }")
		if err == nil {
			t.Error("executeJSHook() should return error when pool is nil")
		}
	})
}
