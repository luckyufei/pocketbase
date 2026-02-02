// Package filters 提供 trace 过滤器实现
package filters

import (
	"github.com/pocketbase/pocketbase/plugins/trace"
)

// errorOnlyFilter 只采集错误响应的过滤器
type errorOnlyFilter struct{}

// ErrorOnly 返回仅采集错误响应的过滤器
func ErrorOnly() trace.Filter {
	return &errorOnlyFilter{}
}

// Name 返回过滤器名称
func (f *errorOnlyFilter) Name() string {
	return "error_only"
}

// Phase 返回过滤器阶段
func (f *errorOnlyFilter) Phase() trace.FilterPhase {
	return trace.PostExecution
}

// ShouldTrace 判断是否应该追踪
// 只有状态码 >= 400 时返回 true
func (f *errorOnlyFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Response == nil {
		return false
	}
	return ctx.Response.StatusCode >= 400
}
