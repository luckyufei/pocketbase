package core_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// T068: Trace 配置热更新测试 (TDD - 红灯阶段)
// ============================================================================

func TestTraceUpdateConfig(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    1000,
		FlushInterval: 100 * time.Millisecond,
		BatchSize:     50,
		RetentionDays: 7,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 验证初始配置
	initialConfig := trace.GetConfig()
	if initialConfig.BufferSize != 1000 {
		t.Errorf("Initial BufferSize = %d, want 1000", initialConfig.BufferSize)
	}

	// 更新配置
	newConfig := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    2000,
		FlushInterval: 200 * time.Millisecond,
		BatchSize:     100,
		RetentionDays: 14,
		SampleRate:    0.5,
	}

	err := trace.UpdateConfig(newConfig)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// 验证配置已更新
	updatedConfig := trace.GetConfig()
	if updatedConfig.BufferSize != 2000 {
		t.Errorf("Updated BufferSize = %d, want 2000", updatedConfig.BufferSize)
	}
	if updatedConfig.FlushInterval != 200*time.Millisecond {
		t.Errorf("Updated FlushInterval = %v, want 200ms", updatedConfig.FlushInterval)
	}
	if updatedConfig.BatchSize != 100 {
		t.Errorf("Updated BatchSize = %d, want 100", updatedConfig.BatchSize)
	}
	if updatedConfig.RetentionDays != 14 {
		t.Errorf("Updated RetentionDays = %d, want 14", updatedConfig.RetentionDays)
	}
	if updatedConfig.SampleRate != 0.5 {
		t.Errorf("Updated SampleRate = %f, want 0.5", updatedConfig.SampleRate)
	}
}

func TestTraceUpdateConfigEnabled(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    1000,
		FlushInterval: 10 * time.Second, // 长间隔，确保不会自动 flush
		BatchSize:     100,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 记录一个 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")
	span.End()

	// 禁用追踪 - 这应该触发 flush
	newConfig := &core.TraceConfig{
		Enabled:       false,
		BufferSize:    1000,
		FlushInterval: 10 * time.Second,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	err := trace.UpdateConfig(newConfig)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// 尝试记录另一个 span（应该被忽略，因为已禁用）
	_, span2 := trace.StartSpan(ctx, "test2")
	span2.End()

	// 只应该有第一个 span（在禁用前记录的）
	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}
}

func TestTraceUpdateConfigFlushInterval(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    1000,
		FlushInterval: 10 * time.Second, // 初始较长间隔
		BatchSize:     100,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 记录一个 span
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test")
	span.End()

	// 更新为更短的 flush 间隔 - 这应该触发 flush（因为 FlushInterval 改变）
	newConfig := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    1000,
		FlushInterval: 10 * time.Millisecond,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	err := trace.UpdateConfig(newConfig)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// span 应该已经被 flush（在 UpdateConfig 中触发）
	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span after config update, got %d", len(spans))
	}
}

func TestTraceUpdateConfigBufferSize(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    10, // 小 buffer
		FlushInterval: 10 * time.Second,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 填满 buffer（10 个会成功，5 个会溢出）
	ctx := context.Background()
	for i := 0; i < 15; i++ {
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	// 更新为更大的 buffer - 这应该触发 flush（因为 BufferSize 改变）
	newConfig := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    100,
		FlushInterval: 10 * time.Second,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	err := trace.UpdateConfig(newConfig)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// 验证旧 buffer 中的 span 已被 flush（最多 10 个，因为 buffer 容量是 10）
	spans := repo.GetSpans()
	if len(spans) != 10 {
		t.Errorf("Expected 10 spans after buffer resize, got %d", len(spans))
	}

	// 验证新 buffer 可以容纳更多 span
	for i := 0; i < 50; i++ {
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	trace.Flush()
	spans = repo.GetSpans()
	// 应该有 10 + 50 = 60 个 span
	if len(spans) != 60 {
		t.Errorf("Expected 60 spans total, got %d", len(spans))
	}
}

func TestTraceUpdateConfigSampleRate(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:    true,
		SampleRate: 1.0, // 100% 采样
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 记录一些 span
	ctx := context.Background()
	for i := 0; i < 10; i++ {
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	// 更新为 0% 采样
	newConfig := &core.TraceConfig{
		Enabled:    true,
		SampleRate: 0.0,
	}
	err := trace.UpdateConfig(newConfig)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// 记录更多 span（应该被采样丢弃）
	for i := 0; i < 10; i++ {
		_, span := trace.StartSpan(ctx, "test")
		span.End()
	}

	trace.Flush()
	spans := repo.GetSpans()
	// 只应该有前 10 个 span
	if len(spans) != 10 {
		t.Errorf("Expected 10 spans with 0%% sampling, got %d", len(spans))
	}
}

func TestTraceUpdateConfigConcurrent(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    10000,
		FlushInterval: 10 * time.Second,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	var wg sync.WaitGroup
	numGoroutines := 10

	// 并发更新配置
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			config := &core.TraceConfig{
				Enabled:       true,
				BufferSize:    1000 + i*100,
				FlushInterval: 10 * time.Second,
				BatchSize:     100,
				SampleRate:    1.0,
			}
			trace.UpdateConfig(config)
		}(i)
	}

	// 并发记录 span
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx := context.Background()
			_, span := trace.StartSpan(ctx, "concurrent")
			span.End()
		}()
	}

	wg.Wait()

	// 验证没有 panic 或死锁
	trace.Flush()
	spans := repo.GetSpans()
	// 由于并发更新配置可能导致 buffer 重建，部分 span 可能被 flush
	// 只需验证没有 panic 即可
	t.Logf("Got %d spans from concurrent operations", len(spans))
}

func TestTraceUpdateConfigInvalidValues(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)
	defer trace.Stop()

	// 测试无效的 BufferSize
	config := &core.TraceConfig{
		Enabled:    true,
		BufferSize: -1, // 无效值
	}
	err := trace.UpdateConfig(config)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}

	// 验证配置被修正
	updatedConfig := trace.GetConfig()
	if updatedConfig.BufferSize <= 0 {
		t.Error("BufferSize should be corrected to positive value")
	}
}

func TestTraceGetConfig(t *testing.T) {
	repo := &mockRepository{}
	originalConfig := &core.TraceConfig{
		Enabled:       true,
		BufferSize:    5000,
		FlushInterval: 300 * time.Millisecond,
		BatchSize:     75,
		RetentionDays: 10,
		SampleRate:    0.8,
	}
	trace := core.NewTrace(repo, originalConfig)
	defer trace.Stop()

	// 获取配置副本
	config := trace.GetConfig()

	// 验证配置值
	if config.Enabled != originalConfig.Enabled {
		t.Errorf("Enabled = %v, want %v", config.Enabled, originalConfig.Enabled)
	}
	if config.BufferSize != originalConfig.BufferSize {
		t.Errorf("BufferSize = %d, want %d", config.BufferSize, originalConfig.BufferSize)
	}
	if config.FlushInterval != originalConfig.FlushInterval {
		t.Errorf("FlushInterval = %v, want %v", config.FlushInterval, originalConfig.FlushInterval)
	}
	if config.BatchSize != originalConfig.BatchSize {
		t.Errorf("BatchSize = %d, want %d", config.BatchSize, originalConfig.BatchSize)
	}
	if config.RetentionDays != originalConfig.RetentionDays {
		t.Errorf("RetentionDays = %d, want %d", config.RetentionDays, originalConfig.RetentionDays)
	}
	if config.SampleRate != originalConfig.SampleRate {
		t.Errorf("SampleRate = %f, want %f", config.SampleRate, originalConfig.SampleRate)
	}

	// 修改返回的配置不应该影响原配置
	config.BufferSize = 9999
	originalAfter := trace.GetConfig()
	if originalAfter.BufferSize == 9999 {
		t.Error("GetConfig should return a copy, not the original")
	}
}

// ============================================================================
// T073: Trace 启用/禁用开关测试 (TDD - 红灯阶段)
// ============================================================================

func TestTraceEnable(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       false, // 初始禁用
		BufferSize:    1000,
		FlushInterval: 10 * time.Second,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 验证初始状态为禁用
	if trace.IsTraceEnabled() {
		t.Error("Trace should be disabled initially")
	}

	// 尝试记录 span（应该被忽略）
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test1")
	span.End()

	// 启用追踪
	trace.Enable()

	// 验证已启用
	if !trace.IsTraceEnabled() {
		t.Error("Trace should be enabled after Enable()")
	}

	// 记录 span（应该成功）
	_, span2 := trace.StartSpan(ctx, "test2")
	span2.End()

	trace.Flush()
	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}
	if len(spans) > 0 && spans[0].Name != "test2" {
		t.Errorf("Expected span name 'test2', got '%s'", spans[0].Name)
	}
}

func TestTraceDisable(t *testing.T) {
	repo := &mockRepository{}
	config := &core.TraceConfig{
		Enabled:       true, // 初始启用
		BufferSize:    1000,
		FlushInterval: 10 * time.Second,
		BatchSize:     100,
		SampleRate:    1.0,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 验证初始状态为启用
	if !trace.IsTraceEnabled() {
		t.Error("Trace should be enabled initially")
	}

	// 记录 span（应该成功）
	ctx := context.Background()
	_, span := trace.StartSpan(ctx, "test1")
	span.End()

	// 禁用追踪（应该触发 flush）
	trace.Disable()

	// 验证已禁用
	if trace.IsTraceEnabled() {
		t.Error("Trace should be disabled after Disable()")
	}

	// 尝试记录 span（应该被忽略）
	_, span2 := trace.StartSpan(ctx, "test2")
	span2.End()

	// 只应该有第一个 span
	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}
	if len(spans) > 0 && spans[0].Name != "test1" {
		t.Errorf("Expected span name 'test1', got '%s'", spans[0].Name)
	}
}

func TestTraceEnableDisableToggle(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)
	defer trace.Stop()

	// 默认应该启用
	if !trace.IsTraceEnabled() {
		t.Error("Trace should be enabled by default")
	}

	// 禁用
	trace.Disable()
	if trace.IsTraceEnabled() {
		t.Error("Trace should be disabled")
	}

	// 再次启用
	trace.Enable()
	if !trace.IsTraceEnabled() {
		t.Error("Trace should be enabled again")
	}

	// 再次禁用
	trace.Disable()
	if trace.IsTraceEnabled() {
		t.Error("Trace should be disabled again")
	}
}