package core_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// Phase 2: App.Trace() 集成测试 - T008 & T009
// ============================================================================

func TestAppTraceMethodExists(t *testing.T) {
	const testDataDir = "./pb_trace_test_data_dir/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}

	// T009: App 接口应该有 Trace() 方法
	trace := app.Trace()
	if trace == nil {
		t.Fatal("Expected app.Trace() to return non-nil Trace instance")
	}
}

func TestAppTraceStartSpan(t *testing.T) {
	const testDataDir = "./pb_trace_test_data_dir2/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}

	trace := app.Trace()

	// 使用 Trace 创建 span
	ctx := context.Background()
	ctx, span := trace.StartSpan(ctx, "test-operation")

	if span == nil {
		t.Fatal("StartSpan returned nil span")
	}

	span.SetAttribute("test.key", "test.value")
	span.End()

	// 等待 flush
	time.Sleep(100 * time.Millisecond)
	trace.Flush()

	// 验证 span 被记录
	params := core.NewFilterParams()
	spans, total, err := trace.Query(params)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if total == 0 {
		t.Error("Expected at least 1 span to be recorded")
	}

	// 验证 span 数据
	found := false
	for _, s := range spans {
		if s.Name == "test-operation" {
			found = true
			if s.Attributes["test.key"] != "test.value" {
				t.Errorf("Expected test.key=test.value, got %v", s.Attributes["test.key"])
			}
			break
		}
	}

	if !found {
		t.Error("Expected to find span with name 'test-operation'")
	}
}

func TestAppTraceConfiguration(t *testing.T) {
	const testDataDir = "./pb_trace_test_data_dir3/"
	defer os.RemoveAll(testDataDir)

	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: testDataDir,
	})
	defer app.ResetBootstrapState()

	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}

	trace := app.Trace()

	// 验证 Trace 已正确配置
	// 通过检查是否可以执行基本操作来验证
	ctx := context.Background()
	ctx, span := trace.StartSpan(ctx, "config-test")
	span.End()

	// 不应该 panic
	trace.Flush()
}
