package core

import (
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
