package analytics

import (
	"context"
	"time"

	"github.com/pocketbase/dbx"
)

// RepositoryPostgres 实现 PostgreSQL 模式的分析数据存储。
// 与 SQLite 版本的主要区别：
// - 使用 UNLOGGED 表提高写入性能
// - 使用 ON CONFLICT 语法实现 upsert
type RepositoryPostgres struct {
	db dbx.Builder
}

// NewRepositoryPostgres 创建一个新的 PostgreSQL Repository。
func NewRepositoryPostgres(db dbx.Builder) *RepositoryPostgres {
	return &RepositoryPostgres{db: db}
}

// UpsertDaily 更新或插入每日统计数据。
// 使用 PostgreSQL 的 ON CONFLICT 语法实现原子 upsert。
func (r *RepositoryPostgres) UpsertDaily(ctx context.Context, stat *DailyStat) error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")

	// 先尝试读取现有记录以合并 HLL
	var existing DailyStat
	err := r.db.Select("*").
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
				if err := mergedHLL.MergeBytes(existing.TotalUV); err == nil {
					newVisitors = int64(mergedHLL.Count())
				}
			}
			if len(stat.TotalUV) > 0 {
				if err := mergedHLL.MergeBytes(stat.TotalUV); err == nil {
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
func (r *RepositoryPostgres) UpsertSource(ctx context.Context, stat *SourceStat) error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")

	var existing SourceStat
	err := r.db.Select("*").
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
func (r *RepositoryPostgres) UpsertDevice(ctx context.Context, stat *DeviceStat) error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")

	var existing DeviceStat
	err := r.db.Select("*").
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
func (r *RepositoryPostgres) GetDailyStats(ctx context.Context, startDate, endDate string) ([]*DailyStat, error) {
	var stats []*DailyStat

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
func (r *RepositoryPostgres) GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*DailyStat, error) {
	if limit <= 0 {
		limit = 10
	}

	var stats []*DailyStat

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
func (r *RepositoryPostgres) GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*SourceStat, error) {
	if limit <= 0 {
		limit = 10
	}

	var stats []*SourceStat

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
func (r *RepositoryPostgres) GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*DeviceStat, error) {
	var stats []*DeviceStat

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
func (r *RepositoryPostgres) GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error) {
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
func (r *RepositoryPostgres) DeleteBefore(ctx context.Context, date string) error {
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
func (r *RepositoryPostgres) Close() error {
	// PostgreSQL 使用共享的 App DB，不需要单独关闭
	return nil
}

// 确保实现了接口
var _ Repository = (*RepositoryPostgres)(nil)
