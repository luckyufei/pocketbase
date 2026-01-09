package core

import (
	"context"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// Trace 配置
// ============================================================================

// TraceConfig 定义 Trace 配置
type TraceConfig struct {
	Enabled         bool          // 是否启用追踪
	BufferSize      int           // Ring Buffer 大小
	FlushInterval   time.Duration // 刷新间隔
	BatchSize       int           // 批量写入大小
	RetentionDays   int           // 数据保留天数
	SampleRate      float64       // 采样率 (0.0-1.0)
	DebugLevel      bool          // 是否启用 Debug 日志
	AutoRecovery    bool          // 是否启用自动恢复
	RecoveryRetries int           // 恢复重试次数
}

// DefaultTraceConfig 返回默认配置
func DefaultTraceConfig() *TraceConfig {
	return &TraceConfig{
		Enabled:         true,
		BufferSize:      10000,
		FlushInterval:   time.Second,
		BatchSize:       100,
		RetentionDays:   7,
		SampleRate:      1.0,
		DebugLevel:      false,
		AutoRecovery:    true,
		RecoveryRetries: 3,
	}
}

// ============================================================================
// 健康状态
// ============================================================================

// TraceHealth 表示 Trace 系统的健康状态
type TraceHealth struct {
	Status     string    // "healthy" 或 "unhealthy"
	LastError  string    // 最后一次错误信息
	ErrorCount int       // 错误计数
	LastCheck  time.Time // 最后检查时间
}

// ============================================================================
// Trace 核心结构
// ============================================================================

// Trace 是追踪系统的核心结构
type Trace struct {
	repo       TraceRepository
	config     *TraceConfig
	buffer     *RingBuffer
	stopCh     chan struct{}
	wg         sync.WaitGroup
	mu         sync.RWMutex
	running    bool
	logger     *log.Logger
	health     *TraceHealth
	errorCount int
	lastError  error
	recovering bool
}

// NewTrace 创建新的 Trace 实例
func NewTrace(repo TraceRepository, config *TraceConfig) *Trace {
	return NewTraceWithLogger(repo, config, nil)
}

// NewTraceWithLogger 创建带 logger 的新 Trace 实例
func NewTraceWithLogger(repo TraceRepository, config *TraceConfig, logger *log.Logger) *Trace {
	if config == nil {
		config = DefaultTraceConfig()
	}

	// 确保配置有效
	if config.BufferSize <= 0 {
		config.BufferSize = 10000
	}
	if config.FlushInterval <= 0 {
		config.FlushInterval = time.Second
	}
	if config.BatchSize <= 0 {
		config.BatchSize = 100
	}
	if config.RecoveryRetries <= 0 {
		config.RecoveryRetries = 3
	}

	t := &Trace{
		repo:   repo,
		config: config,
		buffer: NewRingBuffer(config.BufferSize),
		stopCh: make(chan struct{}),
		logger: logger,
		health: &TraceHealth{
			Status:    "healthy",
			LastCheck: time.Now(),
		},
	}

	// 启动 flush worker
	t.startFlushWorker()

	return t
}

// ============================================================================
// Span 创建和记录
// ============================================================================

// StartSpan 创建并开始一个新的 Span
func (t *Trace) StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder) {
	if !t.isEnabled() {
		t.debugLog("StartSpan: tracing disabled, operation=%s", name)
		return ctx, &noopSpanBuilder{}
	}

	// 检查采样率
	if !t.shouldSample() {
		t.debugLog("StartSpan: sampled out, operation=%s", name)
		return ctx, &noopSpanBuilder{}
	}

	// 生成 ID
	traceID := GenerateTraceID()
	spanID := GenerateSpanID()
	var parentID string

	// 检查父 Span
	if parentSpan := SpanFromContext(ctx); parentSpan != nil {
		traceID = parentSpan.TraceID
		parentID = parentSpan.SpanID
	} else if tc := TraceContextFromContext(ctx); tc != nil {
		traceID = tc.TraceID
		parentID = tc.ParentID
	}

	t.debugLog("StartSpan: operation=%s, trace_id=%s, span_id=%s, parent_id=%s",
		name, traceID, spanID, parentID)

	span := &Span{
		TraceID:   traceID,
		SpanID:    spanID,
		ParentID:  parentID,
		Name:      name,
		Kind:      SpanKindInternal,
		StartTime: time.Now().UnixMicro(),
		Status:    SpanStatusUnset,
	}

	// 创建 SpanBuilder
	builder := &spanBuilderImpl{
		trace:     t,
		span:      span,
		startTime: time.Now(),
	}

	// 将 Span 存入 Context
	ctx = ContextWithSpan(ctx, span)

	return ctx, builder
}

// RecordSpan 记录一个完成的 Span
func (t *Trace) RecordSpan(span *Span) {
	if !t.isEnabled() {
		return
	}

	// 设置创建时间
	if span.Created.IsZero() {
		span.Created = types.NowDateTime()
	}

	t.debugLog("RecordSpan: operation=%s, trace_id=%s, span_id=%s, duration=%dμs",
		span.Name, span.TraceID, span.SpanID, span.Duration)

	// 写入 buffer
	success := t.buffer.Push(span)
	if !success {
		t.debugLog("RecordSpan: buffer overflow, span dropped, operation=%s", span.Name)
	}
}

// ============================================================================
// 查询方法
// ============================================================================

// Query 查询 Span 列表
func (t *Trace) Query(params *FilterParams) ([]*Span, int64, error) {
	return t.repo.Query(params)
}

// GetTrace 获取完整调用链
func (t *Trace) GetTrace(traceID string) ([]*Span, error) {
	return t.repo.GetTrace(traceID)
}

// Stats 获取统计数据
func (t *Trace) Stats(params *FilterParams) (*TraceStats, error) {
	return t.repo.Stats(params)
}

// ============================================================================
// Flush 和清理
// ============================================================================

// Flush 手动刷新缓冲区
func (t *Trace) Flush() {
	t.flushBuffer()
}

// Prune 清理过期数据
func (t *Trace) Prune() (int64, error) {
	if t.config.RetentionDays <= 0 {
		return 0, nil
	}

	cutoff := time.Now().AddDate(0, 0, -t.config.RetentionDays)
	return t.repo.Prune(cutoff)
}

// ============================================================================
// 生命周期管理
// ============================================================================

// Stop 停止 Trace
func (t *Trace) Stop() {
	t.mu.Lock()
	if !t.running {
		t.mu.Unlock()
		return
	}
	t.running = false
	t.mu.Unlock()

	close(t.stopCh)
	t.wg.Wait()

	// 最后一次 flush
	t.flushBuffer()
}

// Close 关闭 Trace
func (t *Trace) Close() error {
	t.Stop()
	return t.repo.Close()
}

// ============================================================================
// 内部方法
// ============================================================================

func (t *Trace) isEnabled() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.config.Enabled
}

func (t *Trace) shouldSample() bool {
	t.mu.RLock()
	sampleRate := t.config.SampleRate
	t.mu.RUnlock()

	if sampleRate >= 1.0 {
		return true
	}
	if sampleRate <= 0.0 {
		return false
	}

	return rand.Float64() < sampleRate
}

func (t *Trace) debugLog(format string, args ...interface{}) {
	t.mu.RLock()
	debugEnabled := t.config.DebugLevel
	logger := t.logger
	t.mu.RUnlock()

	if debugEnabled && logger != nil {
		logger.Printf("[TRACE DEBUG] "+format, args...)
	}
}

func (t *Trace) startFlushWorker() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.startFlushWorkerLocked()
}

func (t *Trace) startFlushWorkerLocked() {
	if t.running {
		return
	}
	t.running = true

	t.wg.Add(1)
	go func() {
		defer t.wg.Done()
		ticker := time.NewTicker(t.config.FlushInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				t.flushBuffer()
			case <-t.stopCh:
				return
			}
		}
	}()
}

func (t *Trace) flushBuffer() {
	t.flushBufferInternal(true, false)
}

// flushBufferInternal 刷新缓冲区
// canLog: 是否可以调用 debugLog（需要获取 RLock）
// holdingLock: 调用者是否已持有 Lock（用于决定 recordError 的调用方式）
func (t *Trace) flushBufferInternal(canLog bool, holdingLock bool) {
	totalFlushed := 0
	for {
		spans := t.buffer.Flush(t.config.BatchSize)
		if len(spans) == 0 {
			break
		}

		totalFlushed += len(spans)
		if canLog {
			t.debugLog("Flush: writing %d spans to repository", len(spans))
		}

		if err := t.repo.BatchWrite(spans); err != nil {
			if canLog {
				t.debugLog("Flush: BatchWrite error: %v", err)
			}
			if holdingLock {
				t.recordErrorLocked(err)
			} else {
				t.recordError(err)
			}
			// 发生错误时停止 flush，等待恢复
			break
		}
	}

	if totalFlushed > 0 && canLog {
		t.debugLog("Flush: completed, total spans flushed: %d", totalFlushed)
	}
}

// ============================================================================
// SpanBuilder 接口和实现
// ============================================================================

// SpanBuilder 用于构建和完成 Span
type SpanBuilder interface {
	SetAttribute(key string, value any) SpanBuilder
	SetStatus(status SpanStatus, message string) SpanBuilder
	SetKind(kind SpanKind) SpanBuilder
	End()
}

// spanBuilderImpl 实现 SpanBuilder
type spanBuilderImpl struct {
	trace     *Trace
	span      *Span
	startTime time.Time
}

func (s *spanBuilderImpl) SetAttribute(key string, value any) SpanBuilder {
	if s.span.Attributes == nil {
		s.span.Attributes = make(map[string]any)
	}
	s.span.Attributes[key] = value
	return s
}

func (s *spanBuilderImpl) SetStatus(status SpanStatus, message string) SpanBuilder {
	s.span.Status = status
	if message != "" {
		s.SetAttribute("error.message", message)
	}
	return s
}

func (s *spanBuilderImpl) SetKind(kind SpanKind) SpanBuilder {
	s.span.Kind = kind
	return s
}

func (s *spanBuilderImpl) End() {
	s.span.Duration = time.Since(s.startTime).Microseconds()
	if s.span.Status == SpanStatusUnset {
		s.span.Status = SpanStatusOK
	}
	s.trace.RecordSpan(s.span)
}

// noopSpanBuilder 禁用时的空实现
type noopSpanBuilder struct{}

func (n *noopSpanBuilder) SetAttribute(key string, value any) SpanBuilder          { return n }
func (n *noopSpanBuilder) SetStatus(status SpanStatus, message string) SpanBuilder { return n }
func (n *noopSpanBuilder) SetKind(kind SpanKind) SpanBuilder                       { return n }
func (n *noopSpanBuilder) End()                                                    {}

// ============================================================================
// 配置热更新 (T068)
// ============================================================================

// GetConfig 返回当前配置的副本
func (t *Trace) GetConfig() *TraceConfig {
	t.mu.RLock()
	defer t.mu.RUnlock()

	// 返回配置副本，避免外部修改
	return &TraceConfig{
		Enabled:         t.config.Enabled,
		BufferSize:      t.config.BufferSize,
		FlushInterval:   t.config.FlushInterval,
		BatchSize:       t.config.BatchSize,
		RetentionDays:   t.config.RetentionDays,
		SampleRate:      t.config.SampleRate,
		DebugLevel:      t.config.DebugLevel,
		AutoRecovery:    t.config.AutoRecovery,
		RecoveryRetries: t.config.RecoveryRetries,
	}
}

// UpdateConfig 热更新配置
func (t *Trace) UpdateConfig(newConfig *TraceConfig) error {
	if newConfig == nil {
		return nil
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	// 直接使用 config 而不调用 debugLog（避免死锁）
	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] UpdateConfig: starting config update")
	}

	// 验证并修正配置值
	if newConfig.BufferSize <= 0 {
		newConfig.BufferSize = 10000
	}
	if newConfig.FlushInterval <= 0 {
		newConfig.FlushInterval = time.Second
	}
	if newConfig.BatchSize <= 0 {
		newConfig.BatchSize = 100
	}
	if newConfig.SampleRate < 0 {
		newConfig.SampleRate = 0.0
	}
	if newConfig.SampleRate > 1.0 {
		newConfig.SampleRate = 1.0
	}

	// 检查是否需要重启 flush worker
	needRestart := t.config.FlushInterval != newConfig.FlushInterval

	// 检查是否需要重建 buffer
	needNewBuffer := t.config.BufferSize != newConfig.BufferSize

	// 检查是否正在禁用追踪
	disabling := t.config.Enabled && !newConfig.Enabled

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] UpdateConfig: BufferSize %d->%d, FlushInterval %v->%v, SampleRate %f->%f",
			t.config.BufferSize, newConfig.BufferSize,
			t.config.FlushInterval, newConfig.FlushInterval,
			t.config.SampleRate, newConfig.SampleRate)
	}

	// 如果正在禁用追踪或需要重建 buffer，先 flush 现有数据
	if disabling || needNewBuffer || needRestart {
		if t.config.DebugLevel && t.logger != nil {
			t.logger.Printf("[TRACE DEBUG] UpdateConfig: flushing buffer before config change")
		}
		t.flushBufferInternal(false, true) // 使用不需要锁的版本
	}

	// 更新配置
	t.config = &TraceConfig{
		Enabled:         newConfig.Enabled,
		BufferSize:      newConfig.BufferSize,
		FlushInterval:   newConfig.FlushInterval,
		BatchSize:       newConfig.BatchSize,
		RetentionDays:   newConfig.RetentionDays,
		SampleRate:      newConfig.SampleRate,
		DebugLevel:      newConfig.DebugLevel,
		AutoRecovery:    newConfig.AutoRecovery,
		RecoveryRetries: newConfig.RecoveryRetries,
	}

	// 如果需要新 buffer，创建新 buffer
	if needNewBuffer {
		if t.config.DebugLevel && t.logger != nil {
			t.logger.Printf("[TRACE DEBUG] UpdateConfig: rebuilding buffer, new size=%d", newConfig.BufferSize)
		}
		t.buffer = NewRingBuffer(newConfig.BufferSize)
	}

	// 如果需要重启 flush worker
	if needRestart && t.running {
		if t.config.DebugLevel && t.logger != nil {
			t.logger.Printf("[TRACE DEBUG] UpdateConfig: restarting flush worker, new interval=%v", newConfig.FlushInterval)
		}
		// 停止旧的 worker
		t.running = false
		close(t.stopCh)
		t.mu.Unlock() // 临时释放锁等待 worker 停止
		t.wg.Wait()
		t.mu.Lock() // 重新获取锁

		// 创建新的 stopCh 并启动新 worker
		t.stopCh = make(chan struct{})
		t.startFlushWorkerLocked()
	}

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] UpdateConfig: completed successfully")
	}
	return nil
}

// SetLogger 设置日志记录器
func (t *Trace) SetLogger(logger *log.Logger) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.logger = logger
	if t.config.DebugLevel && logger != nil {
		logger.Printf("[TRACE DEBUG] SetLogger: logger updated")
	}
}

// ============================================================================
// 启用/禁用开关 (T073)
// ============================================================================

// IsTraceEnabled 返回追踪是否启用
func (t *Trace) IsTraceEnabled() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.config.Enabled
}

// Enable 启用追踪
func (t *Trace) Enable() {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.config.Enabled {
		return // 已经启用
	}

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] Enable: enabling trace")
	}

	t.config.Enabled = true
}

// Disable 禁用追踪（会先 flush 缓冲区中的数据）
func (t *Trace) Disable() {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.config.Enabled {
		return // 已经禁用
	}

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] Disable: disabling trace, flushing buffer first")
	}

	// 先 flush 缓冲区中的数据
	t.flushBufferInternal(false, true)

	t.config.Enabled = false
}

// ============================================================================
// 健康检查和自动恢复 (T072)
// ============================================================================

// IsHealthy 检查 Trace 系统是否健康
func (t *Trace) IsHealthy() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.health.Status == "healthy" && t.repo.IsHealthy()
}

// GetHealth 获取详细健康状态
func (t *Trace) GetHealth() *TraceHealth {
	t.mu.RLock()
	defer t.mu.RUnlock()

	// 更新健康状态
	isHealthy := t.repo.IsHealthy() && t.errorCount == 0
	status := "healthy"
	if !isHealthy {
		status = "unhealthy"
	}

	return &TraceHealth{
		Status:     status,
		LastError:  t.getLastErrorString(),
		ErrorCount: t.errorCount,
		LastCheck:  time.Now(),
	}
}

// Recover 手动恢复 Trace 系统
func (t *Trace) Recover() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] Recover: starting manual recovery")
	}

	err := t.recoverLocked()
	if err != nil {
		if t.config.DebugLevel && t.logger != nil {
			t.logger.Printf("[TRACE DEBUG] Recover: manual recovery failed: %v", err)
		}
		return err
	}

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] Recover: manual recovery completed successfully")
	}
	return nil
}

func (t *Trace) recoverLocked() error {
	// 尝试恢复 repository
	if err := t.repo.Recover(); err != nil {
		return err
	}

	// 重置错误状态
	t.errorCount = 0
	t.lastError = nil
	t.health.Status = "healthy"
	t.health.LastError = ""
	t.health.LastCheck = time.Now()

	return nil
}

func (t *Trace) getLastErrorString() string {
	if t.lastError != nil {
		return t.lastError.Error()
	}
	return ""
}

func (t *Trace) recordError(err error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.recordErrorLocked(err)
}

// recordErrorLocked 在已持有锁的情况下记录错误
func (t *Trace) recordErrorLocked(err error) {
	t.errorCount++
	t.lastError = err
	t.health.Status = "unhealthy"
	t.health.LastError = err.Error()
	t.health.LastCheck = time.Now()

	if t.config.DebugLevel && t.logger != nil {
		t.logger.Printf("[TRACE DEBUG] recordError: error recorded, count=%d, error=%v", t.errorCount, err)
	}

	// 检查是否需要自动恢复
	if t.config.AutoRecovery && !t.recovering {
		go t.autoRecover()
	}
}

func (t *Trace) autoRecover() {
	t.mu.Lock()
	if t.recovering {
		t.mu.Unlock()
		return
	}
	t.recovering = true
	retries := t.config.RecoveryRetries
	t.mu.Unlock()

	defer func() {
		t.mu.Lock()
		t.recovering = false
		t.mu.Unlock()
	}()

	t.debugLog("autoRecover: starting auto recovery, retries=%d", retries)

	for i := 0; i < retries; i++ {
		t.debugLog("autoRecover: attempt %d/%d", i+1, retries)

		t.mu.Lock()
		err := t.recoverLocked()
		t.mu.Unlock()

		if err == nil {
			t.debugLog("autoRecover: recovery successful on attempt %d", i+1)
			return
		}

		t.debugLog("autoRecover: attempt %d failed: %v", i+1, err)

		// 等待一段时间再重试
		time.Sleep(time.Duration(i+1) * time.Second)
	}

	t.debugLog("autoRecover: all recovery attempts failed")
}
