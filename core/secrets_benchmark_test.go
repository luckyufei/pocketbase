package core

import (
	"crypto/rand"
	"testing"
)

// BenchmarkCryptoEngine_Encrypt 基准测试加密性能
func BenchmarkCryptoEngine_Encrypt(b *testing.B) {
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		b.Fatalf("Failed to create crypto engine: %v", err)
	}

	plaintext := []byte("sk-proj-abc123xyz-secret-api-key-value")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := engine.Encrypt(plaintext)
		if err != nil {
			b.Fatalf("Encrypt failed: %v", err)
		}
	}
}

// BenchmarkCryptoEngine_Decrypt 基准测试解密性能
func BenchmarkCryptoEngine_Decrypt(b *testing.B) {
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		b.Fatalf("Failed to create crypto engine: %v", err)
	}

	plaintext := []byte("sk-proj-abc123xyz-secret-api-key-value")
	ciphertext, _ := engine.Encrypt(plaintext)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := engine.Decrypt(ciphertext)
		if err != nil {
			b.Fatalf("Decrypt failed: %v", err)
		}
	}
}

// BenchmarkCryptoEngine_EncryptToBase64 基准测试 Base64 加密性能
func BenchmarkCryptoEngine_EncryptToBase64(b *testing.B) {
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		b.Fatalf("Failed to create crypto engine: %v", err)
	}

	plaintext := "sk-proj-abc123xyz-secret-api-key-value"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := engine.EncryptToBase64(plaintext)
		if err != nil {
			b.Fatalf("EncryptToBase64 failed: %v", err)
		}
	}
}

// BenchmarkCryptoEngine_DecryptFromBase64 基准测试 Base64 解密性能
func BenchmarkCryptoEngine_DecryptFromBase64(b *testing.B) {
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		b.Fatalf("Failed to create crypto engine: %v", err)
	}

	plaintext := "sk-proj-abc123xyz-secret-api-key-value"
	encoded, _ := engine.EncryptToBase64(plaintext)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := engine.DecryptFromBase64(encoded)
		if err != nil {
			b.Fatalf("DecryptFromBase64 failed: %v", err)
		}
	}
}

// BenchmarkSecureZero 基准测试安全擦除性能
func BenchmarkSecureZero(b *testing.B) {
	data := make([]byte, 1024) // 1KB buffer
	rand.Read(data)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SecureZero(data)
	}
}

// BenchmarkMaskSecretValue 基准测试值掩码性能
func BenchmarkMaskSecretValue(b *testing.B) {
	value := "sk-proj-abc123xyz-secret-api-key-value-long-string"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		MaskSecretValue(value)
	}
}
