package jobs

import (
	"github.com/pocketbase/pocketbase/core"
)

// createJobsTable 创建 _jobs 表
func createJobsTable(app core.App) error {
	var query string
	if app.IsPostgres() {
		query = `
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
			);
			CREATE INDEX IF NOT EXISTS idx_jobs_pending ON _jobs (run_at) WHERE status = 'pending' AND (locked_until IS NULL OR locked_until < NOW());
			CREATE INDEX IF NOT EXISTS idx_jobs_topic ON _jobs (topic);
			CREATE INDEX IF NOT EXISTS idx_jobs_status ON _jobs (status);
			CREATE INDEX IF NOT EXISTS idx_jobs_locked ON _jobs (locked_until) WHERE locked_until IS NOT NULL;
			CREATE INDEX IF NOT EXISTS idx_jobs_created ON _jobs (created);
		`
	} else {
		query = `
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
			);
			CREATE INDEX IF NOT EXISTS idx_jobs_pending ON _jobs (run_at, status, locked_until);
			CREATE INDEX IF NOT EXISTS idx_jobs_topic ON _jobs (topic);
			CREATE INDEX IF NOT EXISTS idx_jobs_status ON _jobs (status);
			CREATE INDEX IF NOT EXISTS idx_jobs_locked ON _jobs (locked_until);
			CREATE INDEX IF NOT EXISTS idx_jobs_created ON _jobs (created);
		`
	}

	_, err := app.DB().NewQuery(query).Execute()
	return err
}

// ensureJobsTable 检查 _jobs 表是否存在
func ensureJobsTable(app core.App) (bool, error) {
	var count int
	var err error

	if app.IsPostgres() {
		err = app.DB().NewQuery(`
			SELECT COUNT(*) FROM information_schema.tables 
			WHERE table_name = '_jobs'
		`).Row(&count)
	} else {
		err = app.DB().NewQuery(`
			SELECT COUNT(*) FROM sqlite_master 
			WHERE type='table' AND name='_jobs'
		`).Row(&count)
	}

	if err != nil {
		return false, err
	}

	return count > 0, nil
}
