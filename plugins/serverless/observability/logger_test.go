package observability

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// TestStructuredLoggerInfo 测试 Info 级别日志
func TestStructuredLoggerInfo(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	logger.Info("test message", LogField{Key: "key1", Value: "value1"})

	output := buf.String()
	if !strings.Contains(output, "test message") {
		t.Errorf("日志应包含消息 'test message'，实际输出: %s", output)
	}
	if !strings.Contains(output, "INFO") {
		t.Errorf("日志应包含级别 'INFO'，实际输出: %s", output)
	}
	if !strings.Contains(output, "key1") {
		t.Errorf("日志应包含字段 'key1'，实际输出: %s", output)
	}
}

// TestStructuredLoggerWarn 测试 Warn 级别日志
func TestStructuredLoggerWarn(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	logger.Warn("warning message", LogField{Key: "code", Value: 500})

	output := buf.String()
	if !strings.Contains(output, "warning message") {
		t.Errorf("日志应包含消息，实际输出: %s", output)
	}
	if !strings.Contains(output, "WARN") {
		t.Errorf("日志应包含级别 'WARN'，实际输出: %s", output)
	}
}

// TestStructuredLoggerError 测试 Error 级别日志
func TestStructuredLoggerError(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	logger.Error("error message", LogField{Key: "error", Value: "something went wrong"})

	output := buf.String()
	if !strings.Contains(output, "error message") {
		t.Errorf("日志应包含消息，实际输出: %s", output)
	}
	if !strings.Contains(output, "ERROR") {
		t.Errorf("日志应包含级别 'ERROR'，实际输出: %s", output)
	}
}

// TestStructuredLoggerDebug 测试 Debug 级别日志
func TestStructuredLoggerDebug(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelDebug)

	logger.Debug("debug message")

	output := buf.String()
	if !strings.Contains(output, "debug message") {
		t.Errorf("日志应包含消息，实际输出: %s", output)
	}
	if !strings.Contains(output, "DEBUG") {
		t.Errorf("日志应包含级别 'DEBUG'，实际输出: %s", output)
	}
}

// TestStructuredLoggerLevelFiltering 测试日志级别过滤
func TestStructuredLoggerLevelFiltering(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelWarn)

	// Info 级别应该被过滤
	logger.Info("info message")
	if buf.Len() > 0 {
		t.Errorf("Info 级别日志应该被过滤，实际输出: %s", buf.String())
	}

	// Warn 级别应该输出
	logger.Warn("warn message")
	if buf.Len() == 0 {
		t.Error("Warn 级别日志应该输出")
	}
}

// TestStructuredLoggerJSONFormat 测试 JSON 格式输出
func TestStructuredLoggerJSONFormat(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	logger.Info("json test",
		LogField{Key: "string", Value: "value"},
		LogField{Key: "number", Value: 42},
		LogField{Key: "bool", Value: true},
	)

	// 解析 JSON
	var logEntry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &logEntry); err != nil {
		t.Fatalf("日志应该是有效的 JSON: %v, 输出: %s", err, buf.String())
	}

	// 验证字段
	if logEntry["message"] != "json test" {
		t.Errorf("期望 message='json test'，实际为 %v", logEntry["message"])
	}
	if logEntry["level"] != "INFO" {
		t.Errorf("期望 level='INFO'，实际为 %v", logEntry["level"])
	}
	if logEntry["string"] != "value" {
		t.Errorf("期望 string='value'，实际为 %v", logEntry["string"])
	}
	if logEntry["number"] != float64(42) {
		t.Errorf("期望 number=42，实际为 %v", logEntry["number"])
	}
	if logEntry["bool"] != true {
		t.Errorf("期望 bool=true，实际为 %v", logEntry["bool"])
	}
}

// TestStructuredLoggerWithContext 测试带上下文的日志
func TestStructuredLoggerWithContext(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	// 创建带上下文的 logger
	ctxLogger := logger.WithFields(
		LogField{Key: "request_id", Value: "req-123"},
		LogField{Key: "function", Value: "test-func"},
	)

	ctxLogger.Info("request started")

	output := buf.String()
	if !strings.Contains(output, "request_id") {
		t.Errorf("日志应包含上下文字段 'request_id'，实际输出: %s", output)
	}
	if !strings.Contains(output, "req-123") {
		t.Errorf("日志应包含上下文值 'req-123'，实际输出: %s", output)
	}
	if !strings.Contains(output, "function") {
		t.Errorf("日志应包含上下文字段 'function'，实际输出: %s", output)
	}
}

// TestStructuredLoggerTimestamp 测试时间戳
func TestStructuredLoggerTimestamp(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	before := time.Now()
	logger.Info("timestamp test")
	after := time.Now()

	var logEntry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &logEntry); err != nil {
		t.Fatalf("日志应该是有效的 JSON: %v", err)
	}

	// 验证时间戳存在
	timestampStr, ok := logEntry["timestamp"].(string)
	if !ok {
		t.Fatal("日志应包含 timestamp 字段")
	}

	// 解析时间戳
	timestamp, err := time.Parse(time.RFC3339Nano, timestampStr)
	if err != nil {
		t.Fatalf("时间戳格式错误: %v", err)
	}

	// 验证时间戳在合理范围内
	if timestamp.Before(before) || timestamp.After(after) {
		t.Errorf("时间戳应在 %v 和 %v 之间，实际为 %v", before, after, timestamp)
	}
}

// TestStructuredLoggerMultipleFields 测试多个字段
func TestStructuredLoggerMultipleFields(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	logger.Info("multi fields",
		LogField{Key: "a", Value: 1},
		LogField{Key: "b", Value: 2},
		LogField{Key: "c", Value: 3},
		LogField{Key: "d", Value: 4},
		LogField{Key: "e", Value: 5},
	)

	var logEntry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &logEntry); err != nil {
		t.Fatalf("日志应该是有效的 JSON: %v", err)
	}

	for _, key := range []string{"a", "b", "c", "d", "e"} {
		if _, ok := logEntry[key]; !ok {
			t.Errorf("日志应包含字段 '%s'", key)
		}
	}
}

// TestStructuredLoggerNilWriter 测试空 writer
func TestStructuredLoggerNilWriter(t *testing.T) {
	logger := NewStructuredLogger(nil, LogLevelInfo)

	// 不应该 panic
	logger.Info("test")
	logger.Warn("test")
	logger.Error("test")
}

// TestLogLevelString 测试日志级别字符串
func TestLogLevelString(t *testing.T) {
	tests := []struct {
		level    LogLevel
		expected string
	}{
		{LogLevelDebug, "debug"},
		{LogLevelInfo, "info"},
		{LogLevelWarn, "warn"},
		{LogLevelError, "error"},
	}

	for _, tt := range tests {
		if tt.level.String() != tt.expected {
			t.Errorf("LogLevel(%d).String() = %s, 期望 %s", tt.level, tt.level.String(), tt.expected)
		}
	}
}

// TestStructuredLoggerConcurrency 测试并发安全
func TestStructuredLoggerConcurrency(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	done := make(chan bool)
	for i := 0; i < 100; i++ {
		go func(n int) {
			logger.Info("concurrent log", LogField{Key: "n", Value: n})
			done <- true
		}(i)
	}

	for i := 0; i < 100; i++ {
		<-done
	}

	// 验证没有 panic，输出不为空
	if buf.Len() == 0 {
		t.Error("并发日志输出不应为空")
	}
}

// TestStructuredLoggerSetLevel 测试动态设置日志级别
func TestStructuredLoggerSetLevel(t *testing.T) {
	var buf bytes.Buffer
	logger := NewStructuredLogger(&buf, LogLevelInfo)

	// 初始级别为 Info
	if logger.GetLevel() != LogLevelInfo {
		t.Errorf("初始级别应为 Info，实际为 %v", logger.GetLevel())
	}

	// Info 日志应该输出
	logger.Info("info message")
	if buf.Len() == 0 {
		t.Error("Info 级别日志应该输出")
	}

	buf.Reset()

	// 设置为 Error 级别
	logger.SetLevel(LogLevelError)
	if logger.GetLevel() != LogLevelError {
		t.Errorf("级别应为 Error，实际为 %v", logger.GetLevel())
	}

	// Info 日志应该被过滤
	logger.Info("info message after level change")
	if buf.Len() > 0 {
		t.Error("Info 级别日志应该被过滤")
	}

	// Error 日志应该输出
	logger.Error("error message")
	if buf.Len() == 0 {
		t.Error("Error 级别日志应该输出")
	}
}

// TestStructuredLoggerGetLevel 测试获取日志级别
func TestStructuredLoggerGetLevel(t *testing.T) {
	var buf bytes.Buffer

	tests := []struct {
		level LogLevel
	}{
		{LogLevelDebug},
		{LogLevelInfo},
		{LogLevelWarn},
		{LogLevelError},
	}

	for _, tt := range tests {
		logger := NewStructuredLogger(&buf, tt.level)
		if logger.GetLevel() != tt.level {
			t.Errorf("GetLevel() = %v, 期望 %v", logger.GetLevel(), tt.level)
		}
	}
}

// TestLogLevelStringUnknown 测试未知日志级别字符串
func TestLogLevelStringUnknown(t *testing.T) {
	unknownLevel := LogLevel(999)
	result := unknownLevel.String()
	if result != "unknown" {
		t.Errorf("未知级别应返回 'unknown'，实际为 %s", result)
	}
}
