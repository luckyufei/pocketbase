package analytics

import (
	"context"
)

// Repository 定义分析数据存储接口
type Repository interface {
	// UpsertDaily 更新或插入每日统计数据
	UpsertDaily(ctx context.Context, stat *DailyStat) error

	// UpsertSource 更新或插入来源统计数据
	UpsertSource(ctx context.Context, stat *SourceStat) error

	// UpsertDevice 更新或插入设备统计数据
	UpsertDevice(ctx context.Context, stat *DeviceStat) error

	// GetDailyStats 查询指定日期范围的每日统计数据
	GetDailyStats(ctx context.Context, startDate, endDate string) ([]*DailyStat, error)

	// GetTopPages 查询指定日期范围的 Top Pages
	GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*DailyStat, error)

	// GetTopSources 查询指定日期范围的 Top Sources
	GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*SourceStat, error)

	// GetDeviceStats 查询指定日期范围的设备分布
	GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*DeviceStat, error)

	// GetDailyHLLSketches 获取指定日期范围的 HLL Sketches
	GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error)

	// DeleteBefore 删除指定日期之前的所有统计数据
	DeleteBefore(ctx context.Context, date string) error

	// Close 关闭存储连接
	Close() error
}
