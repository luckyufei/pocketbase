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

// T021-T025 测试 - Proxy 与 secret 字段集成
func TestProxyHeaderWithSecretField(t *testing.T) {
	// 设置 master key 启用 secrets
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建包含 secret 字段的 auth collection
	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("failed to find users collection: %v", err)
	}

	// 添加 secret 字段到 users collection
	usersCol.Fields.Add(&core.SecretField{
		Id:   "api_key_field",
		Name: "api_key",
	})
	if err := app.Save(usersCol); err != nil {
		t.Fatalf("failed to update users collection: %v", err)
	}

	// 创建测试用户 A
	userA := core.NewRecord(usersCol)
	userA.Set("email", "user-a@example.com")
	userA.Set("api_key", "sk-user-a-key-123")
	userA.SetPassword("12345678")
	if err := app.Save(userA); err != nil {
		t.Fatalf("failed to create user A: %v", err)
	}

	// 创建测试用户 B
	userB := core.NewRecord(usersCol)
	userB.Set("email", "user-b@example.com")
	userB.Set("api_key", "sk-user-b-key-456")
	userB.SetPassword("12345678")
	if err := app.Save(userB); err != nil {
		t.Fatalf("failed to create user B: %v", err)
	}

	t.Run("T021 - resolve secret field from auth record", func(t *testing.T) {
		// 从数据库重新加载用户（确保 secret 已加密/解密）
		loadedA, _ := app.FindRecordById(usersCol.Name, userA.Id)

		result, err := core.ParseHeaderTemplate(app, "Bearer @request.auth.api_key", loadedA)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != "Bearer sk-user-a-key-123" {
			t.Errorf("expected 'Bearer sk-user-a-key-123', got %q", result)
		}
	})

	t.Run("T025 - different users have different API keys", func(t *testing.T) {
		loadedA, _ := app.FindRecordById(usersCol.Name, userA.Id)
		loadedB, _ := app.FindRecordById(usersCol.Name, userB.Id)

		resultA, _ := core.ParseHeaderTemplate(app, "@request.auth.api_key", loadedA)
		resultB, _ := core.ParseHeaderTemplate(app, "@request.auth.api_key", loadedB)

		if resultA != "sk-user-a-key-123" {
			t.Errorf("expected user A key 'sk-user-a-key-123', got %q", resultA)
		}

		if resultB != "sk-user-b-key-456" {
			t.Errorf("expected user B key 'sk-user-b-key-456', got %q", resultB)
		}
	})

	t.Run("T022 - empty secret field returns empty string", func(t *testing.T) {
		// 创建没有 api_key 的用户
		userC := core.NewRecord(usersCol)
		userC.Set("email", "user-c@example.com")
		userC.SetPassword("12345678")
		// 不设置 api_key
		if err := app.Save(userC); err != nil {
			t.Fatalf("failed to create user C: %v", err)
		}

		loadedC, _ := app.FindRecordById(usersCol.Name, userC.Id)

		result, err := core.ParseHeaderTemplate(app, "Bearer @request.auth.api_key", loadedC)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != "Bearer " {
			t.Errorf("expected 'Bearer ', got %q", result)
		}
	})

	t.Run("T023 - unauthenticated returns empty", func(t *testing.T) {
		result, err := core.ParseHeaderTemplate(app, "Bearer @request.auth.api_key", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != "Bearer " {
			t.Errorf("expected 'Bearer ', got %q", result)
		}
	})
}

func TestProxyHeaderWithSecretsStore(t *testing.T) {
	// 设置 master key 启用 secrets
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 设置系统级 secret
	if app.Secrets() != nil && app.Secrets().IsEnabled() {
		if err := app.Secrets().Set("SYSTEM_API_KEY", "sk-system-key-789"); err != nil {
			t.Fatalf("failed to set system secret: %v", err)
		}
	} else {
		t.Skip("Secrets store not enabled")
	}

	t.Run("T025 - resolve system secret with {secret.VAR}", func(t *testing.T) {
		result, err := core.ParseHeaderTemplate(app, "Bearer {secret.SYSTEM_API_KEY}", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != "Bearer sk-system-key-789" {
			t.Errorf("expected 'Bearer sk-system-key-789', got %q", result)
		}
	})

	t.Run("T025 - mixed system secret and user secret", func(t *testing.T) {
		// 创建包含 secret 字段的用户
		usersCol, _ := app.FindCollectionByNameOrId("users")

		// 检查是否已有 api_key 字段，没有则添加
		if usersCol.Fields.GetByName("api_key") == nil {
			usersCol.Fields.Add(&core.SecretField{
				Id:   "api_key_field",
				Name: "api_key",
			})
			if err := app.Save(usersCol); err != nil {
				t.Fatalf("failed to update users collection: %v", err)
			}
		}

		user := core.NewRecord(usersCol)
		user.Set("email", "mixed-test@example.com")
		user.Set("api_key", "sk-user-specific")
		user.SetPassword("12345678")
		if err := app.Save(user); err != nil {
			t.Fatalf("failed to create user: %v", err)
		}

		loadedUser, _ := app.FindRecordById(usersCol.Name, user.Id)

		// 同时使用系统 secret 和用户 secret
		result, err := core.ParseHeaderTemplate(
			app,
			"system:{secret.SYSTEM_API_KEY};user:@request.auth.api_key",
			loadedUser,
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := "system:sk-system-key-789;user:sk-user-specific"
		if result != expected {
			t.Errorf("expected %q, got %q", expected, result)
		}
	})
}
