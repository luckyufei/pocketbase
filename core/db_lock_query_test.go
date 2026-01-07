package core

import (
	"context"
	"testing"
)

// TestLockableQueryInterface 测试 LockableQuery 接口
func TestLockableQueryInterface(t *testing.T) {
	// 验证 lockableSelectQuery 实现了 LockableQuery 接口
	var _ LockableQuery = (*lockableSelectQuery)(nil)
}

// TestLockableQueryMethods 测试锁查询方法链
func TestLockableQueryMethods(t *testing.T) {
	// 创建一个模拟的查询
	q := &lockableSelectQuery{
		lockMode: LockNone,
		ctx:      context.Background(),
	}

	// 测试 ForUpdate
	q.ForUpdate()
	if q.lockMode != LockForUpdate {
		t.Errorf("ForUpdate() 应设置 lockMode 为 LockForUpdate, 实际 %v", q.lockMode)
	}

	// 测试 ForShare
	q.ForShare()
	if q.lockMode != LockForShare {
		t.Errorf("ForShare() 应设置 lockMode 为 LockForShare, 实际 %v", q.lockMode)
	}

	// 测试 ForUpdateNoWait
	q.ForUpdateNoWait()
	if q.lockMode != LockForUpdateNoWait {
		t.Errorf("ForUpdateNoWait() 应设置 lockMode 为 LockForUpdateNoWait, 实际 %v", q.lockMode)
	}

	// 测试 ForUpdateSkipLocked
	q.ForUpdateSkipLocked()
	if q.lockMode != LockForUpdateSkipLocked {
		t.Errorf("ForUpdateSkipLocked() 应设置 lockMode 为 LockForUpdateSkipLocked, 实际 %v", q.lockMode)
	}

	// 测试 WithLock
	q.WithLock(LockForUpdate)
	if q.lockMode != LockForUpdate {
		t.Errorf("WithLock(LockForUpdate) 应设置 lockMode 为 LockForUpdate, 实际 %v", q.lockMode)
	}
}

// TestLockableQueryWithContext 测试上下文设置
func TestLockableQueryWithContext(t *testing.T) {
	ctx := context.WithValue(context.Background(), "test", "value")

	q := &lockableSelectQuery{
		lockMode: LockNone,
		ctx:      context.Background(),
	}

	q.WithContext(ctx)

	if q.ctx != ctx {
		t.Error("WithContext() 应正确设置上下文")
	}
}

// TestNewLockableQuery 测试创建新的可锁定查询
func TestNewLockableQuery(t *testing.T) {
	// 由于 newLockableQuery 需要 App 和 SelectQuery，这里只测试基本逻辑
	// 实际集成测试需要在 PostgreSQL 环境中进行

	t.Run("初始状态", func(t *testing.T) {
		q := &lockableSelectQuery{
			lockMode: LockNone,
			ctx:      context.Background(),
		}

		if q.lockMode != LockNone {
			t.Error("初始 lockMode 应为 LockNone")
		}
	})
}

// TestLockOptionsBuilder 测试锁选项构建器
func TestLockOptionsBuilder(t *testing.T) {
	t.Run("默认选项", func(t *testing.T) {
		opts := DefaultLockOptions()

		if opts.Mode != LockForUpdate {
			t.Errorf("默认 Mode 应为 LockForUpdate, 实际 %v", opts.Mode)
		}
		if opts.Timeout != 0 {
			t.Errorf("默认 Timeout 应为 0, 实际 %d", opts.Timeout)
		}
	})

	t.Run("链式设置", func(t *testing.T) {
		opts := DefaultLockOptions().
			WithMode(LockForShare).
			WithTables("users", "orders").
			WithTimeout(5000)

		if opts.Mode != LockForShare {
			t.Errorf("Mode 应为 LockForShare, 实际 %v", opts.Mode)
		}
		if len(opts.Tables) != 2 {
			t.Errorf("Tables 应有 2 个元素, 实际 %d", len(opts.Tables))
		}
		if opts.Timeout != 5000 {
			t.Errorf("Timeout 应为 5000, 实际 %d", opts.Timeout)
		}
	})

	t.Run("构建锁子句", func(t *testing.T) {
		testCases := []struct {
			name     string
			opts     *LockOptions
			expected string
		}{
			{
				name:     "无锁",
				opts:     &LockOptions{Mode: LockNone},
				expected: "",
			},
			{
				name:     "FOR UPDATE",
				opts:     &LockOptions{Mode: LockForUpdate},
				expected: "FOR UPDATE",
			},
			{
				name:     "FOR UPDATE OF tables",
				opts:     &LockOptions{Mode: LockForUpdate, Tables: []string{"users", "orders"}},
				expected: "FOR UPDATE OF users, orders",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				result := tc.opts.BuildLockClause()
				if result != tc.expected {
					t.Errorf("期望 '%s', 实际 '%s'", tc.expected, result)
				}
			})
		}
	})
}

// TestLockErrorHandling 测试锁错误处理
func TestLockErrorHandling(t *testing.T) {
	t.Run("创建锁错误", func(t *testing.T) {
		err := NewLockError("test_op", "test message", nil)

		if err.Operation != "test_op" {
			t.Errorf("Operation 应为 'test_op', 实际 '%s'", err.Operation)
		}
		if err.Message != "test message" {
			t.Errorf("Message 应为 'test message', 实际 '%s'", err.Message)
		}

		expectedStr := "lock error [test_op]: test message"
		if err.Error() != expectedStr {
			t.Errorf("Error() 应返回 '%s', 实际 '%s'", expectedStr, err.Error())
		}
	})

	t.Run("带原因的锁错误", func(t *testing.T) {
		cause := NewLockError("cause_op", "cause message", nil)
		err := NewLockError("test_op", "test message", cause)

		if err.Unwrap() != cause {
			t.Error("Unwrap() 应返回原因错误")
		}

		if !IsLockError(err) {
			t.Error("IsLockError() 应返回 true")
		}
	})

	t.Run("非锁错误", func(t *testing.T) {
		err := context.DeadlineExceeded

		if IsLockError(err) {
			t.Error("IsLockError() 对非锁错误应返回 false")
		}
	})
}
