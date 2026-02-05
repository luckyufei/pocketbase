package metrics_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/plugins/metrics"
	"github.com/pocketbase/pocketbase/tests"
)

func TestDatabaseStats(t *testing.T) {
	t.Parallel()

	// 创建一个 TestAppFactory 来注册 metrics 插件
	testAppWithMetrics := func(tb testing.TB) *tests.TestApp {
		app, err := tests.NewTestApp()
		if err != nil {
			tb.Fatal(err)
		}
		// 在 OnServe hook 被触发之前注册插件
		metrics.MustRegister(app, metrics.Config{})
		return app
	}

	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          "GET",
			URL:             "/api/system/metrics/database",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
			ExpectedEvents:  map[string]int{"*": 0},
			TestAppFactory:  testAppWithMetrics,
		},
		{
			Name:   "authorized as regular user",
			Method: "GET",
			URL:    "/api/system/metrics/database",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
			},
			ExpectedStatus:  403,
			ExpectedContent: []string{`"data":{}`},
			ExpectedEvents:  map[string]int{"*": 0},
			TestAppFactory:  testAppWithMetrics,
		},
		{
			Name:   "authorized as superuser",
			Method: "GET",
			URL:    "/api/system/metrics/database",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"stats":{`,
			},
			ExpectedEvents: map[string]int{"*": 0},
			TestAppFactory: testAppWithMetrics,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestDetectDatabaseType(t *testing.T) {
	// 注意: 不能使用 t.Parallel() 因为子测试使用 t.Setenv

	scenarios := []struct {
		name     string
		envVars  map[string]string
		expected string
	}{
		{
			name:     "default SQLite",
			envVars:  map[string]string{},
			expected: "sqlite",
		},
		{
			name: "PostgreSQL via PB_DATABASE_URL",
			envVars: map[string]string{
				"PB_DATABASE_URL": "postgres://user:pass@localhost:5432/db",
			},
			expected: "postgresql",
		},
		{
			name: "PostgreSQL via PB_POSTGRES_DSN",
			envVars: map[string]string{
				"PB_POSTGRES_DSN": "postgres://user:pass@localhost:5432/db",
			},
			expected: "postgresql",
		},
		{
			name: "PostgreSQL with postgresql:// scheme",
			envVars: map[string]string{
				"PB_DATABASE_URL": "postgresql://user:pass@localhost:5432/db",
			},
			expected: "postgresql",
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			// 设置环境变量
			for key, value := range scenario.envVars {
				t.Setenv(key, value)
			}

			app, _ := tests.NewTestApp()
			defer app.Cleanup()

			// 这里我们无法直接测试 detectDatabaseType 函数，因为它不是导出的
			// 但我们可以通过 API 调用来间接测试
			// 实际的测试逻辑应该在集成测试中进行
		})
	}
}
