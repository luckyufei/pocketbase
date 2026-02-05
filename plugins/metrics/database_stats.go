package metrics

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// DatabaseStatsResponse 数据库统计响应结构
type DatabaseStatsResponse struct {
	Type  string         `json:"type"`  // "sqlite" or "postgresql"
	Stats map[string]any `json:"stats"` // 统计数据
}

// databaseStats 处理 GET /api/system/metrics/database 请求
func databaseStats(e *core.RequestEvent) error {
	// 检测数据库类型
	dbType := detectDatabaseType()

	var stats map[string]any
	var err error

	switch dbType {
	case "postgresql":
		stats, err = collectPostgreSQLStats(e.App)
	default:
		stats, err = collectSQLiteStats(e.App)
	}

	if err != nil {
		return apis.NewBadRequestError("Failed to collect database statistics", err)
	}

	response := DatabaseStatsResponse{
		Type:  dbType,
		Stats: stats,
	}

	return e.JSON(http.StatusOK, response)
}

// detectDatabaseType 检测数据库类型
func detectDatabaseType() string {
	// 检查环境变量
	if dsn := os.Getenv("PB_DATABASE_URL"); dsn != "" {
		if strings.Contains(dsn, "postgres://") || strings.Contains(dsn, "postgresql://") {
			return "postgresql"
		}
	}

	// 检查 PostgreSQL DSN 环境变量
	if dsn := os.Getenv("PB_POSTGRES_DSN"); dsn != "" {
		return "postgresql"
	}

	// 默认为 SQLite
	return "sqlite"
}

// collectSQLiteStats 收集 SQLite 统计信息
func collectSQLiteStats(app core.App) (map[string]any, error) {
	stats := make(map[string]any)

	// 获取数据库连接
	db := app.DB()

	// 1. WAL 文件大小
	walSize, _ := getSQLiteWALSize(app.DataDir())
	stats["wal_size"] = walSize

	// 2. 活跃连接数 - 需要类型断言为 *dbx.DB
	if dbxDB, ok := db.(*dbx.DB); ok && dbxDB.DB() != nil {
		dbStats := dbxDB.DB().Stats()
		stats["open_connections"] = dbStats.OpenConnections
		stats["in_use"] = dbStats.InUse
		stats["idle"] = dbStats.Idle
	}

	// 3. 数据库大小
	dbSize, _ := getSQLiteDatabaseSize(app.DataDir())
	stats["database_size"] = dbSize

	// 4. 页面数和页面大小
	var pageCount, pageSize int64
	err := db.NewQuery("PRAGMA page_count").Row(&pageCount)
	if err == nil {
		stats["page_count"] = pageCount
	}

	err = db.NewQuery("PRAGMA page_size").Row(&pageSize)
	if err == nil {
		stats["page_size"] = pageSize
	}

	// 5. 缓存统计
	var cacheSize int64
	err = db.NewQuery("PRAGMA cache_size").Row(&cacheSize)
	if err == nil {
		stats["cache_size"] = cacheSize
	}

	// 6. 日志模式
	var journalMode string
	err = db.NewQuery("PRAGMA journal_mode").Row(&journalMode)
	if err == nil {
		stats["journal_mode"] = journalMode
	}

	return stats, nil
}

// collectPostgreSQLStats 收集 PostgreSQL 统计信息
func collectPostgreSQLStats(app core.App) (map[string]any, error) {
	stats := make(map[string]any)

	// 获取数据库连接
	db := app.DB()

	// 1. 连接统计
	var activeConnections, maxConnections int
	err := db.NewQuery(`
		SELECT count(*) as active_connections
		FROM pg_stat_activity 
		WHERE state = 'active'
	`).Row(&activeConnections)
	if err == nil {
		stats["active_connections"] = activeConnections
	}

	err = db.NewQuery("SHOW max_connections").Row(&maxConnections)
	if err == nil {
		stats["max_connections"] = maxConnections
	}

	// 2. 数据库大小
	var dbSize int64
	err = db.NewQuery(`
		SELECT pg_database_size(current_database())
	`).Row(&dbSize)
	if err == nil {
		stats["database_size"] = dbSize
	}

	// 3. 缓存命中率
	var cacheHitRatio float64
	err = db.NewQuery(`
		SELECT 
			round(
				100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read) + 0.001), 
				2
			) as cache_hit_ratio
		FROM pg_stat_database 
		WHERE datname = current_database()
	`).Row(&cacheHitRatio)
	if err == nil {
		stats["cache_hit_ratio"] = cacheHitRatio
	}

	// 4. 平均查询时间（需要 pg_stat_statements 扩展）
	var avgQueryTime float64
	err = db.NewQuery(`
		SELECT 
			round(avg(mean_exec_time)::numeric, 2) as avg_query_time
		FROM pg_stat_statements 
		WHERE calls > 0
		LIMIT 1
	`).Row(&avgQueryTime)
	if err == nil {
		stats["avg_query_time"] = avgQueryTime
	}

	// 5. 锁等待统计
	var lockWaits int
	err = db.NewQuery(`
		SELECT count(*) as lock_waits
		FROM pg_stat_activity 
		WHERE wait_event_type = 'Lock'
	`).Row(&lockWaits)
	if err == nil {
		stats["lock_waits"] = lockWaits
	}

	// 6. 表统计
	var tableCount int
	err = db.NewQuery(`
		SELECT count(*) as table_count
		FROM information_schema.tables 
		WHERE table_schema = 'public'
	`).Row(&tableCount)
	if err == nil {
		stats["table_count"] = tableCount
	}

	// 7. 索引统计
	var indexCount int
	err = db.NewQuery(`
		SELECT count(*) as index_count
		FROM pg_indexes 
		WHERE schemaname = 'public'
	`).Row(&indexCount)
	if err == nil {
		stats["index_count"] = indexCount
	}

	return stats, nil
}

// getSQLiteWALSize 获取 SQLite WAL 文件大小
func getSQLiteWALSize(dataDir string) (int64, error) {
	var totalSize int64

	// 检查主数据库 WAL
	dataWalPath := filepath.Join(dataDir, "data.db-wal")
	if info, err := os.Stat(dataWalPath); err == nil {
		totalSize += info.Size()
	}

	// 检查辅助数据库 WAL
	auxWalPath := filepath.Join(dataDir, "auxiliary.db-wal")
	if info, err := os.Stat(auxWalPath); err == nil {
		totalSize += info.Size()
	}

	return totalSize, nil
}

// getSQLiteDatabaseSize 获取 SQLite 数据库文件大小
func getSQLiteDatabaseSize(dataDir string) (int64, error) {
	var totalSize int64

	// 主数据库
	dataPath := filepath.Join(dataDir, "data.db")
	if info, err := os.Stat(dataPath); err == nil {
		totalSize += info.Size()
	}

	// 辅助数据库
	auxPath := filepath.Join(dataDir, "auxiliary.db")
	if info, err := os.Stat(auxPath); err == nil {
		totalSize += info.Size()
	}

	return totalSize, nil
}
