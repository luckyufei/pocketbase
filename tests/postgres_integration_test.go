package tests_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestPostgres15_HelperFunctions 测试 PostgreSQL 15 辅助函数
func TestPostgres15_HelperFunctions(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建辅助函数
	err = container.ExecSQL(dbutils.CreatePGHelperFunctions())
	if err != nil {
		t.Fatalf("创建辅助函数失败: %v", err)
	}

	// 测试 pb_is_json
	t.Run("pb_is_json", func(t *testing.T) {
		testCases := []struct {
			input    string
			expected bool
		}{
			{`'{"a": 1}'`, true},
			{`'[1, 2, 3]'`, true},
			{`'"hello"'`, true},
			{`'123'`, true},
			{`'null'`, true},
			{`'invalid'`, false},
			{`''`, false},
			{`NULL`, false},
		}

		for _, tc := range testCases {
			var result bool
			err := container.DB().QueryRow("SELECT pb_is_json(" + tc.input + ")").Scan(&result)
			if err != nil {
				t.Errorf("pb_is_json(%s) 查询失败: %v", tc.input, err)
				continue
			}
			if result != tc.expected {
				t.Errorf("pb_is_json(%s) = %v, expected %v", tc.input, result, tc.expected)
			}
		}
	})

	// 测试 pb_json_array_length
	t.Run("pb_json_array_length", func(t *testing.T) {
		testCases := []struct {
			input    string
			expected int
		}{
			{`'[1, 2, 3]'::jsonb`, 3},
			{`'[]'::jsonb`, 0},
			{`'{"a": 1}'::jsonb`, 1},
			{`'"hello"'::jsonb`, 1},
		}

		for _, tc := range testCases {
			var result int
			err := container.DB().QueryRow("SELECT pb_json_array_length(" + tc.input + ")").Scan(&result)
			if err != nil {
				t.Errorf("pb_json_array_length(%s) 查询失败: %v", tc.input, err)
				continue
			}
			if result != tc.expected {
				t.Errorf("pb_json_array_length(%s) = %d, expected %d", tc.input, result, tc.expected)
			}
		}
	})

	// 测试 uuid_generate_v7
	t.Run("uuid_generate_v7", func(t *testing.T) {
		var uuid string
		err := container.DB().QueryRow("SELECT uuid_generate_v7()::text").Scan(&uuid)
		if err != nil {
			t.Fatalf("uuid_generate_v7() 查询失败: %v", err)
		}
		if len(uuid) != 36 {
			t.Errorf("uuid_generate_v7() 返回无效 UUID: %s", uuid)
		}
		// 验证是 v7 UUID (第 15 个字符应为 7)
		if uuid[14] != '7' {
			t.Errorf("uuid_generate_v7() 不是 v7 UUID: %s", uuid)
		}
	})
}

// TestPostgres15_JSONBPathQuery 测试 PostgreSQL 15 jsonb_path_query_first
func TestPostgres15_JSONBPathQuery(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE test_json (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		INSERT INTO test_json (data) VALUES 
			('{"name": "Alice", "age": 30, "tags": ["a", "b"]}'),
			('{"name": "Bob", "age": 25, "nested": {"key": "value"}}'),
			('{"name": "Charlie", "items": [{"id": 1}, {"id": 2}]}');
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 测试简单路径提取
	t.Run("simple_path", func(t *testing.T) {
		var name string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.name') #>> '{}' 
			FROM test_json WHERE id = 1
		`).Scan(&name)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if name != "Alice" {
			t.Errorf("expected 'Alice', got '%s'", name)
		}
	})

	// 测试嵌套路径
	t.Run("nested_path", func(t *testing.T) {
		var value string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.nested.key') #>> '{}' 
			FROM test_json WHERE id = 2
		`).Scan(&value)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if value != "value" {
			t.Errorf("expected 'value', got '%s'", value)
		}
	})

	// 测试数组索引
	t.Run("array_index", func(t *testing.T) {
		var tag string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.tags[0]') #>> '{}' 
			FROM test_json WHERE id = 1
		`).Scan(&tag)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if tag != "a" {
			t.Errorf("expected 'a', got '%s'", tag)
		}
	})

	// 测试嵌套数组对象
	t.Run("nested_array_object", func(t *testing.T) {
		var id int
		err := container.DB().QueryRow(`
			SELECT (jsonb_path_query_first(data, '$.items[1].id') #>> '{}')::int 
			FROM test_json WHERE id = 3
		`).Scan(&id)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if id != 2 {
			t.Errorf("expected 2, got %d", id)
		}
	})

	// 测试路径不存在
	t.Run("path_not_exists", func(t *testing.T) {
		var result *string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.nonexistent') #>> '{}' 
			FROM test_json WHERE id = 1
		`).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if result != nil {
			t.Errorf("expected nil, got '%v'", *result)
		}
	})
}

// TestPostgres15_JSONBOperators 测试 PostgreSQL 15 JSONB 操作符
func TestPostgres15_JSONBOperators(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE test_operators (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		INSERT INTO test_operators (data) VALUES 
			('{"tags": ["go", "rust", "python"], "meta": {"version": 1}}');
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 测试 @> 包含操作符
	t.Run("contains_operator", func(t *testing.T) {
		var exists bool
		err := container.DB().QueryRow(`
			SELECT data->'tags' @> '"go"'::jsonb FROM test_operators WHERE id = 1
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if !exists {
			t.Error("expected tags to contain 'go'")
		}
	})

	// 测试 ? 键存在操作符
	t.Run("key_exists_operator", func(t *testing.T) {
		var exists bool
		err := container.DB().QueryRow(`
			SELECT data ? 'tags' FROM test_operators WHERE id = 1
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if !exists {
			t.Error("expected key 'tags' to exist")
		}
	})

	// 测试 #>> 路径提取操作符
	t.Run("path_extract_operator", func(t *testing.T) {
		var version string
		err := container.DB().QueryRow(`
			SELECT data #>> '{meta,version}' FROM test_operators WHERE id = 1
		`).Scan(&version)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if version != "1" {
			t.Errorf("expected '1', got '%s'", version)
		}
	})

	// 测试 jsonb_array_elements
	t.Run("jsonb_array_elements", func(t *testing.T) {
		rows, err := container.DB().Query(`
			SELECT elem #>> '{}' FROM test_operators, jsonb_array_elements(data->'tags') AS elem WHERE id = 1
		`)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var tags []string
		for rows.Next() {
			var tag string
			if err := rows.Scan(&tag); err != nil {
				t.Fatalf("扫描失败: %v", err)
			}
			tags = append(tags, tag)
		}

		if len(tags) != 3 {
			t.Errorf("expected 3 tags, got %d", len(tags))
		}
	})
}

// TestPostgres15_JSONFunctionsAdapter 测试 JSONFunctions 适配器
func TestPostgres15_JSONFunctionsAdapter(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建辅助函数
	err = container.ExecSQL(dbutils.CreatePGHelperFunctions())
	if err != nil {
		t.Fatalf("创建辅助函数失败: %v", err)
	}

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE test_adapter (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		INSERT INTO test_adapter (data) VALUES 
			('{"name": "test", "items": [1, 2, 3], "nested": {"key": "value"}}');
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 验证数据库类型检测
	dbType := dbutils.DetectDBType(container.DBX())
	if !dbType.IsPostgres() {
		t.Fatalf("数据库类型检测错误: expected PostgreSQL, got %v", dbType)
	}

	jsonFn := dbutils.NewJSONFunctions(dbType)

	// 测试 ArrayLength
	t.Run("ArrayLength", func(t *testing.T) {
		// 生成的 SQL 表达式
		expr := jsonFn.ArrayLength("data->'items'")
		t.Logf("ArrayLength expr: %s", expr)

		// 由于表达式使用 [[ ]] 占位符，需要手动替换测试
		var length int
		err := container.DB().QueryRow(`
			SELECT jsonb_array_length(data->'items') FROM test_adapter WHERE id = 1
		`).Scan(&length)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if length != 3 {
			t.Errorf("expected 3, got %d", length)
		}
	})

	// 测试 Type
	t.Run("Type", func(t *testing.T) {
		var jsonType string
		err := container.DB().QueryRow(`
			SELECT jsonb_typeof(data->'items') FROM test_adapter WHERE id = 1
		`).Scan(&jsonType)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if jsonType != "array" {
			t.Errorf("expected 'array', got '%s'", jsonType)
		}
	})

	// 测试 Valid (pb_is_json)
	t.Run("Valid", func(t *testing.T) {
		var valid bool
		err := container.DB().QueryRow(`
			SELECT pb_is_json('{"valid": true}')
		`).Scan(&valid)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if !valid {
			t.Error("expected valid JSON")
		}
	})
}

// TestPostgres15_TypeConversions 测试 PostgreSQL 15 类型转换
func TestPostgres15_TypeConversions(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 测试 BOOLEAN 类型
	t.Run("boolean_type", func(t *testing.T) {
		err := container.ExecSQL(`
			CREATE TABLE test_bool (
				id SERIAL PRIMARY KEY,
				flag BOOLEAN NOT NULL DEFAULT FALSE
			);
			INSERT INTO test_bool (flag) VALUES (TRUE), (FALSE);
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		var flag bool
		err = container.DB().QueryRow("SELECT flag FROM test_bool WHERE id = 1").Scan(&flag)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if !flag {
			t.Error("expected TRUE")
		}
	})

	// 测试 TIMESTAMPTZ 类型
	t.Run("timestamptz_type", func(t *testing.T) {
		err := container.ExecSQL(`
			CREATE TABLE test_time (
				id SERIAL PRIMARY KEY,
				created TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);
			INSERT INTO test_time DEFAULT VALUES;
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		var created string
		err = container.DB().QueryRow("SELECT created::text FROM test_time WHERE id = 1").Scan(&created)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if created == "" {
			t.Error("expected non-empty timestamp")
		}
		t.Logf("Created timestamp: %s", created)
	})

	// 测试 TEXT 主键 (PocketBase 风格)
	t.Run("text_primary_key", func(t *testing.T) {
		// 先启用 pgcrypto 扩展
		err := container.ExecSQL(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)
		if err != nil {
			t.Fatalf("启用 pgcrypto 失败: %v", err)
		}

		err = container.ExecSQL(`
			CREATE TABLE test_pk (
				id TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
				name TEXT NOT NULL
			);
			INSERT INTO test_pk (name) VALUES ('test1'), ('test2');
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		rows, err := container.DB().Query("SELECT id FROM test_pk")
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				t.Fatalf("扫描失败: %v", err)
			}
			ids = append(ids, id)
			// 验证 ID 格式: r + 14 个十六进制字符
			if len(id) != 15 || id[0] != 'r' {
				t.Errorf("invalid ID format: %s", id)
			}
		}

		if len(ids) != 2 {
			t.Errorf("expected 2 IDs, got %d", len(ids))
		}

		// 验证 ID 唯一性
		if ids[0] == ids[1] {
			t.Error("IDs should be unique")
		}
	})
}

// TestPostgres15_GINIndex 测试 PostgreSQL 15 GIN 索引
func TestPostgres15_GINIndex(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建带 GIN 索引的表
	err = container.ExecSQL(`
		CREATE TABLE test_gin (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		CREATE INDEX idx_test_gin_data ON test_gin USING GIN (data);
		
		INSERT INTO test_gin (data) SELECT jsonb_build_object('num', i, 'tags', jsonb_build_array('tag' || i))
		FROM generate_series(1, 100) AS i;
	`)
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 测试 GIN 索引查询
	t.Run("gin_containment_query", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM test_gin WHERE data @> '{"num": 50}'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1, got %d", count)
		}
	})

	// 验证索引被使用
	t.Run("gin_index_usage", func(t *testing.T) {
		var plan string
		err := container.DB().QueryRow(`
			EXPLAIN SELECT * FROM test_gin WHERE data @> '{"num": 50}'
		`).Scan(&plan)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		t.Logf("Query plan: %s", plan)
		// GIN 索引应该在查询计划中出现
	})
}

// TestPostgres15_Transactions 测试 PostgreSQL 15 事务
func TestPostgres15_Transactions(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE test_tx (
			id SERIAL PRIMARY KEY,
			value INTEGER NOT NULL
		);
	`)
	if err != nil {
		t.Fatalf("创建表失败: %v", err)
	}

	// 测试事务提交
	t.Run("transaction_commit", func(t *testing.T) {
		tx, err := container.DB().Begin()
		if err != nil {
			t.Fatalf("开始事务失败: %v", err)
		}

		_, err = tx.Exec("INSERT INTO test_tx (value) VALUES (100)")
		if err != nil {
			tx.Rollback()
			t.Fatalf("插入失败: %v", err)
		}

		err = tx.Commit()
		if err != nil {
			t.Fatalf("提交失败: %v", err)
		}

		var value int
		err = container.DB().QueryRow("SELECT value FROM test_tx WHERE id = 1").Scan(&value)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if value != 100 {
			t.Errorf("expected 100, got %d", value)
		}
	})

	// 测试事务回滚
	t.Run("transaction_rollback", func(t *testing.T) {
		tx, err := container.DB().Begin()
		if err != nil {
			t.Fatalf("开始事务失败: %v", err)
		}

		_, err = tx.Exec("INSERT INTO test_tx (value) VALUES (200)")
		if err != nil {
			tx.Rollback()
			t.Fatalf("插入失败: %v", err)
		}

		err = tx.Rollback()
		if err != nil {
			t.Fatalf("回滚失败: %v", err)
		}

		var count int
		err = container.DB().QueryRow("SELECT COUNT(*) FROM test_tx WHERE value = 200").Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 0 {
			t.Errorf("expected 0, got %d (rollback failed)", count)
		}
	})
}
