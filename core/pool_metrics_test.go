package core

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// TestConvertPoolStats 测试连接池统计转换
func TestConvertPoolStats(t *testing.T) {
	stats := dbutils.PoolStats{
		OpenConnections:   10,
		InUse:             5,
		Idle:              5,
		WaitCount:         10,
		WaitDuration:      500 * time.Millisecond,
		MaxIdleClosed:     2,
		MaxLifetimeClosed: 1,
		MaxIdleTimeClosed: 3,
	}

	metrics := convertPoolStats(stats)

	if metrics.OpenConnections != 10 {
		t.Errorf("OpenConnections: 期望 10, 实际 %d", metrics.OpenConnections)
	}

	if metrics.InUse != 5 {
		t.Errorf("InUse: 期望 5, 实际 %d", metrics.InUse)
	}

	if metrics.Idle != 5 {
		t.Errorf("Idle: 期望 5, 实际 %d", metrics.Idle)
	}

	if metrics.WaitDurationMs != 500 {
		t.Errorf("WaitDurationMs: 期望 500, 实际 %d", metrics.WaitDurationMs)
	}

	// 使用率应该是 50%
	if metrics.UsagePercent != 50 {
		t.Errorf("UsagePercent: 期望 50, 实际 %.2f", metrics.UsagePercent)
	}

	// 健康状态应该是 healthy
	if metrics.Health != "healthy" {
		t.Errorf("Health: 期望 'healthy', 实际 '%s'", metrics.Health)
	}
}

// TestEvaluatePoolHealth 测试连接池健康评估
func TestEvaluatePoolHealth(t *testing.T) {
	testCases := []struct {
		name     string
		stats    *PoolStatsMetrics
		expected string
	}{
		{
			name: "健康状态",
			stats: &PoolStatsMetrics{
				OpenConnections: 10,
				InUse:           5,
				UsagePercent:    50,
				WaitDurationMs:  100,
				WaitCount:       5,
			},
			expected: "healthy",
		},
		{
			name: "高使用率警告",
			stats: &PoolStatsMetrics{
				OpenConnections: 10,
				InUse:           9,
				UsagePercent:    95,
				WaitDurationMs:  100,
				WaitCount:       5,
			},
			expected: "warning",
		},
		{
			name: "长等待时间警告",
			stats: &PoolStatsMetrics{
				OpenConnections: 10,
				InUse:           5,
				UsagePercent:    50,
				WaitDurationMs:  2000,
				WaitCount:       5,
			},
			expected: "warning",
		},
		{
			name: "大量等待请求警告",
			stats: &PoolStatsMetrics{
				OpenConnections: 10,
				InUse:           5,
				UsagePercent:    50,
				WaitDurationMs:  100,
				WaitCount:       200,
			},
			expected: "warning",
		},
		{
			name: "无连接状态未知",
			stats: &PoolStatsMetrics{
				OpenConnections: 0,
				InUse:           0,
				UsagePercent:    0,
				WaitDurationMs:  0,
				WaitCount:       0,
			},
			expected: "unknown",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := evaluatePoolHealth(tc.stats)
			if result != tc.expected {
				t.Errorf("期望 '%s', 实际 '%s'", tc.expected, result)
			}
		})
	}
}

// TestPoolMetricsHistory 测试连接池指标历史记录
func TestPoolMetricsHistory(t *testing.T) {
	history := NewPoolMetricsHistory(5)

	// 测试添加快照
	t.Run("添加快照", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			metrics := &PoolMetrics{
				CollectedAt: time.Now(),
				Data: &PoolStatsMetrics{
					OpenConnections: i + 1,
				},
			}
			history.Add(metrics)
		}

		if history.Len() != 3 {
			t.Errorf("期望 3 个快照, 实际 %d 个", history.Len())
		}
	})

	// 测试超过最大数量
	t.Run("超过最大数量", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			metrics := &PoolMetrics{
				CollectedAt: time.Now(),
				Data: &PoolStatsMetrics{
					OpenConnections: i + 10,
				},
			}
			history.Add(metrics)
		}

		// 应该只保留最新的 5 个
		if history.Len() != 5 {
			t.Errorf("期望 5 个快照, 实际 %d 个", history.Len())
		}

		// 最旧的应该是 OpenConnections=10 的那个
		all := history.GetAll()
		if all[0].Data.OpenConnections != 10 {
			t.Errorf("最旧快照 OpenConnections: 期望 10, 实际 %d", all[0].Data.OpenConnections)
		}
	})

	// 测试获取最新的 n 个
	t.Run("获取最新的 n 个", func(t *testing.T) {
		latest := history.GetLatest(3)
		if len(latest) != 3 {
			t.Errorf("期望 3 个快照, 实际 %d 个", len(latest))
		}

		// 最后一个应该是最新的
		if latest[2].Data.OpenConnections != 14 {
			t.Errorf("最新快照 OpenConnections: 期望 14, 实际 %d", latest[2].Data.OpenConnections)
		}
	})

	// 测试清除
	t.Run("清除历史", func(t *testing.T) {
		history.Clear()
		if history.Len() != 0 {
			t.Errorf("清除后期望 0 个快照, 实际 %d 个", history.Len())
		}
	})
}

// TestPoolMetricsHistoryDefaults 测试默认值
func TestPoolMetricsHistoryDefaults(t *testing.T) {
	// 测试无效的 maxSnapshots
	history := NewPoolMetricsHistory(0)
	if history.maxSnapshots != 60 {
		t.Errorf("默认 maxSnapshots 应该是 60, 实际 %d", history.maxSnapshots)
	}

	history = NewPoolMetricsHistory(-1)
	if history.maxSnapshots != 60 {
		t.Errorf("负数 maxSnapshots 应该默认为 60, 实际 %d", history.maxSnapshots)
	}
}

// TestPoolStatsMetricsJSON 测试 JSON 序列化
func TestPoolStatsMetricsJSON(t *testing.T) {
	metrics := &PoolStatsMetrics{
		OpenConnections:   10,
		InUse:             5,
		Idle:              5,
		WaitCount:         10,
		WaitDurationMs:    500,
		MaxIdleClosed:     2,
		MaxLifetimeClosed: 1,
		MaxIdleTimeClosed: 3,
		UsagePercent:      50,
		Health:            "healthy",
	}

	// 验证所有字段都有正确的 JSON 标签
	if metrics.OpenConnections != 10 {
		t.Error("OpenConnections 字段验证失败")
	}
	if metrics.Health != "healthy" {
		t.Error("Health 字段验证失败")
	}
}
