package core

import (
	"encoding/hex"
	"os"
	"testing"
)

// TestLoadMasterKey_FromEnv 测试从环境变量加载 Master Key
func TestLoadMasterKey_FromEnv(t *testing.T) {
	// 生成有效的 64 字符 hex 字符串 (32 bytes)
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	// 设置环境变量
	os.Setenv(MasterKeyEnvVar, validKey)
	defer os.Unsetenv(MasterKeyEnvVar)

	key, err := LoadMasterKey()
	if err != nil {
		t.Fatalf("LoadMasterKey failed: %v", err)
	}

	if len(key) != 32 {
		t.Errorf("Expected key length 32, got %d", len(key))
	}

	// 验证解码正确
	expected, _ := hex.DecodeString(validKey)
	for i, b := range key {
		if b != expected[i] {
			t.Errorf("Key byte %d mismatch: got %d, want %d", i, b, expected[i])
		}
	}
}

// TestLoadMasterKey_NotSet 测试未设置环境变量
func TestLoadMasterKey_NotSet(t *testing.T) {
	os.Unsetenv(MasterKeyEnvVar)

	key, err := LoadMasterKey()
	if err != ErrMasterKeyNotSet {
		t.Errorf("Expected ErrMasterKeyNotSet, got %v", err)
	}
	if key != nil {
		t.Error("Key should be nil when not set")
	}
}

// TestLoadMasterKey_Empty 测试空环境变量
func TestLoadMasterKey_Empty(t *testing.T) {
	os.Setenv(MasterKeyEnvVar, "")
	defer os.Unsetenv(MasterKeyEnvVar)

	key, err := LoadMasterKey()
	if err != ErrMasterKeyNotSet {
		t.Errorf("Expected ErrMasterKeyNotSet, got %v", err)
	}
	if key != nil {
		t.Error("Key should be nil when empty")
	}
}

// TestValidateMasterKey 测试 Master Key 格式验证
func TestValidateMasterKey(t *testing.T) {
	testCases := []struct {
		name        string
		key         string
		expectError bool
	}{
		{
			"valid 64 hex chars lowercase",
			"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			false,
		},
		{
			"valid 64 hex chars uppercase",
			"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
			false,
		},
		{
			"valid 64 hex chars mixed case",
			"0123456789AbCdEf0123456789aBcDeF0123456789abcdef0123456789ABCDEF",
			false,
		},
		{
			"too short - 32 chars",
			"0123456789abcdef0123456789abcdef",
			true,
		},
		{
			"too long - 128 chars",
			"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			true,
		},
		{
			"invalid chars - contains g",
			"0123456789abcdefg123456789abcdef0123456789abcdef0123456789abcdef",
			true,
		},
		{
			"invalid chars - contains space",
			"0123456789abcdef 123456789abcdef0123456789abcdef0123456789abcdef",
			true,
		},
		{
			"empty string",
			"",
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateMasterKey(tc.key)
			if tc.expectError && err == nil {
				t.Error("Expected error but got nil")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
		})
	}
}

// TestLoadMasterKey_InvalidFormat 测试无效格式的 Master Key
func TestLoadMasterKey_InvalidFormat(t *testing.T) {
	testCases := []struct {
		name string
		key  string
	}{
		{"too short", "0123456789abcdef"},
		{"invalid hex", "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"},
		{"odd length", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			os.Setenv(MasterKeyEnvVar, tc.key)
			defer os.Unsetenv(MasterKeyEnvVar)

			_, err := LoadMasterKey()
			if err == nil {
				t.Error("Expected error for invalid key format")
			}
		})
	}
}

// TestSecretsSettings_IsEnabled 测试 Secrets 功能启用状态
func TestSecretsSettings_IsEnabled(t *testing.T) {
	t.Run("enabled when master key set", func(t *testing.T) {
		validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
		os.Setenv(MasterKeyEnvVar, validKey)
		defer os.Unsetenv(MasterKeyEnvVar)

		settings := NewSecretsSettings()
		if err := settings.Initialize(); err != nil {
			t.Fatalf("Initialize failed: %v", err)
		}

		if !settings.IsEnabled() {
			t.Error("Secrets should be enabled when master key is set")
		}
	})

	t.Run("disabled when master key not set", func(t *testing.T) {
		os.Unsetenv(MasterKeyEnvVar)

		settings := NewSecretsSettings()
		err := settings.Initialize()
		// Initialize 不应该返回错误，只是标记为不可用
		if err != nil {
			t.Fatalf("Initialize should not fail: %v", err)
		}

		if settings.IsEnabled() {
			t.Error("Secrets should be disabled when master key is not set")
		}
	})

	t.Run("disabled when master key invalid", func(t *testing.T) {
		os.Setenv(MasterKeyEnvVar, "invalid-key")
		defer os.Unsetenv(MasterKeyEnvVar)

		settings := NewSecretsSettings()
		err := settings.Initialize()
		// Initialize 不应该返回错误，只是标记为不可用
		if err != nil {
			t.Fatalf("Initialize should not fail: %v", err)
		}

		if settings.IsEnabled() {
			t.Error("Secrets should be disabled when master key is invalid")
		}
	})
}

// TestSecretsSettings_GetCryptoEngine 测试获取加密引擎
func TestSecretsSettings_GetCryptoEngine(t *testing.T) {
	validKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	os.Setenv(MasterKeyEnvVar, validKey)
	defer os.Unsetenv(MasterKeyEnvVar)

	settings := NewSecretsSettings()
	settings.Initialize()

	engine := settings.CryptoEngine()
	if engine == nil {
		t.Fatal("CryptoEngine should not be nil when enabled")
	}

	// 验证加密引擎可以正常工作
	plaintext := "test secret"
	ciphertext, err := engine.Encrypt([]byte(plaintext))
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	decrypted, err := engine.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != plaintext {
		t.Errorf("Decrypted mismatch: got %q, want %q", string(decrypted), plaintext)
	}
}

// TestSecretsSettings_GetCryptoEngine_Disabled 测试禁用状态下获取加密引擎
func TestSecretsSettings_GetCryptoEngine_Disabled(t *testing.T) {
	os.Unsetenv(MasterKeyEnvVar)

	settings := NewSecretsSettings()
	settings.Initialize()

	engine := settings.CryptoEngine()
	if engine != nil {
		t.Error("CryptoEngine should be nil when disabled")
	}
}
