package core

import (
	"encoding/hex"
	"errors"
	"os"
	"regexp"
)

// Master Key 相关常量
const (
	// MasterKeyEnvVar 环境变量名称
	MasterKeyEnvVar = "PB_MASTER_KEY"

	// MasterKeyHexLength Master Key 的 hex 字符串长度（64 字符 = 32 字节）
	MasterKeyHexLength = 64
)

// Master Key 相关错误
var (
	// ErrMasterKeyNotSet Master Key 未设置
	ErrMasterKeyNotSet = errors.New("master key not set (PB_MASTER_KEY environment variable)")

	// ErrMasterKeyInvalidLength Master Key 长度无效
	ErrMasterKeyInvalidLength = errors.New("master key must be exactly 64 hex characters (32 bytes)")

	// ErrMasterKeyInvalidFormat Master Key 格式无效
	ErrMasterKeyInvalidFormat = errors.New("master key must contain only hex characters (0-9, a-f, A-F)")

	// ErrSecretsDisabled Secrets 功能未启用
	ErrSecretsDisabled = errors.New("secrets feature is disabled (master key not configured)")
)

// hexPattern 用于验证 hex 字符串格式
var hexPattern = regexp.MustCompile(`^[0-9a-fA-F]+$`)

// globalCryptoEngine 全局加密引擎实例
// 用于在没有 App 引用的场景下（如 SecretField 的 Getter）访问加密引擎
var globalCryptoEngine *CryptoEngine

// GetGlobalCryptoEngine 获取全局加密引擎实例
// 用于 SecretField 在 Getter 中进行解密（Getter 没有 App 参数）
func GetGlobalCryptoEngine() *CryptoEngine {
	return globalCryptoEngine
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

	if !hexPattern.MatchString(keyHex) {
		return ErrMasterKeyInvalidFormat
	}

	return nil
}

// SecretsSettings Secrets 功能配置
// 管理 Master Key 和加密引擎的生命周期
type SecretsSettings struct {
	enabled      bool
	cryptoEngine *CryptoEngine
	initError    error
}

// NewSecretsSettings 创建 SecretsSettings 实例
func NewSecretsSettings() *SecretsSettings {
	return &SecretsSettings{}
}

// Initialize 初始化 Secrets 设置
// 尝试加载 Master Key 并创建加密引擎
// 如果 Master Key 未设置或无效，不返回错误，只是标记功能为不可用
func (s *SecretsSettings) Initialize() error {
	masterKey, err := LoadMasterKey()
	if err != nil {
		s.enabled = false
		s.initError = err
		// 不返回错误，允许服务正常启动
		return nil
	}

	// 创建加密引擎
	engine, err := NewCryptoEngine(masterKey)
	if err != nil {
		s.enabled = false
		s.initError = err
		// 安全擦除 Master Key
		SecureZero(masterKey)
		return nil
	}

	// 安全擦除原始 Master Key（加密引擎已持有副本）
	SecureZero(masterKey)

	s.cryptoEngine = engine
	s.enabled = true
	s.initError = nil

	// 设置全局加密引擎（用于 SecretField Getter）
	globalCryptoEngine = engine

	return nil
}

// IsEnabled 检查 Secrets 功能是否可用
func (s *SecretsSettings) IsEnabled() bool {
	return s.enabled
}

// CryptoEngine 获取加密引擎
// 如果功能未启用，返回 nil
func (s *SecretsSettings) CryptoEngine() *CryptoEngine {
	if !s.enabled {
		return nil
	}
	return s.cryptoEngine
}

// InitError 获取初始化错误（用于日志记录）
func (s *SecretsSettings) InitError() error {
	return s.initError
}
