package secrets

import "errors"

// Secrets 相关错误
var (
	// ErrSecretNotFound Secret 不存在
	ErrSecretNotFound = errors.New("secret not found")

	// ErrSecretKeyEmpty Key 为空
	ErrSecretKeyEmpty = errors.New("secret key cannot be empty")

	// ErrSecretKeyTooLong Key 过长
	ErrSecretKeyTooLong = errors.New("secret key too long")

	// ErrSecretValueTooLarge Value 过大
	ErrSecretValueTooLarge = errors.New("secret value too large")

	// ErrCryptoNotEnabled 加密功能未启用
	ErrCryptoNotEnabled = errors.New("crypto engine not enabled: PB_MASTER_KEY not set")

	// ErrSecretsNotRegistered secrets 插件未注册
	ErrSecretsNotRegistered = errors.New("secrets plugin not registered")
)
