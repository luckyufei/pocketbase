package core

import (
	"github.com/pocketbase/pocketbase/tools/types"
)

// 编译时检查：确保 SystemMetrics 实现 Model 接口
var _ Model = (*SystemMetrics)(nil)

// SystemMetricsTableName 系统监控指标表名
const SystemMetricsTableName = "_metrics"

// SystemMetrics 系统监控指标数据模型
// 存储在 auxiliary.db 数据库中（与 _logs 表同库）
type SystemMetrics struct {
	BaseModel

	Timestamp       types.DateTime `db:"timestamp" json:"timestamp"`
	CpuUsagePercent float64        `db:"cpu_usage_percent" json:"cpu_usage_percent"`
	MemoryAllocMB   float64        `db:"memory_alloc_mb" json:"memory_alloc_mb"`
	GoroutinesCount int            `db:"goroutines_count" json:"goroutines_count"`
	SqliteWalSizeMB float64        `db:"sqlite_wal_size_mb" json:"sqlite_wal_size_mb"`
	SqliteOpenConns int            `db:"sqlite_open_conns" json:"sqlite_open_conns"`
	P95LatencyMs    float64        `db:"p95_latency_ms" json:"p95_latency_ms"`
	Http5xxCount    int            `db:"http_5xx_count" json:"http_5xx_count"`
}

// TableName 返回表名
func (m *SystemMetrics) TableName() string {
	return SystemMetricsTableName
}

// SystemMetricsResponse API 响应结构
type SystemMetricsResponse struct {
	Items      []*SystemMetrics `json:"items"`
	TotalItems int              `json:"totalItems"`
}
