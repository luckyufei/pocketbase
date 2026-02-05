package secrets

import (
	"time"
)

// SecretInfo 用于列表显示的 Secret 信息
type SecretInfo struct {
	ID          string    `json:"id"`
	Key         string    `json:"key"`
	MaskedValue string    `json:"masked_value"`
	Env         string    `json:"env"`
	Description string    `json:"description"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

// SecretOption 用于配置 Secret 的选项
type SecretOption func(*secretOptions)

type secretOptions struct {
	env         string
	description string
}

// WithEnv 设置 Secret 的环境
func WithEnv(env string) SecretOption {
	return func(o *secretOptions) {
		o.env = env
	}
}

// WithDescription 设置 Secret 的描述
func WithDescription(desc string) SecretOption {
	return func(o *secretOptions) {
		o.description = desc
	}
}

// Store 定义 Secrets 存储接口
type Store interface {
	// Set 设置 Secret
	Set(key, value string, opts ...SecretOption) error

	// Get 获取 Secret（解密后的明文）
	Get(key string) (string, error)

	// GetWithDefault 获取 Secret，不存在时返回默认值
	GetWithDefault(key, defaultValue string) string

	// GetForEnv 获取指定环境的 Secret（带 fallback 到 global）
	GetForEnv(key, env string) (string, error)

	// Delete 删除 Secret
	Delete(key string) error

	// DeleteForEnv 删除指定环境的 Secret
	DeleteForEnv(key, env string) error

	// Exists 检查 Secret 是否存在
	Exists(key string) (bool, error)

	// List 列出所有 Secrets（掩码显示）
	List() ([]SecretInfo, error)

	// IsEnabled 检查 Secrets 功能是否启用
	IsEnabled() bool
}

// MaskSecretValue 生成掩码显示值
func MaskSecretValue(value string) string {
	if len(value) <= 6 {
		return "***"
	}
	// 显示前 6 个字符 + 掩码
	return value[:6] + "***"
}
