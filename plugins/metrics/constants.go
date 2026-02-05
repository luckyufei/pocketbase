// Package metrics 提供系统监控插件功能
// 采集 CPU、内存、Goroutine、数据库连接、HTTP 延迟等系统指标
package metrics

import "time"

// 表名常量
const (
	// SystemMetricsTableName 系统监控指标表名
	SystemMetricsTableName = "_metrics"
)

// 默认配置常量
const (
	// DefaultCollectionInterval 默认采集间隔（60秒）
	DefaultCollectionInterval = 60 * time.Second

	// DefaultRetentionDays 默认数据保留天数（7天）
	DefaultRetentionDays = 7

	// DefaultLatencyBufferSize 默认延迟 Ring Buffer 大小
	DefaultLatencyBufferSize = 1000

	// DefaultCleanupCron 默认清理任务 Cron 表达式（每天 03:00）
	DefaultCleanupCron = "0 3 * * *"
)

// Store Key 常量
const (
	// pluginStoreKey 在 app.Store() 中存储插件实例的键
	pluginStoreKey = "__pbMetricsPlugin__"
)
