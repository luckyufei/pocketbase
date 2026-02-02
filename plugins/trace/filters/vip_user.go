package filters

import (
	"github.com/pocketbase/pocketbase/plugins/trace"
)

// VIPStore 定义 VIP 用户存储接口
type VIPStore interface {
	IsVIP(userID string) bool
}

type vipUserFilter struct {
	store VIPStore
}

// VIPUser 返回 VIP 用户过滤器
// VIP 用户的所有请求都会被追踪
func VIPUser(store VIPStore) trace.Filter {
	return &vipUserFilter{store: store}
}

func (f *vipUserFilter) Name() string {
	return "vip_user"
}

func (f *vipUserFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

func (f *vipUserFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if f.store == nil {
		return false
	}
	if ctx.UserID == "" {
		return false
	}
	return f.store.IsVIP(ctx.UserID)
}
