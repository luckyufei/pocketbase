package secrets_test

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/secrets"
	"github.com/pocketbase/pocketbase/tests"
)

// secretsTestAppFactory 创建带 Master Key 和 secrets 插件的测试 App
func secretsAPITestAppFactory(t testing.TB) *tests.TestApp {
	os.Setenv(core.MasterKeyEnvVar, validMasterKey)

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}

	// 注册 secrets 插件
	secrets.MustRegister(app, secrets.DefaultConfig())

	return app
}

// secretsDisabledAppFactory 创建未启用 Secrets 的测试 App
func secretsDisabledAPIAppFactory(t testing.TB) *tests.TestApp {
	os.Unsetenv(core.MasterKeyEnvVar)

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}

	secrets.MustRegister(app, secrets.DefaultConfig())

	return app
}

// superuserAuthHeader Superuser 认证头
func superuserAPIAuthHeader() map[string]string {
	return map[string]string{
		"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
	}
}

// regularUserAuthHeader 普通用户认证头
func regularUserAPIAuthHeader() map[string]string {
	return map[string]string{
		"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
	}
}

// TestSecretsAPI_Create 测试创建 Secret
func TestSecretsAPI_Create(t *testing.T) {
	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "TEST_KEY", "value": "test-value"}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:            "non-superuser forbidden",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "TEST_KEY", "value": "test-value"}`),
			Headers:         regularUserAPIAuthHeader(),
			ExpectedStatus:  403,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:            "superuser success",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "API_KEY", "value": "sk-abc123"}`),
			Headers:         superuserAPIAuthHeader(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"key":"API_KEY"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:            "empty key",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "", "value": "test"}`),
			Headers:         superuserAPIAuthHeader(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:            "with description",
			Method:          http.MethodPost,
			URL:             "/api/secrets",
			Body:            strings.NewReader(`{"key": "OPENAI_KEY", "value": "sk-proj-xxx", "description": "OpenAI API Key"}`),
			Headers:         superuserAPIAuthHeader(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"key":"OPENAI_KEY"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestSecretsAPI_Get 测试获取 Secret
func TestSecretsAPI_Get(t *testing.T) {
	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/secrets/GET_TEST_KEY",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodGet,
			URL:            "/api/secrets/GET_TEST_KEY",
			Headers:        superuserAPIAuthHeader(),
			ExpectedStatus: 200,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				store := secrets.GetStore(app)
				store.Set("GET_TEST_KEY", "secret-value-123")
			},
			ExpectedContent: []string{`"value":"secret-value-123"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:            "not found",
			Method:          http.MethodGet,
			URL:             "/api/secrets/NONEXISTENT_KEY",
			Headers:         superuserAPIAuthHeader(),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestSecretsAPI_List 测试列出所有 Secrets
func TestSecretsAPI_List(t *testing.T) {
	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/secrets",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodGet,
			URL:            "/api/secrets",
			Headers:        superuserAPIAuthHeader(),
			ExpectedStatus: 200,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				store := secrets.GetStore(app)
				store.Set("LIST_KEY_1", "value1")
				store.Set("LIST_KEY_2", "value2")
			},
			ExpectedContent: []string{`"key":"LIST_KEY_1"`, `"key":"LIST_KEY_2"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestSecretsAPI_Delete 测试删除 Secret
func TestSecretsAPI_Delete(t *testing.T) {
	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodDelete,
			URL:             "/api/secrets/DELETE_TEST_KEY",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodDelete,
			URL:            "/api/secrets/DELETE_TEST_KEY",
			Headers:        superuserAPIAuthHeader(),
			ExpectedStatus: 204,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				store := secrets.GetStore(app)
				store.Set("DELETE_TEST_KEY", "to-be-deleted")
			},
			TestAppFactory: secretsAPITestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestSecretsAPI_Update 测试更新 Secret
func TestSecretsAPI_Update(t *testing.T) {
	scenarios := []tests.ApiScenario{
		{
			Name:            "unauthorized",
			Method:          http.MethodPut,
			URL:             "/api/secrets/UPDATE_TEST_KEY",
			Body:            strings.NewReader(`{"value": "new-value"}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
		{
			Name:           "superuser success",
			Method:         http.MethodPut,
			URL:            "/api/secrets/UPDATE_TEST_KEY",
			Body:           strings.NewReader(`{"value": "new-value"}`),
			Headers:        superuserAPIAuthHeader(),
			ExpectedStatus: 200,
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				store := secrets.GetStore(app)
				store.Set("UPDATE_TEST_KEY", "old-value")
			},
			ExpectedContent: []string{`"key":"UPDATE_TEST_KEY"`},
			TestAppFactory:  secretsAPITestAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// TestSecretsAPI_DisabledWithoutMasterKey 测试未设置 Master Key 时的行为
func TestSecretsAPI_DisabledWithoutMasterKey(t *testing.T) {
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
			Headers:         superuserAPIAuthHeader(),
			ExpectedStatus:  503,
			ExpectedContent: []string{`"message"`},
			TestAppFactory:  secretsDisabledAPIAppFactory,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}
