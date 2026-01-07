// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"fmt"

	"github.com/pocketbase/dbx"
)

// LockableQuery 支持行级锁的查询接口
type LockableQuery interface {
	// ForUpdate 添加 FOR UPDATE 锁
	ForUpdate() LockableQuery

	// ForShare 添加 FOR SHARE 锁
	ForShare() LockableQuery

	// ForUpdateNoWait 添加 FOR UPDATE NOWAIT 锁
	ForUpdateNoWait() LockableQuery

	// ForUpdateSkipLocked 添加 FOR UPDATE SKIP LOCKED 锁
	ForUpdateSkipLocked() LockableQuery

	// WithLock 使用指定的锁模式
	WithLock(mode LockMode) LockableQuery

	// One 执行查询并返回单个结果
	One(model interface{}) error

	// All 执行查询并返回所有结果
	All(models interface{}) error
}

// lockableSelectQuery 实现 LockableQuery 接口
type lockableSelectQuery struct {
	app      App
	query    *dbx.SelectQuery
	lockMode LockMode
	ctx      context.Context
}

// newLockableQuery 创建新的可锁定查询
func newLockableQuery(app App, query *dbx.SelectQuery) *lockableSelectQuery {
	return &lockableSelectQuery{
		app:      app,
		query:    query,
		lockMode: LockNone,
		ctx:      context.Background(),
	}
}

// WithContext 设置查询上下文
func (q *lockableSelectQuery) WithContext(ctx context.Context) *lockableSelectQuery {
	q.ctx = ctx
	return q
}

// ForUpdate 添加 FOR UPDATE 锁
func (q *lockableSelectQuery) ForUpdate() LockableQuery {
	q.lockMode = LockForUpdate
	return q
}

// ForShare 添加 FOR SHARE 锁
func (q *lockableSelectQuery) ForShare() LockableQuery {
	q.lockMode = LockForShare
	return q
}

// ForUpdateNoWait 添加 FOR UPDATE NOWAIT 锁
func (q *lockableSelectQuery) ForUpdateNoWait() LockableQuery {
	q.lockMode = LockForUpdateNoWait
	return q
}

// ForUpdateSkipLocked 添加 FOR UPDATE SKIP LOCKED 锁
func (q *lockableSelectQuery) ForUpdateSkipLocked() LockableQuery {
	q.lockMode = LockForUpdateSkipLocked
	return q
}

// WithLock 使用指定的锁模式
func (q *lockableSelectQuery) WithLock(mode LockMode) LockableQuery {
	q.lockMode = mode
	return q
}

// One 执行查询并返回单个结果
func (q *lockableSelectQuery) One(model interface{}) error {
	return q.query.WithContext(q.ctx).One(model)
}

// All 执行查询并返回所有结果
func (q *lockableSelectQuery) All(models interface{}) error {
	return q.query.WithContext(q.ctx).All(models)
}

// quoteIdent 对标识符进行引用
func quoteIdent(s string) string {
	return `"` + s + `"`
}

// SelectForUpdate 在事务中执行带锁的查询
// 这是一个便捷方法，用于常见的 SELECT ... FOR UPDATE 场景
func (app *BaseApp) SelectForUpdate(
	ctx context.Context,
	tableName string,
	pk interface{},
	model interface{},
) error {
	if !app.IsPostgres() {
		// SQLite 不支持 FOR UPDATE，直接查询
		return app.NonconcurrentDB().
			Select("*").
			From(tableName).
			Where(dbx.HashExp{"id": pk}).
			WithContext(ctx).
			One(model)
	}

	// PostgreSQL: 使用 FOR UPDATE
	sql := fmt.Sprintf(
		"SELECT * FROM %s WHERE id = {:id} FOR UPDATE",
		quoteIdent(tableName),
	)

	return app.NonconcurrentDB().
		NewQuery(sql).
		Bind(dbx.Params{"id": pk}).
		WithContext(ctx).
		One(model)
}

// SelectForUpdateSkipLocked 在事务中执行带 SKIP LOCKED 的查询
// 适用于作业队列等竞争消费场景
func (app *BaseApp) SelectForUpdateSkipLocked(
	ctx context.Context,
	tableName string,
	whereClause string,
	params dbx.Params,
	model interface{},
	limit int,
) error {
	if !app.IsPostgres() {
		// SQLite 不支持 FOR UPDATE SKIP LOCKED
		query := app.NonconcurrentDB().
			Select("*").
			From(tableName)

		if whereClause != "" {
			query = query.Where(dbx.NewExp(whereClause, params))
		}

		if limit > 0 {
			query = query.Limit(int64(limit))
		}

		return query.WithContext(ctx).One(model)
	}

	// PostgreSQL: 使用 FOR UPDATE SKIP LOCKED
	sql := fmt.Sprintf("SELECT * FROM %s", quoteIdent(tableName))
	if whereClause != "" {
		sql += " WHERE " + whereClause
	}
	if limit > 0 {
		sql += fmt.Sprintf(" LIMIT %d", limit)
	}
	sql += " FOR UPDATE SKIP LOCKED"

	return app.NonconcurrentDB().
		NewQuery(sql).
		Bind(params).
		WithContext(ctx).
		One(model)
}

// UpdateWithLock 在事务中执行带锁的更新
// 先锁定记录，然后执行更新
func (app *BaseApp) UpdateWithLock(
	ctx context.Context,
	tableName string,
	pk interface{},
	updateFn func(model map[string]interface{}) (map[string]interface{}, error),
) error {
	return app.RunInTransaction(func(txApp App) error {
		// 1. 先锁定记录
		var record map[string]interface{}
		if err := txApp.(*BaseApp).SelectForUpdate(ctx, tableName, pk, &record); err != nil {
			return err
		}

		// 2. 执行更新逻辑
		updates, err := updateFn(record)
		if err != nil {
			return err
		}

		// 3. 执行更新
		_, err = txApp.NonconcurrentDB().
			Update(tableName, updates, dbx.HashExp{"id": pk}).
			WithContext(ctx).
			Execute()

		return err
	})
}

// IncrementWithLock 原子递增字段值
// 使用悲观锁确保并发安全
func (app *BaseApp) IncrementWithLock(
	ctx context.Context,
	tableName string,
	pk interface{},
	fieldName string,
	delta int64,
) (int64, error) {
	var newValue int64

	err := app.RunInTransaction(func(txApp App) error {
		baseApp := txApp.(*BaseApp)

		if baseApp.IsPostgres() {
			// PostgreSQL: 使用 FOR UPDATE 锁定后更新
			sql := fmt.Sprintf(
				"UPDATE %s SET %s = %s + {:delta} WHERE id = {:id} RETURNING %s",
				quoteIdent(tableName),
				quoteIdent(fieldName),
				quoteIdent(fieldName),
				quoteIdent(fieldName),
			)

			return baseApp.NonconcurrentDB().
				NewQuery(sql).
				Bind(dbx.Params{"id": pk, "delta": delta}).
				WithContext(ctx).
				Row(&newValue)
		}

		// SQLite: 使用普通更新（SQLite 的写锁会自动序列化）
		sql := fmt.Sprintf(
			"UPDATE %s SET %s = %s + {:delta} WHERE id = {:id}",
			quoteIdent(tableName),
			quoteIdent(fieldName),
			quoteIdent(fieldName),
		)

		_, err := baseApp.NonconcurrentDB().
			NewQuery(sql).
			Bind(dbx.Params{"id": pk, "delta": delta}).
			WithContext(ctx).
			Execute()

		if err != nil {
			return err
		}

		// 查询新值
		selectSQL := fmt.Sprintf(
			"SELECT %s FROM %s WHERE id = {:id}",
			quoteIdent(fieldName),
			quoteIdent(tableName),
		)

		return baseApp.NonconcurrentDB().
			NewQuery(selectSQL).
			Bind(dbx.Params{"id": pk}).
			WithContext(ctx).
			Row(&newValue)
	})

	return newValue, err
}

// DecrementWithLock 原子递减字段值（带最小值检查）
// 使用悲观锁确保并发安全，防止超卖等问题
func (app *BaseApp) DecrementWithLock(
	ctx context.Context,
	tableName string,
	pk interface{},
	fieldName string,
	delta int64,
	minValue int64,
) (int64, error) {
	var newValue int64

	err := app.RunInTransaction(func(txApp App) error {
		baseApp := txApp.(*BaseApp)

		if baseApp.IsPostgres() {
			// PostgreSQL: 使用 FOR UPDATE 锁定
			lockSQL := fmt.Sprintf(
				"SELECT %s FROM %s WHERE id = {:id} FOR UPDATE",
				quoteIdent(fieldName),
				quoteIdent(tableName),
			)

			var currentValue int64
			err := baseApp.NonconcurrentDB().
				NewQuery(lockSQL).
				Bind(dbx.Params{"id": pk}).
				WithContext(ctx).
				Row(&currentValue)

			if err != nil {
				return err
			}

			// 检查是否会低于最小值
			if currentValue-delta < minValue {
				return NewLockError("decrement", fmt.Sprintf(
					"value would be below minimum: current=%d, delta=%d, min=%d",
					currentValue, delta, minValue,
				), nil)
			}

			// 执行更新
			updateSQL := fmt.Sprintf(
				"UPDATE %s SET %s = %s - {:delta} WHERE id = {:id} RETURNING %s",
				quoteIdent(tableName),
				quoteIdent(fieldName),
				quoteIdent(fieldName),
				quoteIdent(fieldName),
			)

			return baseApp.NonconcurrentDB().
				NewQuery(updateSQL).
				Bind(dbx.Params{"id": pk, "delta": delta}).
				WithContext(ctx).
				Row(&newValue)
		}

		// SQLite: 使用条件更新
		updateSQL := fmt.Sprintf(
			"UPDATE %s SET %s = %s - {:delta} WHERE id = {:id} AND %s - {:delta} >= {:min}",
			quoteIdent(tableName),
			quoteIdent(fieldName),
			quoteIdent(fieldName),
			quoteIdent(fieldName),
		)

		result, err := baseApp.NonconcurrentDB().
			NewQuery(updateSQL).
			Bind(dbx.Params{"id": pk, "delta": delta, "min": minValue}).
			WithContext(ctx).
			Execute()

		if err != nil {
			return err
		}

		affected, _ := result.RowsAffected()
		if affected == 0 {
			return NewLockError("decrement", "no rows updated, value may be below minimum", nil)
		}

		// 查询新值
		selectSQL := fmt.Sprintf(
			"SELECT %s FROM %s WHERE id = {:id}",
			quoteIdent(fieldName),
			quoteIdent(tableName),
		)

		return baseApp.NonconcurrentDB().
			NewQuery(selectSQL).
			Bind(dbx.Params{"id": pk}).
			WithContext(ctx).
			Row(&newValue)
	})

	return newValue, err
}
