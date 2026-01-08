package core

import (
	"encoding/json"
	"errors"
	"regexp"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// Span 常量定义
// ============================================================================

// SpanKind 表示 Span 的类型
type SpanKind string

const (
	SpanKindInternal SpanKind = "INTERNAL" // 内部操作
	SpanKindServer   SpanKind = "SERVER"   // 服务端处理请求
	SpanKindClient   SpanKind = "CLIENT"   // 客户端发起请求
	SpanKindProducer SpanKind = "PRODUCER" // 消息生产者
	SpanKindConsumer SpanKind = "CONSUMER" // 消息消费者
)

// SpanStatus 表示 Span 的状态
type SpanStatus string

const (
	SpanStatusUnset SpanStatus = "UNSET" // 未设置
	SpanStatusOK    SpanStatus = "OK"    // 成功
	SpanStatusError SpanStatus = "ERROR" // 错误
)

// TracesTableName 是 traces 表的名称
const TracesTableName = "_traces"

// 最大 attributes 大小 (64KB)
const MaxAttributesSize = 64 * 1024

// ============================================================================
// Span 结构体
// ============================================================================

// Span 表示一个追踪 Span
type Span struct {
	TraceID    string            `db:"trace_id" json:"trace_id"`       // 32-char Hex
	SpanID     string            `db:"span_id" json:"span_id"`         // 16-char Hex
	ParentID   string            `db:"parent_id" json:"parent_id"`     // 16-char Hex, 可为空
	Name       string            `db:"name" json:"name"`               // 操作名称
	Kind       SpanKind          `db:"kind" json:"kind"`               // Span 类型
	StartTime  int64             `db:"start_time" json:"start_time"`   // 开始时间 (微秒)
	Duration   int64             `db:"duration" json:"duration"`       // 持续时间 (微秒)
	Status     SpanStatus        `db:"status" json:"status"`           // 状态
	Attributes types.JSONMap[any] `db:"attributes" json:"attributes"` // 属性
	Created    types.DateTime    `db:"created" json:"created"`         // 创建时间
}

// TableName 返回表名
func (s *Span) TableName() string {
	return TracesTableName
}

// IsRoot 返回是否为根 Span
func (s *Span) IsRoot() bool {
	return s.ParentID == ""
}

// ============================================================================
// Span 验证
// ============================================================================

var (
	traceIDRegex = regexp.MustCompile(`^[0-9a-f]{32}$`)
	spanIDRegex  = regexp.MustCompile(`^[0-9a-f]{16}$`)
)

// Validate 验证 Span 字段
func (s *Span) Validate() error {
	// 验证 TraceID (32-char lowercase hex)
	if !traceIDRegex.MatchString(s.TraceID) {
		return errors.New("invalid trace_id: must be 32 lowercase hex characters")
	}

	// 验证 SpanID (16-char lowercase hex)
	if !spanIDRegex.MatchString(s.SpanID) {
		return errors.New("invalid span_id: must be 16 lowercase hex characters")
	}

	// 验证 ParentID (可选，但如果有值必须是 16-char hex)
	if s.ParentID != "" && !spanIDRegex.MatchString(s.ParentID) {
		return errors.New("invalid parent_id: must be 16 lowercase hex characters")
	}

	// 验证 Name
	if s.Name == "" {
		return errors.New("name is required")
	}

	// 验证 Attributes 大小
	if s.Attributes != nil {
		data, err := json.Marshal(s.Attributes)
		if err != nil {
			return errors.New("invalid attributes: " + err.Error())
		}
		if len(data) > MaxAttributesSize {
			return errors.New("attributes size exceeds 64KB limit")
		}
	}

	return nil
}

// ============================================================================
// Span 辅助方法
// ============================================================================

// DurationMs 返回持续时间（毫秒）
func (s *Span) DurationMs() float64 {
	return float64(s.Duration) / 1000.0
}

// StartTimeTime 返回开始时间的 time.Time
func (s *Span) StartTimeTime() time.Time {
	return time.UnixMicro(s.StartTime)
}

// SetAttribute 设置属性
func (s *Span) SetAttribute(key string, value any) {
	if s.Attributes == nil {
		s.Attributes = make(types.JSONMap[any])
	}
	s.Attributes[key] = value
}

// GetAttribute 获取属性
func (s *Span) GetAttribute(key string) (any, bool) {
	if s.Attributes == nil {
		return nil, false
	}
	v, ok := s.Attributes[key]
	return v, ok
}
