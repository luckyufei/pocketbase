package trace

import (
	"context"
	"net/http"
	"time"
)

// FilterPhase 过滤器阶段
type FilterPhase int

const (
	// PreExecution 请求执行前（可用于路径过滤等）
	PreExecution FilterPhase = iota
	// PostExecution 请求执行后（可用于错误过滤、慢请求过滤等）
	PostExecution
)

// FilterContext 过滤器上下文
type FilterContext struct {
	Context  context.Context
	Request  *http.Request
	Response *Response     // 仅 PostExecution 阶段可用
	Duration time.Duration // 仅 PostExecution 阶段可用
	UserID   string        // 当前用户 ID
}

// Response 简化的响应信息
type Response struct {
	StatusCode int
	Size       int64
}

// Filter 过滤器接口
type Filter interface {
	// Name 返回过滤器名称
	Name() string
	// Phase 返回过滤器阶段
	Phase() FilterPhase
	// ShouldTrace 判断是否应该追踪
	ShouldTrace(ctx *FilterContext) bool
}
