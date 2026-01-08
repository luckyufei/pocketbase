package core

import (
	"bytes"
	"crypto/rand"
	"testing"
)

// TestCryptoEngine_EncryptDecrypt 测试加密/解密往返
func TestCryptoEngine_EncryptDecrypt(t *testing.T) {
	// 生成测试用 Master Key (32 bytes)
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		t.Fatalf("Failed to generate master key: %v", err)
	}

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		t.Fatalf("Failed to create crypto engine: %v", err)
	}

	testCases := []struct {
		name      string
		plaintext string
	}{
		{"empty string", ""},
		{"short string", "hello"},
		{"medium string", "This is a test secret value!"},
		{"long string", string(make([]byte, 4096))},
		{"unicode string", "你好世界 🔐 密钥管理"},
		{"special chars", "sk-proj-abc123!@#$%^&*()"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// 加密
			ciphertext, err := engine.Encrypt([]byte(tc.plaintext))
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			// 密文应该与明文不同（除非明文为空）
			if len(tc.plaintext) > 0 && bytes.Equal(ciphertext, []byte(tc.plaintext)) {
				t.Error("Ciphertext should not equal plaintext")
			}

			// 解密
			decrypted, err := engine.Decrypt(ciphertext)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			// 验证解密结果
			if string(decrypted) != tc.plaintext {
				t.Errorf("Decrypted text mismatch: got %q, want %q", string(decrypted), tc.plaintext)
			}
		})
	}
}

// TestCryptoEngine_NonceUniqueness 测试 Nonce 唯一性
func TestCryptoEngine_NonceUniqueness(t *testing.T) {
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		t.Fatalf("Failed to generate master key: %v", err)
	}

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		t.Fatalf("Failed to create crypto engine: %v", err)
	}

	plaintext := []byte("test secret")
	nonces := make(map[string]bool)

	// 加密同一明文多次，验证 Nonce 不同
	for i := 0; i < 100; i++ {
		ciphertext, err := engine.Encrypt(plaintext)
		if err != nil {
			t.Fatalf("Encrypt failed: %v", err)
		}

		// 提取 Nonce（前 12 字节）
		nonce := string(ciphertext[:12])
		if nonces[nonce] {
			t.Errorf("Duplicate nonce detected at iteration %d", i)
		}
		nonces[nonce] = true
	}
}

// TestCryptoEngine_TamperDetection 测试篡改检测
func TestCryptoEngine_TamperDetection(t *testing.T) {
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		t.Fatalf("Failed to generate master key: %v", err)
	}

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		t.Fatalf("Failed to create crypto engine: %v", err)
	}

	plaintext := []byte("sensitive data")
	ciphertext, err := engine.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// 篡改密文的不同部分
	testCases := []struct {
		name   string
		tamper func([]byte) []byte
	}{
		{
			"flip bit in nonce",
			func(ct []byte) []byte {
				modified := make([]byte, len(ct))
				copy(modified, ct)
				modified[0] ^= 0x01
				return modified
			},
		},
		{
			"flip bit in ciphertext",
			func(ct []byte) []byte {
				modified := make([]byte, len(ct))
				copy(modified, ct)
				modified[15] ^= 0x01
				return modified
			},
		},
		{
			"flip bit in auth tag",
			func(ct []byte) []byte {
				modified := make([]byte, len(ct))
				copy(modified, ct)
				modified[len(modified)-1] ^= 0x01
				return modified
			},
		},
		{
			"truncate ciphertext",
			func(ct []byte) []byte {
				return ct[:len(ct)-5]
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tampered := tc.tamper(ciphertext)
			_, err := engine.Decrypt(tampered)
			if err == nil {
				t.Error("Expected decryption to fail for tampered ciphertext")
			}
		})
	}
}

// TestCryptoEngine_InvalidMasterKey 测试无效 Master Key
func TestCryptoEngine_InvalidMasterKey(t *testing.T) {
	testCases := []struct {
		name      string
		keyLength int
	}{
		{"too short - 16 bytes", 16},
		{"too short - 24 bytes", 24},
		{"too long - 64 bytes", 64},
		{"empty", 0},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			key := make([]byte, tc.keyLength)
			_, err := NewCryptoEngine(key)
			if err == nil {
				t.Error("Expected error for invalid key length")
			}
		})
	}
}

// TestCryptoEngine_WrongKey 测试使用错误的 Key 解密
func TestCryptoEngine_WrongKey(t *testing.T) {
	// 创建两个不同的 Key
	key1 := make([]byte, 32)
	key2 := make([]byte, 32)
	rand.Read(key1)
	rand.Read(key2)

	engine1, _ := NewCryptoEngine(key1)
	engine2, _ := NewCryptoEngine(key2)

	plaintext := []byte("secret data")
	ciphertext, _ := engine1.Encrypt(plaintext)

	// 使用错误的 Key 解密
	_, err := engine2.Decrypt(ciphertext)
	if err == nil {
		t.Error("Expected decryption to fail with wrong key")
	}
}

// TestCryptoEngine_Base64 测试 Base64 编码的加密/解密
func TestCryptoEngine_Base64(t *testing.T) {
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	engine, _ := NewCryptoEngine(masterKey)

	plaintext := "sk-proj-abc123xyz"

	// 加密为 Base64
	encoded, err := engine.EncryptToBase64(plaintext)
	if err != nil {
		t.Fatalf("EncryptToBase64 failed: %v", err)
	}

	// 验证是有效的 Base64 字符串
	if len(encoded) == 0 {
		t.Error("Encoded string should not be empty")
	}

	// 从 Base64 解密
	decrypted, err := engine.DecryptFromBase64(encoded)
	if err != nil {
		t.Fatalf("DecryptFromBase64 failed: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("Decrypted mismatch: got %q, want %q", decrypted, plaintext)
	}
}

// TestSecureZero 测试安全擦除
func TestSecureZero(t *testing.T) {
	data := []byte("sensitive secret key data")
	original := make([]byte, len(data))
	copy(original, data)

	SecureZero(data)

	// 验证所有字节都被清零
	for i, b := range data {
		if b != 0 {
			t.Errorf("Byte at position %d not zeroed: %d", i, b)
		}
	}

	// 验证长度不变
	if len(data) != len(original) {
		t.Errorf("Length changed: got %d, want %d", len(data), len(original))
	}
}

// TestCryptoEngine_CiphertextTooShort 测试密文过短
func TestCryptoEngine_CiphertextTooShort(t *testing.T) {
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	engine, _ := NewCryptoEngine(masterKey)

	// 密文至少需要 12 字节 Nonce + 16 字节 Auth Tag
	shortCiphertexts := [][]byte{
		{},
		{1, 2, 3},
		make([]byte, 11), // 少于 Nonce 长度
		make([]byte, 27), // 少于 Nonce + Tag 长度
	}

	for i, ct := range shortCiphertexts {
		_, err := engine.Decrypt(ct)
		if err == nil {
			t.Errorf("Case %d: Expected error for short ciphertext (len=%d)", i, len(ct))
		}
	}
}
