package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.SystemMigrations.Add(&core.Migration{
		Up: func(txApp core.App) error {
			var sql string
			var db = txApp.AuxDB() // 默认使用辅助数据库

			if txApp.IsPostgres() {
				db = txApp.DB() // PostgreSQL 模式使用主数据库
				sql = `
					-- 每日统计表（使用 UNLOGGED 提高写入性能）
					CREATE UNLOGGED TABLE IF NOT EXISTS "_analytics_daily" (
						"id"       TEXT PRIMARY KEY NOT NULL,
						"date"     TEXT NOT NULL,
						"path"     TEXT NOT NULL,
						"total_pv" BIGINT DEFAULT 0 NOT NULL,
						"total_uv" BYTEA,
						"visitors" BIGINT DEFAULT 0 NOT NULL,
						"avg_dur"  BIGINT DEFAULT 0 NOT NULL,
						"created"  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
						"updated"  TIMESTAMPTZ DEFAULT NOW() NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_analytics_daily_date 
					ON "_analytics_daily" ("date");

					CREATE INDEX IF NOT EXISTS idx_analytics_daily_path 
					ON "_analytics_daily" ("path");

					-- 来源统计表
					CREATE UNLOGGED TABLE IF NOT EXISTS "_analytics_sources" (
						"id"       TEXT PRIMARY KEY NOT NULL,
						"date"     TEXT NOT NULL,
						"source"   TEXT NOT NULL,
						"visitors" BIGINT DEFAULT 0 NOT NULL,
						"created"  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
						"updated"  TIMESTAMPTZ DEFAULT NOW() NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_analytics_sources_date 
					ON "_analytics_sources" ("date");

					-- 设备统计表
					CREATE UNLOGGED TABLE IF NOT EXISTS "_analytics_devices" (
						"id"       TEXT PRIMARY KEY NOT NULL,
						"date"     TEXT NOT NULL,
						"browser"  TEXT NOT NULL,
						"os"       TEXT NOT NULL,
						"visitors" BIGINT DEFAULT 0 NOT NULL,
						"created"  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
						"updated"  TIMESTAMPTZ DEFAULT NOW() NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_analytics_devices_date 
					ON "_analytics_devices" ("date");
				`
			} else {
				sql = `
					-- 每日统计表
					CREATE TABLE IF NOT EXISTS {{_analytics_daily}} (
						[[id]]       TEXT PRIMARY KEY NOT NULL,
						[[date]]     TEXT NOT NULL,
						[[path]]     TEXT NOT NULL,
						[[total_pv]] INTEGER DEFAULT 0 NOT NULL,
						[[total_uv]] BLOB,
						[[visitors]] INTEGER DEFAULT 0 NOT NULL,
						[[avg_dur]]  INTEGER DEFAULT 0 NOT NULL,
						[[created]]  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
						[[updated]]  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_analytics_daily_date 
					ON {{_analytics_daily}} ([[date]]);

					CREATE INDEX IF NOT EXISTS idx_analytics_daily_path 
					ON {{_analytics_daily}} ([[path]]);

					-- 来源统计表
					CREATE TABLE IF NOT EXISTS {{_analytics_sources}} (
						[[id]]       TEXT PRIMARY KEY NOT NULL,
						[[date]]     TEXT NOT NULL,
						[[source]]   TEXT NOT NULL,
						[[visitors]] INTEGER DEFAULT 0 NOT NULL,
						[[created]]  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
						[[updated]]  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_analytics_sources_date 
					ON {{_analytics_sources}} ([[date]]);

					-- 设备统计表
					CREATE TABLE IF NOT EXISTS {{_analytics_devices}} (
						[[id]]       TEXT PRIMARY KEY NOT NULL,
						[[date]]     TEXT NOT NULL,
						[[browser]]  TEXT NOT NULL,
						[[os]]       TEXT NOT NULL,
						[[visitors]] INTEGER DEFAULT 0 NOT NULL,
						[[created]]  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
						[[updated]]  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_analytics_devices_date 
					ON {{_analytics_devices}} ([[date]]);
				`
			}
			_, execErr := db.NewQuery(sql).Execute()
			return execErr
		},
		Down: func(txApp core.App) error {
			var db = txApp.AuxDB()
			if txApp.IsPostgres() {
				db = txApp.DB()
			}
			tables := []string{"_analytics_daily", "_analytics_sources", "_analytics_devices"}
			for _, table := range tables {
				if _, err := db.DropTable(table).Execute(); err != nil {
					return err
				}
			}
			return nil
		},
		ReapplyCondition: func(txApp core.App, runner *core.MigrationsRunner, fileName string) (bool, error) {
			// 根据数据库类型检查表是否存在
			if txApp.IsPostgres() {
				exists := txApp.HasTable("_analytics_daily")
				return !exists, nil
			}
			exists := txApp.AuxHasTable("_analytics_daily")
			return !exists, nil
		},
	})
}
