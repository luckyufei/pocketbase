package apis_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// ==================== Phase 8: HTTP API 测试 ====================

// superuserHeaders 返回超级用户认证头
func superuserHeaders() map[string]string {
	return map[string]string{
		"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
	}
}

// userHeaders 返回普通用户认证头
func userHeaders() map[string]string {
	return map[string]string{
		"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
	}
}

func TestJobEnqueueAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "enqueue job successfully",
			Method:          http.MethodPost,
			URL:             "/api/jobs/enqueue",
			Body:            strings.NewReader(`{"topic":"email:send","payload":{"to":"test@example.com"}}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"topic":"email:send"`, `"status":"pending"`},
		},
		{
			Name:            "enqueue with missing topic",
			Method:          http.MethodPost,
			URL:             "/api/jobs/enqueue",
			Body:            strings.NewReader(`{"payload":{"data":"test"}}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Topic is required."`},
		},
		{
			Name:            "enqueue with options",
			Method:          http.MethodPost,
			URL:             "/api/jobs/enqueue",
			Body:            strings.NewReader(`{"topic":"task:process","payload":{},"max_retries":5}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"topic":"task:process"`, `"max_retries":5`},
		},
		{
			Name:            "enqueue without auth",
			Method:          http.MethodPost,
			URL:             "/api/jobs/enqueue",
			Body:            strings.NewReader(`{"topic":"test","payload":{}}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:            "enqueue with non-superuser",
			Method:          http.MethodPost,
			URL:             "/api/jobs/enqueue",
			Body:            strings.NewReader(`{"topic":"test","payload":{}}`),
			Headers:         userHeaders(),
			ExpectedStatus:  403,
			ExpectedContent: []string{`"message"`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestJobGetAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "get non-existing job",
			Method:          http.MethodGet,
			URL:             "/api/jobs/nonexistent-id",
			Headers:         superuserHeaders(),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"Job not found."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestJobGetExistingAPI(t *testing.T) {
	t.Parallel()

	scenario := tests.ApiScenario{
		Name:            "get existing job",
		Method:          http.MethodGet,
		URL:             "/api/jobs/", // 会在测试时更新
		Headers:         superuserHeaders(),
		ExpectedStatus:  200,
		ExpectedContent: []string{`"topic":"test:topic"`},
	}

	// 手动运行测试，因为需要动态 URL
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 创建 job
	job, err := app.Jobs().Enqueue("test:topic", map[string]any{"key": "value"})
	if err != nil {
		t.Fatalf("failed to enqueue job: %v", err)
	}

	scenario.URL = "/api/jobs/" + job.ID
	scenario.TestAppFactory = func(t testing.TB) *tests.TestApp {
		return app
	}
	scenario.Test(t)
}

func TestJobListAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "list jobs",
			Method:  http.MethodGet,
			URL:     "/api/jobs",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Jobs().Enqueue("list:topic1", map[string]any{})
				app.Jobs().Enqueue("list:topic2", map[string]any{})
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"items"`, `"total"`, `"limit"`, `"offset"`},
		},
		{
			Name:    "list jobs with topic filter",
			Method:  http.MethodGet,
			URL:     "/api/jobs?topic=filter:topic",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Jobs().Enqueue("filter:topic", map[string]any{})
				app.Jobs().Enqueue("other:topic", map[string]any{})
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"filter:topic"`},
		},
		{
			Name:    "list jobs with status filter",
			Method:  http.MethodGet,
			URL:     "/api/jobs?status=pending",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Jobs().Enqueue("status:topic", map[string]any{})
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"status":"pending"`},
		},
		{
			Name:    "list jobs with pagination",
			Method:  http.MethodGet,
			URL:     "/api/jobs?limit=5&offset=0",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				for i := 0; i < 10; i++ {
					app.Jobs().Enqueue("page:topic", map[string]any{"index": i})
				}
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"limit":5`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestJobRequeueAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "requeue non-existing job",
			Method:          http.MethodPost,
			URL:             "/api/jobs/nonexistent-id/requeue",
			Headers:         superuserHeaders(),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"Job not found."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestJobDeleteAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "delete non-existing job",
			Method:          http.MethodDelete,
			URL:             "/api/jobs/nonexistent-id",
			Headers:         superuserHeaders(),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"Job not found."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestJobStatsAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "get job stats",
			Method:  http.MethodGet,
			URL:     "/api/jobs/stats",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Jobs().Enqueue("stats:topic", map[string]any{})
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"pending"`, `"processing"`, `"completed"`, `"failed"`},
		},
		{
			Name:            "stats without auth",
			Method:          http.MethodGet,
			URL:             "/api/jobs/stats",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}
