package hostfn

import (
	"context"
	"errors"
	"sync"

	"github.com/pocketbase/pocketbase/tools/security"
)

// 事务上下文 key
type txContextKey struct{}

// TransactionStats 事务统计信息
type TransactionStats struct {
	Active     int // 活跃事务数
	Committed  int // 已提交事务数
	RolledBack int // 已回滚事务数
}

// Transaction 表示一个事务
type Transaction struct {
	ID        string
	committed bool
	rolledBack bool
}

// TransactionManager 事务管理器
type TransactionManager struct {
	mu           sync.RWMutex
	transactions map[string]*Transaction
	committed    int
	rolledBack   int
}

// NewTransactionManager 创建新的事务管理器
func NewTransactionManager() *TransactionManager {
	return &TransactionManager{
		transactions: make(map[string]*Transaction),
	}
}

// Begin 开始一个新事务
func (tm *TransactionManager) Begin(ctx context.Context) (string, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	txID := security.RandomString(16)
	tm.transactions[txID] = &Transaction{
		ID: txID,
	}

	return txID, nil
}

// Commit 提交事务
func (tm *TransactionManager) Commit(txID string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	tx, ok := tm.transactions[txID]
	if !ok {
		return errors.New("transaction not found: " + txID)
	}

	tx.committed = true
	delete(tm.transactions, txID)
	tm.committed++

	return nil
}

// Rollback 回滚事务
func (tm *TransactionManager) Rollback(txID string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	tx, ok := tm.transactions[txID]
	if !ok {
		return errors.New("transaction not found: " + txID)
	}

	tx.rolledBack = true
	delete(tm.transactions, txID)
	tm.rolledBack++

	return nil
}

// HasTransaction 检查事务是否存在
func (tm *TransactionManager) HasTransaction(txID string) bool {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	_, ok := tm.transactions[txID]
	return ok
}

// WithTransaction 创建带事务的上下文
func (tm *TransactionManager) WithTransaction(ctx context.Context, txID string) context.Context {
	return context.WithValue(ctx, txContextKey{}, txID)
}

// GetTransactionID 从上下文获取事务 ID
func (tm *TransactionManager) GetTransactionID(ctx context.Context) string {
	txID, _ := ctx.Value(txContextKey{}).(string)
	return txID
}

// RunInTransaction 在事务中执行函数
func (tm *TransactionManager) RunInTransaction(ctx context.Context, fn func(txCtx context.Context) error) (err error) {
	txID, err := tm.Begin(ctx)
	if err != nil {
		return err
	}

	txCtx := tm.WithTransaction(ctx, txID)

	defer func() {
		if r := recover(); r != nil {
			tm.Rollback(txID)
			panic(r)
		}
	}()

	if err = fn(txCtx); err != nil {
		tm.Rollback(txID)
		return err
	}

	return tm.Commit(txID)
}

// Stats 返回事务统计信息
func (tm *TransactionManager) Stats() TransactionStats {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	return TransactionStats{
		Active:     len(tm.transactions),
		Committed:  tm.committed,
		RolledBack: tm.rolledBack,
	}
}
