package jsvm

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/dop251/goja"
)

// =============================================================================
// Task 1.3: 执行监控与日志 - 红灯测试
// =============================================================================

// TestExecutionMetrics_Duration 测试记录执行时间（毫秒级）
func TestExecutionMetrics_Duration(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	// 模拟执行
	metrics := &JSVMMetrics{
		HookName:   "onRecordCreate",
		Collection: "posts",
		Duration:   2500 * time.Microsecond, // 2.5ms
	}

	collector.Record(metrics)

	// 验证日志输出
	output := buf.String()
	if !strings.Contains(output, "jsvm execution") {
		t.Errorf("expected log message, got: %s", output)
	}
	if !strings.Contains(output, "duration_ms") {
		t.Errorf("expected duration_ms in log, got: %s", output)
	}

	// 解析 JSON 验证数值
	var logEntry map[string]interface{}
	if err := json.Unmarshal([]byte(output), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}

	durationMs, ok := logEntry["duration_ms"].(float64)
	if !ok {
		t.Errorf("duration_ms not found or not a number")
	}
	if durationMs < 2.0 || durationMs > 3.0 {
		t.Errorf("expected duration_ms ~2.5, got: %v", durationMs)
	}
}

// TestExecutionMetrics_HookInfo 测试记录 Hook 名称和关联集合
func TestExecutionMetrics_HookInfo(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	metrics := &JSVMMetrics{
		HookName:   "onRecordUpdate",
		Collection: "users",
		Duration:   1 * time.Millisecond,
	}

	collector.Record(metrics)

	output := buf.String()

	var logEntry map[string]interface{}
	if err := json.Unmarshal([]byte(output), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}

	if logEntry["hook"] != "onRecordUpdate" {
		t.Errorf("expected hook 'onRecordUpdate', got: %v", logEntry["hook"])
	}
	if logEntry["collection"] != "users" {
		t.Errorf("expected collection 'users', got: %v", logEntry["collection"])
	}
}

// TestExecutionMetrics_Success 测试记录成功/失败状态
func TestExecutionMetrics_Success(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	// 成功执行
	metrics := &JSVMMetrics{
		HookName:   "onRecordCreate",
		Collection: "posts",
		Duration:   1 * time.Millisecond,
		Error:      "",
	}
	collector.Record(metrics)

	output := buf.String()
	if strings.Contains(output, `"level":"ERROR"`) {
		t.Errorf("success should not log as error: %s", output)
	}

	// 失败执行
	buf.Reset()
	metrics.Error = "script execution failed"
	collector.Record(metrics)

	output = buf.String()
	if !strings.Contains(output, "error") {
		t.Errorf("failure should contain error field: %s", output)
	}
}

// TestExecutionMetrics_Timeout 测试记录超时中断事件
func TestExecutionMetrics_Timeout(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	metrics := &JSVMMetrics{
		HookName:   "onRecordCreate",
		Collection: "posts",
		Duration:   5 * time.Second,
		Timeout:    true,
		Error:      "execution timeout",
	}

	collector.Record(metrics)

	output := buf.String()

	var logEntry map[string]interface{}
	if err := json.Unmarshal([]byte(output), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}

	if logEntry["timeout"] != true {
		t.Errorf("expected timeout=true, got: %v", logEntry["timeout"])
	}

	// 超时应该记录为 WARN 级别
	if logEntry["level"] != "WARN" {
		t.Errorf("timeout should be logged as WARN, got: %v", logEntry["level"])
	}
}

// TestExecutionMetrics_MemoryApprox 测试记录近似内存分配
func TestExecutionMetrics_MemoryApprox(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	metrics := &JSVMMetrics{
		HookName:      "onRecordCreate",
		Collection:    "posts",
		Duration:      1 * time.Millisecond,
		MemAllocBytes: 1024 * 10, // 10KB
	}

	collector.Record(metrics)

	output := buf.String()

	var logEntry map[string]interface{}
	if err := json.Unmarshal([]byte(output), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}

	memKB, ok := logEntry["mem_alloc_kb"].(float64)
	if !ok {
		t.Errorf("mem_alloc_kb not found or not a number")
	}
	if memKB < 9.0 || memKB > 11.0 {
		t.Errorf("expected mem_alloc_kb ~10, got: %v", memKB)
	}
}

// TestExecutionMetrics_ConfigToggle 测试支持配置开关启用/禁用
func TestExecutionMetrics_ConfigToggle(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	// 禁用监控
	collector := NewMetricsCollector(false, logger)

	metrics := &JSVMMetrics{
		HookName:   "onRecordCreate",
		Collection: "posts",
		Duration:   1 * time.Millisecond,
	}

	collector.Record(metrics)

	// 禁用时不应该有日志输出
	if buf.Len() > 0 {
		t.Errorf("disabled collector should not log, got: %s", buf.String())
	}

	// 启用监控
	buf.Reset()
	collector = NewMetricsCollector(true, logger)
	collector.Record(metrics)

	if buf.Len() == 0 {
		t.Error("enabled collector should log")
	}
}

// TestExecutionMetrics_LowOverhead 测试监控开销 < 1%
func TestExecutionMetrics_LowOverhead(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	// 测量记录开销
	iterations := 10000
	metrics := &JSVMMetrics{
		HookName:      "onRecordCreate",
		Collection:    "posts",
		Duration:      1 * time.Millisecond,
		MemAllocBytes: 1024,
	}

	start := time.Now()
	for i := 0; i < iterations; i++ {
		collector.Record(metrics)
	}
	elapsed := time.Since(start)

	avgOverhead := elapsed / time.Duration(iterations)

	// 平均开销应该小于 100 微秒（远小于典型脚本执行时间）
	if avgOverhead > 100*time.Microsecond {
		t.Errorf("metrics overhead too high: %v per record", avgOverhead)
	}

	t.Logf("Metrics overhead: %v per record", avgOverhead)
}

// TestExecutionMetrics_GetStats 测试获取统计信息
func TestExecutionMetrics_GetStats(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	// 记录一些执行
	for i := 0; i < 10; i++ {
		metrics := &JSVMMetrics{
			HookName:   "onRecordCreate",
			Collection: "posts",
			Duration:   time.Duration(i+1) * time.Millisecond,
		}
		collector.Record(metrics)
	}

	// 记录一些错误
	for i := 0; i < 3; i++ {
		metrics := &JSVMMetrics{
			HookName:   "onRecordCreate",
			Collection: "posts",
			Duration:   1 * time.Millisecond,
			Error:      "test error",
		}
		collector.Record(metrics)
	}

	// 记录一个超时
	collector.Record(&JSVMMetrics{
		HookName:   "onRecordCreate",
		Collection: "posts",
		Duration:   5 * time.Second,
		Timeout:    true,
	})

	stats := collector.GetStats()

	if stats.TotalExecutions != 14 {
		t.Errorf("expected 14 total executions, got: %d", stats.TotalExecutions)
	}
	if stats.TotalErrors != 3 {
		t.Errorf("expected 3 errors, got: %d", stats.TotalErrors)
	}
	if stats.TotalTimeouts != 1 {
		t.Errorf("expected 1 timeout, got: %d", stats.TotalTimeouts)
	}
}

// TestMetricsCollector_Integration 测试与 SafeExecutor 集成
func TestMetricsCollector_Integration(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	collector := NewMetricsCollector(true, logger)
	executor := NewSafeExecutorWithMetrics(pool, 5*time.Second, collector)

	ctx := context.Background()
	_, err := executor.ExecuteWithMetrics(ctx, `1 + 1`, nil, "onRecordCreate", "posts")

	if err != nil {
		t.Fatalf("execution failed: %v", err)
	}

	output := buf.String()
	if !strings.Contains(output, "onRecordCreate") {
		t.Errorf("expected hook name in log, got: %s", output)
	}
	if !strings.Contains(output, "posts") {
		t.Errorf("expected collection in log, got: %s", output)
	}
}

// TestMetricsCollector_Reset 测试重置统计
func TestMetricsCollector_Reset(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	collector := NewMetricsCollector(true, logger)

	// 记录一些执行
	for i := 0; i < 5; i++ {
		collector.Record(&JSVMMetrics{
			HookName:   "test",
			Collection: "test",
			Duration:   1 * time.Millisecond,
		})
	}

	stats := collector.GetStats()
	if stats.TotalExecutions != 5 {
		t.Errorf("expected 5 executions, got: %d", stats.TotalExecutions)
	}

	// 重置
	collector.Reset()

	stats = collector.GetStats()
	if stats.TotalExecutions != 0 {
		t.Errorf("expected 0 executions after reset, got: %d", stats.TotalExecutions)
	}
}

// TestSafeExecutorWithMetrics_DefaultTimeout 测试默认超时
func TestSafeExecutorWithMetrics_DefaultTimeout(t *testing.T) {
	pool := newPool(1, func() *goja.Runtime {
		return goja.New()
	})

	// 传入 0，应该使用默认值
	executor := NewSafeExecutorWithMetrics(pool, 0, nil)

	ctx := context.Background()
	result, err := executor.ExecuteWithMetrics(ctx, `1 + 1`, nil, "test", "test")

	if err != nil {
		t.Fatalf("execution failed: %v", err)
	}

	if result.ToInteger() != 2 {
		t.Errorf("expected 2, got: %v", result.Export())
	}
}

// TestSafeExecutorWithMetrics_CustomTimeout 测试自定义超时
func TestSafeExecutorWithMetrics_CustomTimeout(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	pool := newPool(1, func() *goja.Runtime {
		return goja.New()
	})

	collector := NewMetricsCollector(true, logger)
	executor := NewSafeExecutorWithMetrics(pool, 5*time.Second, collector)

	ctx := context.Background()
	opts := &ExecuteOptions{Timeout: 100 * time.Millisecond}

	start := time.Now()
	_, err := executor.ExecuteWithMetrics(ctx, `for(;;){}`, opts, "test", "test")
	elapsed := time.Since(start)

	if elapsed > 500*time.Millisecond {
		t.Errorf("custom timeout not respected, took: %v", elapsed)
	}

	if err == nil {
		t.Fatal("expected timeout error")
	}

	// 验证超时被记录
	output := buf.String()
	if !strings.Contains(output, "timeout") {
		t.Errorf("expected timeout in log, got: %s", output)
	}
}

// TestSafeExecutorWithMetrics_NilCollector 测试 nil collector
func TestSafeExecutorWithMetrics_NilCollector(t *testing.T) {
	pool := newPool(1, func() *goja.Runtime {
		return goja.New()
	})

	// nil collector 应该正常工作
	executor := NewSafeExecutorWithMetrics(pool, 5*time.Second, nil)

	ctx := context.Background()
	result, err := executor.ExecuteWithMetrics(ctx, `1 + 1`, nil, "test", "test")

	if err != nil {
		t.Fatalf("execution failed: %v", err)
	}

	if result.ToInteger() != 2 {
		t.Errorf("expected 2, got: %v", result.Export())
	}
}

// TestSafeExecutorWithMetrics_Error 测试错误记录
func TestSafeExecutorWithMetrics_Error(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	pool := newPool(1, func() *goja.Runtime {
		return goja.New()
	})

	collector := NewMetricsCollector(true, logger)
	executor := NewSafeExecutorWithMetrics(pool, 5*time.Second, collector)

	ctx := context.Background()
	_, err := executor.ExecuteWithMetrics(ctx, `throw new Error("test error")`, nil, "test", "test")

	if err == nil {
		t.Fatal("expected error")
	}

	output := buf.String()
	if !strings.Contains(output, "test error") {
		t.Errorf("expected error in log, got: %s", output)
	}

	stats := collector.GetStats()
	if stats.TotalErrors != 1 {
		t.Errorf("expected 1 error, got: %d", stats.TotalErrors)
	}
}

// TestMetricsCollector_NilLogger 测试 nil logger
func TestMetricsCollector_NilLogger(t *testing.T) {
	collector := NewMetricsCollector(true, nil)

	// 不应该 panic
	collector.Record(&JSVMMetrics{
		HookName:   "test",
		Collection: "test",
		Duration:   1 * time.Millisecond,
	})
}
