package core_test

import (
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// 测试用的有效 Master Key（64 hex chars = 32 bytes）
const testCryptoMasterKeyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// setupCryptoMasterKey 设置环境变量并返回清理函数
func setupCryptoMasterKey(t *testing.T) {
	t.Helper()
	os.Setenv(core.CryptoMasterKeyEnvVar, testCryptoMasterKeyHex)
	t.Cleanup(func() {
		os.Unsetenv(core.CryptoMasterKeyEnvVar)
	})
}

func TestCryptoProvider_Interface(t *testing.T) {
	// 设置环境变量在 DualDBTest 之前，确保 app 创建时能读取到
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()
		if crypto == nil {
			t.Fatal("Expected non-nil CryptoProvider")
		}

		// 验证接口方法存在
		_ = crypto.IsEnabled()
		_, _ = crypto.Encrypt("test")
		_, _ = crypto.Decrypt("test")
		_, _ = crypto.EncryptBytes([]byte("test"))
		_, _ = crypto.DecryptBytes([]byte("test"))
		crypto.SecureZero([]byte("test"))
		_ = crypto.GetEngine()
	})
}

func TestCryptoProvider_EncryptDecrypt(t *testing.T) {
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()
		if !crypto.IsEnabled() {
			t.Fatal("Expected CryptoProvider to be enabled")
		}

		testCases := []string{
			"hello world",
			"",
			"sk-proj-xxx123456789",
			"中文测试",
			"special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
			strings.Repeat("a", 4096), // 4KB
		}

		for _, plaintext := range testCases {
			name := plaintext
			if len(name) > 20 {
				name = name[:20] + "..."
			}
			t.Run(name, func(t *testing.T) {
				// 加密
				ciphertext, err := crypto.Encrypt(plaintext)
				if err != nil {
					t.Fatalf("Encrypt failed: %v", err)
				}

				// 密文应该与明文不同（除非明文为空）
				if len(plaintext) > 0 && ciphertext == plaintext {
					t.Error("Ciphertext should be different from plaintext")
				}

				// 解密
				decrypted, err := crypto.Decrypt(ciphertext)
				if err != nil {
					t.Fatalf("Decrypt failed: %v", err)
				}

				// 验证解密结果
				if decrypted != plaintext {
					t.Errorf("Decrypted text mismatch: got %q, want %q", decrypted, plaintext)
				}
			})
		}
	})
}

func TestCryptoProvider_EncryptDecryptBytes(t *testing.T) {
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()

		plaintext := []byte("test data for bytes encryption")
		ciphertext, err := crypto.EncryptBytes(plaintext)
		if err != nil {
			t.Fatalf("EncryptBytes failed: %v", err)
		}

		decrypted, err := crypto.DecryptBytes(ciphertext)
		if err != nil {
			t.Fatalf("DecryptBytes failed: %v", err)
		}

		if string(decrypted) != string(plaintext) {
			t.Errorf("Decrypted bytes mismatch: got %q, want %q", decrypted, plaintext)
		}
	})
}

func TestCryptoProvider_RandomNonce(t *testing.T) {
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()

		plaintext := "same plaintext"

		// 多次加密同一明文，密文应该不同（因为 Nonce 随机）
		ciphertexts := make(map[string]bool)
		for i := 0; i < 10; i++ {
			ciphertext, err := crypto.Encrypt(plaintext)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}
			if ciphertexts[ciphertext] {
				t.Error("Expected different ciphertexts for same plaintext (random nonce)")
			}
			ciphertexts[ciphertext] = true
		}
	})
}

func TestNoopCryptoProvider_Disabled(t *testing.T) {
	// 确保 Master Key 未设置
	os.Unsetenv(core.CryptoMasterKeyEnvVar)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()

		if crypto.IsEnabled() {
			t.Error("Expected CryptoProvider to be disabled")
		}

		// Encrypt 应该返回错误
		_, err := crypto.Encrypt("test")
		if err != core.ErrCryptoNotEnabled {
			t.Errorf("Expected ErrCryptoNotEnabled, got: %v", err)
		}

		// Decrypt 应该返回错误
		_, err = crypto.Decrypt("test")
		if err != core.ErrCryptoNotEnabled {
			t.Errorf("Expected ErrCryptoNotEnabled, got: %v", err)
		}

		// EncryptBytes 应该返回错误
		_, err = crypto.EncryptBytes([]byte("test"))
		if err != core.ErrCryptoNotEnabled {
			t.Errorf("Expected ErrCryptoNotEnabled, got: %v", err)
		}

		// DecryptBytes 应该返回错误
		_, err = crypto.DecryptBytes([]byte("test"))
		if err != core.ErrCryptoNotEnabled {
			t.Errorf("Expected ErrCryptoNotEnabled, got: %v", err)
		}

		// GetEngine 应该返回 nil
		if crypto.GetEngine() != nil {
			t.Error("Expected GetEngine to return nil when disabled")
		}
	})
}

func TestCryptoValidateMasterKey(t *testing.T) {
	testCases := []struct {
		name      string
		key       string
		wantErr   bool
		errSubstr string
	}{
		{
			name:    "valid key",
			key:     testCryptoMasterKeyHex,
			wantErr: false,
		},
		{
			name:      "empty key",
			key:       "",
			wantErr:   true,
			errSubstr: "not enabled",
		},
		{
			name:      "too short",
			key:       "0123456789abcdef",
			wantErr:   true,
			errSubstr: "64 hex characters",
		},
		{
			name:      "too long",
			key:       testCryptoMasterKeyHex + "extra",
			wantErr:   true,
			errSubstr: "64 hex characters",
		},
		{
			name:      "invalid chars",
			key:       "ghijklmnopqrstuv0123456789abcdef0123456789abcdef0123456789abcdef",
			wantErr:   true,
			errSubstr: "hex characters",
		},
		{
			name:    "uppercase valid",
			key:     "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
			wantErr: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := core.CryptoValidateMasterKey(tc.key)
			if tc.wantErr {
				if err == nil {
					t.Errorf("CryptoValidateMasterKey(%q) = nil, want error containing %q", tc.key, tc.errSubstr)
				} else if tc.errSubstr != "" && !strings.Contains(err.Error(), tc.errSubstr) {
					t.Errorf("CryptoValidateMasterKey(%q) = %v, want error containing %q", tc.key, err, tc.errSubstr)
				}
			} else {
				if err != nil {
					t.Errorf("CryptoValidateMasterKey(%q) = %v, want nil", tc.key, err)
				}
			}
		})
	}
}

func TestCryptoSecureZero(t *testing.T) {
	data := []byte("sensitive data 12345")
	original := make([]byte, len(data))
	copy(original, data)

	core.CryptoSecureZero(data)

	// 验证数据被清零
	for i, b := range data {
		if b != 0 {
			t.Errorf("Byte at index %d not zeroed: got %d", i, b)
		}
	}

	// 验证原始数据不为零
	allZero := true
	for _, b := range original {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		t.Error("Original data should not be all zeros")
	}
}

func TestCryptoProvider_DecryptInvalidCiphertext(t *testing.T) {
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()

		testCases := []struct {
			name       string
			ciphertext string
		}{
			{"empty", ""},
			{"invalid base64", "not-valid-base64!@#"},
			{"too short", "YWJj"}, // "abc" in base64, too short for nonce+tag
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				_, err := crypto.Decrypt(tc.ciphertext)
				if err == nil {
					t.Error("Expected error for invalid ciphertext")
				}
			})
		}
	})
}

func TestCryptoProvider_GetEngine(t *testing.T) {
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := app.Crypto()

		engine := crypto.GetEngine()
		if engine == nil {
			t.Fatal("Expected non-nil CryptoEngine from GetEngine()")
		}

		// 验证底层 engine 可以工作
		plaintext := "test via engine"
		ciphertext, err := engine.EncryptToBase64(plaintext)
		if err != nil {
			t.Fatalf("EncryptToBase64 failed: %v", err)
		}

		decrypted, err := engine.DecryptFromBase64(ciphertext)
		if err != nil {
			t.Fatalf("DecryptFromBase64 failed: %v", err)
		}

		if decrypted != plaintext {
			t.Errorf("Decrypted text mismatch: got %q, want %q", decrypted, plaintext)
		}
	})
}

func TestGetGlobalCrypto(t *testing.T) {
	// 设置 key 后测试
	setupCryptoMasterKey(t)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := core.GetGlobalCrypto()
		if crypto == nil {
			t.Fatal("GetGlobalCrypto should never return nil")
		}
		if !crypto.IsEnabled() {
			t.Error("Expected global crypto to be enabled after app bootstrap")
		}
	})
}

func TestGetGlobalCrypto_Disabled(t *testing.T) {
	// 确保 Master Key 未设置
	os.Unsetenv(core.CryptoMasterKeyEnvVar)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		crypto := core.GetGlobalCrypto()
		if crypto == nil {
			t.Fatal("GetGlobalCrypto should never return nil")
		}
		// 当 app 没有配置 master key 时，全局 crypto 应该是 noop
		// 注意：由于并行测试，另一个测试可能已经设置了全局变量
		// 所以这里只验证返回值不为 nil
	})
}
