package secrets

import (
	"database/sql"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// secretsStore Store 的实现
type secretsStore struct {
	app    core.App
	config Config
}

// newSecretsStore 创建 Store 实例
func newSecretsStore(app core.App, config Config) *secretsStore {
	return &secretsStore{
		app:    app,
		config: config,
	}
}

// validateKey 验证 Key
func (s *secretsStore) validateKey(key string) error {
	if key == "" {
		return ErrSecretKeyEmpty
	}
	if len(key) > s.config.MaxKeyLength {
		return ErrSecretKeyTooLong
	}
	return nil
}

// validateValue 验证 Value
func (s *secretsStore) validateValue(value string) error {
	if len(value) > s.config.MaxValueSize {
		return ErrSecretValueTooLarge
	}
	return nil
}

// IsEnabled 检查 Secrets 功能是否启用
func (s *secretsStore) IsEnabled() bool {
	return s.app.Crypto().IsEnabled()
}

// Set 设置 Secret
func (s *secretsStore) Set(key, value string, opts ...SecretOption) error {
	if !s.IsEnabled() {
		return ErrCryptoNotEnabled
	}

	// 验证
	if err := s.validateKey(key); err != nil {
		return err
	}
	if err := s.validateValue(value); err != nil {
		return err
	}

	// 解析选项
	options := &secretOptions{
		env: s.config.DefaultEnv,
	}
	for _, opt := range opts {
		opt(options)
	}

	// 使用 CryptoProvider 加密
	crypto := s.app.Crypto()
	encryptedValue, err := crypto.Encrypt(value)
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
		"id":          core.GenerateDefaultRandomId(),
		"key":         key,
		"value":       encryptedValue,
		"env":         options.env,
		"description": options.description,
	}).Execute()

	return err
}

// Get 获取 Secret
func (s *secretsStore) Get(key string) (string, error) {
	return s.GetForEnv(key, s.config.DefaultEnv)
}

// GetForEnv 获取指定环境的 Secret（带 fallback 到 global）
func (s *secretsStore) GetForEnv(key, env string) (string, error) {
	if !s.IsEnabled() {
		return "", ErrCryptoNotEnabled
	}

	var encryptedValue string
	query := `
		SELECT value FROM _secrets
		WHERE key = {:key} AND env IN ({:env}, 'global')
		ORDER BY CASE WHEN env = {:env} THEN 0 ELSE 1 END
		LIMIT 1
	`

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

	// 使用 CryptoProvider 解密
	crypto := s.app.Crypto()
	plaintext, err := crypto.Decrypt(encryptedValue)
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
	return s.DeleteForEnv(key, s.config.DefaultEnv)
}

// DeleteForEnv 删除指定环境的 Secret
func (s *secretsStore) DeleteForEnv(key, env string) error {
	if !s.IsEnabled() {
		return ErrCryptoNotEnabled
	}

	_, err := s.app.DB().NewQuery(`
		DELETE FROM _secrets WHERE key = {:key} AND env = {:env}
	`).Bind(map[string]any{
		"key": key,
		"env": env,
	}).Execute()

	return err
}

// Exists 检查 Secret 是否存在
func (s *secretsStore) Exists(key string) (bool, error) {
	if !s.IsEnabled() {
		return false, ErrCryptoNotEnabled
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
		return nil, ErrCryptoNotEnabled
	}

	query := `
		SELECT id, key, value, env, COALESCE(description, '') as description, 
		       created, updated
		FROM _secrets
		ORDER BY key, env
	`

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
