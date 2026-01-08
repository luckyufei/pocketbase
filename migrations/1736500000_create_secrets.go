package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.SystemMigrations.Register(func(txApp core.App) error {
		return createSecretsTable(txApp)
	}, func(txApp core.App) error {
		// 回滚：删除 _secrets 表
		_, err := txApp.DB().NewQuery(`DROP TABLE IF EXISTS _secrets`).Execute()
		return err
	}, "1736500000_create_secrets.go")
}

// createSecretsTable 创建 _secrets 系统表
// 用于存储加密的密钥数据
func createSecretsTable(txApp core.App) error {
	var createTableSQL string

	if txApp.IsPostgres() {
		// PostgreSQL: 使用 TEXT 存储加密后的 Base64 值
		createTableSQL = `
			CREATE TABLE IF NOT EXISTS _secrets (
				id TEXT PRIMARY KEY,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				env TEXT NOT NULL DEFAULT 'global',
				description TEXT,
				created TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
				updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
				UNIQUE(key, env)
			)
		`
	} else {
		// SQLite
		createTableSQL = `
			CREATE TABLE IF NOT EXISTS _secrets (
				id TEXT PRIMARY KEY,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				env TEXT NOT NULL DEFAULT 'global',
				description TEXT,
				created TEXT DEFAULT (datetime('now')),
				updated TEXT DEFAULT (datetime('now')),
				UNIQUE(key, env)
			)
		`
	}

	_, err := txApp.DB().NewQuery(createTableSQL).Execute()
	if err != nil {
		return err
	}

	// 创建 key 索引（用于快速查找）
	_, err = txApp.DB().NewQuery(`
		CREATE INDEX IF NOT EXISTS idx_secrets_key ON _secrets (key)
	`).Execute()
	if err != nil {
		return err
	}

	// 创建 env 索引（用于环境过滤）
	_, err = txApp.DB().NewQuery(`
		CREATE INDEX IF NOT EXISTS idx_secrets_env ON _secrets (env)
	`).Execute()

	return err
}
