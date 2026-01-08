// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"context"
	"errors"
	"fmt"

	"github.com/pocketbase/pocketbase/core"
)

// DBService 事务感知的数据库服务
// T069: 实现事务感知的 DB 操作
type DBService struct {
	app core.App
	tm  *TransactionManager
}

// NewDBService 创建新的数据库服务
func NewDBService(app core.App, tm *TransactionManager) *DBService {
	if tm == nil {
		tm = NewTransactionManager()
	}
	return &DBService{
		app: app,
		tm:  tm,
	}
}

// Collection 获取集合服务
func (db *DBService) Collection(name string) *CollectionService {
	return &CollectionService{
		db:         db,
		collection: name,
	}
}

// RunInTransaction 在事务中执行操作
func (db *DBService) RunInTransaction(ctx context.Context, fn func(txCtx context.Context) error) error {
	if db.app == nil {
		// 使用内存事务管理器
		return db.tm.RunInTransaction(ctx, fn)
	}

	// 使用 PocketBase 的事务机制
	return db.app.RunInTransaction(func(txApp core.App) error {
		// 创建事务上下文
		txID, _ := db.tm.Begin(ctx)
		txCtx := db.tm.WithTransaction(ctx, txID)

		// 创建临时的事务感知 DBService
		txDB := &DBService{
			app: txApp,
			tm:  db.tm,
		}

		// 在事务上下文中设置 txDB
		txCtx = context.WithValue(txCtx, dbServiceKey{}, txDB)

		err := fn(txCtx)
		if err != nil {
			db.tm.Rollback(txID)
			return err
		}

		db.tm.Commit(txID)
		return nil
	})
}

// dbServiceKey 用于在上下文中存储 DBService
type dbServiceKey struct{}

// GetDBFromContext 从上下文获取事务感知的 DBService
func GetDBFromContext(ctx context.Context) *DBService {
	if db, ok := ctx.Value(dbServiceKey{}).(*DBService); ok {
		return db
	}
	return nil
}

// CollectionService 集合服务
type CollectionService struct {
	db         *DBService
	collection string
}

// GetOne 获取单条记录
func (cs *CollectionService) GetOne(ctx context.Context, id string) (map[string]interface{}, error) {
	if cs.db.app == nil {
		return nil, errors.New("app not initialized")
	}

	record, err := cs.db.app.FindRecordById(cs.collection, id)
	if err != nil {
		return nil, fmt.Errorf("record not found: %w", err)
	}

	return record.PublicExport(), nil
}

// GetList 获取记录列表
func (cs *CollectionService) GetList(ctx context.Context, page, perPage int, filter, sort string) (*ListResult, error) {
	if cs.db.app == nil {
		return nil, errors.New("app not initialized")
	}

	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 20
	}

	// 使用 FindRecordsByFilter
	records, err := cs.db.app.FindRecordsByFilter(cs.collection, filter, sort, perPage, (page-1)*perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch records: %w", err)
	}

	items := make([]map[string]interface{}, len(records))
	for i, record := range records {
		items[i] = record.PublicExport()
	}

	// 获取总数
	total, err := cs.db.app.CountRecords(cs.collection)
	if err != nil {
		total = int64(len(records))
	}

	return &ListResult{
		Page:       page,
		PerPage:    perPage,
		TotalItems: int(total),
		TotalPages: (int(total) + perPage - 1) / perPage,
		Items:      items,
	}, nil
}

// ListResult 列表结果
type ListResult struct {
	Page       int                      `json:"page"`
	PerPage    int                      `json:"perPage"`
	TotalItems int                      `json:"totalItems"`
	TotalPages int                      `json:"totalPages"`
	Items      []map[string]interface{} `json:"items"`
}

// Create 创建记录
func (cs *CollectionService) Create(ctx context.Context, data map[string]interface{}) (map[string]interface{}, error) {
	if cs.db.app == nil {
		return nil, errors.New("app not initialized")
	}

	collection, err := cs.db.app.FindCollectionByNameOrId(cs.collection)
	if err != nil {
		return nil, fmt.Errorf("collection not found: %w", err)
	}

	record := core.NewRecord(collection)
	for key, value := range data {
		record.Set(key, value)
	}

	if err := cs.db.app.Save(record); err != nil {
		return nil, fmt.Errorf("failed to create record: %w", err)
	}

	return record.PublicExport(), nil
}

// Update 更新记录
func (cs *CollectionService) Update(ctx context.Context, id string, data map[string]interface{}) (map[string]interface{}, error) {
	if cs.db.app == nil {
		return nil, errors.New("app not initialized")
	}

	record, err := cs.db.app.FindRecordById(cs.collection, id)
	if err != nil {
		return nil, fmt.Errorf("record not found: %w", err)
	}

	for key, value := range data {
		record.Set(key, value)
	}

	if err := cs.db.app.Save(record); err != nil {
		return nil, fmt.Errorf("failed to update record: %w", err)
	}

	return record.PublicExport(), nil
}

// Delete 删除记录
func (cs *CollectionService) Delete(ctx context.Context, id string) error {
	if cs.db.app == nil {
		return errors.New("app not initialized")
	}

	record, err := cs.db.app.FindRecordById(cs.collection, id)
	if err != nil {
		return fmt.Errorf("record not found: %w", err)
	}

	if err := cs.db.app.Delete(record); err != nil {
		return fmt.Errorf("failed to delete record: %w", err)
	}

	return nil
}

// VectorSearch 向量搜索
func (cs *CollectionService) VectorSearch(ctx context.Context, opts VectorSearchOptions) ([]VectorSearchResult, error) {
	vs := NewVectorSearch(cs.db.app)
	return vs.Search(cs.collection, opts)
}

// CountRecords 统计记录数
func (cs *CollectionService) Count(ctx context.Context, filter string) (int64, error) {
	if cs.db.app == nil {
		return 0, errors.New("app not initialized")
	}

	// 注意：CountRecords 接受 dbx.Expression，这里简化处理
	return cs.db.app.CountRecords(cs.collection)
}

// CountWithFilter 统计符合条件的记录数
// T069: 完善事务感知 DB 操作 - Count filter 支持
func (cs *CollectionService) CountWithFilter(ctx context.Context, filter string) (int64, error) {
	if cs.db.app == nil {
		return 0, errors.New("app not initialized")
	}

	if filter == "" {
		return cs.db.app.CountRecords(cs.collection)
	}

	// 使用 FindRecordsByFilter 获取符合条件的记录数
	// 由于 CountRecords 需要 dbx.Expression，这里使用查询方式
	records, err := cs.db.app.FindRecordsByFilter(cs.collection, filter, "", 0, 0)
	if err != nil {
		return 0, fmt.Errorf("failed to count records: %w", err)
	}

	return int64(len(records)), nil
}
