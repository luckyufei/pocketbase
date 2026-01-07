// Package core 提供 PocketBase 核心功能
package core

import (
	"database/sql"
	"time"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// PoolMetrics 连接池指标
type PoolMetrics struct {
	// 数据库类型
	DBType string `json:"dbType"`

	// 主数据库连接池指标
	Data *PoolStatsMetrics `json:"data"`

	// 辅助数据库连接池指标
	Aux *PoolStatsMetrics `json:"aux"`

	// 采集时间
	CollectedAt time.Time `json:"collectedAt"`
}

// PoolStatsMetrics 单个连接池的统计指标
type PoolStatsMetrics struct {
	// 当前打开的连接数
	OpenConnections int `json:"openConnections"`

	// 正在使用的连接数
	InUse int `json:"inUse"`

	// 空闲连接数
	Idle int `json:"idle"`

	// 等待连接的请求数
	WaitCount int64 `json:"waitCount"`

	// 等待连接的总时间 (毫秒)
	WaitDurationMs int64 `json:"waitDurationMs"`

	// 因最大空闲连接数限制关闭的连接数
	MaxIdleClosed int64 `json:"maxIdleClosed"`

	// 因生命周期到期关闭的连接数
	MaxLifetimeClosed int64 `json:"maxLifetimeClosed"`

	// 因最大空闲时间关闭的连接数
	MaxIdleTimeClosed int64 `json:"maxIdleTimeClosed"`

	// 连接池使用率 (InUse / OpenConnections * 100)
	UsagePercent float64 `json:"usagePercent"`

	// 连接池健康状态
	Health string `json:"health"`
}

// GetPoolMetrics 获取连接池指标
func (app *BaseApp) GetPoolMetrics() *PoolMetrics {
	metrics := &PoolMetrics{
		DBType:      app.DBAdapter().Type().String(),
		CollectedAt: time.Now(),
	}

	// 获取主数据库连接池指标
	if db := app.concurrentDB; db != nil {
		if sqlDB, ok := getUnderlyingDB(db); ok {
			metrics.Data = convertPoolStats(dbutils.GetPoolStats(sqlDB))
		}
	}

	// 获取辅助数据库连接池指标
	if db := app.auxConcurrentDB; db != nil {
		if sqlDB, ok := getUnderlyingDB(db); ok {
			metrics.Aux = convertPoolStats(dbutils.GetPoolStats(sqlDB))
		}
	}

	return metrics
}

// getUnderlyingDB 尝试从 dbx.Builder 获取底层 *sql.DB
func getUnderlyingDB(builder interface{}) (*sql.DB, bool) {
	// 尝试类型断言获取 *sql.DB
	type dbGetter interface {
		DB() *sql.DB
	}

	if getter, ok := builder.(dbGetter); ok {
		return getter.DB(), true
	}

	return nil, false
}

// convertPoolStats 转换 dbutils.PoolStats 为 PoolStatsMetrics
func convertPoolStats(stats dbutils.PoolStats) *PoolStatsMetrics {
	metrics := &PoolStatsMetrics{
		OpenConnections:   stats.OpenConnections,
		InUse:             stats.InUse,
		Idle:              stats.Idle,
		WaitCount:         stats.WaitCount,
		WaitDurationMs:    stats.WaitDuration.Milliseconds(),
		MaxIdleClosed:     stats.MaxIdleClosed,
		MaxLifetimeClosed: stats.MaxLifetimeClosed,
		MaxIdleTimeClosed: stats.MaxIdleTimeClosed,
	}

	// 计算使用率
	if stats.OpenConnections > 0 {
		metrics.UsagePercent = float64(stats.InUse) / float64(stats.OpenConnections) * 100
	}

	// 判断健康状态
	metrics.Health = evaluatePoolHealth(metrics)

	return metrics
}

// evaluatePoolHealth 评估连接池健康状态
func evaluatePoolHealth(stats *PoolStatsMetrics) string {
	// 如果没有打开的连接，状态为 unknown
	if stats.OpenConnections == 0 {
		return "unknown"
	}

	// 如果使用率超过 90%，状态为 warning
	if stats.UsagePercent > 90 {
		return "warning"
	}

	// 如果等待时间过长，状态为 warning
	if stats.WaitDurationMs > 1000 { // 超过 1 秒
		return "warning"
	}

	// 如果有大量等待请求，状态为 warning
	if stats.WaitCount > 100 {
		return "warning"
	}

	return "healthy"
}

// PoolMetricsSnapshot 创建连接池指标快照
type PoolMetricsSnapshot struct {
	Timestamp time.Time         `json:"timestamp"`
	Data      *PoolStatsMetrics `json:"data,omitempty"`
	Aux       *PoolStatsMetrics `json:"aux,omitempty"`
}

// PoolMetricsHistory 连接池指标历史记录
type PoolMetricsHistory struct {
	// 最大保留的快照数
	maxSnapshots int

	// 快照列表
	snapshots []PoolMetricsSnapshot
}

// NewPoolMetricsHistory 创建新的指标历史记录器
func NewPoolMetricsHistory(maxSnapshots int) *PoolMetricsHistory {
	if maxSnapshots <= 0 {
		maxSnapshots = 60 // 默认保留 60 个快照
	}
	return &PoolMetricsHistory{
		maxSnapshots: maxSnapshots,
		snapshots:    make([]PoolMetricsSnapshot, 0, maxSnapshots),
	}
}

// Add 添加快照
func (h *PoolMetricsHistory) Add(metrics *PoolMetrics) {
	snapshot := PoolMetricsSnapshot{
		Timestamp: metrics.CollectedAt,
		Data:      metrics.Data,
		Aux:       metrics.Aux,
	}

	h.snapshots = append(h.snapshots, snapshot)

	// 超过最大数量时移除最旧的
	if len(h.snapshots) > h.maxSnapshots {
		h.snapshots = h.snapshots[1:]
	}
}

// GetAll 获取所有快照
func (h *PoolMetricsHistory) GetAll() []PoolMetricsSnapshot {
	result := make([]PoolMetricsSnapshot, len(h.snapshots))
	copy(result, h.snapshots)
	return result
}

// GetLatest 获取最新的 n 个快照
func (h *PoolMetricsHistory) GetLatest(n int) []PoolMetricsSnapshot {
	if n <= 0 || n > len(h.snapshots) {
		n = len(h.snapshots)
	}

	start := len(h.snapshots) - n
	result := make([]PoolMetricsSnapshot, n)
	copy(result, h.snapshots[start:])
	return result
}

// Clear 清除历史记录
func (h *PoolMetricsHistory) Clear() {
	h.snapshots = h.snapshots[:0]
}

// Len 返回快照数量
func (h *PoolMetricsHistory) Len() int {
	return len(h.snapshots)
}
