package core_test

import (
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// ============================================================================
// LatencyBuffer Tests
// ============================================================================

func TestNewLatencyBuffer(t *testing.T) {
	t.Parallel()

	buf := core.NewLatencyBuffer(100)
	if buf == nil {
		t.Fatal("Expected non-nil LatencyBuffer")
	}

	// P95 of empty buffer should be 0
	if p95 := buf.P95(); p95 != 0 {
		t.Fatalf("Expected P95 of empty buffer to be 0, got %v", p95)
	}
}

func TestLatencyBufferAdd(t *testing.T) {
	t.Parallel()

	buf := core.NewLatencyBuffer(10)

	// Add single value
	buf.Add(100.0)
	if p95 := buf.P95(); p95 != 100.0 {
		t.Fatalf("Expected P95 to be 100.0, got %v", p95)
	}

	// Add more values
	for i := 1; i <= 9; i++ {
		buf.Add(float64(i * 10))
	}

	// With values 10, 20, 30, ..., 100, P95 should be 100
	p95 := buf.P95()
	if p95 != 100.0 {
		t.Fatalf("Expected P95 to be 100.0, got %v", p95)
	}
}

func TestLatencyBufferP95Calculation(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		values   []float64
		expected float64
	}{
		{
			name:     "single value",
			values:   []float64{50.0},
			expected: 50.0,
		},
		{
			name:     "two values",
			values:   []float64{10.0, 20.0},
			expected: 20.0,
		},
		{
			name:     "100 sequential values",
			values:   makeSequence(1, 100),
			expected: 95.0,
		},
		{
			name:     "20 values",
			values:   makeSequence(1, 20),
			expected: 19.0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			buf := core.NewLatencyBuffer(len(tc.values))
			for _, v := range tc.values {
				buf.Add(v)
			}

			p95 := buf.P95()
			if p95 != tc.expected {
				t.Fatalf("Expected P95 to be %v, got %v", tc.expected, p95)
			}
		})
	}
}

func TestLatencyBufferRingBehavior(t *testing.T) {
	t.Parallel()

	// Buffer size 5, add 10 values
	buf := core.NewLatencyBuffer(5)

	// Add 1-10, buffer should only contain 6-10
	for i := 1; i <= 10; i++ {
		buf.Add(float64(i))
	}

	// P95 of [6,7,8,9,10] should be 10
	p95 := buf.P95()
	if p95 != 10.0 {
		t.Fatalf("Expected P95 to be 10.0 after ring wrap, got %v", p95)
	}
}

func TestLatencyBufferReset(t *testing.T) {
	t.Parallel()

	buf := core.NewLatencyBuffer(10)
	buf.Add(100.0)
	buf.Add(200.0)

	buf.Reset()

	if p95 := buf.P95(); p95 != 0 {
		t.Fatalf("Expected P95 after reset to be 0, got %v", p95)
	}
}

func TestLatencyBufferConcurrency(t *testing.T) {
	t.Parallel()

	buf := core.NewLatencyBuffer(1000)
	var wg sync.WaitGroup

	// Concurrent writes
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(base int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				buf.Add(float64(base*100 + j))
			}
		}(i)
	}

	// Concurrent reads
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				_ = buf.P95()
			}
		}()
	}

	wg.Wait()

	// Should not panic and P95 should be reasonable
	p95 := buf.P95()
	if p95 < 0 || p95 > 1000 {
		t.Fatalf("P95 out of expected range: %v", p95)
	}
}

// ============================================================================
// MetricsCollector Tests (使用 MetricsRepository)
// ============================================================================

func TestNewMetricsCollector(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		collector := core.NewMetricsCollector(app)
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
		collector := core.NewMetricsCollector(app)

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
		collector := core.NewMetricsCollector(app)

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
		collector := core.NewMetricsCollector(app)

		// Start collector
		collector.Start()

		// Double start should be safe (idempotent)
		collector.Start()

		// Give it a moment to run
		time.Sleep(50 * time.Millisecond)

		// Stop collector
		collector.Stop()

		// Double stop should be safe (idempotent)
		collector.Stop()
	})
}

func TestMetricsCollectorStartStopConcurrent(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		collector := core.NewMetricsCollector(app)

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
		collector := core.NewMetricsCollector(app)

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
		collector := core.NewMetricsCollector(app)

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

// ============================================================================
// P95 Edge Cases Tests
// ============================================================================

func TestLatencyBufferP95EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试 p95Index 边界情况
	testCases := []struct {
		name     string
		size     int
		values   []float64
		expected float64
	}{
		{
			name:     "very small buffer - 1 element",
			size:     1,
			values:   []float64{42.0},
			expected: 42.0,
		},
		{
			name:     "buffer size 2 with 2 values",
			size:     2,
			values:   []float64{10.0, 20.0},
			expected: 20.0,
		},
		{
			name:     "buffer size 3 with 3 values",
			size:     3,
			values:   []float64{10.0, 20.0, 30.0},
			expected: 30.0,
		},
		{
			name:     "large buffer partially filled",
			size:     100,
			values:   []float64{5.0, 10.0, 15.0},
			expected: 15.0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			buf := core.NewLatencyBuffer(tc.size)
			for _, v := range tc.values {
				buf.Add(v)
			}

			p95 := buf.P95()
			if p95 != tc.expected {
				t.Fatalf("Expected P95 to be %v, got %v", tc.expected, p95)
			}
		})
	}
}

// ============================================================================
// MetricsCollector CollectionLoop Tests
// ============================================================================

func TestMetricsCollectorCollectionLoopWithCleanup(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		collector := core.NewMetricsCollector(app)

		// 启动采集器
		collector.Start()

		// 等待初始采集完成
		time.Sleep(150 * time.Millisecond)

		// 停止采集器（触发 cleanup 分支）
		collector.Stop()

		// 验证数据已被采集（通过 MetricsRepository）
		repo := core.NewMetricsRepository(app)
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
		collector := core.NewMetricsCollector(app)

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
		collector := core.NewMetricsCollector(app)
		collector.Start()
		time.Sleep(100 * time.Millisecond)
		collector.Stop()

		// 通过 AuxModelQuery 验证数据存储在 AuxDB 中
		var metrics []core.SystemMetrics
		err := app.AuxModelQuery(&core.SystemMetrics{}).All(&metrics)
		if err != nil {
			t.Fatalf("Failed to query from AuxDB: %v", err)
		}

		if len(metrics) == 0 {
			t.Fatal("Expected metrics to be stored in AuxDB")
		}
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

func makeSequence(start, end int) []float64 {
	result := make([]float64, end-start+1)
	for i := start; i <= end; i++ {
		result[i-start] = float64(i)
	}
	return result
}
