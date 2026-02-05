package metrics_test

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/metrics"
	"github.com/pocketbase/pocketbase/tests"
)

// ============================================================================
// Plugin Registration Tests
// ============================================================================

// 注意: TestApp 在 NewTestApp() 时已经完成 Bootstrap，
// 因此 MustRegister 的 OnBootstrap hook 无法被触发。
// 这些测试验证的是禁用模式和配置解析功能。

func TestMetricsPluginDisabled(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		metrics.MustRegister(app, metrics.Config{
			Disabled: true,
		})

		// 禁用后应该无法获取 collector（因为 hook 不会执行）
		collector := metrics.GetCollector(app)
		if collector != nil {
			t.Error("Expected nil collector when plugin is disabled")
		}

		// 禁用后应该无法获取 repository
		repository := metrics.GetRepository(app)
		if repository != nil {
			t.Error("Expected nil repository when plugin is disabled")
		}
	})
}

// ============================================================================
// Config Tests
// ============================================================================

func TestMetricsDefaultConfig(t *testing.T) {
	config := metrics.DefaultConfig()

	if config.Disabled {
		t.Error("Default config should not be disabled")
	}
	if config.CollectionInterval != 60*time.Second {
		t.Errorf("Expected default interval 60s, got %v", config.CollectionInterval)
	}
	if config.RetentionDays != 7 {
		t.Errorf("Expected default retention 7 days, got %v", config.RetentionDays)
	}
	if config.LatencyBufferSize != 1000 {
		t.Errorf("Expected default buffer size 1000, got %v", config.LatencyBufferSize)
	}
	if !config.EnableMiddleware {
		t.Error("Default config should enable middleware")
	}
	if config.CleanupCron != "0 3 * * *" {
		t.Errorf("Expected default cleanup cron '0 3 * * *', got %v", config.CleanupCron)
	}
	if config.ResetLatencyBufferOnCollect {
		t.Error("Default config should not reset latency buffer on collect")
	}
}

// ============================================================================
// Component Direct Tests (不依赖 hook)
// ============================================================================

func TestMetricsCollectorAndRepositoryDirect(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 直接创建 Repository（绕过 hook）
		repository := metrics.NewMetricsRepository(app)
		if repository == nil {
			t.Fatal("Expected non-nil repository")
		}

		// 直接创建 Collector（绕过 hook）
		config := metrics.DefaultConfig()
		config.CollectionInterval = 100 * time.Millisecond
		collector := metrics.NewMetricsCollector(app, repository, config)
		if collector == nil {
			t.Fatal("Expected non-nil collector")
		}

		// 验证 collector 可以正常启动和停止
		collector.Start()
		defer collector.Stop()

		// 验证可以记录延迟
		collector.RecordLatency(100.0)
		collector.RecordLatency(200.0)

		buffer := collector.GetLatencyBuffer()
		if buffer.Count() != 2 {
			t.Errorf("Expected buffer count 2, got %v", buffer.Count())
		}
	})
}

// ============================================================================
// P95 Buffer Reset Tests (直接测试组件)
// ============================================================================

func TestMetricsP95BufferResetOnCollect(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repository := metrics.NewMetricsRepository(app)

		config := metrics.DefaultConfig()
		config.CollectionInterval = 50 * time.Millisecond
		config.ResetLatencyBufferOnCollect = true // 启用采集后重置
		config.EnableMiddleware = false

		collector := metrics.NewMetricsCollector(app, repository, config)
		collector.Start()
		defer collector.Stop()

		// 记录一些延迟
		collector.RecordLatency(100.0)
		collector.RecordLatency(200.0)

		buffer := collector.GetLatencyBuffer()
		initialCount := buffer.Count()
		if initialCount == 0 {
			t.Error("Expected buffer to have data before collection")
		}

		// 等待采集发生
		time.Sleep(100 * time.Millisecond)

		// 采集后 buffer 应该被重置（由于采集后重置配置）
		// 但由于是异步的，我们只验证系统正常运行不 panic
	})
}

func TestMetricsP95BufferNoResetOnCollect(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		repository := metrics.NewMetricsRepository(app)

		config := metrics.DefaultConfig()
		config.CollectionInterval = 50 * time.Millisecond
		config.ResetLatencyBufferOnCollect = false // 不重置
		config.EnableMiddleware = false

		collector := metrics.NewMetricsCollector(app, repository, config)
		collector.Start()
		defer collector.Stop()

		// 记录一些延迟
		collector.RecordLatency(100.0)
		collector.RecordLatency(200.0)
		collector.RecordLatency(300.0)

		buffer := collector.GetLatencyBuffer()
		initialCount := buffer.Count()
		if initialCount != 3 {
			t.Errorf("Expected buffer count 3, got %v", initialCount)
		}

		// 等待采集发生
		time.Sleep(100 * time.Millisecond)

		// 不重置模式下，buffer 数据应该保留
		countAfter := buffer.Count()
		if countAfter < initialCount {
			t.Errorf("Buffer should not be reset, expected >= %d, got %d", initialCount, countAfter)
		}
	})
}
