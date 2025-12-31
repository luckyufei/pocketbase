package core_test

import (
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/security"
)

// ============================================================================
// MetricsDB Creation Tests
// ============================================================================

func TestNewMetricsDB(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	if metricsDB.DB() == nil {
		t.Fatal("Expected non-nil DB connection")
	}
}

func TestNewMetricsDBInvalidPath(t *testing.T) {
	// Try to create MetricsDB with invalid path
	_, err := core.NewMetricsDB("/nonexistent/path/that/should/fail", core.DefaultDBConnect)
	if err == nil {
		t.Fatal("Expected error for invalid path")
	}
}

// ============================================================================
// MetricsDB Insert Tests
// ============================================================================

func TestMetricsDBInsert(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	metrics := &core.SystemMetrics{
		Id:              security.RandomString(15),
		Timestamp:       time.Now().UTC(),
		CpuUsagePercent: 25.5,
		MemoryAllocMB:   128.75,
		GoroutinesCount: 50,
		SqliteWalSizeMB: 1.5,
		SqliteOpenConns: 5,
		P95LatencyMs:    10.25,
		Http5xxCount:    2,
	}

	err = metricsDB.Insert(metrics)
	if err != nil {
		t.Fatalf("Failed to insert metrics: %v", err)
	}

	// Verify by querying
	latest, err := metricsDB.GetLatest()
	if err != nil {
		t.Fatalf("Failed to get latest metrics: %v", err)
	}

	if latest == nil {
		t.Fatal("Expected non-nil latest metrics")
	}

	if latest.Id != metrics.Id {
		t.Fatalf("Expected Id %s, got %s", metrics.Id, latest.Id)
	}
}

func TestMetricsDBInsertAfterClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	// Close the database
	metricsDB.Close()

	// Try to insert after close
	metrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: time.Now().UTC(),
	}

	err = metricsDB.Insert(metrics)
	if err == nil {
		t.Fatal("Expected error when inserting after close")
	}
}

// ============================================================================
// MetricsDB InsertBatch Tests
// ============================================================================

func TestMetricsDBInsertBatch(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Create batch of records
	records := make([]*core.SystemMetrics, 10)
	for i := 0; i < 10; i++ {
		records[i] = &core.SystemMetrics{
			Id:              security.RandomString(15),
			Timestamp:       time.Now().UTC().Add(time.Duration(i) * time.Minute),
			CpuUsagePercent: float64(i * 10),
			MemoryAllocMB:   float64(100 + i*10),
			GoroutinesCount: 10 + i,
		}
	}

	err = metricsDB.InsertBatch(records)
	if err != nil {
		t.Fatalf("Failed to insert batch: %v", err)
	}

	// Verify count
	items, total, err := metricsDB.GetByTimeRange(24, 100)
	if err != nil {
		t.Fatalf("Failed to query metrics: %v", err)
	}

	if len(items) != 10 {
		t.Fatalf("Expected 10 items, got %d", len(items))
	}

	if total != 10 {
		t.Fatalf("Expected total 10, got %d", total)
	}
}

func TestMetricsDBInsertBatchEmpty(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert empty batch should succeed
	err = metricsDB.InsertBatch([]*core.SystemMetrics{})
	if err != nil {
		t.Fatalf("Failed to insert empty batch: %v", err)
	}
}

func TestMetricsDBInsertBatchAfterClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	metricsDB.Close()

	records := []*core.SystemMetrics{{
		Id:        security.RandomString(15),
		Timestamp: time.Now().UTC(),
	}}

	err = metricsDB.InsertBatch(records)
	if err == nil {
		t.Fatal("Expected error when inserting batch after close")
	}
}

// ============================================================================
// MetricsDB Query Tests
// ============================================================================

func TestMetricsDBGetLatest(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Empty database should return nil
	latest, err := metricsDB.GetLatest()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if latest != nil {
		t.Fatal("Expected nil for empty database")
	}

	// Insert some records
	for i := 0; i < 3; i++ {
		metrics := &core.SystemMetrics{
			Id:              security.RandomString(15),
			Timestamp:       time.Now().UTC().Add(time.Duration(i) * time.Minute),
			CpuUsagePercent: float64(i * 10),
		}
		if err := metricsDB.Insert(metrics); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// Get latest should return the most recent
	latest, err = metricsDB.GetLatest()
	if err != nil {
		t.Fatalf("Failed to get latest: %v", err)
	}

	if latest == nil {
		t.Fatal("Expected non-nil latest")
	}

	// Should be the last inserted (highest CPU usage in our test)
	if latest.CpuUsagePercent != 20.0 {
		t.Fatalf("Expected CpuUsagePercent 20.0, got %v", latest.CpuUsagePercent)
	}
}

func TestMetricsDBGetLatestAfterClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	metricsDB.Close()

	_, err = metricsDB.GetLatest()
	if err == nil {
		t.Fatal("Expected error when querying after close")
	}
}

func TestMetricsDBGetByTimeRange(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	now := time.Now().UTC()

	// Insert records - all within the last hour
	for i := 0; i < 5; i++ {
		metrics := &core.SystemMetrics{
			Id:              security.RandomString(15),
			Timestamp:       now.Add(-time.Duration(i) * time.Minute), // minutes, not hours
			CpuUsagePercent: float64(i),
		}
		if err := metricsDB.Insert(metrics); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// Query last 24 hours - should get all 5 records
	items, total, err := metricsDB.GetByTimeRange(24, 100)
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

func TestMetricsDBGetByTimeRangeWithLimit(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert 10 records
	for i := 0; i < 10; i++ {
		metrics := &core.SystemMetrics{
			Id:        security.RandomString(15),
			Timestamp: time.Now().UTC().Add(time.Duration(i) * time.Second),
		}
		if err := metricsDB.Insert(metrics); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// Query with limit 5
	items, total, err := metricsDB.GetByTimeRange(24, 5)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 5 {
		t.Fatalf("Expected 5 items, got %d", len(items))
	}

	// total should be limit+1 to indicate more data
	if total != 6 {
		t.Fatalf("Expected total 6 (limit+1), got %d", total)
	}
}

func TestMetricsDBGetByTimeRangeAfterClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	metricsDB.Close()

	_, _, err = metricsDB.GetByTimeRange(24, 100)
	if err == nil {
		t.Fatal("Expected error when querying after close")
	}
}

// ============================================================================
// MetricsDB Cleanup Tests
// ============================================================================

func TestMetricsDBCleanupOldMetrics(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	now := time.Now().UTC()

	// Insert old record (8 days ago, beyond retention)
	oldMetrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: now.AddDate(0, 0, -8),
	}
	if err := metricsDB.Insert(oldMetrics); err != nil {
		t.Fatalf("Failed to insert old metrics: %v", err)
	}

	// Insert recent record
	recentMetrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: now,
	}
	if err := metricsDB.Insert(recentMetrics); err != nil {
		t.Fatalf("Failed to insert recent metrics: %v", err)
	}

	// Run cleanup
	deleted, err := metricsDB.CleanupOldMetrics()
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}

	if deleted != 1 {
		t.Fatalf("Expected 1 deleted, got %d", deleted)
	}

	// Verify only recent record remains
	items, _, err := metricsDB.GetByTimeRange(24*30, 100) // 30 days
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("Expected 1 item remaining, got %d", len(items))
	}

	if items[0].Id != recentMetrics.Id {
		t.Fatalf("Expected recent metrics to remain")
	}
}

func TestMetricsDBCleanupOldMetricsAfterClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	metricsDB.Close()

	_, err = metricsDB.CleanupOldMetrics()
	if err == nil {
		t.Fatal("Expected error when cleanup after close")
	}
}

// ============================================================================
// MetricsDB Rebuild Tests
// ============================================================================

func TestMetricsDBRebuild(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert a record
	metrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: time.Now().UTC(),
	}
	if err := metricsDB.Insert(metrics); err != nil {
		t.Fatalf("Failed to insert: %v", err)
	}

	// Rebuild should clear data
	if err := metricsDB.Rebuild(core.DefaultDBConnect); err != nil {
		t.Fatalf("Failed to rebuild: %v", err)
	}

	// Database should be empty
	latest, err := metricsDB.GetLatest()
	if err != nil {
		t.Fatalf("Failed to query after rebuild: %v", err)
	}

	if latest != nil {
		t.Fatal("Expected nil after rebuild")
	}
}

// ============================================================================
// MetricsDB Concurrency Tests
// ============================================================================

func TestMetricsDBConcurrentInsert(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	var wg sync.WaitGroup
	errCh := make(chan error, 100)

	// Concurrent inserts
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			metrics := &core.SystemMetrics{
				Id:              security.RandomString(15),
				Timestamp:       time.Now().UTC(),
				CpuUsagePercent: float64(idx),
			}
			if err := metricsDB.Insert(metrics); err != nil {
				errCh <- err
			}
		}(i)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Errorf("Insert error: %v", err)
	}

	// Verify all records inserted
	items, _, err := metricsDB.GetByTimeRange(24, 1000)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 100 {
		t.Fatalf("Expected 100 items, got %d", len(items))
	}
}

func TestMetricsDBConcurrentReadWrite(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	var wg sync.WaitGroup

	// Writers
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			metrics := &core.SystemMetrics{
				Id:        security.RandomString(15),
				Timestamp: time.Now().UTC(),
			}
			metricsDB.Insert(metrics)
		}(i)
	}

	// Readers
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			metricsDB.GetLatest()
			metricsDB.GetByTimeRange(24, 100)
		}()
	}

	wg.Wait()
	// Should complete without deadlock or panic
}

// ============================================================================
// MetricsDB Close Tests
// ============================================================================

func TestMetricsDBClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	// First close should succeed
	err = metricsDB.Close()
	if err != nil {
		t.Fatalf("Failed to close: %v", err)
	}

	// Second close should be safe
	err = metricsDB.Close()
	if err != nil {
		t.Fatalf("Second close should be safe: %v", err)
	}
}

func TestMetricsDBDB(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	db := metricsDB.DB()
	if db == nil {
		t.Fatal("Expected non-nil DB")
	}
}

// ============================================================================
// MetricsDB Error Path Tests
// ============================================================================

func TestMetricsDBInsertBatchWithError(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// 创建带有重复 ID 的记录来触发错误
	duplicateId := security.RandomString(15)
	records := []*core.SystemMetrics{
		{
			Id:        duplicateId,
			Timestamp: time.Now().UTC(),
		},
		{
			Id:        duplicateId, // 重复 ID 会导致错误
			Timestamp: time.Now().UTC(),
		},
	}

	err = metricsDB.InsertBatch(records)
	if err == nil {
		t.Fatal("Expected error for duplicate ID in batch")
	}
}

func TestMetricsDBGetByTimeRangeExactLimit(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert exactly 5 records
	for i := 0; i < 5; i++ {
		metrics := &core.SystemMetrics{
			Id:        security.RandomString(15),
			Timestamp: time.Now().UTC().Add(time.Duration(i) * time.Second),
		}
		if err := metricsDB.Insert(metrics); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// Query with limit exactly matching count
	items, total, err := metricsDB.GetByTimeRange(24, 5)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if len(items) != 5 {
		t.Fatalf("Expected 5 items, got %d", len(items))
	}

	// total should be 5 (no more data)
	if total != 5 {
		t.Fatalf("Expected total 5, got %d", total)
	}
}

func TestMetricsDBCleanupNoOldData(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert only recent data
	metrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: time.Now().UTC(),
	}
	if err := metricsDB.Insert(metrics); err != nil {
		t.Fatalf("Failed to insert: %v", err)
	}

	// Cleanup should delete 0 rows
	deleted, err := metricsDB.CleanupOldMetrics()
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}

	if deleted != 0 {
		t.Fatalf("Expected 0 deleted, got %d", deleted)
	}
}

func TestMetricsDBRebuildAfterClose(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}

	// Insert data
	metrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: time.Now().UTC(),
	}
	if err := metricsDB.Insert(metrics); err != nil {
		t.Fatalf("Failed to insert: %v", err)
	}

	// Close first
	metricsDB.Close()

	// Rebuild after close
	if err := metricsDB.Rebuild(core.DefaultDBConnect); err != nil {
		t.Fatalf("Failed to rebuild after close: %v", err)
	}
	defer metricsDB.Close()

	// Should be able to use DB again
	latest, err := metricsDB.GetLatest()
	if err != nil {
		t.Fatalf("Failed to query after rebuild: %v", err)
	}
	// Data should be cleared
	if latest != nil {
		t.Fatal("Expected nil after rebuild")
	}
}

func TestMetricsDBRebuildWithExistingConnection(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert data
	for i := 0; i < 5; i++ {
		metrics := &core.SystemMetrics{
			Id:        security.RandomString(15),
			Timestamp: time.Now().UTC(),
		}
		if err := metricsDB.Insert(metrics); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// Rebuild without closing (tests the branch where db != nil)
	if err := metricsDB.Rebuild(core.DefaultDBConnect); err != nil {
		t.Fatalf("Failed to rebuild: %v", err)
	}

	// Should be empty
	items, _, err := metricsDB.GetByTimeRange(24, 100)
	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("Expected 0 items after rebuild, got %d", len(items))
	}
}
