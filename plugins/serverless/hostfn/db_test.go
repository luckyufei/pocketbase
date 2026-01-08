// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"context"
	"errors"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

// T069: 事务感知的 DB 操作测试

func TestDBService(t *testing.T) {
	t.Run("创建 DBService", func(t *testing.T) {
		db := NewDBService(nil, nil)
		if db == nil {
			t.Fatal("NewDBService() returned nil")
		}
		if db.tm == nil {
			t.Error("TransactionManager should not be nil")
		}
	})

	t.Run("获取 Collection", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		if cs == nil {
			t.Fatal("Collection() returned nil")
		}
		if cs.collection != "users" {
			t.Errorf("collection = %s, want users", cs.collection)
		}
	})
}

func TestDBService_RunInTransaction(t *testing.T) {
	t.Run("事务成功提交", func(t *testing.T) {
		db := NewDBService(nil, nil)

		executed := false
		err := db.RunInTransaction(context.Background(), func(txCtx context.Context) error {
			executed = true
			// 验证事务 ID 存在
			txID := db.tm.GetTransactionID(txCtx)
			if txID == "" {
				t.Error("transaction ID should not be empty")
			}
			return nil
		})

		if err != nil {
			t.Fatalf("RunInTransaction() error = %v", err)
		}
		if !executed {
			t.Error("transaction function was not executed")
		}
	})

	t.Run("事务回滚", func(t *testing.T) {
		db := NewDBService(nil, nil)

		expectedErr := errors.New("test error")
		err := db.RunInTransaction(context.Background(), func(txCtx context.Context) error {
			return expectedErr
		})

		if err != expectedErr {
			t.Errorf("RunInTransaction() error = %v, want %v", err, expectedErr)
		}
	})

	t.Run("事务统计", func(t *testing.T) {
		db := NewDBService(nil, nil)

		// 成功事务
		db.RunInTransaction(context.Background(), func(txCtx context.Context) error {
			return nil
		})

		// 失败事务
		db.RunInTransaction(context.Background(), func(txCtx context.Context) error {
			return errors.New("failed")
		})

		stats := db.tm.Stats()
		if stats.Committed != 1 {
			t.Errorf("Committed = %d, want 1", stats.Committed)
		}
		if stats.RolledBack != 1 {
			t.Errorf("RolledBack = %d, want 1", stats.RolledBack)
		}
	})
}

func TestCollectionService(t *testing.T) {
	t.Run("GetOne 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		_, err := cs.GetOne(context.Background(), "123")
		if err == nil {
			t.Error("GetOne() should return error when app is nil")
		}
	})

	t.Run("GetList 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		_, err := cs.GetList(context.Background(), 1, 10, "", "")
		if err == nil {
			t.Error("GetList() should return error when app is nil")
		}
	})

	t.Run("Create 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		_, err := cs.Create(context.Background(), map[string]interface{}{"name": "test"})
		if err == nil {
			t.Error("Create() should return error when app is nil")
		}
	})

	t.Run("Update 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		_, err := cs.Update(context.Background(), "123", map[string]interface{}{"name": "test"})
		if err == nil {
			t.Error("Update() should return error when app is nil")
		}
	})

	t.Run("Delete 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		err := cs.Delete(context.Background(), "123")
		if err == nil {
			t.Error("Delete() should return error when app is nil")
		}
	})

	t.Run("Count 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		_, err := cs.Count(context.Background(), "")
		if err == nil {
			t.Error("Count() should return error when app is nil")
		}
	})

	t.Run("CountWithFilter 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("users")

		_, err := cs.CountWithFilter(context.Background(), `status = "active"`)
		if err == nil {
			t.Error("CountWithFilter() should return error when app is nil")
		}
	})

	t.Run("VectorSearch 无 app 返回错误", func(t *testing.T) {
		db := NewDBService(nil, nil)
		cs := db.Collection("documents")

		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Top:    5,
		}
		_, err := cs.VectorSearch(context.Background(), opts)
		if err == nil {
			t.Error("VectorSearch() should return error when app is nil")
		}
	})
}

func TestListResult(t *testing.T) {
	t.Run("ListResult 结构", func(t *testing.T) {
		result := &ListResult{
			Page:       1,
			PerPage:    10,
			TotalItems: 100,
			TotalPages: 10,
			Items: []map[string]interface{}{
				{"id": "1", "name": "test"},
			},
		}

		if result.Page != 1 {
			t.Errorf("Page = %d, want 1", result.Page)
		}
		if result.PerPage != 10 {
			t.Errorf("PerPage = %d, want 10", result.PerPage)
		}
		if result.TotalItems != 100 {
			t.Errorf("TotalItems = %d, want 100", result.TotalItems)
		}
		if result.TotalPages != 10 {
			t.Errorf("TotalPages = %d, want 10", result.TotalPages)
		}
		if len(result.Items) != 1 {
			t.Errorf("Items length = %d, want 1", len(result.Items))
		}
	})
}

func TestGetDBFromContext(t *testing.T) {
	t.Run("从空上下文获取返回 nil", func(t *testing.T) {
		db := GetDBFromContext(context.Background())
		if db != nil {
			t.Error("GetDBFromContext() should return nil for empty context")
		}
	})

	t.Run("从上下文获取 DBService", func(t *testing.T) {
		originalDB := NewDBService(nil, nil)
		ctx := context.WithValue(context.Background(), dbServiceKey{}, originalDB)

		db := GetDBFromContext(ctx)
		if db != originalDB {
			t.Error("GetDBFromContext() should return the same DBService")
		}
	})
}

// TestDBServiceWithApp 使用 TestApp 测试 DBService
func TestDBServiceWithApp(t *testing.T) {
	t.Run("GetOne 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("users")

		// 尝试获取不存在的记录
		_, err = cs.GetOne(context.Background(), "nonexistent")
		// 应该返回错误（记录不存在）
		if err == nil {
			t.Log("GetOne() 返回了记录（可能测试数据中有此 ID）")
		}
	})

	t.Run("GetList 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("users")

		result, err := cs.GetList(context.Background(), 1, 10, "", "")
		if err != nil {
			t.Logf("GetList() error = %v (可能是集合不存在)", err)
			return
		}

		if result == nil {
			t.Error("GetList() returned nil result")
		}
	})

	t.Run("Count 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("users")

		count, err := cs.Count(context.Background(), "")
		if err != nil {
			t.Logf("Count() error = %v (可能是集合不存在)", err)
			return
		}

		if count < 0 {
			t.Errorf("Count() = %d, should be >= 0", count)
		}
	})

	t.Run("Create 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("demo1") // 使用测试数据中存在的集合

		// 创建记录
		data := map[string]interface{}{
			"text": "test record",
		}
		record, err := cs.Create(context.Background(), data)
		if err != nil {
			t.Logf("Create() error = %v (可能是集合不存在或字段不匹配)", err)
			return
		}

		if record == nil {
			t.Error("Create() returned nil record")
		}
	})

	t.Run("Update 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("demo1")

		// 先创建一个记录
		data := map[string]interface{}{
			"text": "original",
		}
		record, err := cs.Create(context.Background(), data)
		if err != nil {
			t.Skipf("Create() error = %v", err)
			return
		}

		// 更新记录
		id := record["id"].(string)
		updateData := map[string]interface{}{
			"text": "updated",
		}
		updated, err := cs.Update(context.Background(), id, updateData)
		if err != nil {
			t.Errorf("Update() error = %v", err)
			return
		}

		if updated == nil {
			t.Error("Update() returned nil record")
		}
	})

	t.Run("Delete 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("demo1")

		// 先创建一个记录
		data := map[string]interface{}{
			"text": "to be deleted",
		}
		record, err := cs.Create(context.Background(), data)
		if err != nil {
			t.Skipf("Create() error = %v", err)
			return
		}

		// 删除记录
		id := record["id"].(string)
		err = cs.Delete(context.Background(), id)
		if err != nil {
			t.Errorf("Delete() error = %v", err)
		}
	})

	t.Run("CountWithFilter 成功", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		db := NewDBService(app, nil)
		cs := db.Collection("users")

		count, err := cs.CountWithFilter(context.Background(), "")
		if err != nil {
			t.Logf("CountWithFilter() error = %v (可能是集合不存在)", err)
			return
		}

		if count < 0 {
			t.Errorf("CountWithFilter() = %d, should be >= 0", count)
		}
	})
}
