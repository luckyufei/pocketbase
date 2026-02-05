package core

import (
	"encoding/hex"
	"errors"
	"os"
	"regexp"
	"runtime"
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

// Master Key 相关错误
var (
	// ErrMasterKeyNotSet Master Key 未设置
	ErrMasterKeyNotSet = errors.New("master key not set (PB_MASTER_KEY environment variable)")

	// ErrMasterKeyInvalidLength Master Key 长度无效
	ErrMasterKeyInvalidLength = errors.New("master key must be exactly 64 hex characters (32 bytes)")

	// ErrMasterKeyInvalidFormat Master Key 格式无效
	ErrMasterKeyInvalidFormat = errors.New("master key must contain only hex characters (0-9, a-f, A-F)")

	// ErrCryptoNotEnabled 表示加密功能未启用（Master Key 未配置）
	ErrCryptoNotEnabled = errors.New("crypto engine not enabled: PB_MASTER_KEY not set")
)

// cryptoHexPattern 用于验证 hex 字符串格式
var cryptoHexPattern = regexp.MustCompile(`^[0-9a-fA-F]+$`)

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
	CryptoSecureZero(data)
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
	CryptoSecureZero(data)
}

// GetEngine 返回 nil
func (p *noopCryptoProvider) GetEngine() *CryptoEngine {
	return nil
}

// CryptoSecureZero 安全擦除内存中的敏感数据
// 防止敏感数据残留在内存中被读取
func CryptoSecureZero(buf []byte) {
	for i := range buf {
		buf[i] = 0
	}
	// 防止编译器优化掉清零操作
	runtime.KeepAlive(buf)
}

// CryptoValidateMasterKey 验证 Master Key 格式
// 必须是 64 个 hex 字符（表示 32 字节）
func CryptoValidateMasterKey(keyHex string) error {
	if keyHex == "" {
		return ErrCryptoNotEnabled
	}

	if len(keyHex) != CryptoMasterKeyHexLength {
		return ErrMasterKeyInvalidLength
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
		return ErrMasterKeyInvalidLength
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
