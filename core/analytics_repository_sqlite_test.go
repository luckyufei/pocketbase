package core_test

import (
	"context"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// createAnalyticsTables 在测试数据库中创建 analytics 表
func createAnalyticsTables(app *tests.TestApp) error {
	sql := `
		CREATE TABLE IF NOT EXISTS "_analytics_daily" (
			"id"       TEXT PRIMARY KEY NOT NULL,
			"date"     TEXT NOT NULL,
			"path"     TEXT NOT NULL,
			"total_pv" INTEGER DEFAULT 0 NOT NULL,
			"total_uv" BLOB,
			"visitors" INTEGER DEFAULT 0 NOT NULL,
			"avg_dur"  INTEGER DEFAULT 0 NOT NULL,
			"created"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
			"updated"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
		);
		CREATE TABLE IF NOT EXISTS "_analytics_sources" (
			"id"       TEXT PRIMARY KEY NOT NULL,
			"date"     TEXT NOT NULL,
			"source"   TEXT NOT NULL,
			"visitors" INTEGER DEFAULT 0 NOT NULL,
			"created"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
			"updated"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
		);
		CREATE TABLE IF NOT EXISTS "_analytics_devices" (
			"id"       TEXT PRIMARY KEY NOT NULL,
			"date"     TEXT NOT NULL,
			"browser"  TEXT NOT NULL,
			"os"       TEXT NOT NULL,
			"visitors" INTEGER DEFAULT 0 NOT NULL,
			"created"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
			"updated"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
		);
	`
	_, err := app.DB().NewQuery(sql).Execute()
	return err
}

func TestAnalyticsRepositorySQLite_UpsertDaily(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())
	ctx := context.Background()

	// 创建 HLL 用于测试
	hll := core.NewHLL()
	hll.Add("user1")
	hllBytes, _ := hll.Bytes()

	stat := &core.AnalyticsDailyStat{
		ID:       "test_daily_001",
		Date:     "2024-01-01",
		Path:     "/test-page",
		TotalPV:  100,
		TotalUV:  hllBytes,
		Visitors: 50,
		AvgDur:   30,
	}

	// 测试插入
	err := repo.UpsertDaily(ctx, stat)
	if err != nil {
		t.Fatalf("UpsertDaily insert failed: %v", err)
	}

	// 测试更新（累加 PV 和合并 HLL）
	hll2 := core.NewHLL()
	hll2.Add("user2")
	hllBytes2, _ := hll2.Bytes()

	stat2 := &core.AnalyticsDailyStat{
		ID:       "test_daily_001",
		Date:     "2024-01-01",
		Path:     "/test-page",
		TotalPV:  50,
		TotalUV:  hllBytes2,
		Visitors: 1,
	}

	err = repo.UpsertDaily(ctx, stat2)
	if err != nil {
		t.Fatalf("UpsertDaily update failed: %v", err)
	}

	// 验证结果
	stats, err := repo.GetDailyStats(ctx, "2024-01-01", "2024-01-01")
	if err != nil {
		t.Fatalf("GetDailyStats failed: %v", err)
	}

	if len(stats) != 1 {
		t.Fatalf("Expected 1 stat, got %d", len(stats))
	}

	if stats[0].TotalPV != 150 {
		t.Errorf("Expected TotalPV 150, got %d", stats[0].TotalPV)
	}

	// HLL 合并后应该有 2 个不同用户
	if stats[0].Visitors != 2 {
		t.Errorf("Expected Visitors 2 (merged HLL), got %d", stats[0].Visitors)
	}
}

func TestAnalyticsRepositorySQLite_UpsertSource(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())
	ctx := context.Background()

	stat := &core.AnalyticsSourceStat{
		ID:       "test_source_001",
		Date:     "2024-01-01",
		Source:   "google",
		Visitors: 100,
	}

	// 测试插入
	err := repo.UpsertSource(ctx, stat)
	if err != nil {
		t.Fatalf("UpsertSource insert failed: %v", err)
	}

	// 测试更新
	stat2 := &core.AnalyticsSourceStat{
		ID:       "test_source_001",
		Date:     "2024-01-01",
		Source:   "google",
		Visitors: 50,
	}

	err = repo.UpsertSource(ctx, stat2)
	if err != nil {
		t.Fatalf("UpsertSource update failed: %v", err)
	}

	// 验证结果
	stats, err := repo.GetTopSources(ctx, "2024-01-01", "2024-01-01", 10)
	if err != nil {
		t.Fatalf("GetTopSources failed: %v", err)
	}

	if len(stats) != 1 {
		t.Fatalf("Expected 1 stat, got %d", len(stats))
	}

	if stats[0].Visitors != 150 {
		t.Errorf("Expected Visitors 150, got %d", stats[0].Visitors)
	}
}

func TestAnalyticsRepositorySQLite_UpsertDevice(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())
	ctx := context.Background()

	stat := &core.AnalyticsDeviceStat{
		ID:       "test_device_001",
		Date:     "2024-01-01",
		Browser:  "Chrome",
		OS:       "Windows",
		Visitors: 100,
	}

	// 测试插入
	err := repo.UpsertDevice(ctx, stat)
	if err != nil {
		t.Fatalf("UpsertDevice insert failed: %v", err)
	}

	// 测试更新
	stat2 := &core.AnalyticsDeviceStat{
		ID:       "test_device_001",
		Date:     "2024-01-01",
		Browser:  "Chrome",
		OS:       "Windows",
		Visitors: 50,
	}

	err = repo.UpsertDevice(ctx, stat2)
	if err != nil {
		t.Fatalf("UpsertDevice update failed: %v", err)
	}

	// 验证结果
	stats, err := repo.GetDeviceStats(ctx, "2024-01-01", "2024-01-01")
	if err != nil {
		t.Fatalf("GetDeviceStats failed: %v", err)
	}

	if len(stats) != 1 {
		t.Fatalf("Expected 1 stat, got %d", len(stats))
	}

	if stats[0].Visitors != 150 {
		t.Errorf("Expected Visitors 150, got %d", stats[0].Visitors)
	}
}

func TestAnalyticsRepositorySQLite_GetTopPages(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())
	ctx := context.Background()

	// 插入多个页面数据
	pages := []struct {
		id   string
		path string
		pv   int64
	}{
		{"page_001", "/home", 1000},
		{"page_002", "/about", 500},
		{"page_003", "/contact", 200},
	}

	for _, p := range pages {
		err := repo.UpsertDaily(ctx, &core.AnalyticsDailyStat{
			ID:       p.id,
			Date:     "2024-01-01",
			Path:     p.path,
			TotalPV:  p.pv,
			Visitors: p.pv / 2,
		})
		if err != nil {
			t.Fatalf("UpsertDaily failed for %s: %v", p.path, err)
		}
	}

	// 测试获取 Top 2 页面
	stats, err := repo.GetTopPages(ctx, "2024-01-01", "2024-01-01", 2)
	if err != nil {
		t.Fatalf("GetTopPages failed: %v", err)
	}

	if len(stats) != 2 {
		t.Fatalf("Expected 2 stats, got %d", len(stats))
	}

	if stats[0].Path != "/home" {
		t.Errorf("Expected first page /home, got %s", stats[0].Path)
	}

	if stats[1].Path != "/about" {
		t.Errorf("Expected second page /about, got %s", stats[1].Path)
	}
}

func TestAnalyticsRepositorySQLite_GetDailyHLLSketches(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())
	ctx := context.Background()

	// 插入带 HLL 的数据
	dates := []string{"2024-01-01", "2024-01-02", "2024-01-03"}
	for i, date := range dates {
		hll := core.NewHLL()
		hll.Add("user" + string(rune('1'+i)))
		hllBytes, _ := hll.Bytes()

		err := repo.UpsertDaily(ctx, &core.AnalyticsDailyStat{
			ID:       "hll_test_" + string(rune('1'+i)),
			Date:     date,
			Path:     "/test",
			TotalPV:  100,
			TotalUV:  hllBytes,
			Visitors: 1,
		})
		if err != nil {
			t.Fatalf("UpsertDaily failed: %v", err)
		}
	}

	// 获取 HLL Sketches
	sketches, err := repo.GetDailyHLLSketches(ctx, "2024-01-01", "2024-01-03")
	if err != nil {
		t.Fatalf("GetDailyHLLSketches failed: %v", err)
	}

	if len(sketches) != 3 {
		t.Errorf("Expected 3 sketches, got %d", len(sketches))
	}

	// 合并 HLL 验证
	_, count, err := core.MergeHLLBytes(sketches...)
	if err != nil {
		t.Fatalf("MergeHLLBytes failed: %v", err)
	}

	if count != 3 {
		t.Errorf("Expected merged count 3, got %d", count)
	}
}

func TestAnalyticsRepositorySQLite_DeleteBefore(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())
	ctx := context.Background()

	// 插入多天数据
	dates := []string{"2024-01-01", "2024-01-02", "2024-01-03"}
	for i, date := range dates {
		err := repo.UpsertDaily(ctx, &core.AnalyticsDailyStat{
			ID:       "delete_test_" + string(rune('1'+i)),
			Date:     date,
			Path:     "/test",
			TotalPV:  100,
			Visitors: 50,
		})
		if err != nil {
			t.Fatalf("UpsertDaily failed: %v", err)
		}

		err = repo.UpsertSource(ctx, &core.AnalyticsSourceStat{
			ID:       "delete_source_" + string(rune('1'+i)),
			Date:     date,
			Source:   "google",
			Visitors: 50,
		})
		if err != nil {
			t.Fatalf("UpsertSource failed: %v", err)
		}

		err = repo.UpsertDevice(ctx, &core.AnalyticsDeviceStat{
			ID:       "delete_device_" + string(rune('1'+i)),
			Date:     date,
			Browser:  "Chrome",
			OS:       "Windows",
			Visitors: 50,
		})
		if err != nil {
			t.Fatalf("UpsertDevice failed: %v", err)
		}
	}

	// 删除 2024-01-02 之前的数据
	err := repo.DeleteBefore(ctx, "2024-01-02")
	if err != nil {
		t.Fatalf("DeleteBefore failed: %v", err)
	}

	// 验证只剩下 2024-01-02 和 2024-01-03 的数据
	stats, err := repo.GetDailyStats(ctx, "2024-01-01", "2024-01-03")
	if err != nil {
		t.Fatalf("GetDailyStats failed: %v", err)
	}

	if len(stats) != 2 {
		t.Errorf("Expected 2 stats after delete, got %d", len(stats))
	}

	// 验证 2024-01-01 的数据已被删除
	for _, stat := range stats {
		if stat.Date == "2024-01-01" {
			t.Error("Expected 2024-01-01 data to be deleted")
		}
	}
}

func TestAnalyticsRepositorySQLite_Close(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	if err := createAnalyticsTables(app); err != nil {
		t.Fatalf("Failed to create analytics tables: %v", err)
	}

	repo := core.NewAnalyticsRepositorySQLite(app.DB())

	// Close 应该不返回错误（SQLite 使用共享 DB）
	err := repo.Close()
	if err != nil {
		t.Errorf("Close returned error: %v", err)
	}
}
