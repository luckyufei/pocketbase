package trace

import (
	"errors"
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace/dye"
)

// DyeStoreProvider 是提供 DyeStore 的接口
type DyeStoreProvider interface {
	DyeStore() dye.DyeStore
}

// ErrNoDyeStore 表示没有可用的 DyeStore
var ErrNoDyeStore = errors.New("trace: no dye store available")

// ErrInvalidTracer 表示无效的 Tracer
var ErrInvalidTracer = errors.New("trace: invalid tracer")

// getDyeStore 从 Tracer 获取 DyeStore
func getDyeStore(tracer Tracer) (dye.DyeStore, error) {
	if tracer == nil {
		return nil, ErrInvalidTracer
	}

	provider, ok := tracer.(DyeStoreProvider)
	if !ok {
		return nil, ErrNoDyeStore
	}

	store := provider.DyeStore()
	if store == nil {
		return nil, ErrNoDyeStore
	}

	return store, nil
}

// DyeUser 添加染色用户
// 如果 ttl 为 0，将使用默认 TTL
func DyeUser(tracer Tracer, userID string, ttl time.Duration) error {
	store, err := getDyeStore(tracer)
	if err != nil {
		return err
	}
	return store.Add(userID, ttl, "api", "programmatic")
}

// DyeUserWithReason 添加染色用户，带原因说明
func DyeUserWithReason(tracer Tracer, userID string, ttl time.Duration, addedBy, reason string) error {
	store, err := getDyeStore(tracer)
	if err != nil {
		return err
	}
	return store.Add(userID, ttl, addedBy, reason)
}

// UndyeUser 移除染色用户
func UndyeUser(tracer Tracer, userID string) error {
	store, err := getDyeStore(tracer)
	if err != nil {
		return err
	}
	return store.Remove(userID)
}

// IsDyed 检查用户是否被染色
func IsDyed(tracer Tracer, userID string) bool {
	store, err := getDyeStore(tracer)
	if err != nil {
		return false
	}
	return store.IsDyed(userID)
}

// GetDyedUser 获取染色用户信息
func GetDyedUser(tracer Tracer, userID string) (*dye.DyedUser, bool) {
	store, err := getDyeStore(tracer)
	if err != nil {
		return nil, false
	}
	return store.Get(userID)
}

// ListDyedUsers 获取所有染色用户
func ListDyedUsers(tracer Tracer) []dye.DyedUser {
	store, err := getDyeStore(tracer)
	if err != nil {
		return []dye.DyedUser{}
	}
	return store.List()
}

// UpdateDyeTTL 更新染色用户的 TTL
func UpdateDyeTTL(tracer Tracer, userID string, ttl time.Duration) error {
	store, err := getDyeStore(tracer)
	if err != nil {
		return err
	}
	return store.UpdateTTL(userID, ttl)
}

// DyedUserCount 获取染色用户数量
func DyedUserCount(tracer Tracer) int {
	store, err := getDyeStore(tracer)
	if err != nil {
		return 0
	}
	return store.Count()
}
