package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.SystemMigrations.Register(func(txApp core.App) error {
		return createKVTable(txApp)
	}, func(txApp core.App) error {
		// 回滚：删除 _kv 表
		_, err := txApp.DB().NewQuery(`DROP TABLE IF EXISTS _kv`).Execute()
		return err
	}, "1736400000_create_kv.go")
}

// createKVTable 创建 _kv 系统表
// 用于存储键值数据，实现类 Redis 的 KV 存储功能
func createKVTable(txApp core.App) error {
	var createTableSQL string

	if txApp.IsPostgres() {
		// PostgreSQL: 使用 UNLOGGED TABLE 提升写入性能
		// 注意：UNLOGGED TABLE 在数据库崩溃后会丢失数据，但 KV 数据本就是临时性的
		createTableSQL = `
			CREATE UNLOGGED TABLE IF NOT EXISTS _kv (
				key TEXT PRIMARY KEY,
				value JSONB NOT NULL,
				updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
				expire_at TIMESTAMP WITHOUT TIME ZONE
			)
		`
	} else {
		// SQLite: 使用普通表
		createTableSQL = `
			CREATE TABLE IF NOT EXISTS _kv (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated TEXT DEFAULT (datetime('now')),
				expire_at TEXT
			)
		`
	}

	_, err := txApp.DB().NewQuery(createTableSQL).Execute()
	if err != nil {
		return err
	}

	// 创建过期时间索引
	var indexSQL string
	if txApp.IsPostgres() {
		// PostgreSQL: 部分索引（仅索引有过期时间的行）
		indexSQL = `
			CREATE INDEX IF NOT EXISTS idx_kv_expire ON _kv (expire_at) 
			WHERE expire_at IS NOT NULL
		`
	} else {
		// SQLite: 普通索引
		indexSQL = `
			CREATE INDEX IF NOT EXISTS idx_kv_expire ON _kv (expire_at)
		`
	}

	_, err = txApp.DB().NewQuery(indexSQL).Execute()
	if err != nil {
		return err
	}

	// 创建更新时间索引（用于 LRU 淘汰查询）
	_, err = txApp.DB().NewQuery(`
		CREATE INDEX IF NOT EXISTS idx_kv_updated ON _kv (updated)
	`).Execute()

	return err
}
