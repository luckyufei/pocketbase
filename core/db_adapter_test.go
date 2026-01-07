package core

import (
	"context"
	"testing"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestDBAdapterInterface 测试 DBAdapter 接口定义
func TestDBAdapterInterface(t *testing.T) {
	// 验证接口方法签名存在
	var _ DBAdapter = (*mockDBAdapter)(nil)
}

// mockDBAdapter 用于测试的模拟适配器
type mockDBAdapter struct {
	dbType dbutils.DBType
	config DBConfig
}

func (m *mockDBAdapter) Type() dbutils.DBType {
	return m.dbType
}

func (m *mockDBAdapter) Connect(ctx context.Context, config DBConfig) (*dbx.DB, error) {
	m.config = config
	return nil, nil
}

func (m *mockDBAdapter) Close() error {
	return nil
}

func (m *mockDBAdapter) Ping(ctx context.Context) error {
	return nil
}

func (m *mockDBAdapter) TableColumns(tableName string) ([]string, error) {
	return nil, nil
}

func (m *mockDBAdapter) TableInfo(tableName string) ([]*AdapterTableInfoRow, error) {
	return nil, nil
}

func (m *mockDBAdapter) TableIndexes(tableName string) (map[string]string, error) {
	return nil, nil
}

func (m *mockDBAdapter) HasTable(tableName string) (bool, error) {
	return false, nil
}

func (m *mockDBAdapter) Vacuum() error {
	return nil
}

func (m *mockDBAdapter) BoolValue(val any) bool {
	return false
}

func (m *mockDBAdapter) FormatBool(val bool) any {
	return val
}

func (m *mockDBAdapter) TimeValue(val any) (time.Time, error) {
	return time.Time{}, nil
}

func (m *mockDBAdapter) FormatTime(val time.Time) string {
	return ""
}

func (m *mockDBAdapter) JSONFunctions() *dbutils.JSONFunctions {
	return dbutils.NewJSONFunctions(m.dbType)
}

func (m *mockDBAdapter) NoCaseCollation() string {
	return ""
}

func (m *mockDBAdapter) IsUniqueViolation(err error) bool {
	return false
}

func (m *mockDBAdapter) IsForeignKeyViolation(err error) bool {
	return false
}

// TestDBConfigDefaults 测试 DBConfig 默认值
func TestDBConfigDefaults(t *testing.T) {
	config := DefaultDBConfig("test.db")

	if config.DSN != "test.db" {
		t.Errorf("期望 DSN 为 'test.db', 实际为 '%s'", config.DSN)
	}

	if config.MaxOpenConns <= 0 {
		t.Error("MaxOpenConns 应该有默认值")
	}

	if config.MaxIdleConns <= 0 {
		t.Error("MaxIdleConns 应该有默认值")
	}

	if config.ConnMaxLifetime <= 0 {
		t.Error("ConnMaxLifetime 应该有默认值")
	}

	if config.QueryTimeout <= 0 {
		t.Error("QueryTimeout 应该有默认值")
	}
}

// TestDBConfigPostgresDefaults 测试 PostgreSQL 配置默认值
func TestDBConfigPostgresDefaults(t *testing.T) {
	dsn := "postgres://user:pass@localhost:5432/testdb"
	config := DefaultDBConfig(dsn)

	if config.DSN != dsn {
		t.Errorf("期望 DSN 为 '%s', 实际为 '%s'", dsn, config.DSN)
	}

	// PostgreSQL 应该有更大的连接池
	if config.MaxOpenConns < 10 {
		t.Error("PostgreSQL MaxOpenConns 应该至少为 10")
	}
}

// TestAdapterTableInfoRow 测试 AdapterTableInfoRow 结构
func TestAdapterTableInfoRow(t *testing.T) {
	row := &AdapterTableInfoRow{
		CID:        0,
		Name:       "id",
		Type:       "TEXT",
		NotNull:    true,
		DefaultVal: nil,
		PK:         1,
	}

	if row.Name != "id" {
		t.Errorf("期望 Name 为 'id', 实际为 '%s'", row.Name)
	}

	if !row.NotNull {
		t.Error("期望 NotNull 为 true")
	}

	if row.PK != 1 {
		t.Errorf("期望 PK 为 1, 实际为 %d", row.PK)
	}
}

// TestDetectAdapterType 测试适配器类型检测
func TestDetectAdapterType(t *testing.T) {
	tests := []struct {
		name     string
		dsn      string
		expected dbutils.DBType
	}{
		{
			name:     "SQLite 文件路径",
			dsn:      "/path/to/data.db",
			expected: dbutils.DBTypeSQLite,
		},
		{
			name:     "SQLite 内存数据库",
			dsn:      ":memory:",
			expected: dbutils.DBTypeSQLite,
		},
		{
			name:     "PostgreSQL URL",
			dsn:      "postgres://user:pass@localhost:5432/db",
			expected: dbutils.DBTypePostgres,
		},
		{
			name:     "PostgreSQL URL (postgresql://)",
			dsn:      "postgresql://user:pass@localhost:5432/db",
			expected: dbutils.DBTypePostgres,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DetectAdapterType(tt.dsn)
			if result != tt.expected {
				t.Errorf("DetectAdapterType(%s) = %v, 期望 %v", tt.dsn, result, tt.expected)
			}
		})
	}
}

// TestNewDBAdapter 测试适配器工厂函数
func TestNewDBAdapter(t *testing.T) {
	tests := []struct {
		name         string
		dsn          string
		expectedType dbutils.DBType
	}{
		{
			name:         "创建 SQLite 适配器",
			dsn:          ":memory:",
			expectedType: dbutils.DBTypeSQLite,
		},
		{
			name:         "创建 PostgreSQL 适配器",
			dsn:          "postgres://localhost/test",
			expectedType: dbutils.DBTypePostgres,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adapter := NewDBAdapter(tt.dsn)
			if adapter == nil {
				t.Fatal("NewDBAdapter 返回了 nil")
			}

			if adapter.Type() != tt.expectedType {
				t.Errorf("期望类型 %v, 实际为 %v", tt.expectedType, adapter.Type())
			}
		})
	}
}
