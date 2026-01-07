package core

import (
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestBaseAppDBAdapter 测试 BaseApp 的适配器集成
func TestBaseAppDBAdapter(t *testing.T) {
	// 创建一个基础配置
	config := BaseAppConfig{
		DataDir: t.TempDir(),
	}

	app := NewBaseApp(config)

	// 测试默认适配器
	t.Run("DefaultAdapter", func(t *testing.T) {
		adapter := app.DBAdapter()
		if adapter == nil {
			t.Fatal("DBAdapter() 返回 nil")
		}

		// 默认应该是 SQLite
		if adapter.Type() != dbutils.DBTypeSQLite {
			t.Errorf("默认适配器类型应该是 SQLite, 实际为 %v", adapter.Type())
		}
	})

	// 测试设置适配器
	t.Run("SetDBAdapter", func(t *testing.T) {
		pgAdapter := NewPostgresAdapter()
		app.SetDBAdapter(pgAdapter)

		adapter := app.DBAdapter()
		if adapter.Type() != dbutils.DBTypePostgres {
			t.Errorf("设置后适配器类型应该是 PostgreSQL, 实际为 %v", adapter.Type())
		}
	})

	// 测试 IsPostgres 和 IsSQLite
	t.Run("IsPostgres", func(t *testing.T) {
		pgAdapter := NewPostgresAdapter()
		app.SetDBAdapter(pgAdapter)

		if !app.IsPostgres() {
			t.Error("设置 PostgreSQL 适配器后 IsPostgres() 应该返回 true")
		}

		if app.IsSQLite() {
			t.Error("设置 PostgreSQL 适配器后 IsSQLite() 应该返回 false")
		}
	})

	t.Run("IsSQLite", func(t *testing.T) {
		sqliteAdapter := NewSQLiteAdapter()
		app.SetDBAdapter(sqliteAdapter)

		if !app.IsSQLite() {
			t.Error("设置 SQLite 适配器后 IsSQLite() 应该返回 true")
		}

		if app.IsPostgres() {
			t.Error("设置 SQLite 适配器后 IsPostgres() 应该返回 false")
		}
	})
}

// TestBaseAppDBAdapterNil 测试 nil 适配器的处理
func TestBaseAppDBAdapterNil(t *testing.T) {
	config := BaseAppConfig{
		DataDir: t.TempDir(),
	}

	app := NewBaseApp(config)

	// 确保 dbAdapter 为 nil 时返回默认适配器
	app.dbAdapter = nil

	adapter := app.DBAdapter()
	if adapter == nil {
		t.Fatal("即使 dbAdapter 为 nil, DBAdapter() 也不应该返回 nil")
	}

	if adapter.Type() != dbutils.DBTypeSQLite {
		t.Errorf("nil 时应该返回默认 SQLite 适配器, 实际为 %v", adapter.Type())
	}
}
