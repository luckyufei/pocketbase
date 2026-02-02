package core_test

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// runSecretsTestWithMasterKey 运行需要 Master Key 的 secrets 测试
// 由于 Master Key 需要在 app 初始化前设置，这个辅助函数使用同步方式运行
func runSecretsTestWithMasterKey(t *testing.T, testFunc func(t *testing.T, app *tests.TestApp, dbType tests.DBType)) {
	t.Helper()

	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	// SQLite 测试 - 同步运行，在同一个 goroutine 中
	t.Run("SQLite", func(t *testing.T) {
		// 设置 Master Key
		os.Setenv(core.MasterKeyEnvVar, validKey)
		defer os.Unsetenv(core.MasterKeyEnvVar)

		app, err := tests.NewTestApp()
		if err != nil {
			t.Fatalf("创建 SQLite 测试应用失败: %v", err)
		}
		defer app.Cleanup()

		testFunc(t, app, tests.DBTypeSQLite)
	})

	// PostgreSQL 测试 - 如果启用
	if os.Getenv("TEST_POSTGRES") != "" || os.Getenv("POSTGRES_DSN") != "" {
		t.Run("PostgreSQL", func(t *testing.T) {
			// 设置 Master Key
			os.Setenv(core.MasterKeyEnvVar, validKey)
			defer os.Unsetenv(core.MasterKeyEnvVar)

			app, err := tests.NewPostgresTestApp()
			if err != nil {
				t.Skipf("跳过 PostgreSQL 测试: %v", err)
				return
			}
			defer app.Cleanup()

			testFunc(t, app, tests.DBTypePostgres)
		})
	}
}

// TestSecretsStore_SetGet 测试基础的 Set/Get 操作
func TestSecretsStore_SetGet(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()
		if secrets == nil {
			t.Fatal("Secrets store should not be nil")
		}

		// 测试 Set
		err := secrets.Set("OPENAI_KEY", "sk-proj-abc123xyz")
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// 测试 Get
		value, err := secrets.Get("OPENAI_KEY")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}

		if value != "sk-proj-abc123xyz" {
			t.Errorf("Value mismatch: got %q, want %q", value, "sk-proj-abc123xyz")
		}
	})
}

// TestSecretsStore_GetNotFound 测试获取不存在的 Key
func TestSecretsStore_GetNotFound(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		_, err := secrets.Get("NONEXISTENT_KEY")
		if err != core.ErrSecretNotFound {
			t.Errorf("Expected ErrSecretNotFound, got %v", err)
		}
	})
}

// TestSecretsStore_GetWithDefault 测试带默认值的 Get
func TestSecretsStore_GetWithDefault(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 不存在的 Key 返回默认值
		value := secrets.GetWithDefault("NONEXISTENT", "default-value")
		if value != "default-value" {
			t.Errorf("Expected default value, got %q", value)
		}

		// 存在的 Key 返回实际值
		secrets.Set("EXISTING_KEY", "actual-value")
		value = secrets.GetWithDefault("EXISTING_KEY", "default-value")
		if value != "actual-value" {
			t.Errorf("Expected actual value, got %q", value)
		}
	})
}

// TestSecretsStore_Delete 测试删除操作
func TestSecretsStore_Delete(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 先创建
		secrets.Set("TO_DELETE", "value")

		// 验证存在
		_, err := secrets.Get("TO_DELETE")
		if err != nil {
			t.Fatalf("Key should exist before delete: %v", err)
		}

		// 删除
		err = secrets.Delete("TO_DELETE")
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		// 验证不存在
		_, err = secrets.Get("TO_DELETE")
		if err != core.ErrSecretNotFound {
			t.Errorf("Key should not exist after delete, got error: %v", err)
		}
	})
}

// TestSecretsStore_Exists 测试存在性检查
func TestSecretsStore_Exists(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 不存在
		exists, err := secrets.Exists("NOT_EXISTS")
		if err != nil {
			t.Fatalf("Exists failed: %v", err)
		}
		if exists {
			t.Error("Key should not exist")
		}

		// 创建后存在
		secrets.Set("EXISTS_KEY", "value")
		exists, err = secrets.Exists("EXISTS_KEY")
		if err != nil {
			t.Fatalf("Exists failed: %v", err)
		}
		if !exists {
			t.Error("Key should exist")
		}
	})
}

// TestSecretsStore_Overwrite 测试覆盖写入
func TestSecretsStore_Overwrite(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 第一次写入
		secrets.Set("OVERWRITE_KEY", "value1")
		value, _ := secrets.Get("OVERWRITE_KEY")
		if value != "value1" {
			t.Errorf("First value mismatch: got %q", value)
		}

		// 覆盖写入
		secrets.Set("OVERWRITE_KEY", "value2")
		value, _ = secrets.Get("OVERWRITE_KEY")
		if value != "value2" {
			t.Errorf("Overwritten value mismatch: got %q", value)
		}
	})
}

// TestSecretsStore_List 测试列表操作
func TestSecretsStore_List(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 创建多个 Secrets
		secrets.Set("LIST_KEY_1", "value1")
		secrets.Set("LIST_KEY_2", "value2")
		secrets.Set("LIST_KEY_3", "value3")

		// 获取列表
		list, err := secrets.List()
		if err != nil {
			t.Fatalf("List failed: %v", err)
		}

		if len(list) < 3 {
			t.Errorf("Expected at least 3 secrets, got %d", len(list))
		}

		// 验证掩码显示
		for _, info := range list {
			if info.Key == "LIST_KEY_1" {
				// 值应该被掩码
				if info.MaskedValue == "value1" {
					t.Error("Value should be masked, not plain text")
				}
			}
		}
	})
}

// TestSecretsStore_EncryptionVerification 测试加密验证
func TestSecretsStore_EncryptionVerification(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		plaintext := "super-secret-api-key-12345"
		secrets.Set("ENCRYPTED_KEY", plaintext)

		// 直接从数据库读取，验证值是加密的
		var storedValue string
		err := app.DB().NewQuery(`
			SELECT value FROM _secrets WHERE key = {:key}
		`).Bind(map[string]any{"key": "ENCRYPTED_KEY"}).Row(&storedValue)

		if err != nil {
			t.Fatalf("Direct DB query failed: %v", err)
		}

		// 存储的值不应该是明文
		if storedValue == plaintext {
			t.Error("Stored value should be encrypted, not plaintext")
		}

		// 存储的值应该是 Base64 编码的密文
		if len(storedValue) == 0 {
			t.Error("Stored value should not be empty")
		}
	})
}

// TestSecretsStore_DisabledWithoutMasterKey 测试未设置 Master Key 时的行为
func TestSecretsStore_DisabledWithoutMasterKey(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 不设置 Master Key - DualDBTest 创建的 app 没有设置 Master Key
		secrets := app.Secrets()
		if secrets == nil {
			t.Fatal("Secrets store should not be nil even when disabled")
		}

		// Set 应该返回错误
		err := secrets.Set("KEY", "value")
		if err != core.ErrSecretsDisabled {
			t.Errorf("Expected ErrSecretsDisabled, got %v", err)
		}

		// Get 应该返回错误
		_, err = secrets.Get("KEY")
		if err != core.ErrSecretsDisabled {
			t.Errorf("Expected ErrSecretsDisabled, got %v", err)
		}
	})
}

// TestSecretsStore_SpecialCharacters 测试特殊字符
func TestSecretsStore_SpecialCharacters(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		testCases := []struct {
			name  string
			key   string
			value string
		}{
			{"unicode", "UNICODE_KEY", "你好世界 🔐"},
			{"special chars", "SPECIAL_KEY", "!@#$%^&*()_+-=[]{}|;':\",./<>?"},
			{"newlines", "NEWLINE_KEY", "line1\nline2\nline3"},
			{"json", "JSON_KEY", `{"api_key": "sk-123", "org": "test"}`},
			{"empty value", "EMPTY_KEY", ""},
			{"long value", "LONG_KEY", string(make([]byte, 4000))},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := secrets.Set(tc.key, tc.value)
				if err != nil {
					t.Fatalf("Set failed: %v", err)
				}

				value, err := secrets.Get(tc.key)
				if err != nil {
					t.Fatalf("Get failed: %v", err)
				}

				if value != tc.value {
					t.Errorf("Value mismatch: got %q, want %q", value, tc.value)
				}
			})
		}
	})
}

// TestSecretsStore_WithDescription 测试带描述的 Secret
func TestSecretsStore_WithDescription(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		err := secrets.Set("DESCRIBED_KEY", "value", core.WithDescription("This is a test API key"))
		if err != nil {
			t.Fatalf("Set with description failed: %v", err)
		}

		// 获取列表验证描述
		list, _ := secrets.List()
		for _, info := range list {
			if info.Key == "DESCRIBED_KEY" {
				if info.Description != "This is a test API key" {
					t.Errorf("Description mismatch: got %q", info.Description)
				}
				return
			}
		}
		t.Error("Secret with description not found in list")
	})
}

// TestSecretsStore_KeyValidation 测试 Key 验证
func TestSecretsStore_KeyValidation(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 空 Key 应该失败
		err := secrets.Set("", "value")
		if err == nil {
			t.Error("Empty key should fail")
		}

		// 过长的 Key 应该失败
		longKey := string(make([]byte, 300))
		err = secrets.Set(longKey, "value")
		if err == nil {
			t.Error("Too long key should fail")
		}
	})
}

// TestSecretsStore_ValueSizeLimit 测试 Value 大小限制
func TestSecretsStore_ValueSizeLimit(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 超过 4KB 的值应该失败
		largeValue := string(make([]byte, 5000))
		err := secrets.Set("LARGE_KEY", largeValue)
		if err == nil {
			t.Error("Value exceeding 4KB should fail")
		}
	})
}

// TestSecretsStore_WithEnv 测试环境隔离
func TestSecretsStore_WithEnv(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 创建不同环境的 Secret
		err := secrets.Set("DB_PASSWORD", "dev-password", core.WithEnv("dev"))
		if err != nil {
			t.Fatalf("Set with dev env failed: %v", err)
		}

		err = secrets.Set("DB_PASSWORD", "prod-password", core.WithEnv("prod"))
		if err != nil {
			t.Fatalf("Set with prod env failed: %v", err)
		}

		// 获取 dev 环境的值
		devValue, err := secrets.GetForEnv("DB_PASSWORD", "dev")
		if err != nil {
			t.Fatalf("GetForEnv dev failed: %v", err)
		}
		if devValue != "dev-password" {
			t.Errorf("Dev value mismatch: got %q, want %q", devValue, "dev-password")
		}

		// 获取 prod 环境的值
		prodValue, err := secrets.GetForEnv("DB_PASSWORD", "prod")
		if err != nil {
			t.Fatalf("GetForEnv prod failed: %v", err)
		}
		if prodValue != "prod-password" {
			t.Errorf("Prod value mismatch: got %q, want %q", prodValue, "prod-password")
		}
	})
}

// TestSecretsStore_EnvFallbackToGlobal 测试环境 fallback 到 global
func TestSecretsStore_EnvFallbackToGlobal(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 只创建 global 环境的 Secret
		err := secrets.Set("GLOBAL_KEY", "global-value")
		if err != nil {
			t.Fatalf("Set global failed: %v", err)
		}

		// 获取 dev 环境应该 fallback 到 global
		value, err := secrets.GetForEnv("GLOBAL_KEY", "dev")
		if err != nil {
			t.Fatalf("GetForEnv with fallback failed: %v", err)
		}
		if value != "global-value" {
			t.Errorf("Fallback value mismatch: got %q, want %q", value, "global-value")
		}
	})
}

// TestSecretsStore_MaskSecretValue 测试值掩码
func TestSecretsStore_MaskSecretValue(t *testing.T) {
	testCases := []struct {
		name     string
		value    string
		expected string
	}{
		{"short value", "abc", "***"},
		{"exactly 6 chars", "123456", "***"},
		{"7 chars", "1234567", "123456***"},
		{"long value", "sk-proj-abc123xyz", "sk-pro***"},
		{"empty value", "", "***"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			masked := core.MaskSecretValue(tc.value)
			if masked != tc.expected {
				t.Errorf("Mask mismatch: got %q, want %q", masked, tc.expected)
			}
		})
	}
}

// TestSecretsStore_DeleteNonExistent 测试删除不存在的 Key
func TestSecretsStore_DeleteNonExistent(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		// 删除不存在的 Key 应该不报错（幂等操作）
		err := secrets.Delete("NONEXISTENT_DELETE_KEY")
		if err != nil {
			t.Errorf("Delete nonexistent key should not fail: %v", err)
		}
	})
}

// TestSecretsStore_IsEnabled 测试 IsEnabled 方法
func TestSecretsStore_IsEnabled(t *testing.T) {
	runSecretsTestWithMasterKey(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		secrets := app.Secrets()

		if !secrets.IsEnabled() {
			t.Error("Secrets should be enabled when Master Key is set")
		}
	})
}
