package apis_test

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// secretsTestAppFactory 创建带 Master Key 的测试 App
func secretsTestAppFactory(t testing.TB) *tests.TestApp {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	os.Setenv(core.MasterKeyEnvVar, validKey)
	// 注意：不在 Cleanup 中清除，因为并行测试可能会互相影响

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}

	return app
}

// secretsDisabledAppFactory 创建未启用 Secrets 的测试 App
func secretsDisabledAppFactory(t testing.TB) *tests.TestApp {
	// 确保清除 Master Key
	os.Unsetenv(core.MasterKeyEnvVar)
	os.Setenv(core.MasterKeyEnvVar+"_DISABLED", "1") // 标记禁用

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}

	// 验证 Secrets 确实被禁用
	if app.Secrets() != nil && app.Secrets().IsEnabled() {
		t.Log("Warning: Secrets is still enabled, test may be affected by environment")
	}

	return app
}

// superuserAuthHeader Superuser 认证头
func superuserAuthHeader() map[string]string {
	return map[string]string{
		"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
	}
}

// regularUserAuthHeader 普通用户认证头
func regularUserAuthHeader() map[string]string {
	return map[string]string{
		"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
	}
}

// TestSecretsAPI_Create 测试创建 Secret
func TestSecretsAPI_Create(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "TEST_KEY", "value": "test-value"}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:            "non-superuser forbidden",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "TEST_KEY", "value": "test-value"}`),
			Headers:         regularUserAuthHeader(),
			ExpectedStatus:  403,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:            "superuser success",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "API_KEY", "value": "sk-abc123"}`),
			Headers:         superuserAuthHeader(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"key":"API_KEY"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:            "empty key",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "", "value": "test"}`),
			Headers:         superuserAuthHeader(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:            "with description",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "OPENAI_KEY", "value": "sk-proj-xxx", "description": "OpenAI API Key"}`),
			Headers:         superuserAuthHeader(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"key":"OPENAI_KEY"`},
			TestAppFactory:  secretsTestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// TestSecretsAPI_Get 测试获取 Secret
func TestSecretsAPI_Get(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/secrets/GET_TEST_KEY",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodGet,
			URL:            "/api/secrets/GET_TEST_KEY",
			Headers:        superuserAuthHeader(),
			ExpectedStatus: 200,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				// 先创建一个 Secret
				app.Secrets().Set("GET_TEST_KEY", "secret-value-123")
			},
			ExpectedContent: []string{`"value":"secret-value-123"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:            "not found",
			Method:          http.MethodGet,
			URL:             "/api/secrets/NONEXISTENT_KEY",
			Headers:         superuserAuthHeader(),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// TestSecretsAPI_List 测试列出所有 Secrets
func TestSecretsAPI_List(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/secrets",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodGet,
			URL:            "/api/secrets",
			Headers:        superuserAuthHeader(),
			ExpectedStatus: 200,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Secrets().Set("LIST_KEY_1", "value1")
				app.Secrets().Set("LIST_KEY_2", "value2")
			},
			ExpectedContent: []string{`"key":"LIST_KEY_1"`, `"key":"LIST_KEY_2"`},
			TestAppFactory:  secretsTestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// TestSecretsAPI_Delete 测试删除 Secret
func TestSecretsAPI_Delete(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodDelete,
			URL:             "/api/secrets/DELETE_TEST_KEY",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodDelete,
			URL:            "/api/secrets/DELETE_TEST_KEY",
			Headers:        superuserAuthHeader(),
			ExpectedStatus: 204,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Secrets().Set("DELETE_TEST_KEY", "to-be-deleted")
			},
			TestAppFactory: secretsTestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// TestSecretsAPI_Update 测试更新 Secret
func TestSecretsAPI_Update(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodPut,
			URL:             "/api/secrets/UPDATE_TEST_KEY",
			Body:            strings.NewReader(`{"value": "new-value"}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsTestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodPut,
			URL:            "/api/secrets/UPDATE_TEST_KEY",
			Body:           strings.NewReader(`{"value": "new-value"}`),
			Headers:        superuserAuthHeader(),
			ExpectedStatus: 200,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.Secrets().Set("UPDATE_TEST_KEY", "old-value")
			},
			ExpectedContent: []string{`"key":"UPDATE_TEST_KEY"`},
			TestAppFactory:  secretsTestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// TestSecretsAPI_DisabledWithoutMasterKey 测试未设置 Master Key 时的行为
func TestSecretsAPI_DisabledWithoutMasterKey(t *testing.T) {
	// 不并行运行，避免环境变量污染
	// t.Parallel()

	// 确保清除环境变量
	originalKey := os.Getenv(core.MasterKeyEnvVar)
	os.Unsetenv(core.MasterKeyEnvVar)
	defer func() {
		if originalKey != "" {
			os.Setenv(core.MasterKeyEnvVar, originalKey)
		}
	}()

	scenarios := []tests.ApiScenario{
		{
			Name:            "service unavailable",
			Method:          http.MethodGet,
			URL:             "/api/secrets",
			Headers:         superuserAuthHeader(),
			ExpectedStatus:  503,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsDisabledAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}
