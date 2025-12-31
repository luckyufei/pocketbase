package core

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/pocketbase/dbx"
)

const (
	// MetricsDBName 监控数据库文件名
	MetricsDBName = "metrics.db"

	// MetricsMaxOpenConns 监控数据库最大连接数
	MetricsMaxOpenConns = 5

	// MetricsMaxIdleConns 监控数据库最大空闲连接数
	MetricsMaxIdleConns = 2

	// MetricsRetentionDays 监控数据保留天数
	MetricsRetentionDays = 7
)

// MetricsDB 监控数据库管理器
type MetricsDB struct {
	db        *dbx.DB
	dataDir   string
	mu        sync.RWMutex
	isClosing bool
}

// NewMetricsDB 创建监控数据库管理器实例
func NewMetricsDB(dataDir string, dbConnect DBConnectFunc) (*MetricsDB, error) {
	mdb := &MetricsDB{
		dataDir: dataDir,
	}

	if err := mdb.init(dbConnect); err != nil {
		return nil, err
	}

	return mdb, nil
}

// init 初始化监控数据库
func (mdb *MetricsDB) init(dbConnect DBConnectFunc) error {
	dbPath := filepath.Join(mdb.dataDir, MetricsDBName)

	// 使用提供的数据库连接函数
	db, err := dbConnect(dbPath)
	if err != nil {
		return fmt.Errorf("failed to connect to metrics db: %w", err)
	}

	// 配置连接池
	db.DB().SetMaxOpenConns(MetricsMaxOpenConns)
	db.DB().SetMaxIdleConns(MetricsMaxIdleConns)
	db.DB().SetConnMaxIdleTime(3 * time.Minute)

	mdb.db = db

	// 设置 PRAGMA 并创建表
	if err := mdb.setupPragmas(); err != nil {
		mdb.Close()
		return err
	}

	if err := mdb.createTable(); err != nil {
		mdb.Close()
		return err
	}

	return nil
}

// setupPragmas 设置数据库 PRAGMA 配置
// 使用 synchronous=OFF 以获得最佳写入性能（监控数据可容忍少量丢失）
func (mdb *MetricsDB) setupPragmas() error {
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = OFF",
		"PRAGMA temp_store = MEMORY",
		"PRAGMA busy_timeout = 1000",
	}

	for _, pragma := range pragmas {
		if _, err := mdb.db.NewQuery(pragma).Execute(); err != nil {
			return fmt.Errorf("failed to execute %s: %w", pragma, err)
		}
	}

	return nil
}

// createTable 创建监控数据表
func (mdb *MetricsDB) createTable() error {
	schema := `
		CREATE TABLE IF NOT EXISTS system_metrics (
			id TEXT PRIMARY KEY,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
			cpu_usage_percent REAL DEFAULT 0,
			memory_alloc_mb REAL DEFAULT 0,
			goroutines_count INTEGER DEFAULT 0,
			sqlite_wal_size_mb REAL DEFAULT 0,
			sqlite_open_conns INTEGER DEFAULT 0,
			p95_latency_ms REAL DEFAULT 0,
			http_5xx_count INTEGER DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp 
		ON system_metrics(timestamp);
	`

	if _, err := mdb.db.NewQuery(schema).Execute(); err != nil {
		return fmt.Errorf("failed to create metrics table: %w", err)
	}

	return nil
}

// DB 返回底层数据库连接
func (mdb *MetricsDB) DB() *dbx.DB {
	mdb.mu.RLock()
	defer mdb.mu.RUnlock()
	return mdb.db
}

// Insert 插入单条监控记录
func (mdb *MetricsDB) Insert(metrics *SystemMetrics) error {
	mdb.mu.RLock()
	defer mdb.mu.RUnlock()

	if mdb.isClosing || mdb.db == nil {
		return fmt.Errorf("metrics db is closed")
	}

	_, err := mdb.db.Insert("system_metrics", dbx.Params{
		"id":                 metrics.Id,
		"timestamp":          metrics.Timestamp,
		"cpu_usage_percent":  metrics.CpuUsagePercent,
		"memory_alloc_mb":    metrics.MemoryAllocMB,
		"goroutines_count":   metrics.GoroutinesCount,
		"sqlite_wal_size_mb": metrics.SqliteWalSizeMB,
		"sqlite_open_conns":  metrics.SqliteOpenConns,
		"p95_latency_ms":     metrics.P95LatencyMs,
		"http_5xx_count":     metrics.Http5xxCount,
	}).Execute()

	return err
}

// InsertBatch 批量插入监控记录（使用事务）
func (mdb *MetricsDB) InsertBatch(records []*SystemMetrics) error {
	mdb.mu.RLock()
	defer mdb.mu.RUnlock()

	if mdb.isClosing || mdb.db == nil {
		return fmt.Errorf("metrics db is closed")
	}

	// 使用事务确保原子性
	tx, err := mdb.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	for _, metrics := range records {
		_, err := tx.Insert("system_metrics", dbx.Params{
			"id":                 metrics.Id,
			"timestamp":          metrics.Timestamp,
			"cpu_usage_percent":  metrics.CpuUsagePercent,
			"memory_alloc_mb":    metrics.MemoryAllocMB,
			"goroutines_count":   metrics.GoroutinesCount,
			"sqlite_wal_size_mb": metrics.SqliteWalSizeMB,
			"sqlite_open_conns":  metrics.SqliteOpenConns,
			"p95_latency_ms":     metrics.P95LatencyMs,
			"http_5xx_count":     metrics.Http5xxCount,
		}).Execute()
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

// GetLatest 获取最新一条监控记录
func (mdb *MetricsDB) GetLatest() (*SystemMetrics, error) {
	mdb.mu.RLock()
	defer mdb.mu.RUnlock()

	if mdb.isClosing || mdb.db == nil {
		return nil, fmt.Errorf("metrics db is closed")
	}

	var metrics SystemMetrics
	err := mdb.db.Select("*").
		From("system_metrics").
		OrderBy("timestamp DESC").
		Limit(1).
		One(&metrics)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &metrics, nil
}

// GetByTimeRange 按时间范围查询监控记录
// 返回值 totalItems：当等于 limit+1 时表示可能有更多数据（采用 limit+1 查询技巧避免额外 COUNT）
func (mdb *MetricsDB) GetByTimeRange(hours int, limit int) ([]*SystemMetrics, int, error) {
	mdb.mu.RLock()
	defer mdb.mu.RUnlock()

	if mdb.isClosing || mdb.db == nil {
		return nil, 0, fmt.Errorf("metrics db is closed")
	}

	// 计算时间范围
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	// 查询 limit+1 条来判断是否有更多数据
	var metrics []*SystemMetrics
	err := mdb.db.Select("*").
		From("system_metrics").
		Where(dbx.NewExp("timestamp >= {:since}", dbx.Params{"since": since})).
		OrderBy("timestamp ASC").
		Limit(int64(limit + 1)).
		All(&metrics)

	if err != nil {
		return nil, 0, err
	}

	// 判断是否有更多数据
	hasMore := len(metrics) > limit
	if hasMore {
		metrics = metrics[:limit] // 只返回 limit 条
	}

	totalItems := len(metrics)
	if hasMore {
		totalItems = limit + 1 // 明确表示有更多数据
	}

	return metrics, totalItems, nil
}

// CleanupOldMetrics 清理过期的监控数据
func (mdb *MetricsDB) CleanupOldMetrics() (int64, error) {
	mdb.mu.RLock()
	defer mdb.mu.RUnlock()

	if mdb.isClosing || mdb.db == nil {
		return 0, fmt.Errorf("metrics db is closed")
	}

	cutoff := time.Now().AddDate(0, 0, -MetricsRetentionDays)

	result, err := mdb.db.Delete(
		"system_metrics",
		dbx.NewExp("timestamp < {:cutoff}", dbx.Params{"cutoff": cutoff}),
	).Execute()

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, nil
}

// Rebuild 重建监控数据库（用于数据库损坏时）
func (mdb *MetricsDB) Rebuild(dbConnect DBConnectFunc) error {
	mdb.mu.Lock()
	defer mdb.mu.Unlock()

	// 关闭现有连接
	if mdb.db != nil {
		mdb.db.Close()
		mdb.db = nil
	}

	// 删除旧文件
	dbPath := filepath.Join(mdb.dataDir, MetricsDBName)
	walPath := dbPath + "-wal"
	shmPath := dbPath + "-shm"

	os.Remove(dbPath)
	os.Remove(walPath)
	os.Remove(shmPath)

	// 重新初始化
	mdb.isClosing = false
	return mdb.init(dbConnect)
}

// Close 关闭数据库连接
func (mdb *MetricsDB) Close() error {
	mdb.mu.Lock()
	defer mdb.mu.Unlock()

	mdb.isClosing = true

	if mdb.db != nil {
		err := mdb.db.Close()
		mdb.db = nil
		return err
	}

	return nil
}
