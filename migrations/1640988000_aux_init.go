package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.SystemMigrations.Add(&core.Migration{
		Up: func(txApp core.App) error {
			// PostgreSQL 模式下 AuxDB 共享主数据库连接，需要使用 PostgreSQL 语法
			// SQLite 模式下 AuxDB 使用独立的 auxiliary.db 文件
			var sql string
			if txApp.IsPostgres() {
				// PostgreSQL: 使用 UNLOGGED TABLE 提升写入性能
				// - UNLOGGED: 不写 WAL 日志，写入性能大幅提升，但数据库崩溃后数据会丢失
				//   对于日志数据来说这是可接受的权衡（日志本就是临时性数据）
				// - 使用 TIMESTAMPTZ 类型存储时间戳
				// - 注意：date_trunc 对 TIMESTAMPTZ 不是 IMMUTABLE，不能用于索引表达式
				//
				// TODO: 未来可以考虑使用分区表 + DROP PARTITION 来替代 DELETE 清理旧日志
				//       这样可以避免大量 DELETE 导致的死元组和 Vacuum 开销
				sql = `
					CREATE UNLOGGED TABLE IF NOT EXISTS {{_logs}} (
						[[id]]      TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
						[[level]]   INTEGER DEFAULT 0 NOT NULL,
						[[message]] TEXT DEFAULT '' NOT NULL,
						[[data]]    JSONB DEFAULT '{}' NOT NULL,
						[[created]] TIMESTAMPTZ DEFAULT NOW() NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_logs_level on {{_logs}} ([[level]]);
					CREATE INDEX IF NOT EXISTS idx_logs_message on {{_logs}} ([[message]]);
					CREATE INDEX IF NOT EXISTS idx_logs_created on {{_logs}} ([[created]]);
				`
			} else {
				sql = `
					CREATE TABLE IF NOT EXISTS {{_logs}} (
						[[id]]      TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
						[[level]]   INTEGER DEFAULT 0 NOT NULL,
						[[message]] TEXT DEFAULT "" NOT NULL,
						[[data]]    JSON DEFAULT "{}" NOT NULL,
						[[created]] TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_logs_level on {{_logs}} ([[level]]);
					CREATE INDEX IF NOT EXISTS idx_logs_message on {{_logs}} ([[message]]);
					CREATE INDEX IF NOT EXISTS idx_logs_created_hour on {{_logs}} (strftime('%Y-%m-%d %H:00:00', [[created]]));
				`
			}
			_, execErr := txApp.AuxDB().NewQuery(sql).Execute()
			return execErr
		},
		Down: func(txApp core.App) error {
			_, err := txApp.AuxDB().DropTable("_logs").Execute()
			return err
		},
		ReapplyCondition: func(txApp core.App, runner *core.MigrationsRunner, fileName string) (bool, error) {
			// reapply only if the _logs table doesn't exist
			exists := txApp.AuxHasTable("_logs")
			return !exists, nil
		},
	})
}
