package core

import (
	"context"
	"sync"
	"time"
)

// AnalyticsFlusher 负责定时将内存中的聚合数据刷新到数据库。
// 它实现了 Fork & Flush 架构中的 Flush 部分。
type AnalyticsFlusher struct {
	app        App
	buffer     *AnalyticsBuffer
	repository AnalyticsRepository
	config     *AnalyticsConfig

	mu       sync.Mutex
	running  bool
	stopCh   chan struct{}
	doneCh   chan struct{}
	ticker   *time.Ticker
}

// NewAnalyticsFlusher 创建一个新的 Flusher 实例。
func NewAnalyticsFlusher(app App, buffer *AnalyticsBuffer, repo AnalyticsRepository, config *AnalyticsConfig) *AnalyticsFlusher {
	return &AnalyticsFlusher{
		app:        app,
		buffer:     buffer,
		repository: repo,
		config:     config,
	}
}

// Start 启动定时刷新任务。
func (f *AnalyticsFlusher) Start(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.running {
		return nil
	}

	interval := time.Duration(f.config.FlushInterval) * time.Second
	if interval <= 0 {
		interval = 10 * time.Second
	}

	f.ticker = time.NewTicker(interval)
	f.stopCh = make(chan struct{})
	f.doneCh = make(chan struct{})
	f.running = true

	go f.run(ctx)

	return nil
}

// Stop 停止定时刷新任务，并执行最后一次刷新。
func (f *AnalyticsFlusher) Stop(ctx context.Context) error {
	f.mu.Lock()
	if !f.running {
		f.mu.Unlock()
		return nil
	}
	f.running = false
	close(f.stopCh)
	f.mu.Unlock()

	// 等待运行循环结束
	<-f.doneCh

	// 执行最后一次刷新
	return f.Flush(ctx)
}

// Flush 立即执行一次刷新操作。
func (f *AnalyticsFlusher) Flush(ctx context.Context) error {
	if f.buffer == nil {
		return nil
	}

	// 刷新聚合数据到数据库
	if err := f.flushAggregations(ctx); err != nil {
		return err
	}

	// 检查是否需要刷新原始日志到 Parquet
	if f.buffer.ShouldFlushRaw() {
		if err := f.flushRawToParquet(ctx); err != nil {
			// 原始日志刷新失败不应阻塞聚合数据刷新
			// 记录错误但继续
			if f.app != nil {
				f.app.Logger().Error("Failed to flush raw events to Parquet", "error", err)
			}
		}
	}

	return nil
}

// FlushWithRetry 执行刷新操作，失败时进行重试。
// maxRetries: 最大重试次数（不包括首次尝试）
// retryDelay: 重试间隔（指数退避的基础延迟）
func (f *AnalyticsFlusher) FlushWithRetry(ctx context.Context, maxRetries int, retryDelay time.Duration) error {
	if f.buffer == nil {
		return nil
	}

	if f.repository == nil {
		return nil
	}

	// 先获取数据（会清空 buffer）
	dailyAggs := f.buffer.DrainAggregations()
	sourceAggs := f.buffer.DrainSourceAggregations()
	deviceAggs := f.buffer.DrainDeviceAggregations()

	// 如果没有数据，直接返回
	if len(dailyAggs) == 0 && len(sourceAggs) == 0 && len(deviceAggs) == 0 {
		return nil
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		// 检查 context 是否已取消
		select {
		case <-ctx.Done():
			// 将数据放回 buffer
			f.restoreAggregations(dailyAggs, sourceAggs, deviceAggs)
			return ctx.Err()
		default:
		}

		// 尝试写入
		err := f.writeAggregationsFromMaps(ctx, dailyAggs, sourceAggs, deviceAggs)
		if err == nil {
			// 成功，处理原始日志
			if f.buffer.ShouldFlushRaw() {
				if rawErr := f.flushRawToParquet(ctx); rawErr != nil {
					if f.app != nil {
						f.app.Logger().Error("Failed to flush raw events to Parquet", "error", rawErr)
					}
				}
			}
			return nil
		}

		lastErr = err

		// 如果不是最后一次尝试，等待后重试
		if attempt < maxRetries {
			// 指数退避：delay * 2^attempt
			delay := retryDelay * time.Duration(1<<uint(attempt))
			if f.app != nil {
				f.app.Logger().Warn("Analytics flush failed, retrying",
					"attempt", attempt+1,
					"maxRetries", maxRetries,
					"delay", delay,
					"error", err)
			}

			select {
			case <-ctx.Done():
				// 将数据放回 buffer
				f.restoreAggregations(dailyAggs, sourceAggs, deviceAggs)
				return ctx.Err()
			case <-time.After(delay):
				// 继续重试
			}
		}
	}

	// 所有重试都失败，将数据放回 buffer 以便下次重试
	f.restoreAggregations(dailyAggs, sourceAggs, deviceAggs)

	if f.app != nil {
		f.app.Logger().Error("Analytics flush failed after all retries",
			"maxRetries", maxRetries,
			"error", lastErr)
	}
	return lastErr
}

// writeAggregationsFromMaps 将聚合数据写入数据库。
func (f *AnalyticsFlusher) writeAggregationsFromMaps(ctx context.Context, dailyAggs map[string]*AnalyticsAggregation, sourceAggs map[string]*AnalyticsSourceAggregation, deviceAggs map[string]*AnalyticsDeviceAggregation) error {
	// 刷新每日统计
	for _, agg := range dailyAggs {
		stat := &AnalyticsDailyStat{
			ID:       generateAnalyticsID(agg.Date, agg.Path),
			Date:     agg.Date,
			Path:     agg.Path,
			TotalPV:  agg.PV,
			TotalUV:  agg.HLL,
			Visitors: agg.Count,
			AvgDur:   0,
		}
		if err := f.repository.UpsertDaily(ctx, stat); err != nil {
			return err
		}
	}

	// 刷新来源统计
	for _, agg := range sourceAggs {
		stat := &AnalyticsSourceStat{
			ID:       generateAnalyticsID(agg.Date, agg.Source),
			Date:     agg.Date,
			Source:   agg.Source,
			Visitors: agg.Count,
		}
		if err := f.repository.UpsertSource(ctx, stat); err != nil {
			return err
		}
	}

	// 刷新设备统计
	for _, agg := range deviceAggs {
		stat := &AnalyticsDeviceStat{
			ID:       generateAnalyticsID(agg.Date, agg.Browser+"|"+agg.OS),
			Date:     agg.Date,
			Browser:  agg.Browser,
			OS:       agg.OS,
			Visitors: agg.Count,
		}
		if err := f.repository.UpsertDevice(ctx, stat); err != nil {
			return err
		}
	}

	return nil
}

// restoreAggregations 将聚合数据放回 buffer。
func (f *AnalyticsFlusher) restoreAggregations(dailyAggs map[string]*AnalyticsAggregation, sourceAggs map[string]*AnalyticsSourceAggregation, deviceAggs map[string]*AnalyticsDeviceAggregation) {
	f.buffer.RestoreAggregations(dailyAggs)
	f.buffer.RestoreSourceAggregations(sourceAggs)
	f.buffer.RestoreDeviceAggregations(deviceAggs)
}

// run 是定时刷新的主循环。
func (f *AnalyticsFlusher) run(ctx context.Context) {
	defer close(f.doneCh)
	defer f.ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-f.stopCh:
			return
		case <-f.ticker.C:
			if err := f.Flush(ctx); err != nil {
				if f.app != nil {
					f.app.Logger().Error("Analytics flush error", "error", err)
				}
			}
		}
	}
}

// flushAggregations 将聚合数据刷新到数据库。
func (f *AnalyticsFlusher) flushAggregations(ctx context.Context) error {
	if f.repository == nil {
		return nil
	}

	// 获取并清空聚合数据
	dailyAggs := f.buffer.DrainAggregations()
	sourceAggs := f.buffer.DrainSourceAggregations()
	deviceAggs := f.buffer.DrainDeviceAggregations()

	// 刷新每日统计
	for _, agg := range dailyAggs {
		stat := &AnalyticsDailyStat{
			ID:       generateAnalyticsID(agg.Date, agg.Path),
			Date:     agg.Date,
			Path:     agg.Path,
			TotalPV:  agg.PV,
			TotalUV:  agg.HLL,
			Visitors: agg.Count, // 临时使用 Count，后续用 HLL 计算
			AvgDur:   0,         // TODO: 计算平均停留时长
		}
		if err := f.repository.UpsertDaily(ctx, stat); err != nil {
			return err
		}
	}

	// 刷新来源统计
	for _, agg := range sourceAggs {
		stat := &AnalyticsSourceStat{
			ID:       generateAnalyticsID(agg.Date, agg.Source),
			Date:     agg.Date,
			Source:   agg.Source,
			Visitors: agg.Count,
		}
		if err := f.repository.UpsertSource(ctx, stat); err != nil {
			return err
		}
	}

	// 刷新设备统计
	for _, agg := range deviceAggs {
		stat := &AnalyticsDeviceStat{
			ID:       generateAnalyticsID(agg.Date, agg.Browser+"|"+agg.OS),
			Date:     agg.Date,
			Browser:  agg.Browser,
			OS:       agg.OS,
			Visitors: agg.Count,
		}
		if err := f.repository.UpsertDevice(ctx, stat); err != nil {
			return err
		}
	}

	return nil
}

// flushRawToParquet 将原始事件刷新到 Parquet 文件。
func (f *AnalyticsFlusher) flushRawToParquet(ctx context.Context) error {
	events := f.buffer.DrainRaw()
	if len(events) == 0 {
		return nil
	}

	// TODO: Phase 5 实现 Parquet 写入
	// - SQLite 模式：写入本地文件
	// - PostgreSQL 模式：写入 S3

	return nil
}

// generateAnalyticsID 生成分析数据的唯一 ID。
// 使用 date + key 的哈希作为 ID，确保同一天同一维度的数据可以合并。
func generateAnalyticsID(date, key string) string {
	// 简单实现：使用 date|key 作为 ID
	// 生产环境可以使用 hash 缩短 ID 长度
	return date + "|" + key
}
