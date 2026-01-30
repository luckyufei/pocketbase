// Package tests 提供双数据库测试辅助函数
// 允许同一套测试同时在 SQLite 和 PostgreSQL 上运行
package tests

import (
	"os"
	"sync"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// DBType 表示数据库类型
type DBType string

const (
	DBTypeSQLite   DBType = "sqlite"
	DBTypePostgres DBType = "postgres"
)

// DualDBTestConfig 配置双数据库测试
type DualDBTestConfig struct {
	// TestSQLite 是否测试 SQLite（默认 true）
	TestSQLite bool
	// TestPostgres 是否测试 PostgreSQL（默认取决于环境变量）
	TestPostgres bool
	// PostgresDSN 自定义 PostgreSQL 连接字符串（可选）
	PostgresDSN string
}

// DefaultDualDBTestConfig 返回默认配置
func DefaultDualDBTestConfig() DualDBTestConfig {
	return DualDBTestConfig{
		TestSQLite:   true,
		TestPostgres: os.Getenv("TEST_POSTGRES") != "" || os.Getenv("POSTGRES_DSN") != "",
		PostgresDSN:  os.Getenv("POSTGRES_DSN"),
	}
}

// DualDBTest 在 SQLite 和 PostgreSQL 上运行相同的测试
// 使用方式:
//
//	func TestSomething(t *testing.T) {
//	    tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
//	        // 你的测试代码
//	    })
//	}
func DualDBTest(t *testing.T, testFunc func(t *testing.T, app *TestApp, dbType DBType), configs ...DualDBTestConfig) {
	t.Helper()

	config := DefaultDualDBTestConfig()
	if len(configs) > 0 {
		config = configs[0]
	}

	// SQLite 测试
	if config.TestSQLite {
		t.Run("SQLite", func(t *testing.T) {
			t.Parallel()
			app, err := NewTestApp()
			if err != nil {
				t.Fatalf("创建 SQLite 测试应用失败: %v", err)
			}
			defer app.Cleanup()

			testFunc(t, app, DBTypeSQLite)
		})
	}

	// PostgreSQL 测试
	if config.TestPostgres {
		t.Run("PostgreSQL", func(t *testing.T) {
			t.Parallel()

			var app *TestApp
			var err error

			if config.PostgresDSN != "" {
				// 使用外部 PostgreSQL
				app, err = NewTestAppWithConfig(core.BaseAppConfig{
					PostgresDSN: config.PostgresDSN,
				})
			} else {
				// 使用 Docker PostgreSQL
				app, err = NewPostgresTestApp()
			}

			if err != nil {
				t.Skipf("跳过 PostgreSQL 测试: %v", err)
				return
			}
			defer app.Cleanup()

			testFunc(t, app, DBTypePostgres)
		})
	}
}

// DualDBTestWithSetup 带自定义设置的双数据库测试
func DualDBTestWithSetup(
	t *testing.T,
	setup func(app *TestApp) error,
	testFunc func(t *testing.T, app *TestApp, dbType DBType),
	configs ...DualDBTestConfig,
) {
	t.Helper()

	DualDBTest(t, func(t *testing.T, app *TestApp, dbType DBType) {
		if setup != nil {
			if err := setup(app); err != nil {
				t.Fatalf("测试设置失败 (%s): %v", dbType, err)
			}
		}
		testFunc(t, app, dbType)
	}, configs...)
}

// postgresTestAppPool 管理 PostgreSQL 容器的复用
var (
	postgresContainer     *PostgresContainer
	postgresContainerOnce sync.Once
	postgresContainerErr  error
)

// getSharedPostgresContainer 获取共享的 PostgreSQL 容器
func getSharedPostgresContainer() (*PostgresContainer, error) {
	postgresContainerOnce.Do(func() {
		postgresContainer, postgresContainerErr = NewPostgresContainer()
	})
	return postgresContainer, postgresContainerErr
}

// NewPostgresTestApp 创建使用 PostgreSQL 的测试应用
func NewPostgresTestApp(optTestDataDir ...string) (*TestApp, error) {
	container, err := getSharedPostgresContainer()
	if err != nil {
		return nil, err
	}

	var testDataDir string
	if len(optTestDataDir) > 0 {
		testDataDir = optTestDataDir[0]
	}

	return NewTestAppWithConfig(core.BaseAppConfig{
		DataDir:     testDataDir,
		PostgresDSN: container.DSN(),
	})
}

// RunWithBothDBs 为子测试表格同时运行 SQLite 和 PostgreSQL
// 使用方式:
//
//	scenarios := []struct {
//	    name string
//	    // ...
//	}{}
//
//	for _, s := range scenarios {
//	    tests.RunWithBothDBs(t, s.name, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
//	        // 测试代码
//	    })
//	}
func RunWithBothDBs(t *testing.T, name string, testFunc func(t *testing.T, app *TestApp, dbType DBType), configs ...DualDBTestConfig) {
	t.Helper()
	t.Run(name, func(t *testing.T) {
		DualDBTest(t, testFunc, configs...)
	})
}

// RequirePostgres 确保 PostgreSQL 可用，否则跳过测试
func RequirePostgres(t *testing.T) *PostgresContainer {
	t.Helper()

	if os.Getenv("TEST_POSTGRES") == "" && os.Getenv("POSTGRES_DSN") == "" {
		t.Skip("跳过 PostgreSQL 测试 (设置 TEST_POSTGRES=1 或 POSTGRES_DSN 启用)")
	}

	container, err := getSharedPostgresContainer()
	if err != nil {
		t.Skipf("无法启动 PostgreSQL 容器: %v", err)
	}

	return container
}

// SkipIfNotPostgres 如果不是 PostgreSQL 则跳过
func SkipIfNotPostgres(t *testing.T, dbType DBType) {
	t.Helper()
	if dbType != DBTypePostgres {
		t.Skip("此测试仅适用于 PostgreSQL")
	}
}

// SkipIfNotSQLite 如果不是 SQLite 则跳过
func SkipIfNotSQLite(t *testing.T, dbType DBType) {
	t.Helper()
	if dbType != DBTypeSQLite {
		t.Skip("此测试仅适用于 SQLite")
	}
}
