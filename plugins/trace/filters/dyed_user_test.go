package filters

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace"
	"github.com/pocketbase/pocketbase/plugins/trace/dye"
)

// TestDyedUser 测试染色用户过滤器
func TestDyedUser(t *testing.T) {
	t.Run("returns true for dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "admin", "debug")

		filter := DyedUser(store)

		ctx := &trace.FilterContext{
			UserID: "user-123",
		}

		if !filter.ShouldTrace(ctx) {
			t.Error("expected true for dyed user")
		}
	})

	t.Run("returns false for non-dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		filter := DyedUser(store)

		ctx := &trace.FilterContext{
			UserID: "user-456",
		}

		if filter.ShouldTrace(ctx) {
			t.Error("expected false for non-dyed user")
		}
	})

	t.Run("returns false for empty user ID", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		filter := DyedUser(store)

		ctx := &trace.FilterContext{
			UserID: "",
		}

		if filter.ShouldTrace(ctx) {
			t.Error("expected false for empty user ID")
		}
	})

	t.Run("returns false for expired dyed user", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		// 添加一个 TTL 很短的用户
		_ = store.Add("user-789", time.Millisecond, "admin", "debug")

		// 等待过期
		time.Sleep(10 * time.Millisecond)

		filter := DyedUser(store)

		ctx := &trace.FilterContext{
			UserID: "user-789",
		}

		if filter.ShouldTrace(ctx) {
			t.Error("expected false for expired dyed user")
		}
	})

	t.Run("has correct name", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		filter := DyedUser(store)

		if filter.Name() != "dyed_user" {
			t.Errorf("expected name 'dyed_user', got '%s'", filter.Name())
		}
	})

	t.Run("has PreExecution phase", func(t *testing.T) {
		store := dye.NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		filter := DyedUser(store)

		if filter.Phase() != trace.PreExecution {
			t.Errorf("expected PreExecution phase, got %v", filter.Phase())
		}
	})
}
