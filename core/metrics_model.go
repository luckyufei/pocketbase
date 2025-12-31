package core

import (
	"time"
)

// SystemMetrics 系统监控指标数据模型
// 存储在独立的 metrics.db 数据库中
type SystemMetrics struct {
	Id              string    `db:"id" json:"id"`
	Timestamp       time.Time `db:"timestamp" json:"timestamp"`
	CpuUsagePercent float64   `db:"cpu_usage_percent" json:"cpu_usage_percent"`
	MemoryAllocMB   float64   `db:"memory_alloc_mb" json:"memory_alloc_mb"`
	GoroutinesCount int       `db:"goroutines_count" json:"goroutines_count"`
	SqliteWalSizeMB float64   `db:"sqlite_wal_size_mb" json:"sqlite_wal_size_mb"`
	SqliteOpenConns int       `db:"sqlite_open_conns" json:"sqlite_open_conns"`
	P95LatencyMs    float64   `db:"p95_latency_ms" json:"p95_latency_ms"`
	Http5xxCount    int       `db:"http_5xx_count" json:"http_5xx_count"`
}

// TableName 返回表名
func (m *SystemMetrics) TableName() string {
	return "system_metrics"
}

// SystemMetricsResponse API 响应结构
type SystemMetricsResponse struct {
	Items      []*SystemMetrics `json:"items"`
	TotalItems int              `json:"totalItems"`
}
