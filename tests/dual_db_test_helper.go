// Package tests 提供双数据库测试辅助函数
// 允许同一套测试同时在 SQLite 和 PostgreSQL 上运行
package tests

import (
	"fmt"
	"log"
	"os"
	"sync"
	"testing"
	"time"

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

			t.Log("[PostgreSQL] 开始创建测试应用...")

			var app *TestApp
			var err error

			if config.PostgresDSN != "" {
				t.Log("[PostgreSQL] 使用外部 PostgreSQL DSN")
				// 使用外部 PostgreSQL
				app, err = NewTestAppWithConfig(core.BaseAppConfig{
					PostgresDSN: config.PostgresDSN,
				})
			} else {
				t.Log("[PostgreSQL] 使用 Docker PostgreSQL (NewPostgresTestApp)")
				// 使用 Docker PostgreSQL
				app, err = NewPostgresTestApp()
			}

			if err != nil {
				t.Skipf("跳过 PostgreSQL 测试: %v", err)
				return
			}
			defer app.Cleanup()

			t.Log("[PostgreSQL] 测试应用创建成功，开始执行测试")
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
// 该函数会自动从 SQLite 测试数据库导入测试数据到 PostgreSQL
// 每次调用都会创建一个新的独立数据库以保证测试隔离
func NewPostgresTestApp(optTestDataDir ...string) (*TestApp, error) {
	log.Printf("[NewPostgresTestApp] 开始创建 PostgreSQL 测试应用")
	container, err := getSharedPostgresContainer()
	if err != nil {
		log.Printf("[NewPostgresTestApp] 获取 PostgreSQL 容器失败: %v", err)
		return nil, err
	}

	var testDataDir string
	if len(optTestDataDir) > 0 {
		testDataDir = optTestDataDir[0]
	}

	// 为这个测试创建一个独立的数据库
	dbName := fmt.Sprintf("pb_test_%d", time.Now().UnixNano())
	log.Printf("[NewPostgresTestApp] 创建测试数据库: %s", dbName)
	if err := container.CreateDatabaseWithTemplate(dbName); err != nil {
		log.Printf("[NewPostgresTestApp] 创建测试数据库失败: %v", err)
		return nil, fmt.Errorf("创建测试数据库失败: %w", err)
	}

	// 使用新的数据库 DSN
	dsn := container.DSNWithDatabase(dbName)
	log.Printf("[NewPostgresTestApp] 使用 DSN: %s", dsn)

	app, err := NewTestAppWithConfig(core.BaseAppConfig{
		DataDir:     testDataDir,
		PostgresDSN: dsn,
	})
	if err != nil {
		log.Printf("[NewPostgresTestApp] 创建 TestApp 失败: %v", err)
		// 清理创建的数据库
		container.DropDatabase(dbName)
		return nil, err
	}

	log.Printf("[NewPostgresTestApp] TestApp 创建成功，开始导入测试数据")
	// 导入 SQLite 测试数据到 PostgreSQL
	if err := ImportTestDataToPostgres(app.BaseApp); err != nil {
		log.Printf("[NewPostgresTestApp] 导入测试数据失败: %v", err)
		app.Cleanup()
		container.DropDatabase(dbName)
		return nil, fmt.Errorf("导入测试数据到 PostgreSQL 失败: %w", err)
	}

	log.Printf("[NewPostgresTestApp] PostgreSQL 测试应用创建完成")
	return app, nil
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

// NewTestAppByType 根据数据库类型创建测试应用
// 该函数在需要在子测试中创建独立 app 时使用，以保证测试隔离
// 使用方式:
//
//	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
//	    for _, s := range scenarios {
//	        t.Run(s.name, func(t *testing.T) {
//	            testApp, _ := tests.NewTestAppByType(dbType)
//	            defer testApp.Cleanup()
//	            // 使用 testApp 进行测试
//	        })
//	    }
//	})
func NewTestAppByType(dbType DBType, optTestDataDir ...string) (*TestApp, error) {
	switch dbType {
	case DBTypePostgres:
		return NewPostgresTestApp(optTestDataDir...)
	default:
		return NewTestApp(optTestDataDir...)
	}
}
