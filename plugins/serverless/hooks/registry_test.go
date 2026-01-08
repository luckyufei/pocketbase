// Package hooks 提供 Serverless Hook 注册和管理
package hooks

import (
	"testing"
)

// Phase 12: US8 DB Hooks 测试

func TestHookRegistry(t *testing.T) {
	t.Run("注册 Hook", func(t *testing.T) {
		registry := NewRegistry()

		handler := func(e *RecordEvent) error {
			return nil
		}

		registry.OnRecordBeforeCreate("users", handler)

		hooks := registry.GetHooks("users", HookTypeBeforeCreate)
		if len(hooks) != 1 {
			t.Errorf("GetHooks() 返回 %d 个 hooks, want 1", len(hooks))
		}
	})

	t.Run("多个 Hook 注册", func(t *testing.T) {
		registry := NewRegistry()

		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error { return nil })
		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error { return nil })
		registry.OnRecordAfterCreate("users", func(e *RecordEvent) error { return nil })

		beforeHooks := registry.GetHooks("users", HookTypeBeforeCreate)
		if len(beforeHooks) != 2 {
			t.Errorf("GetHooks(BeforeCreate) 返回 %d 个 hooks, want 2", len(beforeHooks))
		}

		afterHooks := registry.GetHooks("users", HookTypeAfterCreate)
		if len(afterHooks) != 1 {
			t.Errorf("GetHooks(AfterCreate) 返回 %d 个 hooks, want 1", len(afterHooks))
		}
	})

	t.Run("不同集合的 Hook", func(t *testing.T) {
		registry := NewRegistry()

		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error { return nil })
		registry.OnRecordBeforeCreate("posts", func(e *RecordEvent) error { return nil })

		userHooks := registry.GetHooks("users", HookTypeBeforeCreate)
		if len(userHooks) != 1 {
			t.Errorf("GetHooks(users) 返回 %d 个 hooks, want 1", len(userHooks))
		}

		postHooks := registry.GetHooks("posts", HookTypeBeforeCreate)
		if len(postHooks) != 1 {
			t.Errorf("GetHooks(posts) 返回 %d 个 hooks, want 1", len(postHooks))
		}
	})

	t.Run("不存在的 Hook", func(t *testing.T) {
		registry := NewRegistry()

		hooks := registry.GetHooks("nonexistent", HookTypeBeforeCreate)
		if len(hooks) != 0 {
			t.Errorf("GetHooks() 返回 %d 个 hooks, want 0", len(hooks))
		}
	})
}

func TestHookTypes(t *testing.T) {
	t.Run("所有 Hook 类型", func(t *testing.T) {
		registry := NewRegistry()
		handler := func(e *RecordEvent) error { return nil }

		registry.OnRecordBeforeCreate("test", handler)
		registry.OnRecordAfterCreate("test", handler)
		registry.OnRecordBeforeUpdate("test", handler)
		registry.OnRecordAfterUpdate("test", handler)
		registry.OnRecordBeforeDelete("test", handler)
		registry.OnRecordAfterDelete("test", handler)

		types := []HookType{
			HookTypeBeforeCreate,
			HookTypeAfterCreate,
			HookTypeBeforeUpdate,
			HookTypeAfterUpdate,
			HookTypeBeforeDelete,
			HookTypeAfterDelete,
		}

		for _, ht := range types {
			hooks := registry.GetHooks("test", ht)
			if len(hooks) != 1 {
				t.Errorf("GetHooks(%v) 返回 %d 个 hooks, want 1", ht, len(hooks))
			}
		}
	})
}

func TestRecordEvent(t *testing.T) {
	t.Run("RecordEvent 结构", func(t *testing.T) {
		record := &Record{
			ID:   "123",
			Data: map[string]interface{}{"name": "test"},
		}

		event := &RecordEvent{
			Record:     record,
			Collection: "users",
		}

		if event.Record.ID != "123" {
			t.Errorf("Record.ID = %s, want 123", event.Record.ID)
		}

		if event.Collection != "users" {
			t.Errorf("Collection = %s, want users", event.Collection)
		}
	})

	t.Run("Record Get/Set", func(t *testing.T) {
		record := &Record{
			ID:   "123",
			Data: map[string]interface{}{"name": "old"},
		}

		record.Set("name", "new")
		if record.Get("name") != "new" {
			t.Errorf("Get(name) = %v, want new", record.Get("name"))
		}

		record.Set("email", "test@example.com")
		if record.Get("email") != "test@example.com" {
			t.Errorf("Get(email) = %v, want test@example.com", record.Get("email"))
		}
	})
}

func TestHookExecution(t *testing.T) {
	t.Run("执行 Hook 链", func(t *testing.T) {
		registry := NewRegistry()
		executed := []int{}

		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error {
			executed = append(executed, 1)
			return nil
		})
		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error {
			executed = append(executed, 2)
			return nil
		})

		event := &RecordEvent{
			Record:     &Record{ID: "123", Data: map[string]interface{}{}},
			Collection: "users",
		}

		err := registry.Execute("users", HookTypeBeforeCreate, event)
		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if len(executed) != 2 {
			t.Errorf("执行了 %d 个 hooks, want 2", len(executed))
		}
	})

	t.Run("Hook 返回错误中止链", func(t *testing.T) {
		registry := NewRegistry()
		executed := []int{}

		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error {
			executed = append(executed, 1)
			return &HookError{Message: "validation failed"}
		})
		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error {
			executed = append(executed, 2)
			return nil
		})

		event := &RecordEvent{
			Record:     &Record{ID: "123", Data: map[string]interface{}{}},
			Collection: "users",
		}

		err := registry.Execute("users", HookTypeBeforeCreate, event)
		if err == nil {
			t.Error("Execute() 应该返回错误")
		}

		if len(executed) != 1 {
			t.Errorf("执行了 %d 个 hooks, want 1", len(executed))
		}
	})

	t.Run("空 Hook 链执行", func(t *testing.T) {
		registry := NewRegistry()

		event := &RecordEvent{
			Record:     &Record{ID: "123", Data: map[string]interface{}{}},
			Collection: "users",
		}

		err := registry.Execute("users", HookTypeBeforeCreate, event)
		if err != nil {
			t.Errorf("Execute() 空 Hook 链应该返回 nil, got %v", err)
		}
	})
}



// TestHookError 测试 HookError
func TestHookError(t *testing.T) {
	t.Run("HookError.Error()", func(t *testing.T) {
		err := &HookError{Message: "test error"}
		if err.Error() != "test error" {
			t.Errorf("Error() = %s, want 'test error'", err.Error())
		}
	})

	t.Run("空消息", func(t *testing.T) {
		err := &HookError{Message: ""}
		if err.Error() != "" {
			t.Errorf("Error() = %s, want ''", err.Error())
		}
	})
}

// TestRecordNilData 测试 Record 空 Data 处理
func TestRecordNilData(t *testing.T) {
	t.Run("Set 到 nil Data", func(t *testing.T) {
		record := &Record{ID: "123"}
		record.Set("name", "test")

		if record.Data == nil {
			t.Error("Data should be initialized")
		}
		if record.Get("name") != "test" {
			t.Errorf("Get(name) = %v, want 'test'", record.Get("name"))
		}
	})

	t.Run("Get 从 nil Data", func(t *testing.T) {
		record := &Record{ID: "123"}
		val := record.Get("name")
		if val != nil {
			t.Errorf("Get(name) from nil Data = %v, want nil", val)
		}
	})
}

// TestRecordEventWithAuth 测试带 Auth 的 RecordEvent
func TestRecordEventWithAuth(t *testing.T) {
	t.Run("带 Auth 的事件", func(t *testing.T) {
		authRecord := &Record{
			ID:   "auth123",
			Data: map[string]interface{}{"email": "user@example.com"},
		}

		event := &RecordEvent{
			Record:     &Record{ID: "123", Data: map[string]interface{}{}},
			Collection: "posts",
			Auth:       authRecord,
		}

		if event.Auth == nil {
			t.Error("Auth should not be nil")
		}
		if event.Auth.ID != "auth123" {
			t.Errorf("Auth.ID = %s, want 'auth123'", event.Auth.ID)
		}
	})
}

// TestConcurrentHookRegistration 测试并发 Hook 注册
func TestConcurrentHookRegistration(t *testing.T) {
	t.Run("并发注册 Hook", func(t *testing.T) {
		registry := NewRegistry()
		done := make(chan bool, 10)

		for i := 0; i < 10; i++ {
			go func(idx int) {
				registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error {
					return nil
				})
				done <- true
			}(i)
		}

		for i := 0; i < 10; i++ {
			<-done
		}

		hooks := registry.GetHooks("users", HookTypeBeforeCreate)
		if len(hooks) != 10 {
			t.Errorf("GetHooks() 返回 %d 个 hooks, want 10", len(hooks))
		}
	})
}

// TestHookModifiesRecord 测试 Hook 修改记录
func TestHookModifiesRecord(t *testing.T) {
	t.Run("Hook 修改记录字段", func(t *testing.T) {
		registry := NewRegistry()

		registry.OnRecordBeforeCreate("users", func(e *RecordEvent) error {
			e.Record.Set("modified", true)
			e.Record.Set("created_by", "system")
			return nil
		})

		event := &RecordEvent{
			Record:     &Record{ID: "123", Data: map[string]interface{}{"name": "test"}},
			Collection: "users",
		}

		err := registry.Execute("users", HookTypeBeforeCreate, event)
		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if event.Record.Get("modified") != true {
			t.Error("Record should have modified = true")
		}
		if event.Record.Get("created_by") != "system" {
			t.Error("Record should have created_by = 'system'")
		}
		// 原有字段应该保留
		if event.Record.Get("name") != "test" {
			t.Error("Record should still have name = 'test'")
		}
	})
}
