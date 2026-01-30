// Package tests_test 测试 PocketBase 在 PostgreSQL 下的 CRUD API 端到端行为
// 这些测试验证 record_crud 在 PostgreSQL 下的行为与 SQLite 一致
package tests_test

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// postgresTestAppFactoryCRUD 创建 PostgreSQL 测试应用的工厂函数
func postgresTestAppFactoryCRUD(t testing.TB) *tests.TestApp {
	if os.Getenv("TEST_POSTGRES") == "" && os.Getenv("POSTGRES_DSN") == "" {
		t.Skip("跳过 PostgreSQL CRUD E2E 测试 (设置 TEST_POSTGRES=1 或 POSTGRES_DSN 启用)")
	}

	app, err := tests.NewPostgresTestApp()
	if err != nil {
		t.Skipf("无法创建 PostgreSQL 测试应用: %v", err)
	}
	return app
}

// TestPostgresCrudList 测试 PostgreSQL 下的 List API
func TestPostgresCrudList(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:           "公开集合列表",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records",
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"page":1`,
				`"perPage":30`,
				`"items":[{`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
				`syntax error`,
			},
		},
		{
			Name:           "带分页参数",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records?page=1&perPage=2",
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"page":1`,
				`"perPage":2`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
		{
			Name:           "带排序参数",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records?sort=-created,title",
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[{`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
		{
			Name:           "带过滤参数",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records?filter=title!='test'",
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
		{
			Name:           "带关联展开",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo4/records?expand=rel_one_no_cascade",
			TestAppFactory: postgresTestAppFactoryCRUD,
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}
				emptyRule := ""
				collection.ListRule = &emptyRule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresCrudView 测试 PostgreSQL 下的 View API
func TestPostgresCrudView(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:           "获取单条记录",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records/0yxhwia2amd8gec",
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"id":"0yxhwia2amd8gec"`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
		{
			Name:           "不存在的记录",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records/nonexistent",
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 404,
			ExpectedContent: []string{
				`"status":404`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresCrudCreate 测试 PostgreSQL 下的 Create API
func TestPostgresCrudCreate(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:           "创建记录 - 公开集合",
			Method:         http.MethodPost,
			URL:            "/api/collections/demo2/records",
			Body:           strings.NewReader(`{"title":"test_title","active":true}`),
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"title":"test_title"`,
				`"active":true`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
		{
			Name:   "创建记录 - 带必填字段",
			Method: http.MethodPost,
			URL:    "/api/collections/demo4/records",
			Body:   strings.NewReader(`{"title":"pg_test","rel_one_no_cascade_required":"mk5fmymtx4wsprk","rel_many_no_cascade_required":["mk5fmymtx4wsprk"]}`),
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}
				emptyRule := ""
				collection.CreateRule = &emptyRule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"title":"pg_test"`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresCrudUpdate 测试 PostgreSQL 下的 Update API
func TestPostgresCrudUpdate(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:           "更新记录",
			Method:         http.MethodPatch,
			URL:            "/api/collections/demo2/records/0yxhwia2amd8gec",
			Body:           strings.NewReader(`{"title":"updated_title"}`),
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"title":"updated_title"`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresCrudDelete 测试 PostgreSQL 下的 Delete API
func TestPostgresCrudDelete(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "删除记录",
			Method: http.MethodDelete,
			URL:    "/api/collections/demo2/records/achvryl401bhse3",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo2")
				if err != nil {
					t.Fatalf("找不到 demo2 集合: %v", err)
				}
				emptyRule := ""
				collection.DeleteRule = &emptyRule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 204,
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresMultiMatch 测试 PostgreSQL 下的 multi-match 子查询
func TestPostgresMultiMatch(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "multi-match - 至少一个匹配",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}
				// multi-match 规则：多值字段 = 触发子查询
				rule := "self_rel_many.title = 'test'"
				collection.ListRule = &rule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
				`syntax error`,
			},
		},
		{
			Name:   "multi-match - 多层嵌套",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}
				// 多层嵌套 multi-match
				rule := "self_rel_many.self_rel_one.title = 'test'"
				collection.ListRule = &rule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
				`syntax error`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresHiddenFields 测试 PostgreSQL 下的隐藏字段处理
func TestPostgresHiddenFields(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "email 字段可见性 - superuser",
			Method: http.MethodGet,
			URL:    "/api/collections/users/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
				`"email"`, // superuser 可以看到 email
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
		{
			Name:   "email 字段可见性 - 已认证用户 (设置了 ListRule)",
			Method: http.MethodGet,
			URL:    "/api/collections/users/records",
			Headers: map[string]string{
				// 普通用户 token
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				// 设置 users 集合允许已认证用户列表
				collection, err := app.FindCollectionByNameOrId("users")
				if err != nil {
					t.Fatalf("找不到 users 集合: %v", err)
				}
				rule := "@request.auth.id != ''"
				collection.ListRule = &rule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresModifiers 测试 PostgreSQL 下的字段修饰符
func TestPostgresModifiers(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   ":length 修饰符",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}
				rule := "self_rel_many:length >= 0"
				collection.ListRule = &rule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			NotExpectedContent: []string{
				`SQLSTATE`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestPostgresBackRelationVia 测试 PostgreSQL 下的反向关联 _via_
func TestPostgresBackRelationVia(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "_via_ 反向关联查询",
			Method: http.MethodGet,
			URL:    "/api/collections/demo3/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactoryCRUD,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo3")
				if err != nil {
					t.Fatalf("找不到 demo3 集合: %v", err)
				}
				rule := "demo4_via_rel_one_cascade.id ?= ''"
				collection.ListRule = &rule
				if err := app.SaveNoValidate(collection); err != nil {
					t.Fatalf("保存集合失败: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
				`syntax error`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}
