package core

import (
	"context"
	"time"

	"github.com/pocketbase/dbx"
)

// AnalyticsRepositorySQLite 实现 SQLite 模式的分析数据存储。
type AnalyticsRepositorySQLite struct {
	db dbx.Builder
}

// NewAnalyticsRepositorySQLite 创建一个新的 SQLite Repository。
func NewAnalyticsRepositorySQLite(db dbx.Builder) *AnalyticsRepositorySQLite {
	return &AnalyticsRepositorySQLite{db: db}
}

// UpsertDaily 更新或插入每日统计数据。
// 如果记录已存在，则累加 PV 并合并 HLL Sketch。
func (r *AnalyticsRepositorySQLite) UpsertDaily(ctx context.Context, stat *AnalyticsDailyStat) error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")

	// 查询现有记录（只查询需要的字段，避免 time.Time 解析问题）
	var existing struct {
		TotalPV  int64  `db:"total_pv"`
		TotalUV  []byte `db:"total_uv"`
		Visitors int64  `db:"visitors"`
	}
	err := r.db.Select("total_pv", "total_uv", "visitors").
		From("_analytics_daily").
		Where(dbx.HashExp{"id": stat.ID}).
		One(&existing)

	if err == nil {
		// 记录存在，累加 PV 并合并 HLL
		newPV := existing.TotalPV + stat.TotalPV
		newVisitors := existing.Visitors + stat.Visitors

		// 合并 HLL
		var newHLL []byte
		if len(existing.TotalUV) > 0 || len(stat.TotalUV) > 0 {
			mergedHLL := NewHLL()
			if len(existing.TotalUV) > 0 {
				if err := mergedHLL.MergeBytes(existing.TotalUV); err != nil {
					// HLL 合并失败，降级为简单累加
					newVisitors = existing.Visitors + stat.Visitors
				}
			}
			if len(stat.TotalUV) > 0 {
				if err := mergedHLL.MergeBytes(stat.TotalUV); err != nil {
					// HLL 合并失败，降级为简单累加
				} else {
					newVisitors = int64(mergedHLL.Count())
				}
			}
			newHLL, _ = mergedHLL.Bytes()
		}

		_, err = r.db.Update("_analytics_daily",
			dbx.Params{
				"total_pv": newPV,
				"total_uv": newHLL,
				"visitors": newVisitors,
				"updated":  now,
			},
			dbx.HashExp{"id": stat.ID},
		).Execute()
		return err
	}

	// 记录不存在，插入新记录
	_, err = r.db.Insert("_analytics_daily", dbx.Params{
		"id":       stat.ID,
		"date":     stat.Date,
		"path":     stat.Path,
		"total_pv": stat.TotalPV,
		"total_uv": stat.TotalUV,
		"visitors": stat.Visitors,
		"avg_dur":  stat.AvgDur,
		"created":  now,
		"updated":  now,
	}).Execute()

	return err
}

// UpsertSource 更新或插入来源统计数据。
func (r *AnalyticsRepositorySQLite) UpsertSource(ctx context.Context, stat *AnalyticsSourceStat) error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")

	var existing struct {
		Visitors int64 `db:"visitors"`
	}
	err := r.db.Select("visitors").
		From("_analytics_sources").
		Where(dbx.HashExp{"id": stat.ID}).
		One(&existing)

	if err == nil {
		// 记录存在，累加访客数
		_, err = r.db.Update("_analytics_sources",
			dbx.Params{
				"visitors": existing.Visitors + stat.Visitors,
				"updated":  now,
			},
			dbx.HashExp{"id": stat.ID},
		).Execute()
		return err
	}

	// 记录不存在，插入新记录
	_, err = r.db.Insert("_analytics_sources", dbx.Params{
		"id":       stat.ID,
		"date":     stat.Date,
		"source":   stat.Source,
		"visitors": stat.Visitors,
		"created":  now,
		"updated":  now,
	}).Execute()

	return err
}

// UpsertDevice 更新或插入设备统计数据。
func (r *AnalyticsRepositorySQLite) UpsertDevice(ctx context.Context, stat *AnalyticsDeviceStat) error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")

	var existing struct {
		Visitors int64 `db:"visitors"`
	}
	err := r.db.Select("visitors").
		From("_analytics_devices").
		Where(dbx.HashExp{"id": stat.ID}).
		One(&existing)

	if err == nil {
		// 记录存在，累加访客数
		_, err = r.db.Update("_analytics_devices",
			dbx.Params{
				"visitors": existing.Visitors + stat.Visitors,
				"updated":  now,
			},
			dbx.HashExp{"id": stat.ID},
		).Execute()
		return err
	}

	// 记录不存在，插入新记录
	_, err = r.db.Insert("_analytics_devices", dbx.Params{
		"id":       stat.ID,
		"date":     stat.Date,
		"browser":  stat.Browser,
		"os":       stat.OS,
		"visitors": stat.Visitors,
		"created":  now,
		"updated":  now,
	}).Execute()

	return err
}

// GetDailyStats 查询指定日期范围的每日统计数据。
func (r *AnalyticsRepositorySQLite) GetDailyStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDailyStat, error) {
	var stats []*AnalyticsDailyStat

	err := r.db.Select("*").
		From("_analytics_daily").
		Where(dbx.And(
			dbx.NewExp("date >= {:start}", dbx.Params{"start": startDate}),
			dbx.NewExp("date <= {:end}", dbx.Params{"end": endDate}),
		)).
		OrderBy("date ASC").
		All(&stats)

	return stats, err
}

// GetTopPages 查询指定日期范围的 Top Pages。
func (r *AnalyticsRepositorySQLite) GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsDailyStat, error) {
	if limit <= 0 {
		limit = 10
	}

	var stats []*AnalyticsDailyStat

	err := r.db.Select("path", "SUM(total_pv) as total_pv", "SUM(visitors) as visitors").
		From("_analytics_daily").
		Where(dbx.And(
			dbx.NewExp("date >= {:start}", dbx.Params{"start": startDate}),
			dbx.NewExp("date <= {:end}", dbx.Params{"end": endDate}),
		)).
		GroupBy("path").
		OrderBy("total_pv DESC").
		Limit(int64(limit)).
		All(&stats)

	return stats, err
}

// GetTopSources 查询指定日期范围的 Top Sources。
func (r *AnalyticsRepositorySQLite) GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsSourceStat, error) {
	if limit <= 0 {
		limit = 10
	}

	var stats []*AnalyticsSourceStat

	err := r.db.Select("source", "SUM(visitors) as visitors").
		From("_analytics_sources").
		Where(dbx.And(
			dbx.NewExp("date >= {:start}", dbx.Params{"start": startDate}),
			dbx.NewExp("date <= {:end}", dbx.Params{"end": endDate}),
		)).
		GroupBy("source").
		OrderBy("visitors DESC").
		Limit(int64(limit)).
		All(&stats)

	return stats, err
}

// GetDeviceStats 查询指定日期范围的设备分布。
func (r *AnalyticsRepositorySQLite) GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDeviceStat, error) {
	var stats []*AnalyticsDeviceStat

	err := r.db.Select("browser", "os", "SUM(visitors) as visitors").
		From("_analytics_devices").
		Where(dbx.And(
			dbx.NewExp("date >= {:start}", dbx.Params{"start": startDate}),
			dbx.NewExp("date <= {:end}", dbx.Params{"end": endDate}),
		)).
		GroupBy("browser", "os").
		OrderBy("visitors DESC").
		All(&stats)

	return stats, err
}

// GetDailyHLLSketches 获取指定日期范围的 HLL Sketches，用于跨天 UV 合并。
func (r *AnalyticsRepositorySQLite) GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error) {
	var results []struct {
		TotalUV []byte `db:"total_uv"`
	}

	err := r.db.Select("total_uv").
		From("_analytics_daily").
		Where(dbx.And(
			dbx.NewExp("date >= {:start}", dbx.Params{"start": startDate}),
			dbx.NewExp("date <= {:end}", dbx.Params{"end": endDate}),
			dbx.NewExp("total_uv IS NOT NULL"),
		)).
		All(&results)

	if err != nil {
		return nil, err
	}

	sketches := make([][]byte, 0, len(results))
	for _, r := range results {
		if len(r.TotalUV) > 0 {
			sketches = append(sketches, r.TotalUV)
		}
	}

	return sketches, nil
}

// DeleteBefore 删除指定日期之前的所有统计数据。
func (r *AnalyticsRepositorySQLite) DeleteBefore(ctx context.Context, date string) error {
	tables := []string{"_analytics_daily", "_analytics_sources", "_analytics_devices"}

	for _, table := range tables {
		_, err := r.db.Delete(table,
			dbx.NewExp("date < {:date}", dbx.Params{"date": date}),
		).Execute()
		if err != nil {
			return err
		}
	}

	return nil
}

// Close 关闭存储连接。
func (r *AnalyticsRepositorySQLite) Close() error {
	// SQLite 使用共享的 App DB，不需要单独关闭
	return nil
}

// 确保实现了接口
var _ AnalyticsRepository = (*AnalyticsRepositorySQLite)(nil)
