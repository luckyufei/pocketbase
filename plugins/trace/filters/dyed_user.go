package filters

import (
	"github.com/pocketbase/pocketbase/plugins/trace"
	"github.com/pocketbase/pocketbase/plugins/trace/dye"
)

// dyedUserFilter 染色用户过滤器
type dyedUserFilter struct {
	store dye.DyeStore
}

// DyedUser 返回染色用户过滤器
// 如果用户被染色，则始终追踪该用户的请求
func DyedUser(store dye.DyeStore) trace.Filter {
	return &dyedUserFilter{store: store}
}

// Name 返回过滤器名称
func (f *dyedUserFilter) Name() string {
	return "dyed_user"
}

// Phase 返回过滤器阶段
// 染色用户过滤器在 PreExecution 阶段执行，优先级最高
func (f *dyedUserFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

// ShouldTrace 判断是否应该追踪
// 如果用户被染色且未过期，返回 true
func (f *dyedUserFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.UserID == "" {
		return false
	}
	return f.store.IsDyed(ctx.UserID)
}
