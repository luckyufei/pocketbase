package core

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// skipIfNoPostgres 跳过没有 PostgreSQL 环境的测试
func skipIfNoPostgres(t *testing.T) string {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("跳过 PostgreSQL 测试: 未设置 TEST_POSTGRES_DSN 环境变量")
	}
	return dsn
}

// TestPostgresAdapterType 测试 PostgreSQL 适配器类型
func TestPostgresAdapterType(t *testing.T) {
	adapter := NewPostgresAdapter()

	if adapter.Type() != dbutils.DBTypePostgres {
		t.Errorf("期望类型为 PostgreSQL, 实际为 %v", adapter.Type())
	}
}

// TestPostgresAdapterConnect 测试 PostgreSQL 连接
func TestPostgresAdapterConnect(t *testing.T) {
	dsn := skipIfNoPostgres(t)

	adapter := NewPostgresAdapter()

	config := DBConfig{
		DSN:          dsn,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
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

// TestPostgresAdapterTableOperations 测试 PostgreSQL 表操作
func TestPostgresAdapterTableOperations(t *testing.T) {
	dsn := skipIfNoPostgres(t)

	adapter := NewPostgresAdapter()

	config := DBConfig{
		DSN:          dsn,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}

	ctx := context.Background()
	db, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	// 创建测试表
	_, err = db.NewQuery(`
		DROP TABLE IF EXISTS pg_adapter_test;
		CREATE TABLE pg_adapter_test (
			id TEXT PRIMARY KEY NOT NULL,
			name TEXT NOT NULL,
			age INTEGER DEFAULT 0,
			created TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`).Execute()
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}
	defer db.NewQuery(`DROP TABLE IF EXISTS pg_adapter_test`).Execute()

	// 创建索引
	_, err = db.NewQuery(`CREATE INDEX IF NOT EXISTS idx_pg_test_name ON pg_adapter_test(name)`).Execute()
	if err != nil {
		t.Fatalf("创建索引失败: %v", err)
	}

	// 测试 HasTable
	t.Run("HasTable", func(t *testing.T) {
		exists, err := adapter.HasTable("pg_adapter_test")
		if err != nil {
			t.Errorf("HasTable 失败: %v", err)
		}
		if !exists {
			t.Error("期望表存在")
		}

		exists, err = adapter.HasTable("non_existent_table_xyz")
		if err != nil {
			t.Errorf("HasTable 失败: %v", err)
		}
		if exists {
			t.Error("期望表不存在")
		}
	})

	// 测试 HasTable 大小写不敏感
	t.Run("HasTable_CaseInsensitive", func(t *testing.T) {
		// PostgreSQL 将未加引号的标识符转为小写存储
		// 但查询时应该大小写不敏感
		testCases := []string{
			"pg_adapter_test",   // 全小写（与存储一致）
			"PG_ADAPTER_TEST",   // 全大写
			"Pg_Adapter_Test",   // 混合大小写
			"PG_adapter_TEST",   // 混合大小写
		}

		for _, tableName := range testCases {
			exists, err := adapter.HasTable(tableName)
			if err != nil {
				t.Errorf("HasTable(%q) 失败: %v", tableName, err)
			}
			if !exists {
				t.Errorf("HasTable(%q) 应该返回 true（大小写不敏感）", tableName)
			}
		}
	})

	// 测试 TableColumns
	t.Run("TableColumns", func(t *testing.T) {
		columns, err := adapter.TableColumns("pg_adapter_test")
		if err != nil {
			t.Errorf("TableColumns 失败: %v", err)
		}

		expectedColumns := []string{"id", "name", "age", "created"}
		if len(columns) != len(expectedColumns) {
			t.Errorf("期望 %d 列, 实际 %d 列: %v", len(expectedColumns), len(columns), columns)
		}

		for i, col := range expectedColumns {
			if i < len(columns) && columns[i] != col {
				t.Errorf("期望列 %d 为 '%s', 实际为 '%s'", i, col, columns[i])
			}
		}
	})

	// 测试 TableInfo
	t.Run("TableInfo", func(t *testing.T) {
		info, err := adapter.TableInfo("pg_adapter_test")
		if err != nil {
			t.Errorf("TableInfo 失败: %v", err)
		}

		if len(info) != 4 {
			t.Errorf("期望 4 行信息, 实际 %d 行", len(info))
		}

		// 查找 id 列
		var idCol *AdapterTableInfoRow
		for _, col := range info {
			if col.Name == "id" {
				idCol = col
				break
			}
		}

		if idCol == nil {
			t.Fatal("未找到 id 列")
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
		indexes, err := adapter.TableIndexes("pg_adapter_test")
		if err != nil {
			t.Errorf("TableIndexes 失败: %v", err)
		}

		if _, ok := indexes["idx_pg_test_name"]; !ok {
			t.Errorf("期望找到索引 'idx_pg_test_name', 实际索引: %v", indexes)
		}
	})
}

// TestPostgresAdapterBoolValue 测试 PostgreSQL 布尔值转换
func TestPostgresAdapterBoolValue(t *testing.T) {
	adapter := NewPostgresAdapter()

	tests := []struct {
		name     string
		input    any
		expected bool
	}{
		{"布尔 false", false, false},
		{"布尔 true", true, true},
		{"字符串 false", "false", false},
		{"字符串 true", "true", true},
		{"字符串 f", "f", false},
		{"字符串 t", "t", true},
		{"整数 0", 0, false},
		{"整数 1", 1, true},
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

// TestPostgresAdapterFormatBool 测试 PostgreSQL 布尔值格式化
func TestPostgresAdapterFormatBool(t *testing.T) {
	adapter := NewPostgresAdapter()

	// PostgreSQL 使用原生布尔值
	if adapter.FormatBool(false) != false {
		t.Errorf("FormatBool(false) 应该返回 false")
	}

	if adapter.FormatBool(true) != true {
		t.Errorf("FormatBool(true) 应该返回 true")
	}
}

// TestPostgresAdapterTimeValue 测试 PostgreSQL 时间转换
func TestPostgresAdapterTimeValue(t *testing.T) {
	adapter := NewPostgresAdapter()

	tests := []struct {
		name    string
		input   any
		wantErr bool
	}{
		{"RFC3339 格式", "2024-01-15T10:30:00Z", false},
		{"PostgreSQL 格式", "2024-01-15 10:30:00+00", false},
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

// TestPostgresAdapterFormatTime 测试 PostgreSQL 时间格式化
func TestPostgresAdapterFormatTime(t *testing.T) {
	adapter := NewPostgresAdapter()

	testTime := time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)
	result := adapter.FormatTime(testTime)

	// PostgreSQL 使用 RFC3339 格式
	expected := "2024-01-15T10:30:00Z"
	if result != expected {
		t.Errorf("FormatTime() = '%s', 期望 '%s'", result, expected)
	}
}

// TestPostgresAdapterNoCaseCollation 测试 PostgreSQL 大小写不敏感排序
func TestPostgresAdapterNoCaseCollation(t *testing.T) {
	adapter := NewPostgresAdapter()

	collation := adapter.NoCaseCollation()
	// PostgreSQL 使用 LOWER() 函数
	if collation != "LOWER" {
		t.Errorf("NoCaseCollation() = '%s', 期望 'LOWER'", collation)
	}
}

// TestPostgresAdapterJSONFunctions 测试 PostgreSQL JSON 函数
func TestPostgresAdapterJSONFunctions(t *testing.T) {
	adapter := NewPostgresAdapter()

	jsonFuncs := adapter.JSONFunctions()
	if jsonFuncs == nil {
		t.Fatal("JSONFunctions() 返回 nil")
	}

	if jsonFuncs.DBType() != dbutils.DBTypePostgres {
		t.Errorf("JSONFunctions 类型错误, 期望 PostgreSQL, 实际 %v", jsonFuncs.DBType())
	}
}

// TestPostgresAdapterVacuum 测试 PostgreSQL VACUUM
func TestPostgresAdapterVacuum(t *testing.T) {
	dsn := skipIfNoPostgres(t)

	adapter := NewPostgresAdapter()

	config := DBConfig{
		DSN:          dsn,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}

	ctx := context.Background()
	_, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	// VACUUM ANALYZE 应该成功
	if err := adapter.Vacuum(); err != nil {
		t.Errorf("Vacuum 失败: %v", err)
	}
}

// TestPostgresAdapterErrorDetection 测试 PostgreSQL 错误检测
func TestPostgresAdapterErrorDetection(t *testing.T) {
	dsn := skipIfNoPostgres(t)

	adapter := NewPostgresAdapter()

	config := DBConfig{
		DSN:          dsn,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}

	ctx := context.Background()
	db, err := adapter.Connect(ctx, config)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	defer adapter.Close()

	// 创建测试表
	_, err = db.NewQuery(`
		DROP TABLE IF EXISTS pg_error_test CASCADE;
		CREATE TABLE pg_error_test (
			id TEXT PRIMARY KEY NOT NULL,
			email TEXT UNIQUE NOT NULL,
			parent_id TEXT REFERENCES pg_error_test(id)
		)
	`).Execute()
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}
	defer db.NewQuery(`DROP TABLE IF EXISTS pg_error_test CASCADE`).Execute()

	// 插入测试数据
	_, err = db.NewQuery(`INSERT INTO pg_error_test (id, email) VALUES ('1', 'test@example.com')`).Execute()
	if err != nil {
		t.Fatalf("插入数据失败: %v", err)
	}

	// 测试唯一约束违反
	t.Run("UniqueViolation", func(t *testing.T) {
		_, err := db.NewQuery(`INSERT INTO pg_error_test (id, email) VALUES ('2', 'test@example.com')`).Execute()
		if err == nil {
			t.Fatal("期望唯一约束违反错误")
		}

		if !adapter.IsUniqueViolation(err) {
			t.Errorf("期望 IsUniqueViolation 返回 true, 错误: %v", err)
		}
	})

	// 测试外键约束违反
	t.Run("ForeignKeyViolation", func(t *testing.T) {
		_, err := db.NewQuery(`INSERT INTO pg_error_test (id, email, parent_id) VALUES ('3', 'test3@example.com', 'non_existent')`).Execute()
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

// TestPostgresAdapterImplementsInterface 确保 PostgresAdapter 实现了 DBAdapter 接口
func TestPostgresAdapterImplementsInterface(t *testing.T) {
	var _ DBAdapter = (*PostgresAdapter)(nil)
}

// TestPostgresAdapterWithoutConnection 测试未连接状态下的错误处理
func TestPostgresAdapterWithoutConnection(t *testing.T) {
	adapter := NewPostgresAdapter()

	ctx := context.Background()

	// 未连接时应该返回错误
	if err := adapter.Ping(ctx); err == nil {
		t.Error("未连接时 Ping 应该返回错误")
	}

	if _, err := adapter.TableColumns("test"); err == nil {
		t.Error("未连接时 TableColumns 应该返回错误")
	}

	if _, err := adapter.TableInfo("test"); err == nil {
		t.Error("未连接时 TableInfo 应该返回错误")
	}

	if _, err := adapter.TableIndexes("test"); err == nil {
		t.Error("未连接时 TableIndexes 应该返回错误")
	}

	if _, err := adapter.HasTable("test"); err == nil {
		t.Error("未连接时 HasTable 应该返回错误")
	}

	if err := adapter.Vacuum(); err == nil {
		t.Error("未连接时 Vacuum 应该返回错误")
	}
}
