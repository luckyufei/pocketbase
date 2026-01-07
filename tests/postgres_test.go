package tests_test

import (
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// 跳过条件：如果没有 Docker 环境
func skipIfNoDocker(t *testing.T) {
	if os.Getenv("SKIP_DOCKER_TESTS") == "1" {
		t.Skip("跳过 Docker 测试 (SKIP_DOCKER_TESTS=1)")
	}
	// 检查 Docker 是否可用 (支持 Linux 和 macOS/colima)
	dockerSockets := []string{
		"/var/run/docker.sock",                                      // Linux / Docker Desktop
		os.Getenv("HOME") + "/.colima/docker.sock",                  // macOS colima
		os.Getenv("HOME") + "/.colima/default/docker.sock",          // macOS colima (alternative)
		os.Getenv("HOME") + "/.docker/run/docker.sock",              // Docker Desktop for Mac
	}
	
	dockerAvailable := false
	for _, sock := range dockerSockets {
		if _, err := os.Stat(sock); err == nil {
			dockerAvailable = true
			break
		}
	}
	
	if !dockerAvailable {
		t.Skip("跳过 Docker 测试 (Docker 不可用)")
	}
}

func TestNewPostgresContainer(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 验证连接
	if container.DB() == nil {
		t.Fatal("DB() 返回 nil")
	}

	if container.DBX() == nil {
		t.Fatal("DBX() 返回 nil")
	}

	// 验证可以执行查询
	var result int
	err = container.DB().QueryRow("SELECT 1").Scan(&result)
	if err != nil {
		t.Fatalf("执行查询失败: %v", err)
	}
	if result != 1 {
		t.Fatalf("查询结果错误: expected 1, got %d", result)
	}
}

func TestPostgresContainer_Version(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	version, err := container.GetPostgresVersion()
	if err != nil {
		t.Fatalf("获取版本失败: %v", err)
	}

	if !strings.Contains(version, "PostgreSQL 15") {
		t.Fatalf("版本不匹配: expected PostgreSQL 15.x, got %s", version)
	}
}

func TestPostgresContainer_DSN(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	dsn := container.DSN()
	if !strings.HasPrefix(dsn, "postgres://") {
		t.Fatalf("DSN 格式错误: %s", dsn)
	}
	if !strings.Contains(dsn, "pocketbase_test") {
		t.Fatalf("DSN 应包含数据库名称: %s", dsn)
	}
}

func TestPostgresContainer_ExecSQL(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE test_table (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 验证表存在
	exists, err := container.TableExists("test_table")
	if err != nil {
		t.Fatalf("检查表存在失败: %v", err)
	}
	if !exists {
		t.Fatal("表应该存在")
	}

	// 插入数据
	err = container.ExecSQL(`INSERT INTO test_table (name) VALUES ('test')`)
	if err != nil {
		t.Fatalf("插入数据失败: %v", err)
	}

	// 查询数据
	var name string
	err = container.DB().QueryRow("SELECT name FROM test_table WHERE id = 1").Scan(&name)
	if err != nil {
		t.Fatalf("查询数据失败: %v", err)
	}
	if name != "test" {
		t.Fatalf("数据不匹配: expected 'test', got '%s'", name)
	}
}

func TestPostgresContainer_ResetDatabase(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`CREATE TABLE test_reset (id SERIAL PRIMARY KEY)`)
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 验证表存在
	exists, err := container.TableExists("test_reset")
	if err != nil {
		t.Fatalf("检查表存在失败: %v", err)
	}
	if !exists {
		t.Fatal("表应该存在")
	}

	// 重置数据库
	err = container.ResetDatabase()
	if err != nil {
		t.Fatalf("重置数据库失败: %v", err)
	}

	// 验证表不存在
	exists, err = container.TableExists("test_reset")
	if err != nil {
		t.Fatalf("检查表存在失败: %v", err)
	}
	if exists {
		t.Fatal("表应该已被删除")
	}
}

func TestPostgresContainer_DBType(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 验证数据库类型检测
	dbType := dbutils.DetectDBType(container.DBX())
	if !dbType.IsPostgres() {
		t.Fatalf("数据库类型应为 PostgreSQL, got %v", dbType)
	}
}

func TestPostgresContainer_JSONB(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建带 JSONB 字段的表
	err = container.ExecSQL(`
		CREATE TABLE test_jsonb (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL DEFAULT '{}'
		)
	`)
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 插入 JSON 数据
	err = container.ExecSQL(`INSERT INTO test_jsonb (data) VALUES ('{"name": "test", "tags": ["a", "b"]}')`)
	if err != nil {
		t.Fatalf("插入数据失败: %v", err)
	}

	// 使用 JSONB 操作符查询
	var name string
	err = container.DB().QueryRow(`SELECT data->>'name' FROM test_jsonb WHERE id = 1`).Scan(&name)
	if err != nil {
		t.Fatalf("查询 JSONB 失败: %v", err)
	}
	if name != "test" {
		t.Fatalf("JSONB 查询结果错误: expected 'test', got '%s'", name)
	}

	// 使用 jsonb_path_query (PostgreSQL 12+)
	err = container.DB().QueryRow(`SELECT jsonb_path_query_first(data, '$.name') #>> '{}' FROM test_jsonb WHERE id = 1`).Scan(&name)
	if err != nil {
		t.Fatalf("jsonb_path_query 查询失败: %v", err)
	}
	if name != "test" {
		t.Fatalf("jsonb_path_query 结果错误: expected 'test', got '%s'", name)
	}
}
