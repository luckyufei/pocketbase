package core

import (
	"time"
)

// ============================================================================
// TraceRepository 接口定义
// ============================================================================

// TraceRepository 定义 Trace 数据存储接口
// 支持 PostgreSQL 和 SQLite 两种实现
type TraceRepository interface {
	// BatchWrite 批量写入 Span
	// PostgreSQL: 使用 COPY 协议
	// SQLite: 使用批量 INSERT
	BatchWrite(spans []*Span) error

	// Query 查询 Span 列表，返回 (spans, total, error)
	Query(params *FilterParams) ([]*Span, int64, error)

	// GetTrace 获取完整调用链（同一 trace_id 的所有 Span）
	GetTrace(traceID string) ([]*Span, error)

	// Stats 获取统计数据
	Stats(params *FilterParams) (*TraceStats, error)

	// Prune 清理指定时间之前的数据，返回删除的行数
	Prune(before time.Time) (int64, error)

	// CreateSchema 创建数据库 schema
	CreateSchema() error

	// Close 关闭连接
	Close() error

	// IsHealthy 检查 repository 是否健康
	IsHealthy() bool

	// Recover 尝试恢复 repository（重建数据库等）
	Recover() error
}

// ============================================================================
// FilterParams 查询参数
// ============================================================================

// FilterParams 定义查询过滤参数
type FilterParams struct {
	TraceID          string            // 按 trace_id 过滤
	SpanID           string            // 按 span_id 过滤
	Operation        string            // 按操作名称过滤
	Status           SpanStatus        // 按状态过滤
	StartTime        int64             // 开始时间（微秒）
	EndTime          int64             // 结束时间（微秒）
	Limit            int               // 返回数量限制
	Offset           int               // 偏移量
	RootOnly         bool              // 只返回根 Span
	AttributeFilters map[string]any    // 按 attributes 字段过滤
}

// NewFilterParams 创建默认的过滤参数
func NewFilterParams() *FilterParams {
	return &FilterParams{
		Limit:            50,
		Offset:           0,
		AttributeFilters: make(map[string]any),
	}
}

// WithTraceID 设置 trace_id 过滤
func (p *FilterParams) WithTraceID(traceID string) *FilterParams {
	p.TraceID = traceID
	return p
}

// WithSpanID 设置 span_id 过滤
func (p *FilterParams) WithSpanID(spanID string) *FilterParams {
	p.SpanID = spanID
	return p
}

// WithOperation 设置操作名称过滤
func (p *FilterParams) WithOperation(operation string) *FilterParams {
	p.Operation = operation
	return p
}

// WithStatus 设置状态过滤
func (p *FilterParams) WithStatus(status SpanStatus) *FilterParams {
	p.Status = status
	return p
}

// WithTimeRange 设置时间范围过滤
func (p *FilterParams) WithTimeRange(start, end time.Time) *FilterParams {
	p.StartTime = start.UnixMicro()
	p.EndTime = end.UnixMicro()
	return p
}

// WithPagination 设置分页参数
func (p *FilterParams) WithPagination(limit, offset int) *FilterParams {
	p.Limit = limit
	p.Offset = offset
	return p
}

// WithRootOnly 设置只返回根 Span
func (p *FilterParams) WithRootOnly(rootOnly bool) *FilterParams {
	p.RootOnly = rootOnly
	return p
}

// ============================================================================
// TraceStats 统计数据
// ============================================================================

// TraceStats 表示 Trace 统计数据
type TraceStats struct {
	TotalRequests int64 `json:"total_requests"` // 总请求数
	SuccessCount  int64 `json:"success_count"`  // 成功数
	ErrorCount    int64 `json:"error_count"`    // 错误数
	P50Latency    int64 `json:"p50_latency"`    // P50 延迟（微秒）
	P95Latency    int64 `json:"p95_latency"`    // P95 延迟（微秒）
	P99Latency    int64 `json:"p99_latency"`    // P99 延迟（微秒）
}

// SuccessRate 返回成功率（百分比）
func (s *TraceStats) SuccessRate() float64 {
	if s.TotalRequests == 0 {
		return 0.0
	}
	return float64(s.SuccessCount) / float64(s.TotalRequests) * 100.0
}

// P50LatencyMs 返回 P50 延迟（毫秒）
func (s *TraceStats) P50LatencyMs() float64 {
	return float64(s.P50Latency) / 1000.0
}

// P95LatencyMs 返回 P95 延迟（毫秒）
func (s *TraceStats) P95LatencyMs() float64 {
	return float64(s.P95Latency) / 1000.0
}

// P99LatencyMs 返回 P99 延迟（毫秒）
func (s *TraceStats) P99LatencyMs() float64 {
	return float64(s.P99Latency) / 1000.0
}
