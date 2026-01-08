package hostfn

import (
	"bytes"
	"encoding/json"
	"testing"
)

// T039-T043: Console Host Function 测试

func TestConsoleHostFunction(t *testing.T) {
	t.Run("创建 Console 实例", func(t *testing.T) {
		console := NewConsole(ConsoleConfig{})

		if console == nil {
			t.Fatal("console 不应为 nil")
		}
	})

	t.Run("log 级别", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Log("hello", "world")

		output := buf.String()
		if output == "" {
			t.Error("应该有输出")
		}

		// 验证 JSON 格式
		var entry map[string]any
		if err := json.Unmarshal([]byte(output), &entry); err != nil {
			t.Fatalf("输出不是有效 JSON: %v", err)
		}

		if entry["level"] != "log" {
			t.Errorf("level = %v, want log", entry["level"])
		}
		if entry["message"] != "hello world" {
			t.Errorf("message = %v, want hello world", entry["message"])
		}
	})

	t.Run("warn 级别", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Warn("warning message")

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["level"] != "warn" {
			t.Errorf("level = %v, want warn", entry["level"])
		}
	})

	t.Run("error 级别", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Error("error message")

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["level"] != "error" {
			t.Errorf("level = %v, want error", entry["level"])
		}
	})

	t.Run("info 级别", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Info("info message")

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["level"] != "info" {
			t.Errorf("level = %v, want info", entry["level"])
		}
	})

	t.Run("debug 级别", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Debug("debug message")

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["level"] != "debug" {
			t.Errorf("level = %v, want debug", entry["level"])
		}
	})
}

func TestConsoleTraceID(t *testing.T) {
	t.Run("集成 TraceID", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer:  &buf,
			TraceID: "trace-123-abc",
		})

		console.Log("test message")

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["trace_id"] != "trace-123-abc" {
			t.Errorf("trace_id = %v, want trace-123-abc", entry["trace_id"])
		}
	})

	t.Run("设置 TraceID", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.SetTraceID("new-trace-id")
		console.Log("test")

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["trace_id"] != "new-trace-id" {
			t.Errorf("trace_id = %v, want new-trace-id", entry["trace_id"])
		}
	})
}

func TestConsoleStructuredOutput(t *testing.T) {
	t.Run("JSON 结构化输出", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Log("user login", map[string]any{
			"user_id": "123",
			"action":  "login",
		})

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		if entry["level"] != "log" {
			t.Errorf("level = %v, want log", entry["level"])
		}

		// 验证时间戳存在
		if entry["timestamp"] == nil {
			t.Error("应该包含 timestamp")
		}
	})

	t.Run("多参数格式化", func(t *testing.T) {
		var buf bytes.Buffer
		console := NewConsole(ConsoleConfig{
			Writer: &buf,
		})

		console.Log("value:", 42, "flag:", true)

		var entry map[string]any
		json.Unmarshal(buf.Bytes(), &entry)

		msg := entry["message"].(string)
		if msg != "value: 42 flag: true" {
			t.Errorf("message = %s, want 'value: 42 flag: true'", msg)
		}
	})
}

func TestConsoleCollector(t *testing.T) {
	t.Run("收集所有日志", func(t *testing.T) {
		collector := NewLogCollector()
		console := NewConsole(ConsoleConfig{
			Collector: collector,
		})

		console.Log("message 1")
		console.Warn("message 2")
		console.Error("message 3")

		logs := collector.Logs()
		if len(logs) != 3 {
			t.Errorf("len(logs) = %d, want 3", len(logs))
		}

		if logs[0].Level != "log" {
			t.Errorf("logs[0].Level = %s, want log", logs[0].Level)
		}
		if logs[1].Level != "warn" {
			t.Errorf("logs[1].Level = %s, want warn", logs[1].Level)
		}
		if logs[2].Level != "error" {
			t.Errorf("logs[2].Level = %s, want error", logs[2].Level)
		}
	})
}
