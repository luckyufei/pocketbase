package analytics

import (
	"testing"

	"github.com/pocketbase/dbx"
)

// TestNewRepositorySQLite 测试创建 SQLite Repository
func TestNewRepositorySQLite(t *testing.T) {
	// 由于需要真实数据库连接，这里只测试创建函数
	repo := NewRepositorySQLite(nil)
	if repo == nil {
		t.Fatal("NewRepositorySQLite returned nil")
	}
}

// TestNewRepositoryPostgres 测试创建 PostgreSQL Repository
func TestNewRepositoryPostgres(t *testing.T) {
	repo := NewRepositoryPostgres(nil)
	if repo == nil {
		t.Fatal("NewRepositoryPostgres returned nil")
	}
}

// TestRepositorySQLiteClose 测试关闭 SQLite Repository
func TestRepositorySQLiteClose(t *testing.T) {
	repo := NewRepositorySQLite(nil)
	err := repo.Close()
	if err != nil {
		t.Errorf("Close() error = %v, want nil", err)
	}
}

// TestRepositoryPostgresClose 测试关闭 PostgreSQL Repository
func TestRepositoryPostgresClose(t *testing.T) {
	repo := NewRepositoryPostgres(nil)
	err := repo.Close()
	if err != nil {
		t.Errorf("Close() error = %v, want nil", err)
	}
}

// TestRepositorySQLiteInterface 确保 RepositorySQLite 实现了 Repository 接口
func TestRepositorySQLiteInterface(t *testing.T) {
	var _ Repository = (*RepositorySQLite)(nil)
}

// TestRepositoryPostgresInterface 确保 RepositoryPostgres 实现了 Repository 接口
func TestRepositoryPostgresInterface(t *testing.T) {
	var _ Repository = (*RepositoryPostgres)(nil)
}

// mockDB 是一个简单的 mock dbx.Builder
// 用于测试 repository 的基本行为
type mockDB struct {
	dbx.Builder
}

// 注意：完整的 repository 测试需要真实数据库连接
// 以下测试在 Phase 4 迁移测试文件时从 core 目录移动
// 参见：core/analytics_repository_sqlite_test.go
