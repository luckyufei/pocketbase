package filters

import (
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// slowRequestFilter 只采集慢请求的过滤器
type slowRequestFilter struct {
	threshold time.Duration
}

// SlowRequest 返回仅采集慢请求的过滤器
func SlowRequest(threshold time.Duration) trace.Filter {
	return &slowRequestFilter{threshold: threshold}
}

// Name 返回过滤器名称
func (f *slowRequestFilter) Name() string {
	return "slow_request"
}

// Phase 返回过滤器阶段
func (f *slowRequestFilter) Phase() trace.FilterPhase {
	return trace.PostExecution
}

// ShouldTrace 判断是否应该追踪
// 只有请求耗时 >= threshold 时返回 true
func (f *slowRequestFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	return ctx.Duration >= f.threshold
}
