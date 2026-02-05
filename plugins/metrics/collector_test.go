package metrics_test

import (
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/metrics"
	"github.com/pocketbase/pocketbase/tests"
)

// ============================================================================
// MetricsCollector Tests
// ============================================================================

func TestNewMetricsCollector(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		collector := metrics.NewMetricsCollector(app, repo, config)

		if collector == nil {
			t.Fatal("Expected non-nil MetricsCollector")
		}

		if collector.GetLatencyBuffer() == nil {
			t.Fatal("Expected non-nil LatencyBuffer")
		}
	})
}

func TestMetricsCollectorRecordLatency(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		collector := metrics.NewMetricsCollector(app, repo, config)

		// Record some latencies
		collector.RecordLatency(10.5)
		collector.RecordLatency(20.3)
		collector.RecordLatency(15.7)

		// Check via buffer
		p95 := collector.GetLatencyBuffer().P95()
		if p95 <= 0 {
			t.Fatalf("Expected positive P95 after recording latencies, got %v", p95)
		}
	})
}

func TestMetricsCollectorRecordError(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		collector := metrics.NewMetricsCollector(app, repo, config)

		// Record various status codes - only 5xx should be counted
		collector.RecordError(200) // Should not count
		collector.RecordError(400) // Should not count
		collector.RecordError(404) // Should not count
		collector.RecordError(500) // Should count
		collector.RecordError(502) // Should count
		collector.RecordError(503) // Should count
		collector.RecordError(599) // Should count
		collector.RecordError(600) // Should not count

		// We can't directly check the count without collecting metrics,
		// but we verify no panic occurs
	})
}

func TestMetricsCollectorStartStop(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		config.CollectionInterval = 100 * time.Millisecond // 快速测试
		collector := metrics.NewMetricsCollector(app, repo, config)

		// Start collector
		collector.Start()

		if !collector.IsRunning() {
			t.Fatal("Expected collector to be running after Start")
		}

		// Double start should be safe (idempotent)
		collector.Start()

		// Give it a moment to run
		time.Sleep(50 * time.Millisecond)

		// Stop collector
		collector.Stop()

		if collector.IsRunning() {
			t.Fatal("Expected collector to not be running after Stop")
		}

		// Double stop should be safe (idempotent)
		collector.Stop()
	})
}

func TestMetricsCollectorStartStopConcurrent(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		config.CollectionInterval = 100 * time.Millisecond
		collector := metrics.NewMetricsCollector(app, repo, config)

		// Test multiple start/stop cycles sequentially
		for i := 0; i < 5; i++ {
			collector.Start()
			time.Sleep(10 * time.Millisecond)
			collector.Stop()
		}

		// Test concurrent starts (only one should actually start)
		var wg sync.WaitGroup
		for i := 0; i < 5; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				collector.Start()
			}()
		}
		wg.Wait()

		// Clean up
		collector.Stop()
	})
}

func TestMetricsCollectorRecordLatencyConcurrent(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		collector := metrics.NewMetricsCollector(app, repo, config)

		var wg sync.WaitGroup

		// Concurrent latency recording
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func(val float64) {
				defer wg.Done()
				collector.RecordLatency(val)
			}(float64(i))
		}

		wg.Wait()

		// Should have recorded values without panic
		p95 := collector.GetLatencyBuffer().P95()
		if p95 < 0 {
			t.Fatalf("P95 should be non-negative, got %v", p95)
		}
	})
}

func TestMetricsCollectorRecordErrorConcurrent(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		collector := metrics.NewMetricsCollector(app, repo, config)

		var wg sync.WaitGroup

		// Concurrent error recording
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func(code int) {
				defer wg.Done()
				collector.RecordError(code)
			}(500 + (i % 100))
		}

		wg.Wait()
		// Should complete without panic
	})
}

func TestMetricsCollectorCollectionLoopWithCleanup(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		config.CollectionInterval = 50 * time.Millisecond // 快速测试
		collector := metrics.NewMetricsCollector(app, repo, config)

		// 启动采集器
		collector.Start()

		// 等待初始采集完成
		time.Sleep(150 * time.Millisecond)

		// 停止采集器
		collector.Stop()

		// 验证数据已被采集
		latest, err := repo.GetLatest()
		if err != nil {
			t.Fatalf("Failed to get latest: %v", err)
		}
		if latest == nil {
			t.Fatal("Expected metrics to be collected")
		}
	})
}

func TestMetricsCollectorStopBeforeStart(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		config.CollectionInterval = 100 * time.Millisecond
		collector := metrics.NewMetricsCollector(app, repo, config)

		// Stop without Start should be safe
		collector.Stop()

		// Should be able to start after
		collector.Start()
		time.Sleep(50 * time.Millisecond)
		collector.Stop()
	})
}

// TestMetricsCollectorUsesAuxDB 验证 Collector 使用 AuxDB 而非独立 DB
func TestMetricsCollectorUsesAuxDB(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repo := metrics.NewMetricsRepository(app)
		config := metrics.DefaultConfig()
		config.CollectionInterval = 50 * time.Millisecond
		collector := metrics.NewMetricsCollector(app, repo, config)

		collector.Start()
		time.Sleep(100 * time.Millisecond)
		collector.Stop()

		// 通过 AuxModelQuery 验证数据存储在 AuxDB 中
		var metricsData []metrics.SystemMetrics
		err := app.AuxModelQuery(&metrics.SystemMetrics{}).All(&metricsData)
		if err != nil {
			t.Fatalf("Failed to query from AuxDB: %v", err)
		}

		if len(metricsData) == 0 {
			t.Fatal("Expected metrics to be stored in AuxDB")
		}
	})
}
