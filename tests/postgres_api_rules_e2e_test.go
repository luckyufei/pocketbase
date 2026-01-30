// Package tests_test 测试 PocketBase 在 PostgreSQL 下的 API Rules 端到端行为
// 这些测试覆盖了通过 HTTP API 使用 API Rules 的完整场景
package tests_test

import (
	"net/http"
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// postgresTestAppFactory 创建 PostgreSQL 测试应用的工厂函数
func postgresTestAppFactory(t testing.TB) *tests.TestApp {
	if os.Getenv("TEST_POSTGRES") == "" && os.Getenv("POSTGRES_DSN") == "" {
		t.Skip("跳过 PostgreSQL E2E 测试 (设置 TEST_POSTGRES=1 或 POSTGRES_DSN 启用)")
	}

	app, err := tests.NewPostgresTestApp()
	if err != nil {
		t.Skipf("无法创建 PostgreSQL 测试应用: %v", err)
	}
	return app
}

// TestPostgresAPIRulesCollectionCrossQuery 测试 @collection 跨集合查询通过 API
func TestPostgresAPIRulesCollectionCrossQuery(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "@collection 规则查询 (通过 superuser)",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records?filter=title!=''",
			Headers: map[string]string{
				// 使用 superuser token
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				// 设置 @collection 规则
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "@collection.demo1.id != ''"
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

// TestPostgresAPIRulesMultiValueRelation 测试多值关联规则
func TestPostgresAPIRulesMultiValueRelation(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "多值关联 ?= 操作符",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "rel_many_no_cascade.title ?= 'test'"
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
			Name:   "多值关联 ?!= 操作符",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "rel_many_no_cascade.title ?!= 'test'"
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

// TestPostgresAPIRulesComplexJoins 测试复杂的多表 join 场景
func TestPostgresAPIRulesComplexJoins(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "单值关联查询规则",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "rel_one_no_cascade.id != ''"
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
			Name:   "自关联查询规则",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "self_rel_one.id != ''"
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
			Name:   "多值自关联查询规则",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "self_rel_many.id ?= ''"
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
			Name:   "@collection 与 filter 组合",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records?filter=title!=''",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				rule := "@collection.demo1.id != ''"
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

// TestPostgresAPIRulesJSONField 测试 JSON 字段查询
// 注意: 此测试依赖于数据库中存在具有 JSON 字段的集合
func TestPostgresAPIRulesJSONField(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "JSON 字段访问 (demo4.json 字段)",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				collection, err := app.FindCollectionByNameOrId("demo4")
				if err != nil {
					t.Fatalf("找不到 demo4 集合: %v", err)
				}

				// 设置空规则允许访问
				emptyRule := ""
				collection.ListRule = &emptyRule

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

// TestPostgresAPIRulesExpand 测试 expand 功能
func TestPostgresAPIRulesExpand(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "expand 单值关联",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records?expand=rel_one_no_cascade",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
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
			ExpectedContent: []string{
				`"items":[`,
			},
			NotExpectedContent: []string{
				`SQLSTATE`,
				`syntax error`,
			},
		},
		{
			Name:   "expand 多值关联",
			Method: http.MethodGet,
			URL:    "/api/collections/demo4/records?expand=rel_many_no_cascade",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			TestAppFactory: postgresTestAppFactory,
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
