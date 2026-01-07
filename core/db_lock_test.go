package core

import (
	"testing"
)

// TestLockModeString 测试锁模式字符串表示
func TestLockModeString(t *testing.T) {
	testCases := []struct {
		mode     LockMode
		expected string
	}{
		{LockNone, ""},
		{LockForUpdate, "FOR UPDATE"},
		{LockForShare, "FOR SHARE"},
		{LockForUpdateNoWait, "FOR UPDATE NOWAIT"},
		{LockForUpdateSkipLocked, "FOR UPDATE SKIP LOCKED"},
	}

	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			result := tc.mode.String()
			if result != tc.expected {
				t.Errorf("期望 '%s', 实际 '%s'", tc.expected, result)
			}
		})
	}
}

// TestLockModeIsValid 测试锁模式有效性检查
func TestLockModeIsValid(t *testing.T) {
	testCases := []struct {
		mode     LockMode
		expected bool
	}{
		{LockNone, true},
		{LockForUpdate, true},
		{LockForShare, true},
		{LockForUpdateNoWait, true},
		{LockForUpdateSkipLocked, true},
		{LockMode(99), false},
	}

	for _, tc := range testCases {
		t.Run(tc.mode.String(), func(t *testing.T) {
			result := tc.mode.IsValid()
			if result != tc.expected {
				t.Errorf("LockMode(%d).IsValid() = %v, 期望 %v", tc.mode, result, tc.expected)
			}
		})
	}
}

// TestBuildSelectForUpdateSQL 测试构建 SELECT FOR UPDATE SQL
func TestBuildSelectForUpdateSQL(t *testing.T) {
	testCases := []struct {
		name       string
		tableName  string
		columns    []string
		whereClause string
		lockMode   LockMode
		expected   string
	}{
		{
			name:       "基本 FOR UPDATE",
			tableName:  "users",
			columns:    []string{"id", "name"},
			whereClause: "id = $1",
			lockMode:   LockForUpdate,
			expected:   "SELECT id, name FROM users WHERE id = $1 FOR UPDATE",
		},
		{
			name:       "FOR SHARE",
			tableName:  "posts",
			columns:    []string{"*"},
			whereClause: "author_id = $1",
			lockMode:   LockForShare,
			expected:   "SELECT * FROM posts WHERE author_id = $1 FOR SHARE",
		},
		{
			name:       "FOR UPDATE NOWAIT",
			tableName:  "orders",
			columns:    []string{"id", "status", "total"},
			whereClause: "id = $1 AND status = 'pending'",
			lockMode:   LockForUpdateNoWait,
			expected:   "SELECT id, status, total FROM orders WHERE id = $1 AND status = 'pending' FOR UPDATE NOWAIT",
		},
		{
			name:       "FOR UPDATE SKIP LOCKED",
			tableName:  "jobs",
			columns:    []string{"id", "payload"},
			whereClause: "status = 'queued'",
			lockMode:   LockForUpdateSkipLocked,
			expected:   "SELECT id, payload FROM jobs WHERE status = 'queued' FOR UPDATE SKIP LOCKED",
		},
		{
			name:       "无锁模式",
			tableName:  "items",
			columns:    []string{"id"},
			whereClause: "id = $1",
			lockMode:   LockNone,
			expected:   "SELECT id FROM items WHERE id = $1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := BuildSelectForUpdateSQL(tc.tableName, tc.columns, tc.whereClause, tc.lockMode)
			if result != tc.expected {
				t.Errorf("\n期望: %s\n实际: %s", tc.expected, result)
			}
		})
	}
}

// TestCriticalOperations 测试关键操作识别
func TestCriticalOperations(t *testing.T) {
	// 验证关键操作列表
	criticalOps := GetCriticalOperations()

	// 应该包含一些关键操作
	if len(criticalOps) == 0 {
		t.Error("关键操作列表不应为空")
	}

	// 验证每个操作都有必要的字段
	for _, op := range criticalOps {
		if op.Name == "" {
			t.Error("操作名称不应为空")
		}
		if op.Description == "" {
			t.Error("操作描述不应为空")
		}
		if !op.RecommendedLock.IsValid() {
			t.Errorf("操作 %s 的推荐锁模式无效", op.Name)
		}
	}
}

// TestShouldUsePessimisticLock 测试是否应该使用悲观锁
func TestShouldUsePessimisticLock(t *testing.T) {
	testCases := []struct {
		name       string
		operation  string
		isPostgres bool
		expected   bool
	}{
		{
			name:       "PostgreSQL 计数器更新",
			operation:  "counter_update",
			isPostgres: true,
			expected:   true,
		},
		{
			name:       "PostgreSQL 库存扣减",
			operation:  "inventory_decrement",
			isPostgres: true,
			expected:   true,
		},
		{
			name:       "SQLite 计数器更新 (不支持)",
			operation:  "counter_update",
			isPostgres: false,
			expected:   false,
		},
		{
			name:       "普通记录更新",
			operation:  "record_update",
			isPostgres: true,
			expected:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := ShouldUsePessimisticLock(tc.operation, tc.isPostgres)
			if result != tc.expected {
				t.Errorf("ShouldUsePessimisticLock(%s, %v) = %v, 期望 %v",
					tc.operation, tc.isPostgres, result, tc.expected)
			}
		})
	}
}
