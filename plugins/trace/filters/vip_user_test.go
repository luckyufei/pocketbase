package filters

import (
	"testing"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// TestVIPUserFilter 测试 VIP 用户过滤器
func TestVIPUserFilter(t *testing.T) {
	t.Run("returns correct name", func(t *testing.T) {
		filter := VIPUser(nil)
		if filter.Name() != "vip_user" {
			t.Errorf("expected name 'vip_user', got '%s'", filter.Name())
		}
	})

	t.Run("returns pre-execution phase", func(t *testing.T) {
		filter := VIPUser(nil)
		if filter.Phase() != trace.PreExecution {
			t.Errorf("expected PreExecution phase")
		}
	})

	t.Run("returns true for VIP user", func(t *testing.T) {
		store := &mockVIPStore{vipUsers: map[string]bool{"user-123": true}}
		filter := VIPUser(store)

		ctx := &trace.FilterContext{UserID: "user-123"}
		if !filter.ShouldTrace(ctx) {
			t.Error("expected VIP user to be traced")
		}
	})

	t.Run("returns false for non-VIP user", func(t *testing.T) {
		store := &mockVIPStore{vipUsers: map[string]bool{"user-123": true}}
		filter := VIPUser(store)

		ctx := &trace.FilterContext{UserID: "user-456"}
		if filter.ShouldTrace(ctx) {
			t.Error("expected non-VIP user not to be traced")
		}
	})

	t.Run("returns false when no user ID", func(t *testing.T) {
		store := &mockVIPStore{vipUsers: map[string]bool{"user-123": true}}
		filter := VIPUser(store)

		ctx := &trace.FilterContext{UserID: ""}
		if filter.ShouldTrace(ctx) {
			t.Error("expected empty user ID not to be traced")
		}
	})

	t.Run("returns false when store is nil", func(t *testing.T) {
		filter := VIPUser(nil)

		ctx := &trace.FilterContext{UserID: "user-123"}
		if filter.ShouldTrace(ctx) {
			t.Error("expected nil store not to trace")
		}
	})
}

// mockVIPStore 用于测试的 mock VIP store
type mockVIPStore struct {
	vipUsers map[string]bool
}

func (m *mockVIPStore) IsVIP(userID string) bool {
	if m.vipUsers == nil {
		return false
	}
	return m.vipUsers[userID]
}
