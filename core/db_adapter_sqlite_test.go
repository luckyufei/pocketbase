package core

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestSQLiteAdapterType 测试 SQLite 适配器类型
func TestSQLiteAdapterType(t *testing.T) {
	adapter := NewSQLiteAdapter()

	if adapter.Type() != dbutils.DBTypeSQLite {
		t.Errorf("期望类型为 SQLite, 实际为 %v", adapter.Type())
	}
}

// TestSQLiteAdapterConnect 测试 SQLite 连接
func TestSQLiteAdapterConnect(t *testing.T) {
	adapter := NewSQLiteAdapter()

	config := DBConfig{
		DSN:          ":memory:",
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}

	ctx := context.Background()
	db, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	if db == nil {
		t.Fatal("返回的 db 为 nil")
	}

	// 验证连接
	if err := adapter.Ping(ctx); err != nil {
		t.Errorf("Ping 失败: %v", err)
	}
}

// TestSQLiteAdapterTableOperations 测试 SQLite 表操作
func TestSQLiteAdapterTableOperations(t *testing.T) {
	adapter := NewSQLiteAdapter()

	config := DBConfig{
		DSN:          ":memory:",
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}

	ctx := context.Background()
	db, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	// 创建测试表
	_, err = db.NewQuery(`
		CREATE TABLE test_table (
			id TEXT PRIMARY KEY NOT NULL,
			name TEXT NOT NULL,
			age INTEGER DEFAULT 0,
			created TEXT NOT NULL
		)
	`).Execute()
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 创建索引
	_, err = db.NewQuery(`CREATE INDEX idx_test_name ON test_table(name)`).Execute()
	if err != nil {
		t.Fatalf("创建索引失败: %v", err)
	}

	// 测试 HasTable
	t.Run("HasTable", func(t *testing.T) {
		exists, err := adapter.HasTable("test_table")
		if err != nil {
			t.Errorf("HasTable 失败: %v", err)
		}
		if !exists {
			t.Error("期望表存在")
		}

		exists, err = adapter.HasTable("non_existent_table")
		if err != nil {
			t.Errorf("HasTable 失败: %v", err)
		}
		if exists {
			t.Error("期望表不存在")
		}
	})

	// 测试 TableColumns
	t.Run("TableColumns", func(t *testing.T) {
		columns, err := adapter.TableColumns("test_table")
		if err != nil {
			t.Errorf("TableColumns 失败: %v", err)
		}

		expectedColumns := []string{"id", "name", "age", "created"}
		if len(columns) != len(expectedColumns) {
			t.Errorf("期望 %d 列, 实际 %d 列", len(expectedColumns), len(columns))
		}

		for i, col := range expectedColumns {
			if columns[i] != col {
				t.Errorf("期望列 %d 为 '%s', 实际为 '%s'", i, col, columns[i])
			}
		}
	})

	// 测试 TableInfo
	t.Run("TableInfo", func(t *testing.T) {
		info, err := adapter.TableInfo("test_table")
		if err != nil {
			t.Errorf("TableInfo 失败: %v", err)
		}

		if len(info) != 4 {
			t.Errorf("期望 4 行信息, 实际 %d 行", len(info))
		}

		// 检查 id 列
		idCol := info[0]
		if idCol.Name != "id" {
			t.Errorf("期望第一列为 'id', 实际为 '%s'", idCol.Name)
		}
		if idCol.PK != 1 {
			t.Errorf("期望 id 为主键 (PK=1), 实际 PK=%d", idCol.PK)
		}
		if !idCol.NotNull {
			t.Error("期望 id 为 NOT NULL")
		}
	})

	// 测试 TableIndexes
	t.Run("TableIndexes", func(t *testing.T) {
		indexes, err := adapter.TableIndexes("test_table")
		if err != nil {
			t.Errorf("TableIndexes 失败: %v", err)
		}

		if _, ok := indexes["idx_test_name"]; !ok {
			t.Error("期望找到索引 'idx_test_name'")
		}
	})
}

// TestSQLiteAdapterBoolValue 测试 SQLite 布尔值转换
func TestSQLiteAdapterBoolValue(t *testing.T) {
	adapter := NewSQLiteAdapter()

	tests := []struct {
		name     string
		input    any
		expected bool
	}{
		{"整数 0", 0, false},
		{"整数 1", 1, true},
		{"整数 2", 2, true},
		{"int64 0", int64(0), false},
		{"int64 1", int64(1), true},
		{"字符串 0", "0", false},
		{"字符串 1", "1", true},
		{"字符串 false", "false", false},
		{"字符串 true", "true", true},
		{"布尔 false", false, false},
		{"布尔 true", true, true},
		{"nil", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := adapter.BoolValue(tt.input)
			if result != tt.expected {
				t.Errorf("BoolValue(%v) = %v, 期望 %v", tt.input, result, tt.expected)
			}
		})
	}
}

// TestSQLiteAdapterFormatBool 测试 SQLite 布尔值格式化
func TestSQLiteAdapterFormatBool(t *testing.T) {
	adapter := NewSQLiteAdapter()

	// SQLite 使用 0/1 表示布尔值
	if adapter.FormatBool(false) != 0 {
		t.Errorf("FormatBool(false) 应该返回 0")
	}

	if adapter.FormatBool(true) != 1 {
		t.Errorf("FormatBool(true) 应该返回 1")
	}
}

// TestSQLiteAdapterTimeValue 测试 SQLite 时间转换
func TestSQLiteAdapterTimeValue(t *testing.T) {
	adapter := NewSQLiteAdapter()

	tests := []struct {
		name    string
		input   any
		wantErr bool
	}{
		{"RFC3339 格式", "2024-01-15T10:30:00Z", false},
		{"SQLite 格式", "2024-01-15 10:30:00", false},
		{"time.Time", time.Now(), false},
		{"空字符串", "", true},
		{"无效格式", "invalid", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := adapter.TimeValue(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("TimeValue(%v) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

// TestSQLiteAdapterFormatTime 测试 SQLite 时间格式化
func TestSQLiteAdapterFormatTime(t *testing.T) {
	adapter := NewSQLiteAdapter()

	testTime := time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)
	result := adapter.FormatTime(testTime)

	// SQLite 使用 "2006-01-02 15:04:05.000Z" 格式
	expected := "2024-01-15 10:30:00.000Z"
	if result != expected {
		t.Errorf("FormatTime() = '%s', 期望 '%s'", result, expected)
	}
}

// TestSQLiteAdapterNoCaseCollation 测试 SQLite 大小写不敏感排序
func TestSQLiteAdapterNoCaseCollation(t *testing.T) {
	adapter := NewSQLiteAdapter()

	collation := adapter.NoCaseCollation()
	if collation != "COLLATE NOCASE" {
		t.Errorf("NoCaseCollation() = '%s', 期望 'COLLATE NOCASE'", collation)
	}
}

// TestSQLiteAdapterJSONFunctions 测试 SQLite JSON 函数
func TestSQLiteAdapterJSONFunctions(t *testing.T) {
	adapter := NewSQLiteAdapter()

	jsonFuncs := adapter.JSONFunctions()
	if jsonFuncs == nil {
		t.Fatal("JSONFunctions() 返回 nil")
	}

	if jsonFuncs.DBType() != dbutils.DBTypeSQLite {
		t.Errorf("JSONFunctions 类型错误, 期望 SQLite, 实际 %v", jsonFuncs.DBType())
	}
}

// TestSQLiteAdapterVacuum 测试 SQLite VACUUM
func TestSQLiteAdapterVacuum(t *testing.T) {
	adapter := NewSQLiteAdapter()

	config := DBConfig{
		DSN:          ":memory:",
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}

	ctx := context.Background()
	_, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	// VACUUM 应该成功
	if err := adapter.Vacuum(); err != nil {
		t.Errorf("Vacuum 失败: %v", err)
	}
}

// TestSQLiteAdapterErrorDetection 测试 SQLite 错误检测
func TestSQLiteAdapterErrorDetection(t *testing.T) {
	adapter := NewSQLiteAdapter()

	config := DBConfig{
		DSN:          ":memory:",
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}

	ctx := context.Background()
	db, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	// 创建测试表
	_, err = db.NewQuery(`
		CREATE TABLE error_test (
			id TEXT PRIMARY KEY NOT NULL,
			email TEXT UNIQUE NOT NULL,
			parent_id TEXT REFERENCES error_test(id)
		)
	`).Execute()
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 插入测试数据
	_, err = db.NewQuery(`INSERT INTO error_test (id, email) VALUES ('1', 'test@example.com')`).Execute()
	if err != nil {
		t.Fatalf("插入数据失败: %v", err)
	}

	// 测试唯一约束违反
	t.Run("UniqueViolation", func(t *testing.T) {
		_, err := db.NewQuery(`INSERT INTO error_test (id, email) VALUES ('2', 'test@example.com')`).Execute()
		if err == nil {
			t.Fatal("期望唯一约束违反错误")
		}

		if !adapter.IsUniqueViolation(err) {
			t.Errorf("期望 IsUniqueViolation 返回 true, 错误: %v", err)
		}
	})

	// 测试外键约束违反
	t.Run("ForeignKeyViolation", func(t *testing.T) {
		// 启用外键约束
		_, _ = db.NewQuery(`PRAGMA foreign_keys = ON`).Execute()

		_, err := db.NewQuery(`INSERT INTO error_test (id, email, parent_id) VALUES ('3', 'test3@example.com', 'non_existent')`).Execute()
		if err == nil {
			t.Fatal("期望外键约束违反错误")
		}

		if !adapter.IsForeignKeyViolation(err) {
			t.Errorf("期望 IsForeignKeyViolation 返回 true, 错误: %v", err)
		}
	})

	// 测试普通错误
	t.Run("NormalError", func(t *testing.T) {
		normalErr := errors.New("普通错误")

		if adapter.IsUniqueViolation(normalErr) {
			t.Error("普通错误不应该被识别为唯一约束违反")
		}

		if adapter.IsForeignKeyViolation(normalErr) {
			t.Error("普通错误不应该被识别为外键约束违反")
		}
	})
}

// TestSQLiteAdapterImplementsInterface 确保 SQLiteAdapter 实现了 DBAdapter 接口
func TestSQLiteAdapterImplementsInterface(t *testing.T) {
	var _ DBAdapter = (*SQLiteAdapter)(nil)
}
