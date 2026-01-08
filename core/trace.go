package core

import (
	"context"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// Trace 配置
// ============================================================================

// TraceConfig 定义 Trace 配置
type TraceConfig struct {
	Enabled        bool          // 是否启用追踪
	BufferSize     int           // Ring Buffer 大小
	FlushInterval  time.Duration // 刷新间隔
	BatchSize      int           // 批量写入大小
	RetentionDays  int           // 数据保留天数
	SampleRate     float64       // 采样率 (0.0-1.0)
}

// DefaultTraceConfig 返回默认配置
func DefaultTraceConfig() *TraceConfig {
	return &TraceConfig{
		Enabled:        true,
		BufferSize:     10000,
		FlushInterval:  time.Second,
		BatchSize:      100,
		RetentionDays:  7,
		SampleRate:     1.0,
	}
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
}

// NewTrace 创建新的 Trace 实例
func NewTrace(repo TraceRepository, config *TraceConfig) *Trace {
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

	t := &Trace{
		repo:   repo,
		config: config,
		buffer: NewRingBuffer(config.BufferSize),
		stopCh: make(chan struct{}),
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

	// 写入 buffer
	t.buffer.Push(span)
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
	return t.config.Enabled
}

func (t *Trace) startFlushWorker() {
	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return
	}
	t.running = true
	t.mu.Unlock()

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
	for {
		spans := t.buffer.Flush(t.config.BatchSize)
		if len(spans) == 0 {
			break
		}

		if err := t.repo.BatchWrite(spans); err != nil {
			// 记录错误但不阻塞
			// TODO: 添加错误处理/重试逻辑
		}
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

func (n *noopSpanBuilder) SetAttribute(key string, value any) SpanBuilder { return n }
func (n *noopSpanBuilder) SetStatus(status SpanStatus, message string) SpanBuilder { return n }
func (n *noopSpanBuilder) SetKind(kind SpanKind) SpanBuilder { return n }
func (n *noopSpanBuilder) End() {}
