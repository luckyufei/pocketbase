package hostfn

import (
	"context"
	"errors"
	"testing"
)

// T066-T070: Transaction Host Function 测试

// MockDB 模拟数据库接口
type MockDB struct {
	committed  bool
	rolledback bool
	operations []string
}

func (m *MockDB) Begin() (*MockTx, error) {
	return &MockTx{db: m}, nil
}

type MockTx struct {
	db *MockDB
}

func (t *MockTx) Commit() error {
	t.db.committed = true
	return nil
}

func (t *MockTx) Rollback() error {
	t.db.rolledback = true
	return nil
}

func (t *MockTx) Execute(op string) {
	t.db.operations = append(t.db.operations, op)
}

func TestTransactionHostFunction(t *testing.T) {
	t.Run("创建 Transaction Manager", func(t *testing.T) {
		tm := NewTransactionManager()

		if tm == nil {
			t.Fatal("tm 不应为 nil")
		}
	})

	t.Run("开始事务", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		txID, err := tm.Begin(ctx)
		if err != nil {
			t.Fatalf("Begin() error = %v", err)
		}

		if txID == "" {
			t.Error("txID 不应为空")
		}

		// 验证事务存在
		if !tm.HasTransaction(txID) {
			t.Error("事务应该存在")
		}

		// 清理
		tm.Rollback(txID)
	})

	t.Run("提交事务", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		txID, _ := tm.Begin(ctx)
		err := tm.Commit(txID)
		if err != nil {
			t.Fatalf("Commit() error = %v", err)
		}

		// 验证事务已移除
		if tm.HasTransaction(txID) {
			t.Error("提交后事务应该被移除")
		}
	})

	t.Run("回滚事务", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		txID, _ := tm.Begin(ctx)
		err := tm.Rollback(txID)
		if err != nil {
			t.Fatalf("Rollback() error = %v", err)
		}

		// 验证事务已移除
		if tm.HasTransaction(txID) {
			t.Error("回滚后事务应该被移除")
		}
	})

	t.Run("提交不存在的事务", func(t *testing.T) {
		tm := NewTransactionManager()

		err := tm.Commit("nonexistent")
		if err == nil {
			t.Error("提交不存在的事务应返回错误")
		}
	})

	t.Run("回滚不存在的事务", func(t *testing.T) {
		tm := NewTransactionManager()

		err := tm.Rollback("nonexistent")
		if err == nil {
			t.Error("回滚不存在的事务应返回错误")
		}
	})
}

func TestTransactionContext(t *testing.T) {
	t.Run("事务上下文绑定", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		txID, _ := tm.Begin(ctx)

		// 创建带事务的上下文
		txCtx := tm.WithTransaction(ctx, txID)

		// 从上下文获取事务 ID
		gotTxID := tm.GetTransactionID(txCtx)
		if gotTxID != txID {
			t.Errorf("GetTransactionID() = %s, want %s", gotTxID, txID)
		}

		tm.Rollback(txID)
	})

	t.Run("无事务上下文", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		txID := tm.GetTransactionID(ctx)
		if txID != "" {
			t.Errorf("无事务上下文应返回空字符串, got %s", txID)
		}
	})
}

func TestTransactionExecution(t *testing.T) {
	t.Run("RunInTransaction 成功", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		executed := false
		err := tm.RunInTransaction(ctx, func(txCtx context.Context) error {
			executed = true
			return nil
		})

		if err != nil {
			t.Fatalf("RunInTransaction() error = %v", err)
		}
		if !executed {
			t.Error("回调应该被执行")
		}
	})

	t.Run("RunInTransaction 失败回滚", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		expectedErr := errors.New("test error")
		err := tm.RunInTransaction(ctx, func(txCtx context.Context) error {
			return expectedErr
		})

		if err != expectedErr {
			t.Errorf("RunInTransaction() error = %v, want %v", err, expectedErr)
		}
	})

	t.Run("RunInTransaction panic 回滚", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		defer func() {
			if r := recover(); r == nil {
				t.Error("应该 panic")
			}
		}()

		tm.RunInTransaction(ctx, func(txCtx context.Context) error {
			panic("test panic")
		})
	})
}

func TestTransactionStats(t *testing.T) {
	t.Run("统计信息", func(t *testing.T) {
		tm := NewTransactionManager()
		ctx := context.Background()

		txID1, _ := tm.Begin(ctx)
		txID2, _ := tm.Begin(ctx)

		stats := tm.Stats()
		if stats.Active != 2 {
			t.Errorf("stats.Active = %d, want 2", stats.Active)
		}

		tm.Commit(txID1)
		stats = tm.Stats()
		if stats.Active != 1 {
			t.Errorf("stats.Active = %d, want 1", stats.Active)
		}
		if stats.Committed != 1 {
			t.Errorf("stats.Committed = %d, want 1", stats.Committed)
		}

		tm.Rollback(txID2)
		stats = tm.Stats()
		if stats.RolledBack != 1 {
			t.Errorf("stats.RolledBack = %d, want 1", stats.RolledBack)
		}
	})
}
