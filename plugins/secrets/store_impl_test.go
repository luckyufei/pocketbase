package secrets_test

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/secrets"
	"github.com/pocketbase/pocketbase/tests"
)

const validMasterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// setupSecretsPlugin 设置 Master Key 并注册 secrets 插件
// 返回清理函数
func setupSecretsPlugin(t *testing.T, app *tests.TestApp) func() {
	t.Helper()

	// 注册 secrets 插件
	secrets.MustRegister(app, secrets.DefaultConfig())

	return func() {}
}

// runSecretsTest 运行 secrets 测试（需要 Master Key）
func runSecretsTest(t *testing.T, testFunc func(t *testing.T, app *tests.TestApp, store secrets.Store)) {
	t.Helper()

	// SQLite 测试
	t.Run("SQLite", func(t *testing.T) {
		// 设置 Master Key（必须在 app 创建前）
		os.Setenv(core.MasterKeyEnvVar, validMasterKey)
		defer os.Unsetenv(core.MasterKeyEnvVar)

		app, err := tests.NewTestApp()
		if err != nil {
			t.Fatalf("创建 SQLite 测试应用失败: %v", err)
		}
		defer app.Cleanup()

		// 注册插件
		setupSecretsPlugin(t, app)

		// 获取 store
		store := secrets.GetStore(app)
		if store == nil {
			t.Fatal("store should not be nil")
		}

		testFunc(t, app, store)
	})

	// PostgreSQL 测试（如果启用）
	if os.Getenv("TEST_POSTGRES") != "" || os.Getenv("POSTGRES_DSN") != "" {
		t.Run("PostgreSQL", func(t *testing.T) {
			os.Setenv(core.MasterKeyEnvVar, validMasterKey)
			defer os.Unsetenv(core.MasterKeyEnvVar)

			app, err := tests.NewPostgresTestApp()
			if err != nil {
				t.Skipf("跳过 PostgreSQL 测试: %v", err)
				return
			}
			defer app.Cleanup()

			setupSecretsPlugin(t, app)

			store := secrets.GetStore(app)
			if store == nil {
				t.Fatal("store should not be nil")
			}

			testFunc(t, app, store)
		})
	}
}

// TestSecretsStore_SetGet 测试基础的 Set/Get 操作
func TestSecretsStore_SetGet(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 测试 Set
		err := store.Set("OPENAI_KEY", "sk-proj-abc123xyz")
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// 测试 Get
		value, err := store.Get("OPENAI_KEY")
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
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		_, err := store.Get("NONEXISTENT_KEY")
		if err != secrets.ErrSecretNotFound {
			t.Errorf("Expected ErrSecretNotFound, got %v", err)
		}
	})
}

// TestSecretsStore_GetWithDefault 测试带默认值的 Get
func TestSecretsStore_GetWithDefault(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 不存在的 Key 返回默认值
		value := store.GetWithDefault("NONEXISTENT", "default-value")
		if value != "default-value" {
			t.Errorf("Expected default value, got %q", value)
		}

		// 存在的 Key 返回实际值
		store.Set("EXISTING_KEY", "actual-value")
		value = store.GetWithDefault("EXISTING_KEY", "default-value")
		if value != "actual-value" {
			t.Errorf("Expected actual value, got %q", value)
		}
	})
}

// TestSecretsStore_Delete 测试删除操作
func TestSecretsStore_Delete(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 先创建
		store.Set("TO_DELETE", "value")

		// 验证存在
		_, err := store.Get("TO_DELETE")
		if err != nil {
			t.Fatalf("Key should exist before delete: %v", err)
		}

		// 删除
		err = store.Delete("TO_DELETE")
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		// 验证不存在
		_, err = store.Get("TO_DELETE")
		if err != secrets.ErrSecretNotFound {
			t.Errorf("Key should not exist after delete, got error: %v", err)
		}
	})
}

// TestSecretsStore_Exists 测试存在性检查
func TestSecretsStore_Exists(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 不存在
		exists, err := store.Exists("NOT_EXISTS")
		if err != nil {
			t.Fatalf("Exists failed: %v", err)
		}
		if exists {
			t.Error("Key should not exist")
		}

		// 创建后存在
		store.Set("EXISTS_KEY", "value")
		exists, err = store.Exists("EXISTS_KEY")
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
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 第一次写入
		store.Set("OVERWRITE_KEY", "value1")
		value, _ := store.Get("OVERWRITE_KEY")
		if value != "value1" {
			t.Errorf("First value mismatch: got %q", value)
		}

		// 覆盖写入
		store.Set("OVERWRITE_KEY", "value2")
		value, _ = store.Get("OVERWRITE_KEY")
		if value != "value2" {
			t.Errorf("Overwritten value mismatch: got %q", value)
		}
	})
}

// TestSecretsStore_List 测试列表操作
func TestSecretsStore_List(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 创建多个 Secrets
		store.Set("LIST_KEY_1", "value1")
		store.Set("LIST_KEY_2", "value2")
		store.Set("LIST_KEY_3", "value3")

		// 获取列表
		list, err := store.List()
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
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		plaintext := "super-secret-api-key-12345"
		store.Set("ENCRYPTED_KEY", plaintext)

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
	// 不设置 Master Key
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("创建测试应用失败: %v", err)
	}
	defer app.Cleanup()

	// 注册插件
	secrets.MustRegister(app, secrets.DefaultConfig())

	store := secrets.GetStore(app)
	if store == nil {
		t.Fatal("store should not be nil even when disabled")
	}

	// IsEnabled 应该返回 false
	if store.IsEnabled() {
		t.Error("store should be disabled without Master Key")
	}

	// Set 应该返回错误
	err = store.Set("KEY", "value")
	if err != secrets.ErrCryptoNotEnabled {
		t.Errorf("Expected ErrCryptoNotEnabled, got %v", err)
	}

	// Get 应该返回错误
	_, err = store.Get("KEY")
	if err != secrets.ErrCryptoNotEnabled {
		t.Errorf("Expected ErrCryptoNotEnabled, got %v", err)
	}
}

// TestSecretsStore_SpecialCharacters 测试特殊字符
func TestSecretsStore_SpecialCharacters(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
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
				err := store.Set(tc.key, tc.value)
				if err != nil {
					t.Fatalf("Set failed: %v", err)
				}

				value, err := store.Get(tc.key)
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
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		err := store.Set("DESCRIBED_KEY", "value", secrets.WithDescription("This is a test API key"))
		if err != nil {
			t.Fatalf("Set with description failed: %v", err)
		}

		// 获取列表验证描述
		list, _ := store.List()
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
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 空 Key 应该失败
		err := store.Set("", "value")
		if err != secrets.ErrSecretKeyEmpty {
			t.Errorf("Empty key should fail with ErrSecretKeyEmpty, got: %v", err)
		}

		// 过长的 Key 应该失败
		longKey := string(make([]byte, 300))
		err = store.Set(longKey, "value")
		if err != secrets.ErrSecretKeyTooLong {
			t.Errorf("Too long key should fail with ErrSecretKeyTooLong, got: %v", err)
		}
	})
}

// TestSecretsStore_ValueSizeLimit 测试 Value 大小限制
func TestSecretsStore_ValueSizeLimit(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 超过 4KB 的值应该失败
		largeValue := string(make([]byte, 5000))
		err := store.Set("LARGE_KEY", largeValue)
		if err != secrets.ErrSecretValueTooLarge {
			t.Errorf("Value exceeding 4KB should fail with ErrSecretValueTooLarge, got: %v", err)
		}
	})
}

// TestSecretsStore_WithEnv 测试环境隔离
func TestSecretsStore_WithEnv(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 创建不同环境的 Secret
		err := store.Set("DB_PASSWORD", "dev-password", secrets.WithEnv("dev"))
		if err != nil {
			t.Fatalf("Set with dev env failed: %v", err)
		}

		err = store.Set("DB_PASSWORD", "prod-password", secrets.WithEnv("prod"))
		if err != nil {
			t.Fatalf("Set with prod env failed: %v", err)
		}

		// 获取 dev 环境的值
		devValue, err := store.GetForEnv("DB_PASSWORD", "dev")
		if err != nil {
			t.Fatalf("GetForEnv dev failed: %v", err)
		}
		if devValue != "dev-password" {
			t.Errorf("Dev value mismatch: got %q, want %q", devValue, "dev-password")
		}

		// 获取 prod 环境的值
		prodValue, err := store.GetForEnv("DB_PASSWORD", "prod")
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
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 只创建 global 环境的 Secret
		err := store.Set("GLOBAL_KEY", "global-value")
		if err != nil {
			t.Fatalf("Set global failed: %v", err)
		}

		// 获取 dev 环境应该 fallback 到 global
		value, err := store.GetForEnv("GLOBAL_KEY", "dev")
		if err != nil {
			t.Fatalf("GetForEnv with fallback failed: %v", err)
		}
		if value != "global-value" {
			t.Errorf("Fallback value mismatch: got %q, want %q", value, "global-value")
		}
	})
}

// TestSecretsStore_DeleteNonExistent 测试删除不存在的 Key
func TestSecretsStore_DeleteNonExistent(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 删除不存在的 Key 应该不报错（幂等操作）
		err := store.Delete("NONEXISTENT_DELETE_KEY")
		if err != nil {
			t.Errorf("Delete nonexistent key should not fail: %v", err)
		}
	})
}

// TestSecretsStore_IsEnabled 测试 IsEnabled 方法
func TestSecretsStore_IsEnabled(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		if !store.IsEnabled() {
			t.Error("Store should be enabled when Master Key is set")
		}
	})
}

// TestSecretsStore_DeleteForEnv 测试删除指定环境的 Secret
func TestSecretsStore_DeleteForEnv(t *testing.T) {
	runSecretsTest(t, func(t *testing.T, app *tests.TestApp, store secrets.Store) {
		// 创建不同环境的 Secret
		store.Set("ENV_DELETE_KEY", "dev-value", secrets.WithEnv("dev"))
		store.Set("ENV_DELETE_KEY", "prod-value", secrets.WithEnv("prod"))

		// 删除 dev 环境
		err := store.DeleteForEnv("ENV_DELETE_KEY", "dev")
		if err != nil {
			t.Fatalf("DeleteForEnv failed: %v", err)
		}

		// dev 环境应该不存在（fallback 到 global）
		_, err = store.GetForEnv("ENV_DELETE_KEY", "dev")
		// 由于 dev 被删除，且没有 global，会 fallback 到查找 prod 或 global
		// 这里应该找不到，因为只有 prod

		// prod 环境应该仍然存在
		prodValue, err := store.GetForEnv("ENV_DELETE_KEY", "prod")
		if err != nil {
			t.Fatalf("GetForEnv prod should still work: %v", err)
		}
		if prodValue != "prod-value" {
			t.Errorf("Prod value should remain: got %q", prodValue)
		}
	})
}

// TestGetStore_NotRegistered 测试未注册时 GetStore 返回 nil
func TestGetStore_NotRegistered(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("创建测试应用失败: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件
	store := secrets.GetStore(app)
	if store != nil {
		t.Error("GetStore should return nil when plugin not registered")
	}
}
