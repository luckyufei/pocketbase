package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"regexp"
	"runtime"
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

// Master Key 相关常量
const (
	// MasterKeyEnvVar 环境变量名称
	MasterKeyEnvVar = "PB_MASTER_KEY"

	// MasterKeyHexLength Master Key 的 hex 字符串长度（64 字符 = 32 字节）
	MasterKeyHexLength = 64

	// CryptoMasterKeyEnvVar 环境变量名称（别名）
	CryptoMasterKeyEnvVar = MasterKeyEnvVar

	// CryptoMasterKeyHexLength Master Key 的 hex 字符串长度（别名）
	CryptoMasterKeyHexLength = MasterKeyHexLength
)

// 加密相关错误
var (
	// ErrInvalidMasterKeyLength Master Key 长度无效（必须是 32 字节）
	ErrInvalidMasterKeyLength = errors.New("master key must be exactly 32 bytes (256 bits)")

	// ErrInvalidCiphertext 密文格式无效
	ErrInvalidCiphertext = errors.New("invalid ciphertext format")

	// ErrDecryptionFailed 解密失败（可能是密钥错误或数据被篡改）
	ErrDecryptionFailed = errors.New("decryption failed: authentication error")

	// ErrMasterKeyNotSet Master Key 未设置
	ErrMasterKeyNotSet = errors.New("master key not set (PB_MASTER_KEY environment variable)")

	// ErrMasterKeyInvalidHexLength Master Key hex 长度无效
	ErrMasterKeyInvalidHexLength = errors.New("master key must be exactly 64 hex characters (32 bytes)")

	// ErrMasterKeyInvalidFormat Master Key 格式无效
	ErrMasterKeyInvalidFormat = errors.New("master key must contain only hex characters (0-9, a-f, A-F)")

	// ErrCryptoNotEnabled 表示加密功能未启用（Master Key 未配置）
	ErrCryptoNotEnabled = errors.New("crypto engine not enabled: PB_MASTER_KEY not set")
)

// cryptoHexPattern 用于验证 hex 字符串格式
var cryptoHexPattern = regexp.MustCompile(`^[0-9a-fA-F]+$`)

// ---------------------------------------------------------------
// CryptoEngine - AES-256-GCM 加密引擎核心实现
// ---------------------------------------------------------------

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

// ---------------------------------------------------------------
// CryptoProvider - 加密引擎接口
// ---------------------------------------------------------------

// CryptoProvider 定义加密引擎接口
// 所有需要加密功能的组件（SecretField、Secrets Plugin 等）都通过此接口进行加解密
// 这是 Layer 1 的核心接口，由 SecretField (Layer 2) 和 Secrets Plugin (Layer 3) 共享
type CryptoProvider interface {
	// IsEnabled 返回加密功能是否启用（Master Key 是否配置）
	IsEnabled() bool

	// Encrypt 加密明文，返回 Base64 编码的密文
	// 密文格式: Base64(Nonce[12] + Ciphertext + Tag[16])
	Encrypt(plaintext string) (string, error)

	// Decrypt 解密 Base64 编码的密文，返回明文
	Decrypt(ciphertext string) (string, error)

	// EncryptBytes 加密字节数组，返回加密后的字节数组
	// 密文格式: Nonce[12] + Ciphertext + Tag[16]
	EncryptBytes(plaintext []byte) ([]byte, error)

	// DecryptBytes 解密字节数组，返回解密后的字节数组
	DecryptBytes(ciphertext []byte) ([]byte, error)

	// SecureZero 安全擦除内存中的敏感数据
	SecureZero(data []byte)

	// GetEngine 返回底层的 CryptoEngine 实例（用于兼容旧代码）
	// Deprecated: 请直接使用 CryptoProvider 接口方法
	GetEngine() *CryptoEngine
}

// aesCryptoProvider 使用 AES-256-GCM 算法的加密引擎实现
// 包装现有的 CryptoEngine 结构体
type aesCryptoProvider struct {
	engine *CryptoEngine
}

// IsEnabled 返回 true，因为 aesCryptoProvider 只在 Master Key 配置正确时创建
func (p *aesCryptoProvider) IsEnabled() bool {
	return p.engine != nil
}

// Encrypt 加密明文，返回 Base64 编码的密文
func (p *aesCryptoProvider) Encrypt(plaintext string) (string, error) {
	if p.engine == nil {
		return "", ErrCryptoNotEnabled
	}
	return p.engine.EncryptToBase64(plaintext)
}

// Decrypt 解密 Base64 编码的密文，返回明文
func (p *aesCryptoProvider) Decrypt(ciphertext string) (string, error) {
	if p.engine == nil {
		return "", ErrCryptoNotEnabled
	}
	return p.engine.DecryptFromBase64(ciphertext)
}

// EncryptBytes 加密字节数组
func (p *aesCryptoProvider) EncryptBytes(plaintext []byte) ([]byte, error) {
	if p.engine == nil {
		return nil, ErrCryptoNotEnabled
	}
	return p.engine.Encrypt(plaintext)
}

// DecryptBytes 解密字节数组
func (p *aesCryptoProvider) DecryptBytes(ciphertext []byte) ([]byte, error) {
	if p.engine == nil {
		return nil, ErrCryptoNotEnabled
	}
	return p.engine.Decrypt(ciphertext)
}

// SecureZero 安全擦除内存中的敏感数据
func (p *aesCryptoProvider) SecureZero(data []byte) {
	SecureZero(data)
}

// GetEngine 返回底层的 CryptoEngine 实例
func (p *aesCryptoProvider) GetEngine() *CryptoEngine {
	return p.engine
}

// noopCryptoProvider 空实现，用于 Master Key 未配置时
type noopCryptoProvider struct{}

// IsEnabled 返回 false
func (p *noopCryptoProvider) IsEnabled() bool {
	return false
}

// Encrypt 返回错误
func (p *noopCryptoProvider) Encrypt(plaintext string) (string, error) {
	return "", ErrCryptoNotEnabled
}

// Decrypt 返回错误
func (p *noopCryptoProvider) Decrypt(ciphertext string) (string, error) {
	return "", ErrCryptoNotEnabled
}

// EncryptBytes 返回错误
func (p *noopCryptoProvider) EncryptBytes(plaintext []byte) ([]byte, error) {
	return nil, ErrCryptoNotEnabled
}

// DecryptBytes 返回错误
func (p *noopCryptoProvider) DecryptBytes(ciphertext []byte) ([]byte, error) {
	return nil, ErrCryptoNotEnabled
}

// SecureZero noop - 即使功能未启用，也提供基本的擦除
func (p *noopCryptoProvider) SecureZero(data []byte) {
	SecureZero(data)
}

// GetEngine 返回 nil
func (p *noopCryptoProvider) GetEngine() *CryptoEngine {
	return nil
}

// ---------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------

// SecureZero 安全擦除内存中的敏感数据
// 防止敏感数据残留在内存中被读取
func SecureZero(buf []byte) {
	for i := range buf {
		buf[i] = 0
	}
	// 防止编译器优化掉清零操作
	runtime.KeepAlive(buf)
}

// CryptoSecureZero 是 SecureZero 的别名，保持向后兼容
// Deprecated: 请使用 SecureZero
func CryptoSecureZero(buf []byte) {
	SecureZero(buf)
}

// CryptoValidateMasterKey 验证 Master Key 格式
// 必须是 64 个 hex 字符（表示 32 字节）
func CryptoValidateMasterKey(keyHex string) error {
	if keyHex == "" {
		return ErrCryptoNotEnabled
	}

	if len(keyHex) != CryptoMasterKeyHexLength {
		return ErrMasterKeyInvalidHexLength
	}

	if !cryptoHexPattern.MatchString(keyHex) {
		return ErrMasterKeyInvalidFormat
	}

	return nil
}

// LoadMasterKey 从环境变量加载 Master Key
// 返回 32 字节的密钥或错误
func LoadMasterKey() ([]byte, error) {
	keyHex := os.Getenv(MasterKeyEnvVar)
	if keyHex == "" {
		return nil, ErrMasterKeyNotSet
	}

	// 验证格式
	if err := ValidateMasterKey(keyHex); err != nil {
		return nil, err
	}

	// 解码 hex 字符串
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return nil, ErrMasterKeyInvalidFormat
	}

	return key, nil
}

// ValidateMasterKey 验证 Master Key 格式
// 必须是 64 个 hex 字符（表示 32 字节）
func ValidateMasterKey(keyHex string) error {
	if keyHex == "" {
		return ErrMasterKeyNotSet
	}

	if len(keyHex) != MasterKeyHexLength {
		return ErrMasterKeyInvalidHexLength
	}

	if !cryptoHexPattern.MatchString(keyHex) {
		return ErrMasterKeyInvalidFormat
	}

	return nil
}

// globalCryptoProvider 全局 CryptoProvider 实例
// 用于在没有 App 引用的场景下访问加密功能
var globalCryptoProvider CryptoProvider

// GetGlobalCrypto 获取全局 CryptoProvider 实例
// 用于 SecretField 在 Getter 中进行解密（Getter 没有 App 参数）
func GetGlobalCrypto() CryptoProvider {
	if globalCryptoProvider == nil {
		return &noopCryptoProvider{}
	}
	return globalCryptoProvider
}

// initCryptoEngine 初始化加密引擎
func (app *BaseApp) initCryptoEngine() {
	// 尝试从环境变量加载 Master Key
	masterKey, err := LoadMasterKey()
	if err != nil {
		if err == ErrMasterKeyNotSet {
			app.Logger().Debug("CryptoProvider disabled: PB_MASTER_KEY not set")
		} else {
			app.Logger().Warn("CryptoProvider disabled", "error", err)
		}
		app.crypto = &noopCryptoProvider{}
		return
	}

	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		app.Logger().Error("Failed to initialize CryptoProvider", "error", err)
		SecureZero(masterKey)
		app.crypto = &noopCryptoProvider{}
		return
	}

	// 安全擦除原始 Master Key
	SecureZero(masterKey)

	app.crypto = &aesCryptoProvider{engine: engine}
	globalCryptoProvider = app.crypto

	app.Logger().Debug("CryptoProvider initialized successfully")
}

// Crypto 返回 CryptoProvider 实例
// 如果 Master Key 未配置，返回 NoopCryptoProvider
func (app *BaseApp) Crypto() CryptoProvider {
	if app.crypto == nil {
		return &noopCryptoProvider{}
	}
	return app.crypto
}

// cryptoLoadMasterKeyFromEnv 从环境变量加载 Master Key（内部函数）
func cryptoLoadMasterKeyFromEnv() string {
	return os.Getenv(CryptoMasterKeyEnvVar)
}
