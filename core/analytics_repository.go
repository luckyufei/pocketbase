package core

import (
	"context"

	"github.com/pocketbase/pocketbase/tools/types"
)

// AnalyticsDailyStat 表示每日统计数据（对应 _analytics_daily 表）
type AnalyticsDailyStat struct {
	ID       string         `db:"id" json:"id"`
	Date     string         `db:"date" json:"date"`         // 格式: 2026-01-09
	Path     string         `db:"path" json:"path"`         // 已去参的路径
	TotalPV  int64          `db:"total_pv" json:"total_pv"` // 浏览量
	TotalUV  []byte         `db:"total_uv" json:"-"`        // HLL Sketch (二进制)
	Visitors int64          `db:"visitors" json:"visitors"` // 估算的 UV 值
	AvgDur   int64          `db:"avg_dur" json:"avg_dur"`   // 平均停留时长 (ms)
	Created  types.DateTime `db:"created" json:"created"`
	Updated  types.DateTime `db:"updated" json:"updated"`
}

// AnalyticsSourceStat 表示来源统计数据（对应 _analytics_sources 表）
type AnalyticsSourceStat struct {
	ID       string         `db:"id" json:"id"`
	Date     string         `db:"date" json:"date"`
	Source   string         `db:"source" json:"source"`     // 来源域名
	Visitors int64          `db:"visitors" json:"visitors"` // 访客数
	Created  types.DateTime `db:"created" json:"created"`
	Updated  types.DateTime `db:"updated" json:"updated"`
}

// AnalyticsDeviceStat 表示设备统计数据（对应 _analytics_devices 表）
type AnalyticsDeviceStat struct {
	ID       string         `db:"id" json:"id"`
	Date     string         `db:"date" json:"date"`
	Browser  string         `db:"browser" json:"browser"`
	OS       string         `db:"os" json:"os"`
	Visitors int64          `db:"visitors" json:"visitors"`
	Created  types.DateTime `db:"created" json:"created"`
	Updated  types.DateTime `db:"updated" json:"updated"`
}

// AnalyticsRepository 定义分析数据存储接口。
// 该接口抽象了 SQLite 和 PostgreSQL 的存储差异。
type AnalyticsRepository interface {
	// UpsertDaily 更新或插入每日统计数据。
	// 如果记录已存在，则累加 PV 并合并 HLL Sketch。
	UpsertDaily(ctx context.Context, stat *AnalyticsDailyStat) error

	// UpsertSource 更新或插入来源统计数据。
	UpsertSource(ctx context.Context, stat *AnalyticsSourceStat) error

	// UpsertDevice 更新或插入设备统计数据。
	UpsertDevice(ctx context.Context, stat *AnalyticsDeviceStat) error

	// GetDailyStats 查询指定日期范围的每日统计数据。
	GetDailyStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDailyStat, error)

	// GetTopPages 查询指定日期范围的 Top Pages。
	GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsDailyStat, error)

	// GetTopSources 查询指定日期范围的 Top Sources。
	GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsSourceStat, error)

	// GetDeviceStats 查询指定日期范围的设备分布。
	GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDeviceStat, error)

	// GetDailyHLLSketches 获取指定日期范围的 HLL Sketches，用于跨天 UV 合并。
	GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error)

	// DeleteBefore 删除指定日期之前的所有统计数据。
	DeleteBefore(ctx context.Context, date string) error

	// Close 关闭存储连接。
	Close() error
}

// AnalyticsAggregation 表示内存中的聚合数据。
type AnalyticsAggregation struct {
	Date     string // 日期
	Path     string // 路径
	PV       int64  // 浏览量
	HLL      []byte // HLL Sketch
	Duration int64  // 总停留时长（用于计算平均值）
	Count    int64  // 事件数（用于计算平均值）
}

// AnalyticsSourceAggregation 表示内存中的来源聚合数据。
type AnalyticsSourceAggregation struct {
	Date    string
	Source  string
	Count   int64
	HLL     []byte // 用于 UV 去重
}

// AnalyticsDeviceAggregation 表示内存中的设备聚合数据。
type AnalyticsDeviceAggregation struct {
	Date    string
	Browser string
	OS      string
	Count   int64
	HLL     []byte // 用于 UV 去重
}
