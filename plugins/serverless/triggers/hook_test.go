// Package triggers 提供 Serverless 触发器实现
package triggers

import (
	"context"
	"errors"
	"testing"
)

// T079: Hook 触发器测试

// TestHookTrigger_Execute 测试 Hook 触发器执行
func TestHookTrigger_Execute(t *testing.T) {
	t.Run("执行 BeforeCreate Hook", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 5000,
		})

		event := &RecordEvent{
			Collection: "users",
			Action:     "create",
			Phase:      "before",
			Record: map[string]any{
				"id":    "test123",
				"email": "test@example.com",
			},
		}

		result, err := trigger.Execute(context.Background(), event, func(e *RecordEvent) error {
			// 模拟 Hook 处理
			e.Record["processed"] = true
			return nil
		})

		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if result == nil {
			t.Fatal("Execute() returned nil result")
		}

		if result.Record["processed"] != true {
			t.Error("Hook 未正确处理 Record")
		}
	})

	t.Run("执行 AfterCreate Hook", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 5000,
		})

		event := &RecordEvent{
			Collection: "users",
			Action:     "create",
			Phase:      "after",
			Record: map[string]any{
				"id":    "test123",
				"email": "test@example.com",
			},
		}

		executed := false
		_, err := trigger.Execute(context.Background(), event, func(e *RecordEvent) error {
			executed = true
			return nil
		})

		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if !executed {
			t.Error("AfterCreate Hook 未执行")
		}
	})

	t.Run("Hook 抛出错误中止操作", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 5000,
		})

		event := &RecordEvent{
			Collection: "users",
			Action:     "create",
			Phase:      "before",
			Record:     map[string]any{},
		}

		_, err := trigger.Execute(context.Background(), event, func(e *RecordEvent) error {
			return errors.New("validation failed: email required")
		})

		if err == nil {
			t.Error("Execute() should return error when hook fails")
		}

		if err.Error() != "validation failed: email required" {
			t.Errorf("Error message = %s, want validation failed: email required", err.Error())
		}
	})
}

// TestHookTrigger_Chain 测试 Hook 链执行
func TestHookTrigger_Chain(t *testing.T) {
	t.Run("多个 Hook 按顺序执行", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 5000,
		})

		event := &RecordEvent{
			Collection: "users",
			Action:     "create",
			Phase:      "before",
			Record: map[string]any{
				"order": []int{},
			},
		}

		handlers := []HookHandler{
			func(e *RecordEvent) error {
				order := e.Record["order"].([]int)
				e.Record["order"] = append(order, 1)
				return nil
			},
			func(e *RecordEvent) error {
				order := e.Record["order"].([]int)
				e.Record["order"] = append(order, 2)
				return nil
			},
			func(e *RecordEvent) error {
				order := e.Record["order"].([]int)
				e.Record["order"] = append(order, 3)
				return nil
			},
		}

		result, err := trigger.ExecuteChain(context.Background(), event, handlers)
		if err != nil {
			t.Fatalf("ExecuteChain() error = %v", err)
		}

		order := result.Record["order"].([]int)
		if len(order) != 3 || order[0] != 1 || order[1] != 2 || order[2] != 3 {
			t.Errorf("Hook 执行顺序错误: %v", order)
		}
	})

	t.Run("中间 Hook 失败中止链", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 5000,
		})

		event := &RecordEvent{
			Collection: "users",
			Action:     "create",
			Phase:      "before",
			Record: map[string]any{
				"count": 0,
			},
		}

		handlers := []HookHandler{
			func(e *RecordEvent) error {
				e.Record["count"] = e.Record["count"].(int) + 1
				return nil
			},
			func(e *RecordEvent) error {
				return errors.New("hook 2 failed")
			},
			func(e *RecordEvent) error {
				e.Record["count"] = e.Record["count"].(int) + 1
				return nil
			},
		}

		_, err := trigger.ExecuteChain(context.Background(), event, handlers)
		if err == nil {
			t.Error("ExecuteChain() should return error when hook fails")
		}

		// 第三个 Hook 不应该执行
		if event.Record["count"].(int) != 1 {
			t.Errorf("count = %d, want 1 (第三个 Hook 不应执行)", event.Record["count"])
		}
	})
}

// TestRecordEvent 测试 RecordEvent 结构
func TestRecordEvent(t *testing.T) {
	t.Run("RecordEvent 基本属性", func(t *testing.T) {
		event := &RecordEvent{
			Collection: "posts",
			Action:     "update",
			Phase:      "before",
			Record: map[string]any{
				"id":    "post123",
				"title": "Hello",
			},
			Auth: map[string]any{
				"id":    "user123",
				"email": "admin@example.com",
			},
		}

		if event.Collection != "posts" {
			t.Errorf("Collection = %s, want posts", event.Collection)
		}

		if event.Action != "update" {
			t.Errorf("Action = %s, want update", event.Action)
		}

		if event.Phase != "before" {
			t.Errorf("Phase = %s, want before", event.Phase)
		}

		if event.Record["id"] != "post123" {
			t.Errorf("Record.id = %v, want post123", event.Record["id"])
		}

		if event.Auth["id"] != "user123" {
			t.Errorf("Auth.id = %v, want user123", event.Auth["id"])
		}
	})

	t.Run("RecordEvent Get/Set", func(t *testing.T) {
		event := &RecordEvent{
			Record: map[string]any{
				"title": "Original",
			},
		}

		// Get
		if event.Get("title") != "Original" {
			t.Errorf("Get(title) = %v, want Original", event.Get("title"))
		}

		if event.Get("nonexistent") != nil {
			t.Errorf("Get(nonexistent) = %v, want nil", event.Get("nonexistent"))
		}

		// Set
		event.Set("title", "Updated")
		if event.Record["title"] != "Updated" {
			t.Errorf("Set failed: title = %v, want Updated", event.Record["title"])
		}

		event.Set("newField", "value")
		if event.Record["newField"] != "value" {
			t.Errorf("Set failed: newField = %v, want value", event.Record["newField"])
		}
	})
}

// TestHookTrigger_Timeout 测试超时控制
func TestHookTrigger_Timeout(t *testing.T) {
	t.Run("Hook 执行超时", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 50, // 50ms
		})

		event := &RecordEvent{
			Collection: "users",
			Action:     "create",
			Phase:      "before",
			Record:     map[string]any{},
		}

		ctx, cancel := context.WithTimeout(context.Background(), 50)
		defer cancel()

		_, err := trigger.Execute(ctx, event, func(e *RecordEvent) error {
			// 模拟长时间操作 - 但由于 context 已超时，应该立即返回
			select {
			case <-ctx.Done():
				return ctx.Err()
			}
		})

		if err == nil {
			t.Error("Execute() should return timeout error")
		}
	})
}

// TestHookTriggerConfig 测试配置
func TestHookTriggerConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{})

		if trigger.config.Timeout == 0 {
			t.Error("默认 Timeout 不应为 0")
		}
	})

	t.Run("自定义配置", func(t *testing.T) {
		trigger := NewHookTrigger(HookTriggerConfig{
			Timeout: 10000,
		})

		if trigger.config.Timeout != 10000 {
			t.Errorf("Timeout = %d, want 10000", trigger.config.Timeout)
		}
	})
}

// TestParseHookType 测试 Hook 类型解析
func TestParseHookType(t *testing.T) {
	tests := []struct {
		action   string
		phase    string
		expected HookType
	}{
		{"create", "before", HookTypeBeforeCreate},
		{"create", "after", HookTypeAfterCreate},
		{"update", "before", HookTypeBeforeUpdate},
		{"update", "after", HookTypeAfterUpdate},
		{"delete", "before", HookTypeBeforeDelete},
		{"delete", "after", HookTypeAfterDelete},
		{"unknown", "before", ""},
		{"create", "unknown", ""},
		{"", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.action+"_"+tt.phase, func(t *testing.T) {
			result := ParseHookType(tt.action, tt.phase)
			if result != tt.expected {
				t.Errorf("ParseHookType(%s, %s) = %s, want %s", tt.action, tt.phase, result, tt.expected)
			}
		})
	}
}
