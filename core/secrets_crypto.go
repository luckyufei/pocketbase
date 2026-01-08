package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"runtime"
)

// 加密相关错误
var (
	// ErrInvalidMasterKeyLength Master Key 长度无效（必须是 32 字节）
	ErrInvalidMasterKeyLength = errors.New("master key must be exactly 32 bytes (256 bits)")

	// ErrInvalidCiphertext 密文格式无效
	ErrInvalidCiphertext = errors.New("invalid ciphertext format")

	// ErrDecryptionFailed 解密失败（可能是密钥错误或数据被篡改）
	ErrDecryptionFailed = errors.New("decryption failed: authentication error")
)

// AES-256-GCM 常量
const (
	// NonceSize GCM Nonce 大小（12 字节）
	NonceSize = 12

	// TagSize GCM 认证标签大小（16 字节）
	TagSize = 16

	// KeySize AES-256 密钥大小（32 字节）
	KeySize = 32
)

// CryptoEngine AES-256-GCM 加密引擎
// 用于加密和解密 Secret 值
type CryptoEngine struct {
	gcm cipher.AEAD
}

// NewCryptoEngine 创建加密引擎实例
// masterKey 必须是 32 字节（256 位）
func NewCryptoEngine(masterKey []byte) (*CryptoEngine, error) {
	if len(masterKey) != KeySize {
		return nil, ErrInvalidMasterKeyLength
	}

	// 创建 AES cipher
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, err
	}

	// 创建 GCM 模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return &CryptoEngine{gcm: gcm}, nil
}

// Encrypt 加密明文
// 返回格式: Nonce (12 bytes) || Ciphertext || Tag (16 bytes)
func (c *CryptoEngine) Encrypt(plaintext []byte) ([]byte, error) {
	// 生成随机 Nonce
	nonce := make([]byte, NonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	// 加密：gcm.Seal 会将 Ciphertext 和 Tag 追加到 nonce 后面
	// 结果格式: Nonce || Ciphertext || Tag
	ciphertext := c.gcm.Seal(nonce, nonce, plaintext, nil)

	return ciphertext, nil
}

// Decrypt 解密密文
// 输入格式: Nonce (12 bytes) || Ciphertext || Tag (16 bytes)
func (c *CryptoEngine) Decrypt(ciphertext []byte) ([]byte, error) {
	// 验证密文最小长度: Nonce + Tag
	if len(ciphertext) < NonceSize+TagSize {
		return nil, ErrInvalidCiphertext
	}

	// 提取 Nonce
	nonce := ciphertext[:NonceSize]
	encryptedData := ciphertext[NonceSize:]

	// 解密并验证
	plaintext, err := c.gcm.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	return plaintext, nil
}

// EncryptToBase64 加密并返回 Base64 编码的字符串
// 用于存储到数据库
func (c *CryptoEngine) EncryptToBase64(plaintext string) (string, error) {
	ciphertext, err := c.Encrypt([]byte(plaintext))
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptFromBase64 从 Base64 编码的字符串解密
// 用于从数据库读取
func (c *CryptoEngine) DecryptFromBase64(encoded string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}

	plaintext, err := c.Decrypt(ciphertext)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// SecureZero 安全擦除内存中的敏感数据
// 防止敏感数据残留在内存中被读取
func SecureZero(buf []byte) {
	for i := range buf {
		buf[i] = 0
	}
	// 防止编译器优化掉清零操作
	runtime.KeepAlive(buf)
}
