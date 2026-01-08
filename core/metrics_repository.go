package core

import (
	"database/sql"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/security"
)

const (
	// MetricsRetentionDays 监控数据保留天数
	MetricsRetentionDays = 7
)

// MetricsRepository 监控数据仓库
// 使用 AuxDB 存储监控数据，与 Logs 共享数据库
type MetricsRepository struct {
	app App
}

// NewMetricsRepository 创建监控数据仓库实例
func NewMetricsRepository(app App) *MetricsRepository {
	return &MetricsRepository{app: app}
}

// Insert 插入单条监控记录
// 自动生成 Id
func (r *MetricsRepository) Insert(metrics *SystemMetrics) error {
	if metrics.Id == "" {
		metrics.Id = security.RandomString(15)
	}

	return r.app.AuxSave(metrics)
}

// InsertBatch 批量插入监控记录
// 使用事务确保原子性
func (r *MetricsRepository) InsertBatch(records []*SystemMetrics) error {
	if len(records) == 0 {
		return nil
	}

	// 为所有记录生成 Id
	for _, m := range records {
		if m.Id == "" {
			m.Id = security.RandomString(15)
		}
	}

	return r.app.AuxRunInTransaction(func(txApp App) error {
		for _, m := range records {
			if err := txApp.AuxSave(m); err != nil {
				return err
			}
		}
		return nil
	})
}

// GetLatest 获取最新一条监控记录
func (r *MetricsRepository) GetLatest() (*SystemMetrics, error) {
	var metrics SystemMetrics
	err := r.app.AuxModelQuery(&metrics).
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
// 返回值 totalItems：当等于 limit+1 时表示可能有更多数据
func (r *MetricsRepository) GetByTimeRange(hours int, limit int) ([]*SystemMetrics, int, error) {
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	// 查询 limit+1 条来判断是否有更多数据
	var metrics []*SystemMetrics
	err := r.app.AuxModelQuery(&SystemMetrics{}).
		AndWhere(dbx.NewExp("timestamp >= {:since}", dbx.Params{"since": since})).
		OrderBy("timestamp ASC").
		Limit(int64(limit + 1)).
		All(&metrics)

	if err != nil {
		return nil, 0, err
	}

	// 判断是否有更多数据
	hasMore := len(metrics) > limit
	if hasMore {
		metrics = metrics[:limit]
	}

	totalItems := len(metrics)
	if hasMore {
		totalItems = limit + 1
	}

	return metrics, totalItems, nil
}

// CleanupOldMetrics 清理过期的监控数据
func (r *MetricsRepository) CleanupOldMetrics() (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -MetricsRetentionDays)

	result, err := r.app.AuxNonconcurrentDB().Delete(
		SystemMetricsTableName,
		dbx.NewExp("timestamp < {:cutoff}", dbx.Params{"cutoff": cutoff}),
	).Execute()

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, nil
}
