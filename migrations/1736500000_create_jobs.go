package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.SystemMigrations.Register(func(txApp core.App) error {
		return createJobsTable(txApp)
	}, func(txApp core.App) error {
		// 回滚：删除 _jobs 表
		_, err := txApp.DB().NewQuery(`DROP TABLE IF EXISTS _jobs`).Execute()
		return err
	}, "1736500000_create_jobs.go")
}

// createJobsTable 创建 _jobs 系统表
// 用于存储任务队列数据，实现原生 Job Queue 功能
func createJobsTable(txApp core.App) error {
	var createTableSQL string

	if txApp.IsPostgres() {
		// PostgreSQL: 使用 JSONB 和 TIMESTAMP
		createTableSQL = `
			CREATE TABLE IF NOT EXISTS _jobs (
				id TEXT PRIMARY KEY,
				topic TEXT NOT NULL,
				payload JSONB NOT NULL DEFAULT '{}',
				status TEXT NOT NULL DEFAULT 'pending',
				run_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
				locked_until TIMESTAMP WITHOUT TIME ZONE,
				retries INTEGER NOT NULL DEFAULT 0,
				max_retries INTEGER NOT NULL DEFAULT 3,
				last_error TEXT,
				created TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
				updated TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
			)
		`
	} else {
		// SQLite: 使用 TEXT 存储 JSON 和时间
		createTableSQL = `
			CREATE TABLE IF NOT EXISTS _jobs (
				id TEXT PRIMARY KEY,
				topic TEXT NOT NULL,
				payload TEXT NOT NULL DEFAULT '{}',
				status TEXT NOT NULL DEFAULT 'pending',
				run_at TEXT NOT NULL DEFAULT (datetime('now')),
				locked_until TEXT,
				retries INTEGER NOT NULL DEFAULT 0,
				max_retries INTEGER NOT NULL DEFAULT 3,
				last_error TEXT,
				created TEXT NOT NULL DEFAULT (datetime('now')),
				updated TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`
	}

	_, err := txApp.DB().NewQuery(createTableSQL).Execute()
	if err != nil {
		return err
	}

	// 创建索引
	return createJobsIndexes(txApp)
}

// createJobsIndexes 创建 _jobs 表索引
func createJobsIndexes(txApp core.App) error {
	var indexes []string

	if txApp.IsPostgres() {
		// PostgreSQL: 使用部分索引优化查询
		indexes = []string{
			// 待执行任务索引（部分索引）
			`CREATE INDEX IF NOT EXISTS idx_jobs_pending ON _jobs (status, run_at) WHERE status = 'pending'`,
			// topic 索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_topic ON _jobs (topic)`,
			// 状态索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_status ON _jobs (status)`,
			// 过期锁索引（用于崩溃恢复）
			`CREATE INDEX IF NOT EXISTS idx_jobs_locked ON _jobs (locked_until) WHERE status = 'processing'`,
			// 创建时间索引（用于列表排序）
			`CREATE INDEX IF NOT EXISTS idx_jobs_created ON _jobs (created DESC)`,
		}
	} else {
		// SQLite: 使用普通索引
		indexes = []string{
			// 待执行任务索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_pending ON _jobs (status, run_at)`,
			// topic 索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_topic ON _jobs (topic)`,
			// 状态索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_status ON _jobs (status)`,
			// 过期锁索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_locked ON _jobs (status, locked_until)`,
			// 创建时间索引
			`CREATE INDEX IF NOT EXISTS idx_jobs_created ON _jobs (created)`,
		}
	}

	for _, indexSQL := range indexes {
		_, err := txApp.DB().NewQuery(indexSQL).Execute()
		if err != nil {
			return err
		}
	}

	return nil
}
