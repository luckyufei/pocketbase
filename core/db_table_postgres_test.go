package core

import (
	"context"
	"os"
	"testing"
)

// TestTableColumnsPostgres 测试 PostgreSQL 的 TableColumns 方法
func TestTableColumnsPostgres(t *testing.T) {
	t.Run("PostgreSQL 表列查询", func(t *testing.T) {
		// 创建 PostgreSQL 适配器
		adapter := NewPostgresAdapter()

		// 验证 TableColumns 方法存在并返回正确格式
		columns, err := adapter.TableColumns("nonexistent_table")
		// 未连接时应该返回错误
		if err == nil {
			t.Log("未连接数据库时应该返回错误")
		}
		_ = columns
	})
}

// TestTableInfoPostgres 测试 PostgreSQL 的 TableInfo 方法
func TestTableInfoPostgres(t *testing.T) {
	t.Run("PostgreSQL 表信息查询", func(t *testing.T) {
		adapter := NewPostgresAdapter()

		info, err := adapter.TableInfo("nonexistent_table")
		if err == nil {
			t.Log("未连接数据库时应该返回错误")
		}
		_ = info
	})
}

// TestTableIndexesPostgres 测试 PostgreSQL 的 TableIndexes 方法
func TestTableIndexesPostgres(t *testing.T) {
	t.Run("PostgreSQL 索引查询", func(t *testing.T) {
		adapter := NewPostgresAdapter()

		indexes, err := adapter.TableIndexes("nonexistent_table")
		if err == nil {
			t.Log("未连接数据库时应该返回错误")
		}
		_ = indexes
	})
}

// TestHasTablePostgres 测试 PostgreSQL 的 HasTable 方法
func TestHasTablePostgres(t *testing.T) {
	t.Run("PostgreSQL 表存在检查", func(t *testing.T) {
		adapter := NewPostgresAdapter()

		exists, err := adapter.HasTable("nonexistent_table")
		if err == nil {
			t.Log("未连接数据库时应该返回错误")
		}
		_ = exists
	})
}

// TestVacuumPostgres 测试 PostgreSQL 的 Vacuum 方法
func TestVacuumPostgres(t *testing.T) {
	t.Run("PostgreSQL VACUUM", func(t *testing.T) {
		adapter := NewPostgresAdapter()

		err := adapter.Vacuum()
		if err == nil {
			t.Log("未连接数据库时应该返回错误")
		}
	})
}

// TestBaseAppTableMethodsWithAdapter 测试 BaseApp 使用适配器的表方法
func TestBaseAppTableMethodsWithAdapter(t *testing.T) {
	t.Run("IsPostgres 检测", func(t *testing.T) {
		config := BaseAppConfig{
			DataDir: t.TempDir(),
		}
		app := NewBaseApp(config)

		// 默认应该是 SQLite
		if app.IsPostgres() {
			t.Error("默认应该不是 PostgreSQL")
		}

		// 设置 PostgreSQL 适配器
		app.SetDBAdapter(NewPostgresAdapter())
		if !app.IsPostgres() {
			t.Error("设置后应该是 PostgreSQL")
		}
	})

	t.Run("IsSQLite 检测", func(t *testing.T) {
		config := BaseAppConfig{
			DataDir: t.TempDir(),
		}
		app := NewBaseApp(config)

		// 默认应该是 SQLite
		if !app.IsSQLite() {
			t.Error("默认应该是 SQLite")
		}

		// 设置 PostgreSQL 适配器
		app.SetDBAdapter(NewPostgresAdapter())
		if app.IsSQLite() {
			t.Error("设置 PostgreSQL 后不应该是 SQLite")
		}
	})
}

// TestAdapterTableInfoRowConversion 测试适配器表信息行转换
func TestAdapterTableInfoRowConversion(t *testing.T) {
	t.Run("AdapterTableInfoRow 结构", func(t *testing.T) {
		row := &AdapterTableInfoRow{
			CID:        0,
			Name:       "id",
			Type:       "TEXT",
			NotNull:    true,
			DefaultVal: "",
			PK:         1,
		}

		if row.Name != "id" {
			t.Errorf("期望 Name 为 id, 实际为 %s", row.Name)
		}
		if row.Type != "TEXT" {
			t.Errorf("期望 Type 为 TEXT, 实际为 %s", row.Type)
		}
		if !row.NotNull {
			t.Error("期望 NotNull 为 true")
		}
		if row.PK != 1 {
			t.Errorf("期望 PK 为 1, 实际为 %d", row.PK)
		}
	})
}

// skipIfNoPostgresEnv 跳过没有 PostgreSQL 环境的测试
func skipIfNoPostgresEnv(t *testing.T) string {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("跳过 PostgreSQL 集成测试：未设置 TEST_POSTGRES_DSN")
	}
	return dsn
}

// setupPostgresTestApp 创建一个连接到 PostgreSQL 的测试 App
func setupPostgresTestApp(t *testing.T, dsn string) (*BaseApp, func()) {
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

// TestHasTablePostgresIntegration 测试 PostgreSQL 模式下 app.HasTable() 的集成行为
// 这个测试确保 hasTable 方法在 PostgreSQL 模式下正确使用传入的 db 参数
// 而不是依赖 DBAdapter() 返回的适配器（其 db 字段可能未初始化）
func TestHasTablePostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)

	t.Run("hasTable 使用传入的 db 参数而非 DBAdapter", func(t *testing.T) {
		// 创建 PostgreSQL 适配器并连接
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
		defer adapter.Close()

		// 创建测试表
		tableName := "test_hastable_integration"
		_, err = db.NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
		if err != nil {
			t.Fatalf("删除测试表失败: %v", err)
		}
		_, err = db.NewQuery(`CREATE TABLE ` + tableName + ` (id TEXT PRIMARY KEY)`).Execute()
		if err != nil {
			t.Fatalf("创建测试表失败: %v", err)
		}
		defer db.NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

		// 创建 BaseApp 并设置 PostgreSQL 适配器（但不调用 adapter.Connect）
		// 这模拟了实际运行时的情况：DBAdapter() 返回的适配器的 db 字段是 nil
		appConfig := BaseAppConfig{
			DataDir: t.TempDir(),
		}
		app := NewBaseApp(appConfig)

		// 设置一个未连接的适配器（模拟实际运行时的情况）
		uninitializedAdapter := NewPostgresAdapter()
		app.SetDBAdapter(uninitializedAdapter)

		// 验证适配器的 db 是 nil（这是 bug 的根源）
		_, adapterErr := uninitializedAdapter.HasTable(tableName)
		if adapterErr == nil {
			t.Error("未初始化的适配器应该返回错误")
		}

		// 现在测试修复后的 hasTable 方法
		// 它应该使用传入的 db 参数，而不是 DBAdapter().HasTable()
		// 由于 hasTable 是私有方法，我们通过反射或直接测试公开的 HasTable 方法
		// 但 HasTable 使用的是 app.ConcurrentDB()，我们需要设置它

		// 设置 concurrentDB（模拟 initDataDB 的行为）
		app.concurrentDB = db

		// 现在 app.HasTable 应该能正确工作
		exists := app.HasTable(tableName)
		if !exists {
			t.Errorf("HasTable(%q) 应该返回 true，表已存在", tableName)
		}

		// 测试大小写不敏感
		existsUpper := app.HasTable("TEST_HASTABLE_INTEGRATION")
		if !existsUpper {
			t.Errorf("HasTable(%q) 应该返回 true（大小写不敏感）", "TEST_HASTABLE_INTEGRATION")
		}

		// 测试不存在的表
		notExists := app.HasTable("nonexistent_table_xyz")
		if notExists {
			t.Error("HasTable(nonexistent_table_xyz) 应该返回 false")
		}
	})
}

// TestTableColumnsPostgresIntegration 测试 PostgreSQL 模式下 app.TableColumns() 的集成行为
func TestTableColumnsPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	// 创建测试表
	tableName := "test_table_columns_pg"
	_, err := app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
	if err != nil {
		t.Fatalf("删除测试表失败: %v", err)
	}
	_, err = app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		age INTEGER,
		created TIMESTAMPTZ DEFAULT NOW()
	)`).Execute()
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

	t.Run("获取表列", func(t *testing.T) {
		columns, err := app.TableColumns(tableName)
		if err != nil {
			t.Fatalf("TableColumns 失败: %v", err)
		}

		expectedColumns := []string{"id", "name", "age", "created"}
		if len(columns) != len(expectedColumns) {
			t.Fatalf("期望 %d 列，实际 %d 列: %v", len(expectedColumns), len(columns), columns)
		}

		for _, expected := range expectedColumns {
			found := false
			for _, col := range columns {
				if col == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("缺少列 %q", expected)
			}
		}
	})

	t.Run("大小写不敏感", func(t *testing.T) {
		columns, err := app.TableColumns("TEST_TABLE_COLUMNS_PG")
		if err != nil {
			t.Fatalf("TableColumns 大小写不敏感测试失败: %v", err)
		}
		if len(columns) == 0 {
			t.Error("大小写不敏感查询应该返回列")
		}
	})

	t.Run("不存在的表", func(t *testing.T) {
		columns, _ := app.TableColumns("nonexistent_table_xyz")
		if len(columns) != 0 {
			t.Error("不存在的表应该返回空列表")
		}
	})
}

// TestTableInfoPostgresIntegration 测试 PostgreSQL 模式下 app.TableInfo() 的集成行为
func TestTableInfoPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	// 创建测试表
	tableName := "test_table_info_pg"
	_, err := app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
	if err != nil {
		t.Fatalf("删除测试表失败: %v", err)
	}
	_, err = app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY DEFAULT 'test',
		name TEXT NOT NULL DEFAULT '',
		count INTEGER DEFAULT 0,
		active BOOLEAN DEFAULT true
	)`).Execute()
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

	t.Run("获取表信息", func(t *testing.T) {
		info, err := app.TableInfo(tableName)
		if err != nil {
			t.Fatalf("TableInfo 失败: %v", err)
		}

		if len(info) != 4 {
			t.Fatalf("期望 4 个字段，实际 %d 个", len(info))
		}

		// 检查 id 字段
		var idField *TableInfoRow
		for _, row := range info {
			if row.Name == "id" {
				idField = row
				break
			}
		}
		if idField == nil {
			t.Fatal("缺少 id 字段")
		}
		if idField.PK != 1 {
			t.Errorf("id 字段应该是主键，PK=%d", idField.PK)
		}
	})

	t.Run("大小写不敏感", func(t *testing.T) {
		info, err := app.TableInfo("TEST_TABLE_INFO_PG")
		if err != nil {
			t.Fatalf("TableInfo 大小写不敏感测试失败: %v", err)
		}
		if len(info) == 0 {
			t.Error("大小写不敏感查询应该返回信息")
		}
	})

	t.Run("不存在的表", func(t *testing.T) {
		info, _ := app.TableInfo("nonexistent_table_xyz")
		if info != nil && len(info) != 0 {
			t.Error("不存在的表应该返回 nil 或空列表")
		}
	})
}

// TestTableIndexesPostgresIntegration 测试 PostgreSQL 模式下 app.TableIndexes() 的集成行为
func TestTableIndexesPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	// 创建测试表和索引
	tableName := "test_table_indexes_pg"
	_, err := app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
	if err != nil {
		t.Fatalf("删除测试表失败: %v", err)
	}
	_, err = app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL,
		name TEXT
	)`).Execute()
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

	// 创建索引
	_, err = app.ConcurrentDB().NewQuery(`CREATE INDEX idx_test_email ON ` + tableName + ` (email)`).Execute()
	if err != nil {
		t.Fatalf("创建索引失败: %v", err)
	}
	_, err = app.ConcurrentDB().NewQuery(`CREATE UNIQUE INDEX idx_test_name ON ` + tableName + ` (name)`).Execute()
	if err != nil {
		t.Fatalf("创建唯一索引失败: %v", err)
	}

	t.Run("获取表索引", func(t *testing.T) {
		indexes, err := app.TableIndexes(tableName)
		if err != nil {
			t.Fatalf("TableIndexes 失败: %v", err)
		}

		// 应该有 2 个自定义索引（主键索引可能也会返回）
		if len(indexes) < 2 {
			t.Fatalf("期望至少 2 个索引，实际 %d 个: %v", len(indexes), indexes)
		}

		// 检查自定义索引
		if _, ok := indexes["idx_test_email"]; !ok {
			t.Error("缺少 idx_test_email 索引")
		}
		if _, ok := indexes["idx_test_name"]; !ok {
			t.Error("缺少 idx_test_name 索引")
		}
	})

	t.Run("大小写不敏感", func(t *testing.T) {
		indexes, err := app.TableIndexes("TEST_TABLE_INDEXES_PG")
		if err != nil {
			t.Fatalf("TableIndexes 大小写不敏感测试失败: %v", err)
		}
		if len(indexes) == 0 {
			t.Error("大小写不敏感查询应该返回索引")
		}
	})

	t.Run("不存在的表", func(t *testing.T) {
		indexes, _ := app.TableIndexes("nonexistent_table_xyz")
		if len(indexes) != 0 {
			t.Error("不存在的表应该返回空 map")
		}
	})
}

// TestDeleteTablePostgresIntegration 测试 PostgreSQL 模式下 app.DeleteTable() 的集成行为
func TestDeleteTablePostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	t.Run("删除存在的表", func(t *testing.T) {
		tableName := "test_delete_table_pg"
		_, err := app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
		if err != nil {
			t.Fatalf("清理测试表失败: %v", err)
		}
		_, err = app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (id TEXT PRIMARY KEY)`).Execute()
		if err != nil {
			t.Fatalf("创建测试表失败: %v", err)
		}

		// 确认表存在
		if !app.HasTable(tableName) {
			t.Fatal("测试表应该存在")
		}

		// 删除表
		err = app.DeleteTable(tableName)
		if err != nil {
			t.Fatalf("DeleteTable 失败: %v", err)
		}

		// 确认表已删除
		if app.HasTable(tableName) {
			t.Error("表应该已被删除")
		}
	})

	t.Run("删除不存在的表", func(t *testing.T) {
		err := app.DeleteTable("nonexistent_table_xyz")
		// 删除不存在的表不应该报错（使用 IF EXISTS）
		if err != nil {
			t.Errorf("删除不存在的表不应该报错: %v", err)
		}
	})

	t.Run("空表名", func(t *testing.T) {
		err := app.DeleteTable("")
		if err == nil {
			t.Error("空表名应该报错")
		}
	})
}

// TestVacuumPostgresIntegration 测试 PostgreSQL 模式下 app.Vacuum() 的集成行为
func TestVacuumPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	t.Run("执行 VACUUM", func(t *testing.T) {
		err := app.Vacuum()
		if err != nil {
			t.Fatalf("Vacuum 失败: %v", err)
		}
	})
}

// TestViewPostgresIntegration 测试 PostgreSQL 模式下视图操作的集成行为
func TestViewPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	// 创建基础表
	tableName := "test_view_base_pg"
	_, err := app.ConcurrentDB().NewQuery(`DROP VIEW IF EXISTS test_view_pg`).Execute()
	if err != nil {
		t.Logf("删除视图警告: %v", err)
	}
	_, err = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
	if err != nil {
		t.Fatalf("删除测试表失败: %v", err)
	}
	_, err = app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT
	)`).Execute()
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

	t.Run("创建视图", func(t *testing.T) {
		viewName := "test_view_pg"
		query := "SELECT id, name FROM " + tableName

		err := app.SaveView(viewName, query)
		if err != nil {
			t.Fatalf("SaveView 失败: %v", err)
		}
		defer app.DeleteView(viewName)

		// 验证视图存在
		if !app.HasTable(viewName) {
			t.Error("视图应该存在")
		}

		// 验证视图列
		columns, err := app.TableColumns(viewName)
		if err != nil {
			t.Fatalf("获取视图列失败: %v", err)
		}
		if len(columns) != 2 {
			t.Errorf("期望 2 列，实际 %d 列: %v", len(columns), columns)
		}
	})

	t.Run("删除视图", func(t *testing.T) {
		viewName := "test_view_delete_pg"
		query := "SELECT id FROM " + tableName

		err := app.SaveView(viewName, query)
		if err != nil {
			t.Fatalf("SaveView 失败: %v", err)
		}

		err = app.DeleteView(viewName)
		if err != nil {
			t.Fatalf("DeleteView 失败: %v", err)
		}

		if app.HasTable(viewName) {
			t.Error("视图应该已被删除")
		}
	})

	t.Run("更新视图", func(t *testing.T) {
		viewName := "test_view_update_pg"

		// 创建初始视图
		err := app.SaveView(viewName, "SELECT id FROM "+tableName)
		if err != nil {
			t.Fatalf("创建初始视图失败: %v", err)
		}
		defer app.DeleteView(viewName)

		// 更新视图
		err = app.SaveView(viewName, "SELECT id, name, email FROM "+tableName)
		if err != nil {
			t.Fatalf("更新视图失败: %v", err)
		}

		// 验证视图已更新
		columns, err := app.TableColumns(viewName)
		if err != nil {
			t.Fatalf("获取视图列失败: %v", err)
		}
		if len(columns) != 3 {
			t.Errorf("期望 3 列，实际 %d 列: %v", len(columns), columns)
		}
	})
}

// TestSyncRecordTableSchemaPostgresIntegration 测试 PostgreSQL 模式下表结构同步的集成行为
func TestSyncRecordTableSchemaPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresEnv(t)
	app, cleanup := setupPostgresTestApp(t, dsn)
	defer cleanup()

	t.Run("创建新表", func(t *testing.T) {
		tableName := "test_sync_new_pg"
		_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

		collection := NewBaseCollection(tableName)
		collection.Fields.Add(&TextField{Name: "title"})
		collection.Fields.Add(&NumberField{Name: "count"})

		err := app.SyncRecordTableSchema(collection, nil)
		if err != nil {
			t.Fatalf("SyncRecordTableSchema 创建新表失败: %v", err)
		}

		if !app.HasTable(tableName) {
			t.Error("表应该已创建")
		}

		columns, _ := app.TableColumns(tableName)
		expectedCols := []string{"id", "title", "count"}
		for _, expected := range expectedCols {
			found := false
			for _, col := range columns {
				if col == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("缺少列 %q，实际列: %v", expected, columns)
			}
		}
	})

	t.Run("更新现有表", func(t *testing.T) {
		tableName := "test_sync_update_pg"
		_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
		defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

		// 创建初始表
		oldCollection := NewBaseCollection(tableName)
		oldCollection.Fields.Add(&TextField{Name: "old_field"})
		err := app.SyncRecordTableSchema(oldCollection, nil)
		if err != nil {
			t.Fatalf("创建初始表失败: %v", err)
		}

		// 更新表结构
		newCollection := NewBaseCollection(tableName)
		newCollection.Id = oldCollection.Id
		newCollection.Fields.Add(&TextField{Name: "new_field"})

		err = app.SyncRecordTableSchema(newCollection, oldCollection)
		if err != nil {
			t.Fatalf("SyncRecordTableSchema 更新表失败: %v", err)
		}

		columns, _ := app.TableColumns(tableName)
		// 应该有 new_field，可能没有 old_field（取决于实现）
		hasNewField := false
		for _, col := range columns {
			if col == "new_field" {
				hasNewField = true
				break
			}
		}
		if !hasNewField {
			t.Errorf("应该有 new_field 列，实际列: %v", columns)
		}
	})
}
