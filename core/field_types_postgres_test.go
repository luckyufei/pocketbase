package core

import (
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestFieldColumnTypePostgres 测试字段类型在 PostgreSQL 下的列类型
func TestFieldColumnTypePostgres(t *testing.T) {
	// 创建一个模拟的 PostgreSQL App
	config := BaseAppConfig{
		DataDir: t.TempDir(),
	}
	app := NewBaseApp(config)
	app.SetDBAdapter(NewPostgresAdapter())

	// 验证是 PostgreSQL
	if !app.IsPostgres() {
		t.Fatal("应该是 PostgreSQL")
	}

	t.Run("DateField PostgreSQL", func(t *testing.T) {
		f := &DateField{}
		colType := f.ColumnType(app)
		if colType != "TIMESTAMPTZ DEFAULT NULL" {
			t.Errorf("DateField PostgreSQL 应返回 TIMESTAMPTZ, 实际: %s", colType)
		}
	})

	t.Run("JSONField PostgreSQL", func(t *testing.T) {
		f := &JSONField{}
		colType := f.ColumnType(app)
		if colType != "JSONB DEFAULT NULL" {
			t.Errorf("JSONField PostgreSQL 应返回 JSONB, 实际: %s", colType)
		}
	})

	t.Run("BoolField PostgreSQL", func(t *testing.T) {
		f := &BoolField{}
		colType := f.ColumnType(app)
		// PostgreSQL 原生支持 BOOLEAN
		if colType != "BOOLEAN DEFAULT FALSE NOT NULL" {
			t.Errorf("BoolField PostgreSQL 应返回 BOOLEAN, 实际: %s", colType)
		}
	})

	t.Run("AutodateField PostgreSQL", func(t *testing.T) {
		f := &AutodateField{}
		colType := f.ColumnType(app)
		if colType != "TIMESTAMPTZ DEFAULT NULL" {
			t.Errorf("AutodateField PostgreSQL 应返回 TIMESTAMPTZ, 实际: %s", colType)
		}
	})

	t.Run("SelectField Single PostgreSQL", func(t *testing.T) {
		f := &SelectField{MaxSelect: 1}
		colType := f.ColumnType(app)
		if colType != "TEXT DEFAULT '' NOT NULL" {
			t.Errorf("SelectField Single PostgreSQL 应返回 TEXT, 实际: %s", colType)
		}
	})

	t.Run("SelectField Multiple PostgreSQL", func(t *testing.T) {
		f := &SelectField{MaxSelect: 2}
		colType := f.ColumnType(app)
		if colType != "JSONB DEFAULT '[]' NOT NULL" {
			t.Errorf("SelectField Multiple PostgreSQL 应返回 JSONB, 实际: %s", colType)
		}
	})

	t.Run("RelationField Single PostgreSQL", func(t *testing.T) {
		f := &RelationField{MaxSelect: 1}
		colType := f.ColumnType(app)
		if colType != "TEXT DEFAULT '' NOT NULL" {
			t.Errorf("RelationField Single PostgreSQL 应返回 TEXT, 实际: %s", colType)
		}
	})

	t.Run("RelationField Multiple PostgreSQL", func(t *testing.T) {
		f := &RelationField{MaxSelect: 2}
		colType := f.ColumnType(app)
		if colType != "JSONB DEFAULT '[]' NOT NULL" {
			t.Errorf("RelationField Multiple PostgreSQL 应返回 JSONB, 实际: %s", colType)
		}
	})
}

// TestFieldColumnTypeSQLite 测试字段类型在 SQLite 下的列类型（保持兼容）
func TestFieldColumnTypeSQLite(t *testing.T) {
	config := BaseAppConfig{
		DataDir: t.TempDir(),
	}
	app := NewBaseApp(config)
	// 默认是 SQLite
	if app.DBAdapter().Type() != dbutils.DBTypeSQLite {
		t.Fatal("默认应该是 SQLite")
	}

	t.Run("DateField SQLite", func(t *testing.T) {
		f := &DateField{}
		colType := f.ColumnType(app)
		if colType != "TEXT DEFAULT '' NOT NULL" {
			t.Errorf("DateField SQLite 应返回 TEXT, 实际: %s", colType)
		}
	})

	t.Run("JSONField SQLite", func(t *testing.T) {
		f := &JSONField{}
		colType := f.ColumnType(app)
		if colType != "JSON DEFAULT NULL" {
			t.Errorf("JSONField SQLite 应返回 JSON, 实际: %s", colType)
		}
	})

	t.Run("SelectField Multiple SQLite", func(t *testing.T) {
		f := &SelectField{MaxSelect: 2}
		colType := f.ColumnType(app)
		if colType != "JSON DEFAULT '[]' NOT NULL" {
			t.Errorf("SelectField Multiple SQLite 应返回 JSON, 实际: %s", colType)
		}
	})
}
