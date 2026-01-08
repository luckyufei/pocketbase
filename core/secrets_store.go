package core

import (
	"database/sql"
	"errors"
	"time"
)

// Secrets 相关常量
const (
	// SecretMaxKeyLength Key 最大长度
	SecretMaxKeyLength = 256

	// SecretMaxValueSize Value 最大大小 (4KB)
	SecretMaxValueSize = 4 * 1024

	// SecretDefaultEnv 默认环境
	SecretDefaultEnv = "global"
)

// Secrets 相关错误
var (
	// ErrSecretNotFound Secret 不存在
	ErrSecretNotFound = errors.New("secret not found")

	// ErrSecretKeyEmpty Key 为空
	ErrSecretKeyEmpty = errors.New("secret key cannot be empty")

	// ErrSecretKeyTooLong Key 过长
	ErrSecretKeyTooLong = errors.New("secret key too long (max 256 characters)")

	// ErrSecretValueTooLarge Value 过大
	ErrSecretValueTooLarge = errors.New("secret value too large (max 4KB)")
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

// SecretsStore 定义密钥存储接口
type SecretsStore interface {
	// Set 设置 Secret
	Set(key, value string, opts ...SecretOption) error

	// Get 获取 Secret
	Get(key string) (string, error)

	// GetWithDefault 获取 Secret，不存在时返回默认值
	GetWithDefault(key, defaultValue string) string

	// GetForEnv 获取指定环境的 Secret
	GetForEnv(key, env string) (string, error)

	// Delete 删除 Secret
	Delete(key string) error

	// Exists 检查 Secret 是否存在
	Exists(key string) (bool, error)

	// List 列出所有 Secrets（掩码显示）
	List() ([]SecretInfo, error)

	// IsEnabled 检查 Secrets 功能是否启用
	IsEnabled() bool
}

// secretsStore SecretsStore 的实现
type secretsStore struct {
	app      App
	settings *SecretsSettings
}

// newSecretsStore 创建 SecretsStore 实例
func newSecretsStore(app App, settings *SecretsSettings) *secretsStore {
	return &secretsStore{
		app:      app,
		settings: settings,
	}
}

// validateKey 验证 Key
func validateKey(key string) error {
	if key == "" {
		return ErrSecretKeyEmpty
	}
	if len(key) > SecretMaxKeyLength {
		return ErrSecretKeyTooLong
	}
	return nil
}

// validateValue 验证 Value
func validateValue(value string) error {
	if len(value) > SecretMaxValueSize {
		return ErrSecretValueTooLarge
	}
	return nil
}

// IsEnabled 检查 Secrets 功能是否启用
func (s *secretsStore) IsEnabled() bool {
	return s.settings != nil && s.settings.IsEnabled()
}

// Set 设置 Secret
func (s *secretsStore) Set(key, value string, opts ...SecretOption) error {
	if !s.IsEnabled() {
		return ErrSecretsDisabled
	}

	// 验证
	if err := validateKey(key); err != nil {
		return err
	}
	if err := validateValue(value); err != nil {
		return err
	}

	// 解析选项
	options := &secretOptions{
		env: SecretDefaultEnv,
	}
	for _, opt := range opts {
		opt(options)
	}

	// 加密
	engine := s.settings.CryptoEngine()
	encryptedValue, err := engine.EncryptToBase64(value)
	if err != nil {
		return err
	}

	// UPSERT 到数据库
	var query string
	if s.app.IsPostgres() {
		query = `
			INSERT INTO _secrets (id, key, value, env, description, created, updated)
			VALUES ({:id}, {:key}, {:value}, {:env}, {:description}, NOW(), NOW())
			ON CONFLICT (key, env) DO UPDATE
			SET value = EXCLUDED.value, 
			    description = EXCLUDED.description,
			    updated = NOW()
		`
	} else {
		query = `
			INSERT INTO _secrets (id, key, value, env, description, created, updated)
			VALUES ({:id}, {:key}, {:value}, {:env}, {:description}, datetime('now'), datetime('now'))
			ON CONFLICT (key, env) DO UPDATE
			SET value = EXCLUDED.value, 
			    description = EXCLUDED.description,
			    updated = datetime('now')
		`
	}

	_, err = s.app.DB().NewQuery(query).Bind(map[string]any{
		"id":          GenerateDefaultRandomId(),
		"key":         key,
		"value":       encryptedValue,
		"env":         options.env,
		"description": options.description,
	}).Execute()

	return err
}

// Get 获取 Secret
func (s *secretsStore) Get(key string) (string, error) {
	return s.GetForEnv(key, SecretDefaultEnv)
}

// GetForEnv 获取指定环境的 Secret（带 fallback 到 global）
func (s *secretsStore) GetForEnv(key, env string) (string, error) {
	if !s.IsEnabled() {
		return "", ErrSecretsDisabled
	}

	var encryptedValue string
	var query string

	if s.app.IsPostgres() {
		// PostgreSQL: 优先指定环境，fallback 到 global
		query = `
			SELECT value FROM _secrets
			WHERE key = {:key} AND env IN ({:env}, 'global')
			ORDER BY CASE WHEN env = {:env} THEN 0 ELSE 1 END
			LIMIT 1
		`
	} else {
		query = `
			SELECT value FROM _secrets
			WHERE key = {:key} AND env IN ({:env}, 'global')
			ORDER BY CASE WHEN env = {:env} THEN 0 ELSE 1 END
			LIMIT 1
		`
	}

	err := s.app.DB().NewQuery(query).Bind(map[string]any{
		"key": key,
		"env": env,
	}).Row(&encryptedValue)

	if err != nil {
		if err == sql.ErrNoRows {
			return "", ErrSecretNotFound
		}
		return "", err
	}

	// 解密
	engine := s.settings.CryptoEngine()
	plaintext, err := engine.DecryptFromBase64(encryptedValue)
	if err != nil {
		return "", err
	}

	return plaintext, nil
}

// GetWithDefault 获取 Secret，不存在时返回默认值
func (s *secretsStore) GetWithDefault(key, defaultValue string) string {
	value, err := s.Get(key)
	if err != nil {
		return defaultValue
	}
	return value
}

// Delete 删除 Secret
func (s *secretsStore) Delete(key string) error {
	if !s.IsEnabled() {
		return ErrSecretsDisabled
	}

	_, err := s.app.DB().NewQuery(`
		DELETE FROM _secrets WHERE key = {:key} AND env = {:env}
	`).Bind(map[string]any{
		"key": key,
		"env": SecretDefaultEnv,
	}).Execute()

	return err
}

// Exists 检查 Secret 是否存在
func (s *secretsStore) Exists(key string) (bool, error) {
	if !s.IsEnabled() {
		return false, ErrSecretsDisabled
	}

	var exists int
	err := s.app.DB().NewQuery(`
		SELECT 1 FROM _secrets WHERE key = {:key} LIMIT 1
	`).Bind(map[string]any{"key": key}).Row(&exists)

	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// List 列出所有 Secrets（掩码显示）
func (s *secretsStore) List() ([]SecretInfo, error) {
	if !s.IsEnabled() {
		return nil, ErrSecretsDisabled
	}

	var query string
	if s.app.IsPostgres() {
		query = `
			SELECT id, key, value, env, COALESCE(description, '') as description, 
			       created, updated
			FROM _secrets
			ORDER BY key, env
		`
	} else {
		query = `
			SELECT id, key, value, env, COALESCE(description, '') as description, 
			       created, updated
			FROM _secrets
			ORDER BY key, env
		`
	}

	rows, err := s.app.DB().NewQuery(query).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []SecretInfo
	for rows.Next() {
		var info SecretInfo
		var encryptedValue string
		var createdStr, updatedStr string

		if err := rows.Scan(&info.ID, &info.Key, &encryptedValue, &info.Env,
			&info.Description, &createdStr, &updatedStr); err != nil {
			return nil, err
		}

		// 生成掩码值
		info.MaskedValue = MaskSecretValue(encryptedValue)

		// 解析时间
		info.Created, _ = time.Parse(time.RFC3339, createdStr)
		info.Updated, _ = time.Parse(time.RFC3339, updatedStr)

		result = append(result, info)
	}

	return result, nil
}

// MaskSecretValue 生成掩码显示值
func MaskSecretValue(value string) string {
	if len(value) <= 6 {
		return "***"
	}
	// 显示前 6 个字符 + 掩码
	return value[:6] + "***"
}
