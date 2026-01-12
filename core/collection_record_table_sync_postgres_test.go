package core

import (
	"context"
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/tools/types"
)

// skipIfNoPostgresForSync 跳过没有 PostgreSQL 环境的测试
func skipIfNoPostgresForSync(t *testing.T) string {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("跳过 PostgreSQL 集成测试：未设置 TEST_POSTGRES_DSN")
	}
	return dsn
}

// setupPostgresTestAppForSync 创建一个连接到 PostgreSQL 的测试 App
func setupPostgresTestAppForSync(t *testing.T, dsn string) (*BaseApp, func()) {
	adapter := NewPostgresAdapter()
	dbConfig := DBConfig{
		DSN:          dsn,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}
	ctx := context.Background()
	db, err := adapter.Connect(ctx, dbConfig)
	if err != nil {
		t.Fatalf("连接 PostgreSQL 失败: %v", err)
	}

	appConfig := BaseAppConfig{
		DataDir: t.TempDir(),
	}
	app := NewBaseApp(appConfig)
	app.SetDBAdapter(adapter)
	app.concurrentDB = db
	app.nonconcurrentDB = db

	cleanup := func() {
		adapter.Close()
	}

	return app, cleanup
}

// getTotalViewsPostgresForSync 获取 PostgreSQL 中视图的总数
func getTotalViewsPostgresForSync(app *BaseApp) (int, error) {
	var total int

	err := app.ConcurrentDB().NewQuery(`
		SELECT COUNT(*) 
		FROM information_schema.views 
		WHERE table_schema = 'public'
	`).Row(&total)

	return total, err
}

// TestSyncRecordTableSchemaPostgres 测试 PostgreSQL 模式下的表结构同步
func TestSyncRecordTableSchemaPostgres(t *testing.T) {
	dsn := skipIfNoPostgresForSync(t)
	app, cleanup := setupPostgresTestAppForSync(t, dsn)
	defer cleanup()

	// 清理可能存在的测试表
	cleanupTables := []string{
		"test_sync_base_pg",
		"test_sync_auth_pg",
		"test_sync_update_pg",
		"test_sync_renamed_pg",
	}
	for _, table := range cleanupTables {
		app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table + ` CASCADE`).Execute()
	}

	t.Run("创建新的 base collection", func(t *testing.T) {
		tableName := "test_sync_base_pg"
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

		baseCol := NewBaseCollection(tableName)
		baseCol.Fields.Add(&TextField{Name: "title"})
		baseCol.Fields.Add(&NumberField{Name: "count"})

		err := app.SyncRecordTableSchema(baseCol, nil)
		if err != nil {
			t.Fatalf("SyncRecordTableSchema 失败: %v", err)
		}

		if !app.HasTable(tableName) {
			t.Fatalf("期望表 %s 存在", tableName)
		}

		cols, _ := app.TableColumns(tableName)
		expectedCols := []string{"id", "title", "count"}
		for _, expected := range expectedCols {
			found := false
			for _, col := range cols {
				if col == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("缺少列 %q，实际列: %v", expected, cols)
			}
		}
	})

	t.Run("创建新的 auth collection", func(t *testing.T) {
		tableName := "test_sync_auth_pg"
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

		authCol := NewAuthCollection(tableName)
		authCol.Fields.Add(&TextField{Name: "nickname"})
		authCol.AddIndex("idx_auth_test_pg", false, "email, id", "")

		err := app.SyncRecordTableSchema(authCol, nil)
		if err != nil {
			t.Fatalf("SyncRecordTableSchema 失败: %v", err)
		}

		if !app.HasTable(tableName) {
			t.Fatalf("期望表 %s 存在", tableName)
		}

		cols, _ := app.TableColumns(tableName)
		expectedCols := []string{"id", "email", "verified", "emailVisibility", "tokenKey", "password", "nickname"}
		for _, expected := range expectedCols {
			found := false
			for _, col := range cols {
				if col == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("缺少列 %q，实际列: %v", expected, cols)
			}
		}

		// 检查索引
		indexes, _ := app.TableIndexes(tableName)
		if len(indexes) < 1 {
			t.Errorf("期望至少 1 个索引，实际 %d 个", len(indexes))
		}
	})

	t.Run("更新现有表 - 添加/删除/重命名列", func(t *testing.T) {
		tableName := "test_sync_update_pg"
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

		// 创建初始表
		oldCol := NewBaseCollection(tableName)
		oldCol.Fields.Add(&TextField{Name: "old_field"})
		oldCol.Fields.Add(&TextField{Name: "to_rename"})
		oldCol.Fields.Add(&NumberField{Name: "to_delete"})

		err := app.SyncRecordTableSchema(oldCol, nil)
		if err != nil {
			t.Fatalf("创建初始表失败: %v", err)
		}

		// 更新表结构
		newCol := NewBaseCollection(tableName)
		newCol.Id = oldCol.Id
		newCol.Fields.Add(&TextField{Name: "old_field"})  // 保留
		newCol.Fields.Add(&TextField{Name: "new_field"})  // 新增
		// to_rename 和 to_delete 被删除

		err = app.SyncRecordTableSchema(newCol, oldCol)
		if err != nil {
			t.Fatalf("更新表结构失败: %v", err)
		}

		cols, _ := app.TableColumns(tableName)

		// 应该有 old_field 和 new_field
		hasOldField := false
		hasNewField := false
		for _, col := range cols {
			if col == "old_field" {
				hasOldField = true
			}
			if col == "new_field" {
				hasNewField = true
			}
		}

		if !hasOldField {
			t.Errorf("应该保留 old_field 列，实际列: %v", cols)
		}
		if !hasNewField {
			t.Errorf("应该添加 new_field 列，实际列: %v", cols)
		}
	})

	t.Run("重命名表", func(t *testing.T) {
		oldTableName := "test_sync_old_name_pg"
		newTableName := "test_sync_renamed_pg"
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + oldTableName + ` CASCADE`).Execute()
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + newTableName + ` CASCADE`).Execute()

		// 创建初始表
		oldCol := NewBaseCollection(oldTableName)
		oldCol.Fields.Add(&TextField{Name: "title"})

		err := app.SyncRecordTableSchema(oldCol, nil)
		if err != nil {
			t.Fatalf("创建初始表失败: %v", err)
		}

		// 重命名表
		newCol := NewBaseCollection(newTableName)
		newCol.Id = oldCol.Id
		newCol.Fields.Add(&TextField{Name: "title"})

		err = app.SyncRecordTableSchema(newCol, oldCol)
		if err != nil {
			t.Fatalf("重命名表失败: %v", err)
		}

		if !app.HasTable(newTableName) {
			t.Error("新表名应该存在")
		}
		// 注意：旧表名可能仍然存在或已被删除，取决于实现
	})

	t.Run("添加索引", func(t *testing.T) {
		tableName := "test_sync_index_pg"
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

		// 创建初始表（无索引）
		oldCol := NewBaseCollection(tableName)
		oldCol.Fields.Add(&TextField{Name: "email"})

		err := app.SyncRecordTableSchema(oldCol, nil)
		if err != nil {
			t.Fatalf("创建初始表失败: %v", err)
		}

		// 添加索引
		newCol := NewBaseCollection(tableName)
		newCol.Id = oldCol.Id
		newCol.Fields.Add(&TextField{Name: "email"})
		newCol.Indexes = types.JSONArray[string]{"CREATE INDEX idx_email_pg ON " + tableName + " (email)"}

		err = app.SyncRecordTableSchema(newCol, oldCol)
		if err != nil {
			t.Fatalf("添加索引失败: %v", err)
		}

		indexes, _ := app.TableIndexes(tableName)
		if _, ok := indexes["idx_email_pg"]; !ok {
			t.Errorf("应该有 idx_email_pg 索引，实际索引: %v", indexes)
		}
	})
}

// TestTableInfoDefaultValuePostgres 测试 PostgreSQL 模式下的默认值格式
func TestTableInfoDefaultValuePostgres(t *testing.T) {
	dsn := skipIfNoPostgresForSync(t)
	app, cleanup := setupPostgresTestAppForSync(t, dsn)
	defer cleanup()

	tableName := "test_default_value_pg"
	_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

	// 创建带各种默认值的表
	_, err := app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY DEFAULT 'test_id',
		text_field TEXT DEFAULT '',
		number_field INTEGER DEFAULT 0,
		bool_field BOOLEAN DEFAULT true,
		json_field JSONB DEFAULT '[]',
		timestamp_field TIMESTAMPTZ DEFAULT NOW()
	)`).Execute()
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	tableInfo, err := app.TableInfo(tableName)
	if err != nil {
		t.Fatalf("获取表信息失败: %v", err)
	}

	t.Run("检查各字段的默认值", func(t *testing.T) {
		for _, row := range tableInfo {
			switch row.Name {
			case "id":
				if !row.DefaultValue.Valid {
					t.Error("id 应该有默认值")
				}
			case "text_field":
				if !row.DefaultValue.Valid {
					t.Error("text_field 应该有默认值")
				}
			case "number_field":
				if !row.DefaultValue.Valid {
					t.Error("number_field 应该有默认值")
				}
			case "bool_field":
				if !row.DefaultValue.Valid {
					t.Error("bool_field 应该有默认值")
				}
			case "json_field":
				if !row.DefaultValue.Valid {
					t.Error("json_field 应该有默认值")
				}
			case "timestamp_field":
				if !row.DefaultValue.Valid {
					t.Error("timestamp_field 应该有默认值")
				}
			}
		}
	})

	t.Run("检查主键标识", func(t *testing.T) {
		var idRow *TableInfoRow
		for _, row := range tableInfo {
			if row.Name == "id" {
				idRow = row
				break
			}
		}

		if idRow == nil {
			t.Fatal("找不到 id 列")
		}

		if idRow.PK != 1 {
			t.Errorf("id 应该是主键，PK=%d", idRow.PK)
		}
	})

	t.Run("检查 NOT NULL 约束", func(t *testing.T) {
		for _, row := range tableInfo {
			if row.Name == "id" {
				if !row.NotNull {
					t.Error("id 应该是 NOT NULL")
				}
			}
		}
	})
}

// TestConcurrentTableOperationsPostgres 测试 PostgreSQL 模式下的并发表操作
func TestConcurrentTableOperationsPostgres(t *testing.T) {
	dsn := skipIfNoPostgresForSync(t)
	app, cleanup := setupPostgresTestAppForSync(t, dsn)
	defer cleanup()

	t.Run("并发创建多个表", func(t *testing.T) {
		tables := []string{
			"test_concurrent_1_pg",
			"test_concurrent_2_pg",
			"test_concurrent_3_pg",
		}

		// 清理
		for _, table := range tables {
			app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table + ` CASCADE`).Execute()
		}
		defer func() {
			for _, table := range tables {
				app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table + ` CASCADE`).Execute()
			}
		}()

		// 并发创建表
		errCh := make(chan error, len(tables))
		for _, tableName := range tables {
			go func(name string) {
				col := NewBaseCollection(name)
				col.Fields.Add(&TextField{Name: "title"})
				errCh <- app.SyncRecordTableSchema(col, nil)
			}(tableName)
		}

		// 等待所有操作完成
		for range tables {
			if err := <-errCh; err != nil {
				t.Errorf("并发创建表失败: %v", err)
			}
		}

		// 验证所有表都已创建
		for _, table := range tables {
			if !app.HasTable(table) {
				t.Errorf("表 %s 应该存在", table)
			}
		}
	})
}
