package dye

import (
	"testing"
	"time"
)

// TestMemoryDyeStoreNew 测试创建 MemoryDyeStore
func TestMemoryDyeStoreNew(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	if store == nil {
		t.Fatal("NewMemoryDyeStore should not return nil")
	}
	defer store.Close()

	if store.Count() != 0 {
		t.Errorf("Initial count should be 0, got %d", store.Count())
	}
}

// TestMemoryDyeStoreAdd 测试添加染色用户
func TestMemoryDyeStoreAdd(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	t.Run("成功添加用户", func(t *testing.T) {
		err := store.Add("user-1", time.Hour, "admin", "测试")
		if err != nil {
			t.Errorf("Add should not return error, got %v", err)
		}
		if store.Count() != 1 {
			t.Errorf("Count should be 1, got %d", store.Count())
		}
	})

	t.Run("添加相同用户会更新", func(t *testing.T) {
		store2 := NewMemoryDyeStore(100, time.Hour)
		defer store2.Close()

		err := store2.Add("user-1", time.Hour, "admin1", "reason1")
		if err != nil {
			t.Fatalf("First Add failed: %v", err)
		}

		err = store2.Add("user-1", 2*time.Hour, "admin2", "reason2")
		if err != nil {
			t.Fatalf("Second Add failed: %v", err)
		}

		if store2.Count() != 1 {
			t.Errorf("Count should still be 1, got %d", store2.Count())
		}

		user, ok := store2.Get("user-1")
		if !ok {
			t.Fatal("Get should return user")
		}
		if user.AddedBy != "admin2" {
			t.Errorf("AddedBy should be updated to admin2, got %s", user.AddedBy)
		}
	})

	t.Run("达到上限时返回错误", func(t *testing.T) {
		store3 := NewMemoryDyeStore(2, time.Hour)
		defer store3.Close()

		store3.Add("user-1", time.Hour, "", "")
		store3.Add("user-2", time.Hour, "", "")

		err := store3.Add("user-3", time.Hour, "", "")
		if err != ErrMaxDyedUsersReached {
			t.Errorf("Expected ErrMaxDyedUsersReached, got %v", err)
		}
	})

	t.Run("使用默认 TTL", func(t *testing.T) {
		store4 := NewMemoryDyeStore(100, time.Hour)
		defer store4.Close()

		err := store4.Add("user-1", 0, "", "")
		if err != nil {
			t.Fatalf("Add failed: %v", err)
		}

		user, ok := store4.Get("user-1")
		if !ok {
			t.Fatal("Get should return user")
		}
		if user.TTL != time.Hour {
			t.Errorf("TTL should be default 1h, got %v", user.TTL)
		}
	})
}

// TestMemoryDyeStoreRemove 测试移除染色用户
func TestMemoryDyeStoreRemove(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	store.Add("user-1", time.Hour, "", "")

	err := store.Remove("user-1")
	if err != nil {
		t.Errorf("Remove should not return error, got %v", err)
	}
	if store.Count() != 0 {
		t.Errorf("Count should be 0 after remove, got %d", store.Count())
	}

	// 移除不存在的用户不应该报错
	err = store.Remove("user-not-exist")
	if err != nil {
		t.Errorf("Remove non-existent user should not return error, got %v", err)
	}
}

// TestMemoryDyeStoreIsDyed 测试检查用户是否被染色
func TestMemoryDyeStoreIsDyed(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	t.Run("未添加的用户返回 false", func(t *testing.T) {
		if store.IsDyed("user-not-exist") {
			t.Error("IsDyed should return false for non-existent user")
		}
	})

	t.Run("已添加的用户返回 true", func(t *testing.T) {
		store.Add("user-1", time.Hour, "", "")
		if !store.IsDyed("user-1") {
			t.Error("IsDyed should return true for added user")
		}
	})

	t.Run("过期的用户返回 false", func(t *testing.T) {
		store2 := NewMemoryDyeStore(100, time.Hour)
		defer store2.Close()

		// 添加一个很短 TTL 的用户
		store2.Add("user-1", time.Millisecond, "", "")
		time.Sleep(10 * time.Millisecond)

		if store2.IsDyed("user-1") {
			t.Error("IsDyed should return false for expired user")
		}
	})
}

// TestMemoryDyeStoreGet 测试获取染色用户信息
func TestMemoryDyeStoreGet(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	store.Add("user-1", time.Hour, "admin", "测试染色")

	user, ok := store.Get("user-1")
	if !ok {
		t.Fatal("Get should return user")
	}
	if user.UserID != "user-1" {
		t.Errorf("UserID should be user-1, got %s", user.UserID)
	}
	if user.AddedBy != "admin" {
		t.Errorf("AddedBy should be admin, got %s", user.AddedBy)
	}
	if user.Reason != "测试染色" {
		t.Errorf("Reason should be '测试染色', got %s", user.Reason)
	}
}

// TestMemoryDyeStoreList 测试获取所有染色用户列表
func TestMemoryDyeStoreList(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	store.Add("user-1", time.Hour, "", "")
	store.Add("user-2", time.Hour, "", "")
	store.Add("user-3", time.Hour, "", "")

	users := store.List()
	if len(users) != 3 {
		t.Errorf("List should return 3 users, got %d", len(users))
	}
}

// TestMemoryDyeStoreUpdateTTL 测试更新染色 TTL
func TestMemoryDyeStoreUpdateTTL(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	store.Add("user-1", time.Hour, "", "")

	t.Run("成功更新 TTL", func(t *testing.T) {
		err := store.UpdateTTL("user-1", 2*time.Hour)
		if err != nil {
			t.Errorf("UpdateTTL should not return error, got %v", err)
		}

		user, _ := store.Get("user-1")
		if user.TTL != 2*time.Hour {
			t.Errorf("TTL should be 2h, got %v", user.TTL)
		}
	})

	t.Run("用户不存在时返回错误", func(t *testing.T) {
		err := store.UpdateTTL("user-not-exist", time.Hour)
		if err != ErrDyedUserNotFound {
			t.Errorf("Expected ErrDyedUserNotFound, got %v", err)
		}
	})
}

// TestMemoryDyeStoreCount 测试获取染色用户数量
func TestMemoryDyeStoreCount(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	if store.Count() != 0 {
		t.Errorf("Initial count should be 0, got %d", store.Count())
	}

	store.Add("user-1", time.Hour, "", "")
	if store.Count() != 1 {
		t.Errorf("Count should be 1, got %d", store.Count())
	}

	store.Add("user-2", time.Hour, "", "")
	if store.Count() != 2 {
		t.Errorf("Count should be 2, got %d", store.Count())
	}

	store.Remove("user-1")
	if store.Count() != 1 {
		t.Errorf("Count should be 1 after remove, got %d", store.Count())
	}
}

// TestDyeStoreInterface 测试 DyeStore 接口
func TestDyeStoreInterface(t *testing.T) {
	var _ DyeStore = (*MemoryDyeStore)(nil)
}

// TestMemoryDyeStoreCleanup 测试过期清理
func TestMemoryDyeStoreCleanup(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	// 添加一个很短 TTL 的用户
	store.Add("user-1", 10*time.Millisecond, "", "")

	// 等待过期
	time.Sleep(20 * time.Millisecond)

	// 手动触发清理
	store.cleanup()

	// 验证用户被清理
	if store.Count() != 0 {
		t.Errorf("Count should be 0 after cleanup, got %d", store.Count())
	}
}

// TestMemoryDyeStoreDefaultValues 测试默认值
func TestMemoryDyeStoreDefaultValues(t *testing.T) {
	// 测试 maxUsers <= 0 使用默认值
	store1 := NewMemoryDyeStore(0, time.Hour)
	defer store1.Close()

	// 测试 defaultTTL <= 0 使用默认值
	store2 := NewMemoryDyeStore(100, 0)
	defer store2.Close()

	// 添加用户验证默认 TTL
	store2.Add("user-1", 0, "", "")
	user, ok := store2.Get("user-1")
	if !ok {
		t.Fatal("Get should return user")
	}
	if user.TTL != time.Hour {
		t.Errorf("Default TTL should be 1h, got %v", user.TTL)
	}
}

// TestMemoryDyeStoreGetExpired 测试获取过期用户
func TestMemoryDyeStoreGetExpired(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	// 添加一个很短 TTL 的用户
	store.Add("user-1", time.Millisecond, "", "")
	time.Sleep(10 * time.Millisecond)

	// 获取应该返回 false
	_, ok := store.Get("user-1")
	if ok {
		t.Error("Get should return false for expired user")
	}
}

// TestMemoryDyeStoreListExpired 测试列表不包含过期用户
func TestMemoryDyeStoreListExpired(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	store.Add("user-1", time.Hour, "", "")
	store.Add("user-2", time.Millisecond, "", "")
	time.Sleep(10 * time.Millisecond)

	users := store.List()
	if len(users) != 1 {
		t.Errorf("List should return 1 user (excluding expired), got %d", len(users))
	}
	if users[0].UserID != "user-1" {
		t.Errorf("Expected user-1, got %s", users[0].UserID)
	}
}
