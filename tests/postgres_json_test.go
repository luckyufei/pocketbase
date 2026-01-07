package tests_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestPostgres_JSONPathConversion 测试 JSON 路径转换
func TestPostgres_JSONPathConversion(t *testing.T) {
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

	// 创建测试数据
	err = container.ExecSQL(`
		CREATE TABLE records (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		INSERT INTO records (data) VALUES 
			('{"name": "Alice", "age": 30, "email": "alice@example.com"}'),
			('{"name": "Bob", "age": 25, "tags": ["developer", "golang"]}'),
			('{"name": "Charlie", "profile": {"bio": "Hello", "links": [{"url": "https://example.com"}]}}'),
			('{"items": [{"id": 1, "name": "Item1"}, {"id": 2, "name": "Item2"}]}'),
			('{"nested": {"deep": {"value": 42}}}');
	`)
	if err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	// 测试简单字段提取
	t.Run("simple_field_extract", func(t *testing.T) {
		var name string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.name') #>> '{}'
			FROM records WHERE id = 1
		`).Scan(&name)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if name != "Alice" {
			t.Errorf("expected 'Alice', got '%s'", name)
		}
	})

	// 测试嵌套字段提取
	t.Run("nested_field_extract", func(t *testing.T) {
		var bio string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.profile.bio') #>> '{}'
			FROM records WHERE id = 3
		`).Scan(&bio)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if bio != "Hello" {
			t.Errorf("expected 'Hello', got '%s'", bio)
		}
	})

	// 测试深层嵌套
	t.Run("deep_nested_extract", func(t *testing.T) {
		var value int
		err := container.DB().QueryRow(`
			SELECT (jsonb_path_query_first(data, '$.nested.deep.value') #>> '{}')::int
			FROM records WHERE id = 5
		`).Scan(&value)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if value != 42 {
			t.Errorf("expected 42, got %d", value)
		}
	})

	// 测试数组索引
	t.Run("array_index_extract", func(t *testing.T) {
		var tag string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.tags[0]') #>> '{}'
			FROM records WHERE id = 2
		`).Scan(&tag)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if tag != "developer" {
			t.Errorf("expected 'developer', got '%s'", tag)
		}
	})

	// 测试数组对象字段
	t.Run("array_object_field_extract", func(t *testing.T) {
		var itemName string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.items[1].name') #>> '{}'
			FROM records WHERE id = 4
		`).Scan(&itemName)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if itemName != "Item2" {
			t.Errorf("expected 'Item2', got '%s'", itemName)
		}
	})

	// 测试嵌套数组对象
	t.Run("nested_array_object_extract", func(t *testing.T) {
		var url string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.profile.links[0].url') #>> '{}'
			FROM records WHERE id = 3
		`).Scan(&url)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if url != "https://example.com" {
			t.Errorf("expected 'https://example.com', got '%s'", url)
		}
	})

	// 测试路径不存在返回 NULL
	t.Run("path_not_exists_returns_null", func(t *testing.T) {
		var result *string
		err := container.DB().QueryRow(`
			SELECT jsonb_path_query_first(data, '$.nonexistent') #>> '{}'
			FROM records WHERE id = 1
		`).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if result != nil {
			t.Errorf("expected nil, got '%v'", *result)
		}
	})
}

// TestPostgres_JSONArrayOperations 测试 JSON 数组操作
func TestPostgres_JSONArrayOperations(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试数据
	err = container.ExecSQL(`
		CREATE TABLE array_test (
			id SERIAL PRIMARY KEY,
			tags JSONB NOT NULL
		);
		INSERT INTO array_test (tags) VALUES 
			('["go", "rust", "python"]'),
			('["javascript", "typescript"]'),
			('[]'),
			('"not_an_array"'),
			('{"key": "value"}');
	`)
	if err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	// 测试数组长度
	t.Run("array_length", func(t *testing.T) {
		testCases := []struct {
			id       int
			expected int
		}{
			{1, 3},
			{2, 2},
			{3, 0},
		}

		for _, tc := range testCases {
			var length int
			err := container.DB().QueryRow(`
				SELECT jsonb_array_length(tags) FROM array_test WHERE id = $1
			`, tc.id).Scan(&length)
			if err != nil {
				t.Errorf("id=%d: 查询失败: %v", tc.id, err)
				continue
			}
			if length != tc.expected {
				t.Errorf("id=%d: expected %d, got %d", tc.id, tc.expected, length)
			}
		}
	})

	// 测试数组包含
	t.Run("array_contains", func(t *testing.T) {
		var exists bool
		err := container.DB().QueryRow(`
			SELECT tags @> '"go"'::jsonb FROM array_test WHERE id = 1
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if !exists {
			t.Error("expected tags to contain 'go'")
		}

		err = container.DB().QueryRow(`
			SELECT tags @> '"java"'::jsonb FROM array_test WHERE id = 1
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if exists {
			t.Error("tags should not contain 'java'")
		}
	})

	// 测试数组展开
	t.Run("array_elements", func(t *testing.T) {
		rows, err := container.DB().Query(`
			SELECT elem #>> '{}' 
			FROM array_test, jsonb_array_elements(tags) AS elem 
			WHERE id = 1
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

	// 测试数组元素查询
	t.Run("array_element_query", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM array_test 
			WHERE tags @> '"go"'::jsonb
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1 record with 'go', got %d", count)
		}
	})
}

// TestPostgres_JSONComparison 测试 JSON 比较操作
func TestPostgres_JSONComparison(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试数据
	err = container.ExecSQL(`
		CREATE TABLE compare_test (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		INSERT INTO compare_test (data) VALUES 
			('{"age": 30, "name": "Alice"}'),
			('{"age": 25, "name": "Bob"}'),
			('{"age": 35, "name": "Charlie"}'),
			('{"age": 30, "name": "David"}');
	`)
	if err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	// 测试数值比较
	t.Run("numeric_comparison", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM compare_test 
			WHERE (data->>'age')::int > 25
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 3 {
			t.Errorf("expected 3 records with age > 25, got %d", count)
		}
	})

	// 测试字符串比较
	t.Run("string_comparison", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM compare_test 
			WHERE data->>'name' = 'Alice'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1 record with name='Alice', got %d", count)
		}
	})

	// 测试 LIKE 查询
	t.Run("like_comparison", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM compare_test 
			WHERE data->>'name' LIKE 'A%'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1 record with name starting with 'A', got %d", count)
		}
	})

	// 测试 IN 查询
	t.Run("in_comparison", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM compare_test 
			WHERE data->>'name' IN ('Alice', 'Bob')
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 2 {
			t.Errorf("expected 2 records with name in ('Alice', 'Bob'), got %d", count)
		}
	})

	// 测试 jsonb_path_query 与比较
	t.Run("jsonb_path_comparison", func(t *testing.T) {
		var count int
		err := container.DB().QueryRow(`
			SELECT COUNT(*) FROM compare_test 
			WHERE (jsonb_path_query_first(data, '$.age') #>> '{}')::int = 30
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != 2 {
			t.Errorf("expected 2 records with age=30, got %d", count)
		}
	})
}

// TestPostgres_JSONModification 测试 JSON 修改操作
func TestPostgres_JSONModification(t *testing.T) {
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
		CREATE TABLE modify_test (
			id SERIAL PRIMARY KEY,
			data JSONB NOT NULL
		);
		INSERT INTO modify_test (data) VALUES ('{"name": "test", "count": 0}');
	`)
	if err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	// 测试 jsonb_set 更新字段
	t.Run("jsonb_set_update", func(t *testing.T) {
		_, err := container.DB().Exec(`
			UPDATE modify_test 
			SET data = jsonb_set(data, '{name}', '"updated"')
			WHERE id = 1
		`)
		if err != nil {
			t.Fatalf("更新失败: %v", err)
		}

		var name string
		err = container.DB().QueryRow(`
			SELECT data->>'name' FROM modify_test WHERE id = 1
		`).Scan(&name)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if name != "updated" {
			t.Errorf("expected 'updated', got '%s'", name)
		}
	})

	// 测试 jsonb_set 添加新字段
	t.Run("jsonb_set_add_field", func(t *testing.T) {
		_, err := container.DB().Exec(`
			UPDATE modify_test 
			SET data = jsonb_set(data, '{newField}', '"newValue"')
			WHERE id = 1
		`)
		if err != nil {
			t.Fatalf("更新失败: %v", err)
		}

		var value string
		err = container.DB().QueryRow(`
			SELECT data->>'newField' FROM modify_test WHERE id = 1
		`).Scan(&value)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if value != "newValue" {
			t.Errorf("expected 'newValue', got '%s'", value)
		}
	})

	// 测试 || 操作符合并
	t.Run("jsonb_concat", func(t *testing.T) {
		_, err := container.DB().Exec(`
			UPDATE modify_test 
			SET data = data || '{"extra": true}'::jsonb
			WHERE id = 1
		`)
		if err != nil {
			t.Fatalf("更新失败: %v", err)
		}

		var extra bool
		err = container.DB().QueryRow(`
			SELECT (data->>'extra')::boolean FROM modify_test WHERE id = 1
		`).Scan(&extra)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if !extra {
			t.Error("expected extra to be true")
		}
	})

	// 测试 - 操作符删除字段
	t.Run("jsonb_delete_field", func(t *testing.T) {
		_, err := container.DB().Exec(`
			UPDATE modify_test 
			SET data = data - 'extra'
			WHERE id = 1
		`)
		if err != nil {
			t.Fatalf("更新失败: %v", err)
		}

		var exists bool
		err = container.DB().QueryRow(`
			SELECT data ? 'extra' FROM modify_test WHERE id = 1
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if exists {
			t.Error("extra field should be deleted")
		}
	})
}

// TestPostgres_JSONAggregation 测试 JSON 聚合操作
func TestPostgres_JSONAggregation(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试数据
	err = container.ExecSQL(`
		CREATE TABLE agg_test (
			id SERIAL PRIMARY KEY,
			category TEXT NOT NULL,
			value INTEGER NOT NULL
		);
		INSERT INTO agg_test (category, value) VALUES 
			('A', 10), ('A', 20), ('A', 30),
			('B', 15), ('B', 25);
	`)
	if err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	// 测试 jsonb_agg
	t.Run("jsonb_agg", func(t *testing.T) {
		var result string
		err := container.DB().QueryRow(`
			SELECT jsonb_agg(value)::text FROM agg_test WHERE category = 'A'
		`).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if result != "[10, 20, 30]" {
			t.Errorf("expected '[10, 20, 30]', got '%s'", result)
		}
	})

	// 测试 jsonb_object_agg
	t.Run("jsonb_object_agg", func(t *testing.T) {
		var result string
		err := container.DB().QueryRow(`
			SELECT jsonb_object_agg(category, total)::text 
			FROM (
				SELECT category, SUM(value) as total 
				FROM agg_test 
				GROUP BY category
			) sub
		`).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		// 结果可能是 {"A": 60, "B": 40} 或 {"B": 40, "A": 60}
		if result != `{"A": 60, "B": 40}` && result != `{"B": 40, "A": 60}` {
			t.Errorf("unexpected result: %s", result)
		}
	})

	// 测试 jsonb_build_object
	t.Run("jsonb_build_object", func(t *testing.T) {
		var result string
		err := container.DB().QueryRow(`
			SELECT jsonb_build_object('id', id, 'category', category, 'value', value)::text
			FROM agg_test WHERE id = 1
		`).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		expected := `{"id": 1, "value": 10, "category": "A"}`
		if result != expected {
			t.Errorf("expected '%s', got '%s'", expected, result)
		}
	})

	// 测试 jsonb_build_array
	t.Run("jsonb_build_array", func(t *testing.T) {
		var result string
		err := container.DB().QueryRow(`
			SELECT jsonb_build_array(1, 'two', true, null)::text
		`).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if result != `[1, "two", true, null]` {
			t.Errorf("unexpected result: %s", result)
		}
	})
}
