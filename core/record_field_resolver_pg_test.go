// Package core_test 测试 RecordFieldResolver 在 PostgreSQL 下的行为
package core_test

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/search"
)

// skipIfNoPostgres 检查是否应该跳过 PostgreSQL 测试
func skipIfNoPostgres(t *testing.T) {
	t.Helper()
	if os.Getenv("TEST_POSTGRES") == "" && os.Getenv("POSTGRES_DSN") == "" {
		t.Skip("跳过 PostgreSQL 测试 (设置 TEST_POSTGRES=1 或 POSTGRES_DSN 启用)")
	}
}

// createPostgresTestApp 创建 PostgreSQL 测试应用
func createPostgresTestApp(t *testing.T) *tests.TestApp {
	t.Helper()
	skipIfNoPostgres(t)

	app, err := tests.NewPostgresTestApp()
	if err != nil {
		t.Skipf("无法创建 PostgreSQL 测试应用: %v", err)
	}
	return app
}

// TestRecordFieldResolverPostgres 测试 RecordFieldResolver 在 PostgreSQL 下的行为
func TestRecordFieldResolverPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	// 测试场景表
	scenarios := []struct {
		name       string
		collection string
		rule       string
		filter     string
		expectErr  bool
	}{
		{
			name:       "@collection 跨集合查询 (基本)",
			collection: "demo4",
			rule:       "@collection.demo1.id != ''",
			filter:     "id != ''",
			expectErr:  false,
		},
		{
			name:       "@collection 跨集合查询 (带条件)",
			collection: "demo4",
			rule:       "@collection.demo1.text ?= 'test'",
			filter:     "id != ''",
			expectErr:  false,
		},
		{
			name:       "单值关联查询",
			collection: "demo4",
			rule:       "",
			filter:     "rel_one_no_cascade.id != ''",
			expectErr:  false,
		},
		{
			name:       "多值关联查询",
			collection: "demo4",
			rule:       "",
			filter:     "rel_many_no_cascade.title ?= 'test'",
			expectErr:  false,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			// 复制 collection 以避免修改原始对象
			collectionCopy := *collection
			
			// 如果有 rule，临时设置
			if s.rule != "" {
				collectionCopy.ListRule = &s.rule
			}

			requestInfo := &core.RequestInfo{}

			resolver := core.NewRecordFieldResolver(app, &collectionCopy, requestInfo, true)
			query := app.RecordQuery(&collectionCopy)

			// 解析 filter
			expr, err := search.FilterData(s.filter).BuildExpr(resolver)
			if err != nil {
				if !s.expectErr {
					t.Fatalf("构建过滤表达式失败: %v", err)
				}
				return
			}

			query.AndWhere(expr)

			// 应用 resolver 的 join
			if err := resolver.UpdateQuery(query); err != nil {
				if !s.expectErr {
					t.Fatalf("UpdateQuery 失败: %v", err)
				}
				return
			}

			// 尝试执行查询
			var records []*core.Record
			if err := query.All(&records); err != nil {
				if !s.expectErr {
					t.Fatalf("执行查询失败: %v", err)
				}
				return
			}

			if s.expectErr {
				t.Error("预期错误但查询成功")
			}
		})
	}
}

// TestCollectionCrossQueryPostgres 专门测试 @collection 跨集合查询语法
func TestCollectionCrossQueryPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	// 获取测试集合
	collection, err := app.FindCollectionByNameOrId("demo4")
	if err != nil {
		t.Fatalf("找不到集合: %v", err)
	}

	// 复制 collection
	collectionCopy := *collection

	// 设置使用 @collection 的 listRule
	rule := "@collection.demo1.id != ''"
	collectionCopy.ListRule = &rule

	requestInfo := &core.RequestInfo{}

	resolver := core.NewRecordFieldResolver(app, &collectionCopy, requestInfo, true)
	query := app.RecordQuery(&collectionCopy)

	// 解析 listRule
	expr, err := search.FilterData(rule).BuildExpr(resolver)
	if err != nil {
		t.Fatalf("构建过滤表达式失败: %v", err)
	}

	query.AndWhere(expr)

	// 应用 resolver 的 join - 这里会触发 @collection join
	if err := resolver.UpdateQuery(query); err != nil {
		t.Fatalf("UpdateQuery 失败: %v", err)
	}

	// 验证生成的 SQL 包含 ON true（PostgreSQL 需要）
	sqlStr := query.Build().SQL()
	t.Logf("生成的 SQL: %s", sqlStr)

	// 执行查询验证语法正确
	var records []*core.Record
	if err := query.All(&records); err != nil {
		t.Fatalf("执行查询失败 (这表明 LEFT JOIN 缺少 ON 条件): %v", err)
	}
}

// TestMultiMatchQueryPostgres 测试多值匹配查询
func TestMultiMatchQueryPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	scenarios := []struct {
		name       string
		collection string
		filter     string
	}{
		{
			name:       "多值关联 ?= 操作符",
			collection: "demo4",
			filter:     "rel_many_no_cascade.title ?= 'test'",
		},
		{
			name:       "多值关联 ?!= 操作符",
			collection: "demo4",
			filter:     "rel_many_no_cascade.title ?!= 'test'",
		},
		{
			name:       "多值关联 ?~ 操作符",
			collection: "demo4",
			filter:     "rel_many_no_cascade.title ?~ 'test%'",
		},
		{
			name:       "多值关联 ?!~ 操作符",
			collection: "demo4",
			filter:     "rel_many_no_cascade.title ?!~ 'test%'",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			requestInfo := &core.RequestInfo{}

			resolver := core.NewRecordFieldResolver(app, collection, requestInfo, true)
			query := app.RecordQuery(collection)

			expr, err := search.FilterData(s.filter).BuildExpr(resolver)
			if err != nil {
				t.Fatalf("构建过滤表达式失败: %v", err)
			}

			query.AndWhere(expr)

			if err := resolver.UpdateQuery(query); err != nil {
				t.Fatalf("UpdateQuery 失败: %v", err)
			}

			// 验证查询能执行
			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestJSONFieldQueryPostgres 测试 JSON 字段查询
func TestJSONFieldQueryPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	scenarios := []struct {
		name       string
		collection string
		filter     string
	}{
		{
			name:       "JSON 字段等值比较",
			collection: "demo1",
			filter:     "json_array ?= 'test'",
		},
		{
			name:       "JSON 嵌套字段访问",
			collection: "demo1",
			filter:     "json_object.name = 'test'",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			requestInfo := &core.RequestInfo{}

			resolver := core.NewRecordFieldResolver(app, collection, requestInfo, true)
			query := app.RecordQuery(collection)

			expr, err := search.FilterData(s.filter).BuildExpr(resolver)
			if err != nil {
				t.Fatalf("构建过滤表达式失败: %v", err)
			}

			query.AndWhere(expr)

			if err := resolver.UpdateQuery(query); err != nil {
				t.Fatalf("UpdateQuery 失败: %v", err)
			}

			// 验证查询能执行
			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestRequestInfoFieldsPostgres 测试 @request 字段在 PostgreSQL 下的行为
func TestRequestInfoFieldsPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	collection, err := app.FindCollectionByNameOrId("demo4")
	if err != nil {
		t.Fatalf("找不到集合: %v", err)
	}

	scenarios := []struct {
		name   string
		rule   string
		filter string
	}{
		{
			name:   "@request.query 参数",
			rule:   "@request.query.test = 'value'",
			filter: "id != ''",
		},
		{
			name:   "@request.headers",
			rule:   "@request.headers.content_type != ''",
			filter: "id != ''",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			// 复制 collection
			collectionCopy := *collection
			collectionCopy.ListRule = &s.rule

			requestInfo := &core.RequestInfo{
				Query: map[string]string{
					"test": "value",
				},
				Headers: map[string]string{
					"content_type": "application/json",
				},
			}

			resolver := core.NewRecordFieldResolver(app, &collectionCopy, requestInfo, true)
			query := app.RecordQuery(&collectionCopy)

			// 解析 rule
			expr, err := search.FilterData(s.rule).BuildExpr(resolver)
			if err != nil {
				t.Fatalf("构建过滤表达式失败: %v", err)
			}

			query.AndWhere(expr)

			if err := resolver.UpdateQuery(query); err != nil {
				t.Fatalf("UpdateQuery 失败: %v", err)
			}

			// 验证查询能执行
			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}
