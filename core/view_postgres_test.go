package core

import (
	"context"
	"os"
	"testing"
)

// skipIfNoPostgresForView 跳过没有 PostgreSQL 环境的测试
func skipIfNoPostgresForView(t *testing.T) string {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("跳过 PostgreSQL 集成测试：未设置 TEST_POSTGRES_DSN")
	}
	return dsn
}

// setupPostgresTestAppForView 创建一个连接到 PostgreSQL 的测试 App
func setupPostgresTestAppForView(t *testing.T, dsn string) (*BaseApp, func()) {
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

// ensureNoTempViewsPostgres 检查 PostgreSQL 中是否有临时视图
func ensureNoTempViewsPostgres(app *BaseApp, t *testing.T) {
	var total int

	// PostgreSQL 使用 information_schema 而不是 sqlite_schema
	err := app.ConcurrentDB().NewQuery(`
		SELECT COUNT(*) 
		FROM information_schema.views 
		WHERE table_schema = 'public' 
		AND table_name LIKE '%_temp_%'
	`).Row(&total)
	if err != nil {
		t.Fatalf("检查临时视图失败: %v", err)
	}

	if total > 0 {
		t.Fatalf("期望所有临时视图已删除，实际还有 %d 个", total)
	}
}

// getTotalViewsPostgres 获取 PostgreSQL 中视图的总数
func getTotalViewsPostgres(app *BaseApp) (int, error) {
	var total int

	err := app.ConcurrentDB().NewQuery(`
		SELECT COUNT(*) 
		FROM information_schema.views 
		WHERE table_schema = 'public'
	`).Row(&total)

	return total, err
}

// TestDeleteViewPostgresIntegration 测试 PostgreSQL 模式下删除视图
func TestDeleteViewPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresForView(t)
	app, cleanup := setupPostgresTestAppForView(t, dsn)
	defer cleanup()

	// 创建基础表
	tableName := "test_delete_view_base_pg"
	_, _ = app.ConcurrentDB().NewQuery(`DROP VIEW IF EXISTS test_view_to_delete_pg`).Execute()
	_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()
	_, err := app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (id TEXT PRIMARY KEY, name TEXT)`).Execute()
	if err != nil {
		t.Fatalf("创建基础表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName).Execute()

	// 创建视图
	viewName := "test_view_to_delete_pg"
	err = app.SaveView(viewName, "SELECT id, name FROM "+tableName)
	if err != nil {
		t.Fatalf("创建视图失败: %v", err)
	}

	scenarios := []struct {
		viewName    string
		expectError bool
	}{
		{"", true},                       // 空名称
		{tableName, true},                // 不是视图（是表）
		{"missing_view_xyz", false},      // 不存在的视图
		{viewName, false},                // 存在的视图
		{"TEST_VIEW_TO_DELETE_PG", false}, // 大小写不敏感
	}

	for i, s := range scenarios {
		err := app.DeleteView(s.viewName)

		hasErr := err != nil
		if hasErr != s.expectError {
			t.Errorf("[%d - %q] 期望 hasErr=%v, 实际=%v (%v)", i, s.viewName, s.expectError, hasErr, err)
		}
	}

	ensureNoTempViewsPostgres(app, t)
}

// TestSaveViewPostgresIntegration 测试 PostgreSQL 模式下保存视图
func TestSaveViewPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresForView(t)
	app, cleanup := setupPostgresTestAppForView(t, dsn)
	defer cleanup()

	// 创建基础表
	tableName := "test_save_view_base_pg"
	_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()
	_, err := app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT,
		count INTEGER
	)`).Execute()
	if err != nil {
		t.Fatalf("创建基础表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

	scenarios := []struct {
		scenarioName  string
		viewName      string
		query         string
		expectError   bool
		expectColumns []string
	}{
		{
			"空名称和查询",
			"",
			"",
			true,
			nil,
		},
		{
			"空名称",
			"",
			"SELECT * FROM " + tableName,
			true,
			nil,
		},
		{
			"空查询",
			"test_view_empty_query_pg",
			"",
			true,
			nil,
		},
		{
			"无效查询",
			"test_view_invalid_pg",
			"123 456",
			true,
			nil,
		},
		{
			"缺少表",
			"test_view_missing_table_pg",
			"SELECT id FROM missing_table_xyz",
			true,
			nil,
		},
		{
			"非 SELECT 查询",
			"test_view_non_select_pg",
			"DROP TABLE " + tableName,
			true,
			nil,
		},
		{
			"简单 SELECT 查询",
			"test_view_simple_pg",
			"SELECT id, name, COUNT(*) as c FROM " + tableName + " GROUP BY id, name",
			false,
			[]string{"id", "name", "c"},
		},
		{
			"更新已存在的视图",
			"test_view_simple_pg",
			"SELECT id FROM " + tableName,
			false,
			[]string{"id"},
		},
	}

	for _, s := range scenarios {
		t.Run(s.scenarioName, func(t *testing.T) {
			err := app.SaveView(s.viewName, s.query)

			hasErr := err != nil
			if hasErr != s.expectError {
				t.Fatalf("期望 hasErr=%v, 实际=%v (%v)", s.expectError, hasErr, err)
			}

			if hasErr {
				return
			}

			// 清理视图
			defer app.DeleteView(s.viewName)

			infoRows, err := app.TableInfo(s.viewName)
			if err != nil {
				t.Fatalf("获取视图信息失败 %s: %v", s.viewName, err)
			}

			if len(s.expectColumns) != len(infoRows) {
				t.Fatalf("期望 %d 列, 实际 %d 列", len(s.expectColumns), len(infoRows))
			}

			for _, row := range infoRows {
				found := false
				for _, expected := range s.expectColumns {
					if row.Name == expected {
						found = true
						break
					}
				}
				if !found {
					t.Fatalf("未期望的列 %q，期望列: %v", row.Name, s.expectColumns)
				}
			}
		})
	}

	ensureNoTempViewsPostgres(app, t)
}

// TestCreateViewFieldsPostgresIntegration 测试 PostgreSQL 模式下创建视图字段
// 注意：这个测试需要完整初始化的 PocketBase 应用（包含 _collections 系统表）
// 由于我们的测试环境只是简单的 PostgreSQL 连接，无法测试 CreateViewFields 的完整功能
// 这里只测试基本的错误处理场景
func TestCreateViewFieldsPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresForView(t)
	app, cleanup := setupPostgresTestAppForView(t, dsn)
	defer cleanup()

	// 只测试不需要查询 _collections 表的场景
	scenarios := []struct {
		name        string
		query       string
		expectError bool
	}{
		{
			"空查询",
			"",
			true,
		},
		{
			"无效查询",
			"test 123456",
			true,
		},
		{
			"缺少表",
			"SELECT id FROM missing_table_xyz",
			true,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			_, err := app.CreateViewFields(s.query)

			hasErr := err != nil
			if hasErr != s.expectError {
				t.Fatalf("期望 hasErr=%v, 实际=%v (%v)", s.expectError, hasErr, err)
			}
		})
	}

	ensureNoTempViewsPostgres(app, t)
}

// TestSingleVsMultipleValuesNormalizationPostgresIntegration 测试 PostgreSQL 模式下单值/多值字段规范化
func TestSingleVsMultipleValuesNormalizationPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresForView(t)
	app, cleanup := setupPostgresTestAppForView(t, dsn)
	defer cleanup()

	// 创建测试表
	tableName := "test_normalization_pg"
	_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()
	_, err := app.ConcurrentDB().NewQuery(`CREATE TABLE ` + tableName + ` (
		id TEXT PRIMARY KEY,
		single_field TEXT DEFAULT '',
		multi_field JSONB DEFAULT '[]'
	)`).Execute()
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + tableName + ` CASCADE`).Execute()

	t.Run("检查默认值格式", func(t *testing.T) {
		tableInfo, err := app.TableInfo(tableName)
		if err != nil {
			t.Fatalf("获取表信息失败: %v", err)
		}

		for _, row := range tableInfo {
			switch row.Name {
			case "single_field":
				// PostgreSQL 的默认值格式可能是 ''::text
				if !row.DefaultValue.Valid {
					t.Errorf("single_field 应该有默认值")
				}
			case "multi_field":
				// PostgreSQL 的默认值格式可能是 '[]'::jsonb
				if !row.DefaultValue.Valid {
					t.Errorf("multi_field 应该有默认值")
				}
			}
		}
	})
}

// TestViewWithJoinsPostgresIntegration 测试 PostgreSQL 模式下带 JOIN 的视图
func TestViewWithJoinsPostgresIntegration(t *testing.T) {
	dsn := skipIfNoPostgresForView(t)
	app, cleanup := setupPostgresTestAppForView(t, dsn)
	defer cleanup()

	// 创建两个基础表
	table1 := "test_join_table1_pg"
	table2 := "test_join_table2_pg"

	_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table1 + ` CASCADE`).Execute()
	_, _ = app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table2 + ` CASCADE`).Execute()

	_, err := app.ConcurrentDB().NewQuery(`CREATE TABLE ` + table1 + ` (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL
	)`).Execute()
	if err != nil {
		t.Fatalf("创建表1失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table1 + ` CASCADE`).Execute()

	_, err = app.ConcurrentDB().NewQuery(`CREATE TABLE ` + table2 + ` (
		id TEXT PRIMARY KEY,
		table1_id TEXT REFERENCES ` + table1 + `(id),
		value INTEGER
	)`).Execute()
	if err != nil {
		t.Fatalf("创建表2失败: %v", err)
	}
	defer app.ConcurrentDB().NewQuery(`DROP TABLE IF EXISTS ` + table2 + ` CASCADE`).Execute()

	t.Run("创建带 JOIN 的视图", func(t *testing.T) {
		viewName := "test_join_view_pg"
		query := `
			SELECT 
				t1.id,
				t1.name,
				t2.id AS t2_id,
				t2.value
			FROM ` + table1 + ` t1
			LEFT JOIN ` + table2 + ` t2 ON t2.table1_id = t1.id
		`

		err := app.SaveView(viewName, query)
		if err != nil {
			t.Fatalf("创建带 JOIN 的视图失败: %v", err)
		}
		defer app.DeleteView(viewName)

		// 验证视图列
		columns, err := app.TableColumns(viewName)
		if err != nil {
			t.Fatalf("获取视图列失败: %v", err)
		}

		expectedColumns := []string{"id", "name", "t2_id", "value"}
		if len(columns) != len(expectedColumns) {
			t.Fatalf("期望 %d 列, 实际 %d 列: %v", len(expectedColumns), len(columns), columns)
		}
	})
}
