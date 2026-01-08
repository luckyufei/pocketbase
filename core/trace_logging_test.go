package core_test

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// T069: 操作日志（Debug 级别）测试 (TDD - 红灯阶段)
// ============================================================================

func TestTraceDebugLogging(t *testing.T) {
	// 捕获日志输出
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)

	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
	}
	trace := core.NewTraceWithLogger(repo, config, logger)
	defer trace.Stop()

	// 记录一个 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test-operation")
	span.SetAttribute("key", "value")
	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	// 检查日志输出
	logOutput := buf.String()
	if !strings.Contains(logOutput, "StartSpan") {
		t.Error("Expected StartSpan debug log")
	}
	if !strings.Contains(logOutput, "test-operation") {
		t.Error("Expected operation name in debug log")
	}
	if !strings.Contains(logOutput, "RecordSpan") {
		t.Error("Expected RecordSpan debug log")
	}
}

func TestTraceDebugLoggingDisabled(t *testing.T) {
	// 捕获日志输出
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)

	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: false, // 禁用 debug 日志
	}
	trace := core.NewTraceWithLogger(repo, config, logger)
	defer trace.Stop()

	// 记录一个 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test-operation")
	span.End()

	// 等待 flush
	time.Sleep(50 * time.Millisecond)
	trace.Flush()

	// 检查日志输出（应该为空）
	logOutput := buf.String()
	if strings.Contains(logOutput, "StartSpan") {
		t.Error("Should not have debug logs when disabled")
	}
}

func TestTraceDebugLoggingFlush(t *testing.T) {
	// 捕获日志输出
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)

	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
	}
	trace := core.NewTraceWithLogger(repo, config, logger)
	defer trace.Stop()

	// 记录多个 span
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	// 手动 flush
	trace.Flush()

	// 检查 flush 日志
	logOutput := buf.String()
	if !strings.Contains(logOutput, "Flush") {
		t.Error("Expected Flush debug log")
	}
	if !strings.Contains(logOutput, "spans") {
		t.Error("Expected span count in flush log")
	}
}

func TestTraceDebugLoggingConfigUpdate(t *testing.T) {
	// 捕获日志输出
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)

	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
	}
	trace := core.NewTraceWithLogger(repo, config, logger)
	defer trace.Stop()

	// 更新配置
	newConfig := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
		BufferSize: 2000,
	}
	err := trace.UpdateConfig(newConfig)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// 检查配置更新日志
	logOutput := buf.String()
	if !strings.Contains(logOutput, "UpdateConfig") {
		t.Error("Expected UpdateConfig debug log")
	}
	if !strings.Contains(logOutput, "BufferSize") {
		t.Error("Expected BufferSize change in debug log")
	}
}

func TestTraceDebugLoggingBufferOverflow(t *testing.T) {
	// 捕获日志输出
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)

	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
		BufferSize: 5, // 小 buffer 容易溢出
	}
	trace := core.NewTraceWithLogger(repo, config, logger)
	defer trace.Stop()

	// 填满 buffer 导致溢出
	ctx := context.Background()
	for i := 0; i < 20; i++ {
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	// 等待 flush
	time.Sleep(50 * time.Millisecond)

	// 检查溢出日志
	logOutput := buf.String()
	if !strings.Contains(logOutput, "overflow") || !strings.Contains(logOutput, "dropped") {
		t.Error("Expected buffer overflow debug log")
	}
}

func TestTraceDebugLoggingSampling(t *testing.T) {
	// 捕获日志输出
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)

	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
		SampleRate: 0.0, // 0% 采样，所有 span 都会被丢弃
	}
	trace := core.NewTraceWithLogger(repo, config, logger)
	defer trace.Stop()

	// 尝试记录 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")
	span.End()

	// 检查采样日志
	logOutput := buf.String()
	if !strings.Contains(logOutput, "sampled out") || !strings.Contains(logOutput, "dropped") {
		t.Error("Expected sampling debug log")
	}
}

func TestTraceSetLogger(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)
	defer trace.Stop()

	// 设置新的 logger
	var buf bytes.Buffer
	logger := log.New(&buf, "", log.LstdFlags)
	trace.SetLogger(logger)

	// 启用 debug 日志
	config := &core.TraceConfig{
		Enabled:    true,
		DebugLevel: true,
	}
	trace.UpdateConfig(config)

	// 记录 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")
	span.End()

	// 检查日志输出
	logOutput := buf.String()
	if !strings.Contains(logOutput, "StartSpan") {
		t.Error("Expected debug log after setting logger")
	}
}