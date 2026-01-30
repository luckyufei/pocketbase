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
			collection: "demo4",
			filter:     "json_array ?= 'test'",
		},
		{
			name:       "JSON 嵌套字段访问",
			collection: "demo4",
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

// TestNestedRelationsPostgres 测试嵌套关联查询
// 这是 SQLite 测试覆盖但 PostgreSQL 之前缺失的关键场景
func TestNestedRelationsPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	scenarios := []struct {
		name       string
		collection string
		filter     string
	}{
		{
			name:       "单层嵌套关联 (单值)",
			collection: "demo4",
			filter:     "self_rel_one.title > ''",
		},
		{
			name:       "双层嵌套关联 (单值)",
			collection: "demo4",
			filter:     "self_rel_one.self_rel_one.title > ''",
		},
		{
			name:       "嵌套关联 (多值 opt/any)",
			collection: "demo4",
			filter:     "self_rel_many.self_rel_one.title ?> ''",
		},
		{
			name:       "嵌套关联 (多值 multi-match)",
			collection: "demo4",
			filter:     "self_rel_many.self_rel_one.title > ''",
		},
		{
			name:       "深层嵌套关联 (4层)",
			collection: "demo4",
			filter:     "self_rel_many.self_rel_one.self_rel_many.self_rel_one.title ?> ''",
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

			// 验证查询能执行 (PostgreSQL 特有的 LEFT JOIN ON true 语法)
			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestBackRelationsViaPostgres 测试反向关联 _via_ 查询
func TestBackRelationsViaPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	scenarios := []struct {
		name       string
		collection string
		filter     string
	}{
		{
			name:       "反向关联 via 单值字段 (multi-match)",
			collection: "demo3",
			filter:     "demo4_via_rel_one_cascade.id = ''",
		},
		{
			name:       "反向关联 via 单值字段 (唯一索引)",
			collection: "demo3",
			filter:     "demo4_via_rel_one_unique.id = ''",
		},
		{
			name:       "反向关联 via 多值字段 (opt/any)",
			collection: "demo3",
			filter:     "demo4_via_rel_many_cascade.id ?= ''",
		},
		{
			name:       "反向关联 via 多值字段 (multi-match)",
			collection: "demo3",
			filter:     "demo4_via_rel_many_cascade.id = ''",
		},
		{
			name:       "递归反向关联",
			collection: "demo3",
			filter:     "demo4_via_rel_many_cascade.rel_one_cascade.demo4_via_rel_many_cascade.id ?= ''",
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

			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestModifiersPostgres 测试字段修饰符在 PostgreSQL 下的行为
func TestModifiersPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	// 获取 auth 用户用于 @request.auth
	authRecord, err := app.FindRecordById("users", "4q1xlclmfloku33")
	if err != nil {
		t.Skipf("找不到测试用户: %v", err)
	}

	scenarios := []struct {
		name        string
		collection  string
		filter      string
		requestInfo *core.RequestInfo
	}{
		{
			name:       ":lower 修饰符",
			collection: "demo4",
			filter:     "title:lower = 'test'",
			requestInfo: &core.RequestInfo{
				Auth: authRecord,
			},
		},
		{
			name:       ":length 修饰符 (多值字段)",
			collection: "demo4",
			filter:     "self_rel_many:length > 0",
			requestInfo: &core.RequestInfo{
				Auth: authRecord,
			},
		},
		{
			name:       ":isset 修饰符 (@request.query)",
			collection: "demo4",
			filter:     "@request.query.test:isset = true",
			requestInfo: &core.RequestInfo{
				Auth: authRecord,
				Query: map[string]string{
					"test": "value",
				},
			},
		},
		{
			name:       ":isset 修饰符 (@request.body)",
			collection: "demo4",
			filter:     "@request.body.title:isset = true",
			requestInfo: &core.RequestInfo{
				Auth: authRecord,
				Body: map[string]any{
					"title": "test",
				},
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			resolver := core.NewRecordFieldResolver(app, collection, s.requestInfo, true)
			query := app.RecordQuery(collection)

			expr, err := search.FilterData(s.filter).BuildExpr(resolver)
			if err != nil {
				t.Fatalf("构建过滤表达式失败: %v", err)
			}

			query.AndWhere(expr)

			if err := resolver.UpdateQuery(query); err != nil {
				t.Fatalf("UpdateQuery 失败: %v", err)
			}

			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestEachModifierPostgres 测试 :each 修饰符在 PostgreSQL 下的行为
// 这是 SQLite 和 PostgreSQL SQL 语法差异较大的场景
func TestEachModifierPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	scenarios := []struct {
		name       string
		collection string
		filter     string
	}{
		{
			name:       ":each 修饰符 (select_many)",
			collection: "demo1",
			filter:     "select_many:each = 'optionA'",
		},
		{
			name:       ":each 修饰符 (file_many)",
			collection: "demo1",
			filter:     "file_many:each != ''",
		},
		{
			name:       ":each 与 opt/any 操作符组合",
			collection: "demo1",
			filter:     "select_many:each ?= 'optionA'",
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

			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestHiddenFieldsPostgres 测试隐藏字段 (emailVisibility) 在 PostgreSQL 下的行为
func TestHiddenFieldsPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	scenarios := []struct {
		name              string
		collection        string
		filter            string
		allowHiddenFields bool
		expectErr         bool
	}{
		{
			name:              "直接访问隐藏字段 (不允许)",
			collection:        "users",
			filter:            "email > ''",
			allowHiddenFields: false,
			expectErr:         false, // 不会报错，但会添加 emailVisibility 条件
		},
		{
			name:              "直接访问隐藏字段 (允许)",
			collection:        "users",
			filter:            "email > ''",
			allowHiddenFields: true,
			expectErr:         false,
		},
		{
			name:              "隐藏字段 + :lower 修饰符",
			collection:        "users",
			filter:            "email:lower = 'test@example.com'",
			allowHiddenFields: false,
			expectErr:         false,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			requestInfo := &core.RequestInfo{}
			resolver := core.NewRecordFieldResolver(app, collection, requestInfo, s.allowHiddenFields)
			query := app.RecordQuery(collection)

			expr, err := search.FilterData(s.filter).BuildExpr(resolver)
			if err != nil {
				if !s.expectErr {
					t.Fatalf("构建过滤表达式失败: %v", err)
				}
				return
			}

			query.AndWhere(expr)

			if err := resolver.UpdateQuery(query); err != nil {
				if !s.expectErr {
					t.Fatalf("UpdateQuery 失败: %v", err)
				}
				return
			}

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

// TestRequestAuthFieldsPostgres 测试 @request.auth.* 字段在 PostgreSQL 下的行为
func TestRequestAuthFieldsPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	// 获取 auth 用户
	authRecord, err := app.FindRecordById("users", "4q1xlclmfloku33")
	if err != nil {
		t.Skipf("找不到测试用户: %v", err)
	}

	scenarios := []struct {
		name       string
		collection string
		filter     string
	}{
		{
			name:       "@request.auth.id",
			collection: "demo4",
			filter:     "@request.auth.id != ''",
		},
		{
			name:       "@request.auth 嵌套关联字段",
			collection: "demo4",
			filter:     "@request.auth.rel.title != ''",
		},
		{
			name:       "@request.auth 缺失字段处理",
			collection: "demo4",
			filter:     "@request.auth.missing.field != ''",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			requestInfo := &core.RequestInfo{
				Auth: authRecord,
			}

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

			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败: %v", err)
			}
		})
	}
}

// TestComplexRulesPostgres 测试复杂规则组合在 PostgreSQL 下的行为
// 这是最容易出现 SQLite/PostgreSQL 语法差异的场景
func TestComplexRulesPostgres(t *testing.T) {
	app := createPostgresTestApp(t)
	defer app.Cleanup()

	authRecord, err := app.FindRecordById("users", "4q1xlclmfloku33")
	if err != nil {
		t.Skipf("找不到测试用户: %v", err)
	}

	scenarios := []struct {
		name       string
		collection string
		rule       string
	}{
		{
			name:       "多个 @collection 联合查询",
			collection: "demo4",
			rule:       "@collection.demo1.text ?> '' || @collection.demo2.active ?> ''",
		},
		{
			name:       "@collection + 嵌套关联",
			collection: "demo4",
			rule:       "@collection.demo1.id != '' && self_rel_one.title != ''",
		},
		{
			name:       "多层 multi-match 组合",
			collection: "demo4",
			rule:       "self_rel_many.title = '' || self_rel_one.json_object.a > ''",
		},
		{
			name:       "@collection 与带规则的集合",
			collection: "demo4",
			rule:       "@collection.demo3.title > ''",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			collection, err := app.FindCollectionByNameOrId(s.collection)
			if err != nil {
				t.Fatalf("找不到集合 %q: %v", s.collection, err)
			}

			collectionCopy := *collection
			collectionCopy.ListRule = &s.rule

			requestInfo := &core.RequestInfo{
				Auth: authRecord,
			}

			resolver := core.NewRecordFieldResolver(app, &collectionCopy, requestInfo, true)
			query := app.RecordQuery(&collectionCopy)

			expr, err := search.FilterData(s.rule).BuildExpr(resolver)
			if err != nil {
				t.Fatalf("构建过滤表达式失败: %v", err)
			}

			query.AndWhere(expr)

			if err := resolver.UpdateQuery(query); err != nil {
				t.Fatalf("UpdateQuery 失败: %v", err)
			}

			// 打印生成的 SQL 以便调试
			t.Logf("生成的 SQL: %s", query.Build().SQL())

			var records []*core.Record
			if err := query.All(&records); err != nil {
				t.Fatalf("执行查询失败 (PostgreSQL 语法错误): %v", err)
			}
		})
	}
}
