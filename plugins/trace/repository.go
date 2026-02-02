// Package trace 提供可插拔的分布式追踪功能
package trace

import (
	"time"
)

// TraceRepository 定义追踪数据存储接口
// 支持 SQLite 和 PostgreSQL 后端实现
type TraceRepository interface {
	// SaveBatch 批量保存 Span 数据
	SaveBatch(spans []*Span) (BatchSaveResult, error)

	// FindByTraceID 根据 TraceID 查找所有相关 Span
	FindByTraceID(traceID string) ([]*Span, error)

	// FindBySpanID 根据 SpanID 查找单个 Span
	FindBySpanID(spanID string) (*Span, error)

	// Query 根据查询选项查询 Span 列表
	Query(opts TraceQueryOptions) ([]*Span, error)

	// Count 统计匹配的 Span 数量
	Count(opts TraceQueryOptions) (int64, error)

	// Prune 清理指定时间之前的 Span 数据
	// 返回删除的 Span 数量
	Prune(before time.Time) (int64, error)

	// DeleteByTraceID 删除指定 TraceID 的所有 Span
	DeleteByTraceID(traceID string) error

	// Close 关闭存储连接
	Close() error
}

// TraceQueryOptions 定义查询选项
type TraceQueryOptions struct {
	// TraceID 按 TraceID 精确匹配
	TraceID string

	// ParentSpanID 按父 SpanID 精确匹配
	ParentSpanID string

	// SpanName 按 Span 名称模糊匹配
	SpanName string

	// MinDuration 最小持续时间（微秒）
	MinDuration time.Duration

	// MaxDuration 最大持续时间（微秒）
	MaxDuration time.Duration

	// StatusFilter 状态过滤（多选）
	StatusFilter []SpanStatus

	// KindFilter 类型过滤（多选）
	KindFilter []SpanKind

	// StartTimeFrom 开始时间范围起点
	StartTimeFrom time.Time

	// StartTimeTo 开始时间范围终点
	StartTimeTo time.Time

	// AttributeFilters 属性过滤条件（key=value 形式）
	AttributeFilters map[string]any

	// OrderBy 排序字段，默认按开始时间降序
	OrderBy string

	// OrderDesc 是否降序，默认 true
	OrderDesc bool

	// Limit 返回数量限制，0 表示使用默认值
	Limit int

	// Offset 偏移量，用于分页
	Offset int
}

// BatchSaveResult 表示批量保存操作的结果
type BatchSaveResult struct {
	// Total 总共尝试保存的 Span 数量
	Total int

	// Success 成功保存的 Span 数量
	Success int

	// Failed 保存失败的 Span 数量
	Failed int

	// Errors 具体的错误信息列表
	Errors []error
}
