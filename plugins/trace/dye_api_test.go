package trace

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace/dye"
)

// createTestTracer 创建测试用的 Tracer
func createTestTracer(store dye.DyeStore) *traceImpl {
	return &traceImpl{
		dyeStore: store,
	}
}

// TestDyeUser 测试添加染色用户
func TestDyeUser(t *testing.T) {
	t.Run("adds user to dye store", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		err := DyeUser(tracer, "user-123", time.Hour)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if !store.IsDyed("user-123") {
			t.Error("expected user to be dyed")
		}
	})

	t.Run("uses default TTL when zero", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		err := DyeUser(tracer, "user-456", 0)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if !store.IsDyed("user-456") {
			t.Error("expected user to be dyed")
		}
	})

	t.Run("returns error when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		err := DyeUser(tracer, "user-789", time.Hour)
		if err == nil {
			t.Error("expected error when dye store is nil")
		}
	})

	t.Run("returns error for nil tracer", func(t *testing.T) {
		err := DyeUser(nil, "user-123", time.Hour)
		if err == nil {
			t.Error("expected error for nil tracer")
		}
	})
}

// TestUndyeUser 测试移除染色用户
func TestUndyeUser(t *testing.T) {
	t.Run("removes user from dye store", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "", "")

		tracer := createTestTracer(store)

		err := UndyeUser(tracer, "user-123")
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if store.IsDyed("user-123") {
			t.Error("expected user to be undyed")
		}
	})

	t.Run("returns no error for non-existing user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		err := UndyeUser(tracer, "non-existing")
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("returns error when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		err := UndyeUser(tracer, "user-123")
		if err == nil {
			t.Error("expected error when dye store is nil")
		}
	})
}

// TestIsDyed 测试检查用户是否被染色
func TestIsDyed(t *testing.T) {
	t.Run("returns true for dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "", "")

		tracer := createTestTracer(store)

		if !IsDyed(tracer, "user-123") {
			t.Error("expected true for dyed user")
		}
	})

	t.Run("returns false for non-dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		if IsDyed(tracer, "user-456") {
			t.Error("expected false for non-dyed user")
		}
	})

	t.Run("returns false when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		if IsDyed(tracer, "user-123") {
			t.Error("expected false when dye store is nil")
		}
	})

	t.Run("returns false for nil tracer", func(t *testing.T) {
		if IsDyed(nil, "user-123") {
			t.Error("expected false for nil tracer")
		}
	})
}

// TestListDyedUsers 测试获取所有染色用户
func TestListDyedUsers(t *testing.T) {
	t.Run("returns all dyed users", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-1", time.Hour, "admin", "debug")
		_ = store.Add("user-2", time.Hour, "admin", "test")

		tracer := createTestTracer(store)

		users := ListDyedUsers(tracer)
		if len(users) != 2 {
			t.Errorf("expected 2 users, got %d", len(users))
		}
	})

	t.Run("returns empty slice when no dyed users", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		users := ListDyedUsers(tracer)
		if len(users) != 0 {
			t.Errorf("expected 0 users, got %d", len(users))
		}
	})

	t.Run("returns empty slice when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		users := ListDyedUsers(tracer)
		if len(users) != 0 {
			t.Errorf("expected 0 users, got %d", len(users))
		}
	})

	t.Run("returns empty slice for nil tracer", func(t *testing.T) {
		users := ListDyedUsers(nil)
		if len(users) != 0 {
			t.Errorf("expected 0 users, got %d", len(users))
		}
	})
}

// TestGetDyedUser 测试获取单个染色用户信息
func TestGetDyedUser(t *testing.T) {
	t.Run("returns user info for dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "admin", "debug")

		tracer := createTestTracer(store)

		user, found := GetDyedUser(tracer, "user-123")
		if !found {
			t.Error("expected user to be found")
		}
		if user == nil {
			t.Error("expected user info")
		}
		if user.UserID != "user-123" {
			t.Errorf("expected user ID 'user-123', got '%s'", user.UserID)
		}
	})

	t.Run("returns nil for non-dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		user, found := GetDyedUser(tracer, "user-456")
		if found {
			t.Error("expected user not to be found")
		}
		if user != nil {
			t.Error("expected nil user info")
		}
	})
}

// TestUpdateDyeTTL 测试更新染色 TTL
func TestUpdateDyeTTL(t *testing.T) {
	t.Run("updates TTL successfully", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "admin", "debug")

		tracer := createTestTracer(store)

		err := UpdateDyeTTL(tracer, "user-123", 2*time.Hour)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("returns error for non-existing user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		err := UpdateDyeTTL(tracer, "non-existing", time.Hour)
		if err == nil {
			t.Error("expected error for non-existing user")
		}
	})
}

// TestDyedUserCount 测试获取染色用户数量
func TestDyedUserCount(t *testing.T) {
	t.Run("returns correct count", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-1", time.Hour, "", "")
		_ = store.Add("user-2", time.Hour, "", "")

		tracer := createTestTracer(store)

		count := DyedUserCount(tracer)
		if count != 2 {
			t.Errorf("expected count 2, got %d", count)
		}
	})

	t.Run("returns 0 when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		count := DyedUserCount(tracer)
		if count != 0 {
			t.Errorf("expected count 0, got %d", count)
		}
	})
}

// TestDyeUserWithReason 测试带原因的染色
func TestDyeUserWithReason(t *testing.T) {
	t.Run("adds user with reason", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		tracer := createTestTracer(store)

		err := DyeUserWithReason(tracer, "user-123", time.Hour, "support", "customer issue #456")
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		user, found := store.Get("user-123")
		if !found {
			t.Error("expected user to be found")
		}
		if user.AddedBy != "support" {
			t.Errorf("expected addedBy 'support', got '%s'", user.AddedBy)
		}
		if user.Reason != "customer issue #456" {
			t.Errorf("expected reason 'customer issue #456', got '%s'", user.Reason)
		}
	})

	t.Run("returns error for nil tracer", func(t *testing.T) {
		err := DyeUserWithReason(nil, "user-123", time.Hour, "admin", "test")
		if err == nil {
			t.Error("expected error for nil tracer")
		}
		if err != ErrInvalidTracer {
			t.Errorf("expected ErrInvalidTracer, got %v", err)
		}
	})

	t.Run("returns error when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		err := DyeUserWithReason(tracer, "user-123", time.Hour, "admin", "test")
		if err == nil {
			t.Error("expected error when dye store is nil")
		}
		if err != ErrNoDyeStore {
			t.Errorf("expected ErrNoDyeStore, got %v", err)
		}
	})
}

// TestGetDyedUserEdgeCases 测试获取染色用户边界情况
func TestGetDyedUserEdgeCases(t *testing.T) {
	t.Run("returns nil for nil tracer", func(t *testing.T) {
		user, found := GetDyedUser(nil, "user-123")
		if found {
			t.Error("expected not found for nil tracer")
		}
		if user != nil {
			t.Error("expected nil user for nil tracer")
		}
	})

	t.Run("returns nil when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		user, found := GetDyedUser(tracer, "user-123")
		if found {
			t.Error("expected not found when dye store is nil")
		}
		if user != nil {
			t.Error("expected nil user when dye store is nil")
		}
	})
}

// TestUpdateDyeTTLEdgeCases 测试更新 TTL 边界情况
func TestUpdateDyeTTLEdgeCases(t *testing.T) {
	t.Run("returns error for nil tracer", func(t *testing.T) {
		err := UpdateDyeTTL(nil, "user-123", time.Hour)
		if err == nil {
			t.Error("expected error for nil tracer")
		}
		if err != ErrInvalidTracer {
			t.Errorf("expected ErrInvalidTracer, got %v", err)
		}
	})

	t.Run("returns error when tracer has no dye store", func(t *testing.T) {
		tracer := createTestTracer(nil)

		err := UpdateDyeTTL(tracer, "user-123", time.Hour)
		if err == nil {
			t.Error("expected error when dye store is nil")
		}
		if err != ErrNoDyeStore {
			t.Errorf("expected ErrNoDyeStore, got %v", err)
		}
	})
}

// TestDyedUserCountEdgeCases 测试染色用户数量边界情况
func TestDyedUserCountEdgeCases(t *testing.T) {
	t.Run("returns 0 for nil tracer", func(t *testing.T) {
		count := DyedUserCount(nil)
		if count != 0 {
			t.Errorf("expected 0 for nil tracer, got %d", count)
		}
	})
}

// TestUndyeUserEdgeCases 测试移除染色用户边界情况
func TestUndyeUserEdgeCases(t *testing.T) {
	t.Run("returns error for nil tracer", func(t *testing.T) {
		err := UndyeUser(nil, "user-123")
		if err == nil {
			t.Error("expected error for nil tracer")
		}
		if err != ErrInvalidTracer {
			t.Errorf("expected ErrInvalidTracer, got %v", err)
		}
	})
}

// TestGetDyeStoreWithNonProvider 测试非 DyeStoreProvider 的 Tracer
func TestGetDyeStoreWithNonProvider(t *testing.T) {
	t.Run("returns error for tracer not implementing DyeStoreProvider", func(t *testing.T) {
		// 使用 NoopTracer，它不实现 DyeStoreProvider
		tracer := NewNoopTrace()

		err := DyeUser(tracer, "user-123", time.Hour)
		if err == nil {
			t.Error("expected error for non-provider tracer")
		}
		if err != ErrNoDyeStore {
			t.Errorf("expected ErrNoDyeStore, got %v", err)
		}
	})
}
