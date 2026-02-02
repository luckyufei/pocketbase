package filters

import (
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// FilterFunc 自定义过滤函数类型
type FilterFunc func(ctx *trace.FilterContext) bool

type customFilter struct {
	name  string
	phase trace.FilterPhase
	fn    FilterFunc
}

// Custom 创建自定义过滤器
func Custom(name string, phase trace.FilterPhase, fn FilterFunc) trace.Filter {
	return &customFilter{
		name:  name,
		phase: phase,
		fn:    fn,
	}
}

func (f *customFilter) Name() string {
	return f.name
}

func (f *customFilter) Phase() trace.FilterPhase {
	return f.phase
}

func (f *customFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if f.fn == nil {
		return false
	}
	return f.fn(ctx)
}

// ============================================================================
// 组合过滤器
// ============================================================================

type andFilter struct {
	filters []trace.Filter
}

// And 创建 AND 组合过滤器（所有过滤器都返回 true 时才追踪）
func And(filters ...trace.Filter) trace.Filter {
	return &andFilter{filters: filters}
}

func (f *andFilter) Name() string {
	return "and"
}

func (f *andFilter) Phase() trace.FilterPhase {
	// AND 组合器使用第一个过滤器的阶段，或默认 PreExecution
	if len(f.filters) > 0 {
		return f.filters[0].Phase()
	}
	return trace.PreExecution
}

func (f *andFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	for _, filter := range f.filters {
		if !filter.ShouldTrace(ctx) {
			return false
		}
	}
	return true
}

type orFilter struct {
	filters []trace.Filter
}

// Or 创建 OR 组合过滤器（任一过滤器返回 true 时追踪）
func Or(filters ...trace.Filter) trace.Filter {
	return &orFilter{filters: filters}
}

func (f *orFilter) Name() string {
	return "or"
}

func (f *orFilter) Phase() trace.FilterPhase {
	if len(f.filters) > 0 {
		return f.filters[0].Phase()
	}
	return trace.PreExecution
}

func (f *orFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	for _, filter := range f.filters {
		if filter.ShouldTrace(ctx) {
			return true
		}
	}
	return false
}

type notFilter struct {
	filter trace.Filter
}

// Not 创建 NOT 过滤器（反转另一个过滤器的结果）
func Not(filter trace.Filter) trace.Filter {
	return &notFilter{filter: filter}
}

func (f *notFilter) Name() string {
	return "not"
}

func (f *notFilter) Phase() trace.FilterPhase {
	if f.filter != nil {
		return f.filter.Phase()
	}
	return trace.PreExecution
}

func (f *notFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if f.filter == nil {
		return true
	}
	return !f.filter.ShouldTrace(ctx)
}

// ============================================================================
// 常用过滤器
// ============================================================================

type headerFilter struct {
	header string
	value  string
}

// Header 创建 Header 匹配过滤器
func Header(header, value string) trace.Filter {
	return &headerFilter{header: header, value: value}
}

func (f *headerFilter) Name() string {
	return "header"
}

func (f *headerFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

func (f *headerFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Request == nil {
		return false
	}
	return ctx.Request.Header.Get(f.header) == f.value
}

type statusCodeFilter struct {
	codes []int
}

// StatusCode 创建状态码过滤器
func StatusCode(codes ...int) trace.Filter {
	return &statusCodeFilter{codes: codes}
}

func (f *statusCodeFilter) Name() string {
	return "status_code"
}

func (f *statusCodeFilter) Phase() trace.FilterPhase {
	return trace.PostExecution
}

func (f *statusCodeFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Response == nil {
		return false
	}
	for _, code := range f.codes {
		if ctx.Response.StatusCode == code {
			return true
		}
	}
	return false
}

type durationRangeFilter struct {
	min time.Duration
	max time.Duration
}

// DurationRange 创建持续时间范围过滤器
// min 和 max 都是包含的边界。如果 max 为 0，则没有上限。
func DurationRange(min, max time.Duration) trace.Filter {
	return &durationRangeFilter{min: min, max: max}
}

func (f *durationRangeFilter) Name() string {
	return "duration_range"
}

func (f *durationRangeFilter) Phase() trace.FilterPhase {
	return trace.PostExecution
}

func (f *durationRangeFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Duration < f.min {
		return false
	}
	if f.max > 0 && ctx.Duration > f.max {
		return false
	}
	return true
}
