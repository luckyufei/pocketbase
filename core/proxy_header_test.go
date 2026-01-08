package core_test

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestParseHeaderTemplate(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 设置测试环境变量
	os.Setenv("TEST_API_KEY", "test-key-12345")
	os.Setenv("TEST_SECRET", "secret-value")
	defer os.Unsetenv("TEST_API_KEY")
	defer os.Unsetenv("TEST_SECRET")

	testCases := []struct {
		name        string
		template    string
		expected    string
		expectError bool
	}{
		// 环境变量替换
		{"env var simple", "{env.TEST_API_KEY}", "test-key-12345", false},
		{"env var with prefix", "Bearer {env.TEST_API_KEY}", "Bearer test-key-12345", false},
		{"env var multiple", "{env.TEST_API_KEY}:{env.TEST_SECRET}", "test-key-12345:secret-value", false},

		// 不存在的环境变量
		{"env var not found", "{env.NOT_EXISTS}", "", true},

		// 纯文本（无模板）
		{"plain text", "static-value", "static-value", false},
		{"empty string", "", "", false},

		// 混合内容
		{"mixed content", "prefix-{env.TEST_API_KEY}-suffix", "prefix-test-key-12345-suffix", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := core.ParseHeaderTemplate(app, tc.template, nil)

			if tc.expectError {
				if err == nil {
					t.Errorf("expected error for template %q, got nil", tc.template)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error for template %q: %v", tc.template, err)
				}
				if result != tc.expected {
					t.Errorf("expected %q, got %q", tc.expected, result)
				}
			}
		})
	}
}

func TestParseHeaderTemplateWithAuth(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建测试用户
	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("failed to find users collection: %v", err)
	}

	testUser := core.NewRecord(usersCol)
	testUser.Set("email", "header-test@example.com")
	testUser.Set("name", "Test User")
	testUser.SetPassword("12345678")
	if err := app.Save(testUser); err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	testCases := []struct {
		name        string
		template    string
		authRecord  *core.Record
		expected    string
		expectError bool
	}{
		// @request.auth.id
		{"auth id", "@request.auth.id", testUser, testUser.Id, false},
		{"auth email", "@request.auth.email", testUser, "header-test@example.com", false},
		{"auth name", "@request.auth.name", testUser, "Test User", false},

		// 无认证时
		{"auth id no auth", "@request.auth.id", nil, "", false},

		// 混合模板
		{"mixed with auth", "user:@request.auth.id", testUser, "user:" + testUser.Id, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := core.ParseHeaderTemplate(app, tc.template, tc.authRecord)

			if tc.expectError {
				if err == nil {
					t.Errorf("expected error for template %q, got nil", tc.template)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error for template %q: %v", tc.template, err)
				}
				if result != tc.expected {
					t.Errorf("expected %q, got %q", tc.expected, result)
				}
			}
		})
	}
}

func TestBuildProxyHeaders(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	os.Setenv("TEST_HEADER_KEY", "header-value")
	defer os.Unsetenv("TEST_HEADER_KEY")

	// 创建测试用户
	usersCol, _ := app.FindCollectionByNameOrId("users")
	testUser := core.NewRecord(usersCol)
	testUser.Set("email", "build-test@example.com")
	testUser.SetPassword("12345678")
	app.Save(testUser)

	headers := map[string]string{
		"Authorization": "Bearer {env.TEST_HEADER_KEY}",
		"X-User-Id":     "@request.auth.id",
		"X-Static":      "static-value",
	}

	result, err := core.BuildProxyHeaders(app, headers, testUser)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result["Authorization"] != "Bearer header-value" {
		t.Errorf("expected Authorization 'Bearer header-value', got %q", result["Authorization"])
	}

	if result["X-User-Id"] != testUser.Id {
		t.Errorf("expected X-User-Id %q, got %q", testUser.Id, result["X-User-Id"])
	}

	if result["X-Static"] != "static-value" {
		t.Errorf("expected X-Static 'static-value', got %q", result["X-Static"])
	}
}
