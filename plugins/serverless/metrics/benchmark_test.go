package metrics

import (
	"testing"
	"time"
)

// BenchmarkMetricsRecordRequest 测试指标记录性能开销
func BenchmarkMetricsRecordRequest(b *testing.B) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     100 * time.Millisecond,
		Result:       ResultSuccess,
		Timestamp:    time.Now(),
		MemoryUsed:   1024 * 1024,
		ColdStart:    false,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		collector.RecordRequest(metric)
	}
}

// BenchmarkMetricsRecordRequestParallel 测试并发指标记录性能
func BenchmarkMetricsRecordRequestParallel(b *testing.B) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     100 * time.Millisecond,
		Result:       ResultSuccess,
		Timestamp:    time.Now(),
		MemoryUsed:   1024 * 1024,
		ColdStart:    false,
	}

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			collector.RecordRequest(metric)
		}
	})
}

// BenchmarkMetricsGetStats 测试获取统计性能
func BenchmarkMetricsGetStats(b *testing.B) {
	collector := NewCollector()

	// 预先填充一些数据
	for i := 0; i < 10000; i++ {
		collector.RecordRequest(RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     time.Duration(i) * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		})
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = collector.GetStats()
	}
}

// BenchmarkMetricsGetWindowStats 测试获取窗口统计性能
func BenchmarkMetricsGetWindowStats(b *testing.B) {
	collector := NewCollector()

	// 预先填充一些数据
	for i := 0; i < 10000; i++ {
		collector.RecordRequest(RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     time.Duration(i) * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		})
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = collector.GetWindowStats(5 * time.Minute)
	}
}

// BenchmarkMetricsUpdatePoolStats 测试更新池统计性能
func BenchmarkMetricsUpdatePoolStats(b *testing.B) {
	collector := NewCollector()

	stats := PoolStats{
		Size:            10,
		Available:       5,
		InUse:           5,
		WaitingRequests: 2,
		TotalCreated:    100,
		TotalDestroyed:  90,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		collector.UpdatePoolStats(stats)
	}
}

// BenchmarkMetricsMultipleFunctions 测试多函数场景性能
func BenchmarkMetricsMultipleFunctions(b *testing.B) {
	collector := NewCollector()
	functions := []string{"func-a", "func-b", "func-c", "func-d", "func-e"}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		collector.RecordRequest(RequestMetric{
			FunctionName: functions[i%len(functions)],
			Runtime:      "quickjs",
			Duration:     100 * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		})
	}
}
