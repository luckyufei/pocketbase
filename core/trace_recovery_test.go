package core_test

import (
	"errors"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// T072: auxiliary.db 自动重建测试 (TDD - 红灯阶段)
// ============================================================================

// mockFailingRepository 模拟数据库损坏的 repository
type mockFailingRepository struct {
	*mockRepository
	failCount    int
	maxFails     int
	shouldFail   bool
	schemaExists bool
}

func (m *mockFailingRepository) BatchWrite(spans []*core.Span) error {
	if m.shouldFail && m.failCount < m.maxFails {
		m.failCount++
		return errors.New("database is locked or corrupted")
	}
	return m.mockRepository.BatchWrite(spans)
}

func (m *mockFailingRepository) CreateSchema() error {
	if m.shouldFail && !m.schemaExists {
		m.schemaExists = true
		return nil
	}
	return m.mockRepository.CreateSchema()
}

func (m *mockFailingRepository) IsHealthy() bool {
	return !m.shouldFail || m.failCount >= m.maxFails
}

func (m *mockFailingRepository) Recover() error {
	m.shouldFail = false
	m.failCount = 0
	m.schemaExists = true
	return nil
}

func TestTraceAutoRecovery(t *testing.T) {
	repo := &mockFailingRepository{
		mockRepository: &mockRepository{},
		shouldFail:     true,
		maxFails:       3,
	}

	config := &core.TraceConfig{
		Enabled:      true,
		AutoRecovery: true,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 记录一些 span，前几个会失败
	for i := 0; i < 5; i++ {
		span := &core.Span{
			TraceID:   "test-trace",
			SpanID:    "test-span",
			Name:      "test",
			StartTime: time.Now().UnixMicro(),
		}
		trace.RecordSpan(span)
	}

	// 等待 flush 和自动恢复
	time.Sleep(100 * time.Millisecond)
	trace.Flush()

	// 验证恢复后能正常工作
	if !repo.IsHealthy() {
		t.Error("Repository should be healthy after auto recovery")
	}

	// 验证最终有 span 被记录
	spans := repo.GetSpans()
	if len(spans) == 0 {
		t.Error("Expected some spans after recovery")
	}
}

func TestTraceAutoRecoveryDisabled(t *testing.T) {
	repo := &mockFailingRepository{
		mockRepository: &mockRepository{},
		shouldFail:     true,
		maxFails:       10, // 持续失败
	}

	config := &core.TraceConfig{
		Enabled:      true,
		AutoRecovery: false, // 禁用自动恢复
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 记录一些 span
	for i := 0; i < 5; i++ {
		span := &core.Span{
			TraceID:   "test-trace",
			SpanID:    "test-span",
			Name:      "test",
			StartTime: time.Now().UnixMicro(),
		}
		trace.RecordSpan(span)
	}

	// 等待 flush
	time.Sleep(100 * time.Millisecond)
	trace.Flush()

	// 验证没有自动恢复
	if repo.IsHealthy() {
		t.Error("Repository should still be unhealthy when auto recovery is disabled")
	}

	// 验证没有 span 被记录
	spans := repo.GetSpans()
	if len(spans) > 0 {
		t.Error("Should not have spans when repository is failing and recovery is disabled")
	}
}

func TestTraceManualRecovery(t *testing.T) {
	repo := &mockFailingRepository{
		mockRepository: &mockRepository{},
		shouldFail:     true,
		maxFails:       10,
	}

	trace := core.NewTrace(repo, nil)
	defer trace.Stop()

	// 验证初始状态不健康
	if trace.IsHealthy() {
		t.Error("Trace should not be healthy with failing repository")
	}

	// 手动恢复
	err := trace.Recover()
	if err != nil {
		t.Fatalf("Manual recovery failed: %v", err)
	}

	// 验证恢复后健康
	if !trace.IsHealthy() {
		t.Error("Trace should be healthy after manual recovery")
	}

	// 验证能正常记录 span
	span := &core.Span{
		TraceID:   "test-trace",
		SpanID:    "test-span",
		Name:      "test",
		StartTime: time.Now().UnixMicro(),
	}
	trace.RecordSpan(span)
	trace.Flush()

	spans := repo.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span after recovery, got %d", len(spans))
	}
}

func TestTraceHealthCheck(t *testing.T) {
	repo := &mockRepository{}
	trace := core.NewTrace(repo, nil)
	defer trace.Stop()

	// 正常 repository 应该健康
	if !trace.IsHealthy() {
		t.Error("Trace should be healthy with normal repository")
	}

	// 测试健康检查方法
	health := trace.GetHealth()
	if health.Status != "healthy" {
		t.Errorf("Health status = %s, want healthy", health.Status)
	}
	if health.LastError != "" {
		t.Errorf("LastError should be empty, got %s", health.LastError)
	}
}

func TestTraceHealthCheckWithErrors(t *testing.T) {
	repo := &mockFailingRepository{
		mockRepository: &mockRepository{},
		shouldFail:     true,
		maxFails:       10,
	}

	trace := core.NewTrace(repo, nil)
	defer trace.Stop()

	// 记录一个 span 触发错误
	span := &core.Span{
		TraceID:   "test-trace",
		SpanID:    "test-span",
		Name:      "test",
		StartTime: time.Now().UnixMicro(),
	}
	trace.RecordSpan(span)
	trace.Flush()

	// 检查健康状态
	if trace.IsHealthy() {
		t.Error("Trace should not be healthy with failing repository")
	}

	health := trace.GetHealth()
	if health.Status != "unhealthy" {
		t.Errorf("Health status = %s, want unhealthy", health.Status)
	}
	if health.LastError == "" {
		t.Error("LastError should not be empty")
	}
	if health.ErrorCount == 0 {
		t.Error("ErrorCount should be greater than 0")
	}
}

func TestTraceRecoveryRetry(t *testing.T) {
	repo := &mockFailingRepository{
		mockRepository: &mockRepository{},
		shouldFail:     true,
		maxFails:       2, // 失败 2 次后成功
	}

	config := &core.TraceConfig{
		Enabled:        true,
		AutoRecovery:   true,
		RecoveryRetries: 3,
	}
	trace := core.NewTrace(repo, config)
	defer trace.Stop()

	// 记录 span 触发恢复
	for i := 0; i < 5; i++ {
		span := &core.Span{
			TraceID:   "test-trace",
			SpanID:    "test-span",
			Name:      "test",
			StartTime: time.Now().UnixMicro(),
		}
		trace.RecordSpan(span)
	}

	// 等待自动恢复
	time.Sleep(200 * time.Millisecond)
	trace.Flush()

	// 验证最终恢复成功
	if !trace.IsHealthy() {
		t.Error("Trace should be healthy after retry recovery")
	}

	spans := repo.GetSpans()
	if len(spans) == 0 {
		t.Error("Expected some spans after recovery")
	}
}