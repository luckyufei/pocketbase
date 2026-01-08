package core_test

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// MetricsRepository 基础测试
// ============================================================================

func TestMetricsRepositoryInsert(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	metrics := &core.SystemMetrics{
		Timestamp:       types.NowDateTime(),
		CpuUsagePercent: 25.5,
		MemoryAllocMB:   128.75,
		GoroutinesCount: 50,
	}

	err := repo.Insert(metrics)
	if err != nil {
		t.Fatalf("Failed to insert: %v", err)
	}

	// 验证 Id 已生成
	if metrics.Id == "" {
		t.Fatal("Expected Id to be generated")
	}

	// 验证可以查询到
	latest, err := repo.GetLatest()
	if err != nil {
		t.Fatalf("Failed to get latest: %v", err)
	}

	if latest == nil {
		t.Fatal("Expected non-nil latest")
	}

	if latest.Id != metrics.Id {
		t.Fatalf("Expected Id %s, got %s", metrics.Id, latest.Id)
	}
}

func TestMetricsRepositoryInsertBatch(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	// 创建批量记录
	records := make([]*core.SystemMetrics, 10)
	now := time.Now().UTC()
	for i := 0; i < 10; i++ {
		dt, _ := types.ParseDateTime(now.Add(time.Duration(i) * time.Minute))
		records[i] = &core.SystemMetrics{
			Timestamp:       dt,
			CpuUsagePercent: float64(i * 10),
			MemoryAllocMB:   float64(100 + i*10),
		}
	}

	err := repo.InsertBatch(records)
	if err != nil {
		t.Fatalf("Failed to insert batch: %v", err)
	}

	// 验证所有记录都有 Id
	for i, r := range records {
		if r.Id == "" {
			t.Fatalf("Record %d missing Id", i)
		}
	}

	// 验证数量
	items, total, err := repo.GetByTimeRange(24, 100)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 10 {
		t.Fatalf("Expected 10 items, got %d", len(items))
	}

	if total != 10 {
		t.Fatalf("Expected total 10, got %d", total)
	}
}

// ============================================================================
// MetricsRepository 查询测试
// ============================================================================

func TestMetricsRepositoryGetLatest(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	// 空数据库应返回 nil
	latest, err := repo.GetLatest()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if latest != nil {
		t.Fatal("Expected nil for empty database")
	}

	// 插入多条记录
	now := time.Now().UTC()
	for i := 0; i < 3; i++ {
		dt, _ := types.ParseDateTime(now.Add(time.Duration(i) * time.Minute))
		m := &core.SystemMetrics{
			Timestamp:       dt,
			CpuUsagePercent: float64(i * 10),
		}
		if err := repo.Insert(m); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// 获取最新的应该是最后插入的
	latest, err = repo.GetLatest()
	if err != nil {
		t.Fatalf("Failed to get latest: %v", err)
	}

	if latest == nil {
		t.Fatal("Expected non-nil latest")
	}

	if latest.CpuUsagePercent != 20.0 {
		t.Fatalf("Expected CpuUsagePercent 20.0, got %v", latest.CpuUsagePercent)
	}
}

func TestMetricsRepositoryGetByTimeRange(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	now := time.Now().UTC()

	// 插入 5 条记录
	for i := 0; i < 5; i++ {
		dt, _ := types.ParseDateTime(now.Add(-time.Duration(i) * time.Minute))
		m := &core.SystemMetrics{
			Timestamp:       dt,
			CpuUsagePercent: float64(i),
		}
		if err := repo.Insert(m); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// 查询过去 24 小时
	items, total, err := repo.GetByTimeRange(24, 100)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 5 {
		t.Fatalf("Expected 5 items, got %d", len(items))
	}

	if total != 5 {
		t.Fatalf("Expected total 5, got %d", total)
	}
}

func TestMetricsRepositoryGetByTimeRangeWithLimit(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	// 插入 10 条记录
	now := time.Now().UTC()
	for i := 0; i < 10; i++ {
		dt, _ := types.ParseDateTime(now.Add(time.Duration(i) * time.Second))
		m := &core.SystemMetrics{Timestamp: dt}
		if err := repo.Insert(m); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// 限制 5 条
	items, total, err := repo.GetByTimeRange(24, 5)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 5 {
		t.Fatalf("Expected 5 items, got %d", len(items))
	}

	// total 应该是 6 表示有更多数据
	if total != 6 {
		t.Fatalf("Expected total 6 (limit+1), got %d", total)
	}
}

// ============================================================================
// MetricsRepository 清理测试
// ============================================================================

func TestMetricsRepositoryCleanup(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	now := time.Now().UTC()

	// 插入旧记录（8 天前）
	oldDt, _ := types.ParseDateTime(now.AddDate(0, 0, -8))
	oldMetrics := &core.SystemMetrics{Timestamp: oldDt}
	if err := repo.Insert(oldMetrics); err != nil {
		t.Fatalf("Failed to insert old: %v", err)
	}

	// 插入新记录
	newDt, _ := types.ParseDateTime(now)
	newMetrics := &core.SystemMetrics{Timestamp: newDt}
	if err := repo.Insert(newMetrics); err != nil {
		t.Fatalf("Failed to insert new: %v", err)
	}

	// 清理
	deleted, err := repo.CleanupOldMetrics()
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}

	if deleted != 1 {
		t.Fatalf("Expected 1 deleted, got %d", deleted)
	}

	// 验证只剩新记录
	items, _, err := repo.GetByTimeRange(24*30, 100)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("Expected 1 item remaining, got %d", len(items))
	}

	if items[0].Id != newMetrics.Id {
		t.Fatal("Expected new metrics to remain")
	}
}

// ============================================================================
// MetricsRepository 并发测试
// ============================================================================

func TestMetricsRepositoryConcurrentInsert(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	repo := core.NewMetricsRepository(app)

	// 并发插入 50 条
	done := make(chan error, 50)
	for i := 0; i < 50; i++ {
		go func(idx int) {
			m := &core.SystemMetrics{
				Timestamp:       types.NowDateTime(),
				CpuUsagePercent: float64(idx),
			}
			done <- repo.Insert(m)
		}(i)
	}

	// 等待完成
	for i := 0; i < 50; i++ {
		if err := <-done; err != nil {
			t.Errorf("Insert error: %v", err)
		}
	}

	// 验证数量
	items, _, err := repo.GetByTimeRange(24, 1000)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 50 {
		t.Fatalf("Expected 50 items, got %d", len(items))
	}
}
