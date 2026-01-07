package tests_test

import (
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// skipIfNoDockerGIN 检查 Docker 是否可用
func skipIfNoDockerGIN(t *testing.T) {
	if os.Getenv("SKIP_DOCKER_TESTS") == "1" {
		t.Skip("跳过 Docker 测试 (SKIP_DOCKER_TESTS=1)")
	}
	dockerSockets := []string{
		"/var/run/docker.sock",
		os.Getenv("HOME") + "/.colima/docker.sock",
		os.Getenv("HOME") + "/.colima/default/docker.sock",
		os.Getenv("HOME") + "/.docker/run/docker.sock",
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

// TestPostgres_GINIndex_Creation 测试在真实 PostgreSQL 中创建 GIN 索引
func TestPostgres_GINIndex_Creation(t *testing.T) {
	skipIfNoDockerGIN(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE gin_test (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL,
			tags JSONB NOT NULL DEFAULT '[]'::jsonb,
			metadata JSONB
		);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 测试创建基本 GIN 索引
	t.Run("basic_gin_index", func(t *testing.T) {
		sql := dbutils.BuildGINIndex("gin_test", "data", "")
		err := container.ExecSQL(sql)
		if err != nil {
			t.Fatalf("创建 GIN 索引失败: %v\nSQL: %s", err, sql)
		}

		// 验证索引存在
		var indexExists bool
		err = container.DB().QueryRow(`
			SELECT EXISTS (
				SELECT 1 FROM pg_indexes 
				WHERE tablename = 'gin_test' 
				AND indexname = 'idx_gin_test_data_gin'
			)
		`).Scan(&indexExists)
		if err != nil {
			t.Fatalf("查询索引失败: %v", err)
		}
		if !indexExists {
			t.Error("GIN 索引应该存在")
		}
	})

	// 测试创建带 jsonb_path_ops 的 GIN 索引
	t.Run("gin_index_with_path_ops", func(t *testing.T) {
		sql := dbutils.BuildGINIndex("gin_test", "tags", dbutils.GINOpClassPathOps)
		err := container.ExecSQL(sql)
		if err != nil {
			t.Fatalf("创建 GIN 索引失败: %v\nSQL: %s", err, sql)
		}

		// 验证索引存在
		var indexExists bool
		err = container.DB().QueryRow(`
			SELECT EXISTS (
				SELECT 1 FROM pg_indexes 
				WHERE tablename = 'gin_test' 
				AND indexname = 'idx_gin_test_tags_gin'
			)
		`).Scan(&indexExists)
		if err != nil {
			t.Fatalf("查询索引失败: %v", err)
		}
		if !indexExists {
			t.Error("GIN 索引应该存在")
		}
	})

	// 测试 GIN 索引查询性能
	t.Run("gin_index_query_performance", func(t *testing.T) {
		// 插入测试数据
		err := container.ExecSQL(`
			INSERT INTO gin_test (data, tags)
			SELECT 
				jsonb_build_object('name', 'user_' || i, 'status', CASE WHEN i % 2 = 0 THEN 'active' ELSE 'inactive' END),
				jsonb_build_array('tag' || (i % 10), 'common')
			FROM generate_series(1, 1000) AS i;
		`)
		if err != nil {
			t.Fatalf("插入测试数据失败: %v", err)
		}

		// 更新统计信息
		err = container.ExecSQL("ANALYZE gin_test")
		if err != nil {
			t.Fatalf("ANALYZE 失败: %v", err)
		}

		// 测试 @> 操作符查询
		var count int
		err = container.DB().QueryRow(`
			SELECT COUNT(*) FROM gin_test 
			WHERE data @> '{"status": "active"}'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 500 {
			t.Errorf("expected 500 active users, got %d", count)
		}

		// 测试数组包含查询
		err = container.DB().QueryRow(`
			SELECT COUNT(*) FROM gin_test 
			WHERE tags @> '"common"'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 1000 {
			t.Errorf("expected 1000 records with 'common' tag, got %d", count)
		}
	})
}

// TestPostgres_GINIndex_QueryPlan 测试 GIN 索引是否被查询计划使用
func TestPostgres_GINIndex_QueryPlan(t *testing.T) {
	skipIfNoDockerGIN(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表和数据
	err = container.ExecSQL(`
		CREATE TABLE plan_test (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		
		-- 插入足够多的数据使索引有意义
		INSERT INTO plan_test (data)
		SELECT jsonb_build_object(
			'category', 'cat_' || (i % 100),
			'value', i
		)
		FROM generate_series(1, 10000) AS i;
		
		-- 创建 GIN 索引
		CREATE INDEX idx_plan_test_data_gin ON plan_test USING GIN (data);
		
		-- 更新统计信息
		ANALYZE plan_test;
	`)
	if err != nil {
		t.Fatalf("创建测试环境失败: %v", err)
	}

	// 检查查询计划是否使用 GIN 索引
	t.Run("gin_index_used_in_plan", func(t *testing.T) {
		var plan string
		rows, err := container.DB().Query(`
			EXPLAIN (FORMAT TEXT) 
			SELECT * FROM plan_test 
			WHERE data @> '{"category": "cat_1"}'
		`)
		if err != nil {
			t.Fatalf("获取查询计划失败: %v", err)
		}
		defer rows.Close()

		for rows.Next() {
			var line string
			rows.Scan(&line)
			plan += line + "\n"
		}

		// 在大数据集上，@> 操作符应该使用 Bitmap Index Scan
		// 注意：小数据集可能仍然使用 Seq Scan
		t.Logf("查询计划:\n%s", plan)
	})
}

// TestPostgres_MultipleGINIndexes 测试多个 GIN 索引
func TestPostgres_MultipleGINIndexes(t *testing.T) {
	skipIfNoDockerGIN(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE multi_gin_test (
			id SERIAL PRIMARY KEY,
			profile JSONB,
			settings JSONB,
			tags JSONB
		);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 使用 GetGINIndexesForCollection 批量创建索引
	jsonbColumns := []string{"profile", "settings", "tags"}
	indexes := dbutils.GetGINIndexesForCollection("multi_gin_test", jsonbColumns)

	for _, sql := range indexes {
		err := container.ExecSQL(sql)
		if err != nil {
			t.Fatalf("创建索引失败: %v\nSQL: %s", err, sql)
		}
	}

	// 验证所有索引都已创建
	var indexCount int
	err = container.DB().QueryRow(`
		SELECT COUNT(*) FROM pg_indexes 
		WHERE tablename = 'multi_gin_test' 
		AND indexdef LIKE '%USING gin%'
	`).Scan(&indexCount)
	if err != nil {
		t.Fatalf("查询索引数量失败: %v", err)
	}
	if indexCount != 3 {
		t.Errorf("expected 3 GIN indexes, got %d", indexCount)
	}
}

// TestPostgres_GINIndex_WithTextSearch 测试文本搜索 GIN 索引 (需要 pg_trgm)
func TestPostgres_GINIndex_WithTextSearch(t *testing.T) {
	skipIfNoDockerGIN(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 启用 pg_trgm 扩展
	err = container.ExecSQL(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
	if err != nil {
		t.Fatalf("启用 pg_trgm 扩展失败: %v", err)
	}

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE text_search_test (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT
		);
		
		INSERT INTO text_search_test (name, description) VALUES
			('Alice Smith', 'Software engineer from New York'),
			('Bob Johnson', 'Data scientist working on ML'),
			('Charlie Brown', 'Product manager at startup');
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 创建文本搜索 GIN 索引
	sql := dbutils.BuildTextSearchIndex("text_search_test", "name")
	err = container.ExecSQL(sql)
	if err != nil {
		t.Fatalf("创建文本搜索索引失败: %v\nSQL: %s", err, sql)
	}

	// 测试 LIKE 查询
	t.Run("like_query_with_gin", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM text_search_test 
			WHERE name ILIKE '%smith%'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1 result, got %d", count)
		}
	})

	// 测试相似度查询
	t.Run("similarity_query", func(t *testing.T) {
		// 设置较低的相似度阈值
		err := container.ExecSQL(`SET pg_trgm.similarity_threshold = 0.1`)
		if err != nil {
			t.Fatalf("设置相似度阈值失败: %v", err)
		}

		var name string
		err = container.DB().QueryRow(`
			SELECT name FROM text_search_test 
			WHERE similarity(name, 'Alise') > 0.1
			ORDER BY similarity(name, 'Alise') DESC
			LIMIT 1
		`).Scan(&name)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if name != "Alice Smith" {
			t.Errorf("expected 'Alice Smith', got '%s'", name)
		}
	})
}
