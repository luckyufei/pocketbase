// Package observability 提供 Serverless 函数的可观测性功能
// 包括结构化日志、追踪、告警等
package observability

import (
	"context"
	"time"
)

// LogLevel 日志级别
type LogLevel int

const (
	// LogLevelDebug 调试级别
	LogLevelDebug LogLevel = iota
	// LogLevelInfo 信息级别
	LogLevelInfo
	// LogLevelWarn 警告级别
	LogLevelWarn
	// LogLevelError 错误级别
	LogLevelError
)

// String 返回日志级别的字符串表示
func (l LogLevel) String() string {
	switch l {
	case LogLevelDebug:
		return "debug"
	case LogLevelInfo:
		return "info"
	case LogLevelWarn:
		return "warn"
	case LogLevelError:
		return "error"
	default:
		return "unknown"
	}
}

// LogEntry 日志条目
type LogEntry struct {
	// Level 日志级别
	Level LogLevel
	// Message 日志消息
	Message string
	// Timestamp 时间戳
	Timestamp time.Time
	// Fields 结构化字段
	Fields map[string]any
	// FunctionName 函数名称
	FunctionName string
	// RequestID 请求ID
	RequestID string
	// TraceID 追踪ID
	TraceID string
	// SpanID SpanID
	SpanID string
}

// Logger 结构化日志接口
type Logger interface {
	// Debug 记录调试日志
	Debug(msg string, fields ...any)
	// Info 记录信息日志
	Info(msg string, fields ...any)
	// Warn 记录警告日志
	Warn(msg string, fields ...any)
	// Error 记录错误日志
	Error(msg string, fields ...any)
	// With 创建带有预设字段的子日志器
	With(fields ...any) Logger
	// WithContext 从上下文创建日志器
	WithContext(ctx context.Context) Logger
}

// Span 追踪 Span
type Span struct {
	// TraceID 追踪ID
	TraceID string
	// SpanID SpanID
	SpanID string
	// ParentSpanID 父 SpanID
	ParentSpanID string
	// OperationName 操作名称
	OperationName string
	// StartTime 开始时间
	StartTime time.Time
	// EndTime 结束时间
	EndTime time.Time
	// Duration 持续时间
	Duration time.Duration
	// Status 状态
	Status SpanStatus
	// Tags 标签
	Tags map[string]string
	// Events 事件
	Events []SpanEvent
}

// SpanStatus Span 状态
type SpanStatus int

const (
	// SpanStatusUnset 未设置
	SpanStatusUnset SpanStatus = iota
	// SpanStatusOK 成功
	SpanStatusOK
	// SpanStatusError 错误
	SpanStatusError
)

// SpanEvent Span 事件
type SpanEvent struct {
	// Name 事件名称
	Name string
	// Timestamp 时间戳
	Timestamp time.Time
	// Attributes 属性
	Attributes map[string]any
}

// Tracer 追踪器接口
type Tracer interface {
	// StartSpan 开始一个新的 Span
	StartSpan(ctx context.Context, operationName string) (context.Context, SpanHandle)
	// InjectContext 将追踪上下文注入到载体中
	InjectContext(ctx context.Context, carrier map[string]string)
	// ExtractContext 从载体中提取追踪上下文
	ExtractContext(carrier map[string]string) context.Context
}

// SpanHandle Span 句柄，用于结束 Span
type SpanHandle interface {
	// End 结束 Span
	End()
	// SetStatus 设置状态
	SetStatus(status SpanStatus)
	// SetTag 设置标签
	SetTag(key, value string)
	// AddEvent 添加事件
	AddEvent(name string, attrs map[string]any)
	// RecordError 记录错误
	RecordError(err error)
}

// AlertLevel 告警级别
type AlertLevel int

const (
	// AlertLevelInfo 信息级别
	AlertLevelInfo AlertLevel = iota
	// AlertLevelWarning 警告级别
	AlertLevelWarning
	// AlertLevelCritical 严重级别
	AlertLevelCritical
)

// Alert 告警
type Alert struct {
	// Level 告警级别
	Level AlertLevel
	// Name 告警名称
	Name string
	// Message 告警消息
	Message string
	// Timestamp 时间戳
	Timestamp time.Time
	// Labels 标签
	Labels map[string]string
	// Value 触发值
	Value float64
	// Threshold 阈值
	Threshold float64
}

// AlertRule 告警规则
type AlertRule struct {
	// Name 规则名称
	Name string
	// Condition 条件表达式
	Condition string
	// Threshold 阈值
	Threshold float64
	// Duration 持续时间（触发前需要持续多久）
	Duration time.Duration
	// Level 告警级别
	Level AlertLevel
	// Labels 标签
	Labels map[string]string
}

// Alerter 告警器接口
type Alerter interface {
	// AddRule 添加告警规则
	AddRule(rule AlertRule)
	// RemoveRule 移除告警规则
	RemoveRule(name string)
	// Check 检查并触发告警
	Check(metricName string, value float64) []Alert
	// Subscribe 订阅告警
	Subscribe(handler func(Alert))
}
