package core_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func TestIsPostgresDSN(t *testing.T) {
	scenarios := []struct {
		name     string
		dsn      string
		expected bool
	}{
		{
			name:     "postgres:// prefix",
			dsn:      "postgres://user:pass@localhost:5432/dbname",
			expected: true,
		},
		{
			name:     "postgresql:// prefix",
			dsn:      "postgresql://user:pass@localhost:5432/dbname",
			expected: true,
		},
		{
			name:     "postgres:// with params",
			dsn:      "postgres://user:pass@localhost:5432/dbname?sslmode=disable",
			expected: true,
		},
		{
			name:     "key=value format with host",
			dsn:      "host=localhost port=5432 user=postgres dbname=test",
			expected: true,
		},
		{
			name:     "key=value format with dbname",
			dsn:      "dbname=test user=postgres",
			expected: true,
		},
		{
			name:     "SQLite file path",
			dsn:      "/path/to/data.db",
			expected: false,
		},
		{
			name:     "SQLite relative path",
			dsn:      "data.db",
			expected: false,
		},
		{
			name:     "SQLite memory",
			dsn:      ":memory:",
			expected: false,
		},
		{
			name:     "SQLite with extension .sqlite",
			dsn:      "test.sqlite",
			expected: false,
		},
		{
			name:     "SQLite with extension .sqlite3",
			dsn:      "test.sqlite3",
			expected: false,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := core.IsPostgresDSN(s.dsn)
			if result != s.expected {
				t.Fatalf("Expected %v for DSN %q, got %v", s.expected, s.dsn, result)
			}
		})
	}
}

func TestIsSQLitePath(t *testing.T) {
	scenarios := []struct {
		name     string
		path     string
		expected bool
	}{
		{
			name:     ".db extension",
			path:     "/path/to/data.db",
			expected: true,
		},
		{
			name:     ".sqlite extension",
			path:     "test.sqlite",
			expected: true,
		},
		{
			name:     ".sqlite3 extension",
			path:     "test.sqlite3",
			expected: true,
		},
		{
			name:     "memory database",
			path:     ":memory:",
			expected: true,
		},
		{
			name:     "memory mode",
			path:     "file::memory:?cache=shared",
			expected: true,
		},
		{
			name:     "postgres DSN",
			path:     "postgres://localhost/test",
			expected: false,
		},
		{
			name:     "postgresql DSN",
			path:     "postgresql://localhost/test",
			expected: false,
		},
		{
			name:     "relative path without extension",
			path:     "data",
			expected: true, // 默认假设是 SQLite
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := core.IsSQLitePath(s.path)
			if result != s.expected {
				t.Fatalf("Expected %v for path %q, got %v", s.expected, s.path, result)
			}
		})
	}
}

func TestDefaultPostgresConfig(t *testing.T) {
	dsn := "postgres://user:pass@localhost:5432/dbname"
	config := core.DefaultPostgresConfig(dsn)

	if config.DSN != dsn {
		t.Fatalf("Expected DSN %q, got %q", dsn, config.DSN)
	}

	if config.MaxOpenConns != 25 {
		t.Fatalf("Expected MaxOpenConns 25, got %d", config.MaxOpenConns)
	}

	if config.MaxIdleConns != 5 {
		t.Fatalf("Expected MaxIdleConns 5, got %d", config.MaxIdleConns)
	}
}

// 注意：PostgresDBConnect 的实际连接测试需要 Docker 环境
// 这里只测试配置验证逻辑
func TestPostgresDBConnect_EmptyDSN(t *testing.T) {
	config := core.PostgresConfig{DSN: ""}
	_, err := core.PostgresDBConnect(config)

	if err == nil {
		t.Fatal("Expected error for empty DSN")
	}
}
