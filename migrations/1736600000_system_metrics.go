package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.SystemMigrations.Add(&core.Migration{
		Up: func(txApp core.App) error {
			// AuxDB 始终使用 SQLite，即使主数据库使用 PostgreSQL
			// 因此这里不需要根据 IsPostgres() 区分，始终使用 SQLite 语法
			sql := `
				CREATE TABLE IF NOT EXISTS {{_metrics}} (
					[[id]]                 TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
					[[timestamp]]          TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
					[[cpu_usage_percent]]  REAL DEFAULT 0 NOT NULL,
					[[memory_alloc_mb]]    REAL DEFAULT 0 NOT NULL,
					[[goroutines_count]]   INTEGER DEFAULT 0 NOT NULL,
					[[sqlite_wal_size_mb]] REAL DEFAULT 0 NOT NULL,
					[[sqlite_open_conns]]  INTEGER DEFAULT 0 NOT NULL,
					[[p95_latency_ms]]     REAL DEFAULT 0 NOT NULL,
					[[http_5xx_count]]     INTEGER DEFAULT 0 NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_metrics_timestamp 
				ON {{_metrics}} ([[timestamp]]);
			`
			_, execErr := txApp.AuxDB().NewQuery(sql).Execute()
			return execErr
		},
		Down: func(txApp core.App) error {
			_, err := txApp.AuxDB().DropTable("_metrics").Execute()
			return err
		},
		ReapplyCondition: func(txApp core.App, runner *core.MigrationsRunner, fileName string) (bool, error) {
			// 仅当 _metrics 表不存在时重新应用
			exists := txApp.AuxHasTable("_metrics")
			return !exists, nil
		},
	})
}
