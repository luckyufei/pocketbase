package metrics

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestNewCollector 测试创建收集器
func TestNewCollector(t *testing.T) {
	collector := NewCollector()
	if collector == nil {
		t.Fatal("期望创建收集器成功")
	}

	stats := collector.GetStats()
	if stats.TotalRequests != 0 {
		t.Errorf("期望初始总请求数为 0，实际为 %d", stats.TotalRequests)
	}
}

// TestRecordRequestSuccess 测试记录成功请求
func TestRecordRequestSuccess(t *testing.T) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     100 * time.Millisecond,
		Result:       ResultSuccess,
		Timestamp:    time.Now(),
		MemoryUsed:   1024,
		ColdStart:    false,
	}

	collector.RecordRequest(metric)

	stats := collector.GetStats()
	if stats.TotalRequests != 1 {
		t.Errorf("期望总请求数为 1，实际为 %d", stats.TotalRequests)
	}
	if stats.SuccessRequests != 1 {
		t.Errorf("期望成功请求数为 1，实际为 %d", stats.SuccessRequests)
	}
	if stats.ErrorRequests != 0 {
		t.Errorf("期望错误请求数为 0，实际为 %d", stats.ErrorRequests)
	}
}

// TestRecordRequestError 测试记录错误请求
func TestRecordRequestError(t *testing.T) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     50 * time.Millisecond,
		Result:       ResultError,
		Timestamp:    time.Now(),
	}

	collector.RecordRequest(metric)

	stats := collector.GetStats()
	if stats.ErrorRequests != 1 {
		t.Errorf("期望错误请求数为 1，实际为 %d", stats.ErrorRequests)
	}
}

// TestRecordRequestTimeout 测试记录超时请求
func TestRecordRequestTimeout(t *testing.T) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "wasm",
		Duration:     5 * time.Second,
		Result:       ResultTimeout,
		Timestamp:    time.Now(),
	}

	collector.RecordRequest(metric)

	stats := collector.GetStats()
	if stats.TimeoutRequests != 1 {
		t.Errorf("期望超时请求数为 1，实际为 %d", stats.TimeoutRequests)
	}
}

// TestRecordRequestRejected 测试记录被拒绝请求
func TestRecordRequestRejected(t *testing.T) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     0,
		Result:       ResultRejected,
		Timestamp:    time.Now(),
	}

	collector.RecordRequest(metric)

	stats := collector.GetStats()
	if stats.RejectedRequests != 1 {
		t.Errorf("期望被拒绝请求数为 1，实际为 %d", stats.RejectedRequests)
	}
}

// TestRecordRequestColdStart 测试记录冷启动
func TestRecordRequestColdStart(t *testing.T) {
	collector := NewCollector()

	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     200 * time.Millisecond,
		Result:       ResultSuccess,
		Timestamp:    time.Now(),
		ColdStart:    true,
	}

	collector.RecordRequest(metric)

	stats := collector.GetStats()
	if stats.ColdStarts != 1 {
		t.Errorf("期望冷启动次数为 1，实际为 %d", stats.ColdStarts)
	}
}

// TestLatencyHistogram 测试延迟直方图
func TestLatencyHistogram(t *testing.T) {
	collector := NewCollector()

	// 记录不同延迟的请求
	latencies := []time.Duration{
		1 * time.Millisecond,
		10 * time.Millisecond,
		50 * time.Millisecond,
		100 * time.Millisecond,
		500 * time.Millisecond,
		1 * time.Second,
	}

	for _, latency := range latencies {
		metric := RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     latency,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		}
		collector.RecordRequest(metric)
	}

	stats := collector.GetStats()

	// 验证直方图统计
	if stats.LatencyHistogram.Count != int64(len(latencies)) {
		t.Errorf("期望直方图计数为 %d，实际为 %d", len(latencies), stats.LatencyHistogram.Count)
	}

	// 验证最小/最大值
	if stats.LatencyHistogram.Min != 1 {
		t.Errorf("期望最小延迟为 1ms，实际为 %f ms", stats.LatencyHistogram.Min)
	}
	if stats.LatencyHistogram.Max != 1000 {
		t.Errorf("期望最大延迟为 1000ms，实际为 %f ms", stats.LatencyHistogram.Max)
	}
}

// TestLatencyHistogramBuckets 测试延迟直方图桶
func TestLatencyHistogramBuckets(t *testing.T) {
	buckets := DefaultLatencyBuckets()

	if len(buckets) != 12 {
		t.Errorf("期望 12 个桶，实际为 %d", len(buckets))
	}

	// 验证桶边界递增
	for i := 1; i < len(buckets); i++ {
		if buckets[i] <= buckets[i-1] {
			t.Errorf("桶边界应该递增，但 buckets[%d]=%f <= buckets[%d]=%f",
				i, buckets[i], i-1, buckets[i-1])
		}
	}
}

// TestUpdatePoolStats 测试更新池统计
func TestUpdatePoolStats(t *testing.T) {
	collector := NewCollector()

	poolStats := PoolStats{
		Size:            10,
		Available:       7,
		InUse:           3,
		WaitingRequests: 0,
		TotalCreated:    15,
		TotalDestroyed:  5,
	}

	collector.UpdatePoolStats(poolStats)

	stats := collector.GetStats()
	if stats.PoolStats.Size != 10 {
		t.Errorf("期望池大小为 10，实际为 %d", stats.PoolStats.Size)
	}
	if stats.PoolStats.InUse != 3 {
		t.Errorf("期望使用中为 3，实际为 %d", stats.PoolStats.InUse)
	}
}

// TestUpdateMemoryStats 测试更新内存统计
func TestUpdateMemoryStats(t *testing.T) {
	collector := NewCollector()

	memStats := MemoryStats{
		TotalAllocated: 1024 * 1024,
		TotalFreed:     512 * 1024,
		CurrentUsage:   512 * 1024,
		PeakUsage:      768 * 1024,
	}

	collector.UpdateMemoryStats(memStats)

	stats := collector.GetStats()
	if stats.MemoryStats.CurrentUsage != 512*1024 {
		t.Errorf("期望当前内存使用为 %d，实际为 %d", 512*1024, stats.MemoryStats.CurrentUsage)
	}
	if stats.MemoryStats.PeakUsage != 768*1024 {
		t.Errorf("期望峰值内存使用为 %d，实际为 %d", 768*1024, stats.MemoryStats.PeakUsage)
	}
}

// TestByFunctionStats 测试按函数分组统计
func TestByFunctionStats(t *testing.T) {
	collector := NewCollector()

	// 记录不同函数的请求
	functions := []string{"func-a", "func-b", "func-a", "func-c", "func-a"}
	for _, fn := range functions {
		metric := RequestMetric{
			FunctionName: fn,
			Runtime:      "quickjs",
			Duration:     100 * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		}
		collector.RecordRequest(metric)
	}

	stats := collector.GetStats()

	if len(stats.ByFunction) != 3 {
		t.Errorf("期望 3 个函数统计，实际为 %d", len(stats.ByFunction))
	}

	if funcStats, ok := stats.ByFunction["func-a"]; ok {
		if funcStats.TotalRequests != 3 {
			t.Errorf("期望 func-a 请求数为 3，实际为 %d", funcStats.TotalRequests)
		}
	} else {
		t.Error("期望存在 func-a 的统计")
	}
}

// TestByRuntimeStats 测试按运行时分组统计
func TestByRuntimeStats(t *testing.T) {
	collector := NewCollector()

	// 记录不同运行时的请求
	runtimes := []string{"quickjs", "wasm", "quickjs", "wasm", "quickjs"}
	for _, rt := range runtimes {
		metric := RequestMetric{
			FunctionName: "test-func",
			Runtime:      rt,
			Duration:     100 * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
			MemoryUsed:   1024,
		}
		collector.RecordRequest(metric)
	}

	stats := collector.GetStats()

	if len(stats.ByRuntime) != 2 {
		t.Errorf("期望 2 个运行时统计，实际为 %d", len(stats.ByRuntime))
	}

	if rtStats, ok := stats.ByRuntime["quickjs"]; ok {
		if rtStats.TotalRequests != 3 {
			t.Errorf("期望 quickjs 请求数为 3，实际为 %d", rtStats.TotalRequests)
		}
	} else {
		t.Error("期望存在 quickjs 的统计")
	}
}

// TestGetWindowStats 测试滑动窗口统计
func TestGetWindowStats(t *testing.T) {
	collector := NewCollector()

	// 记录一些请求
	for i := 0; i < 10; i++ {
		result := ResultSuccess
		if i%3 == 0 {
			result = ResultError
		}
		metric := RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     time.Duration(50+i*10) * time.Millisecond,
			Result:       result,
			Timestamp:    time.Now(),
		}
		collector.RecordRequest(metric)
	}

	windowStats := collector.GetWindowStats(1 * time.Minute)

	if windowStats.RequestRate <= 0 {
		t.Error("期望请求速率 > 0")
	}

	// 错误率应该约为 40%（4/10）
	if windowStats.ErrorRate < 0.3 || windowStats.ErrorRate > 0.5 {
		t.Errorf("期望错误率约为 0.4，实际为 %f", windowStats.ErrorRate)
	}
}

// TestReset 测试重置
func TestReset(t *testing.T) {
	collector := NewCollector()

	// 记录一些数据
	for i := 0; i < 5; i++ {
		metric := RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     100 * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		}
		collector.RecordRequest(metric)
	}

	// 重置
	collector.Reset()

	stats := collector.GetStats()
	if stats.TotalRequests != 0 {
		t.Errorf("期望重置后总请求数为 0，实际为 %d", stats.TotalRequests)
	}
	if len(stats.ByFunction) != 0 {
		t.Errorf("期望重置后函数统计为空，实际有 %d 个", len(stats.ByFunction))
	}
}

// TestConcurrentRecordRequest 测试并发记录请求
func TestConcurrentRecordRequest(t *testing.T) {
	collector := NewCollector()

	var wg sync.WaitGroup
	numGoroutines := 100
	numRequests := 100

	var totalRecorded int64

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numRequests; j++ {
				metric := RequestMetric{
					FunctionName: "test-func",
					Runtime:      "quickjs",
					Duration:     time.Duration(50+id) * time.Millisecond,
					Result:       ResultSuccess,
					Timestamp:    time.Now(),
				}
				collector.RecordRequest(metric)
				atomic.AddInt64(&totalRecorded, 1)
			}
		}(i)
	}

	wg.Wait()

	stats := collector.GetStats()
	expected := int64(numGoroutines * numRequests)

	if stats.TotalRequests != expected {
		t.Errorf("期望总请求数为 %d，实际为 %d", expected, stats.TotalRequests)
	}
}

// TestConcurrentGetStats 测试并发获取统计
func TestConcurrentGetStats(t *testing.T) {
	collector := NewCollector()

	var wg sync.WaitGroup

	// 启动写入协程
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			metric := RequestMetric{
				FunctionName: "test-func",
				Runtime:      "quickjs",
				Duration:     100 * time.Millisecond,
				Result:       ResultSuccess,
				Timestamp:    time.Now(),
			}
			collector.RecordRequest(metric)
		}
	}()

	// 启动读取协程
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				_ = collector.GetStats()
				_ = collector.GetWindowStats(1 * time.Minute)
			}
		}()
	}

	wg.Wait()
}

// TestFunctionStatsAccuracy 测试函数统计准确性
func TestFunctionStatsAccuracy(t *testing.T) {
	collector := NewCollector()

	// 记录成功和失败请求
	for i := 0; i < 10; i++ {
		result := ResultSuccess
		if i < 3 {
			result = ResultError
		}
		metric := RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     time.Duration(100+i*10) * time.Millisecond,
			Result:       result,
			Timestamp:    time.Now(),
		}
		collector.RecordRequest(metric)
	}

	stats := collector.GetStats()
	funcStats := stats.ByFunction["test-func"]

	if funcStats.TotalRequests != 10 {
		t.Errorf("期望总请求数为 10，实际为 %d", funcStats.TotalRequests)
	}
	if funcStats.SuccessRequests != 7 {
		t.Errorf("期望成功请求数为 7，实际为 %d", funcStats.SuccessRequests)
	}
	if funcStats.ErrorRequests != 3 {
		t.Errorf("期望错误请求数为 3，实际为 %d", funcStats.ErrorRequests)
	}
}

// BenchmarkRecordRequest 基准测试记录请求
func BenchmarkRecordRequest(b *testing.B) {
	collector := NewCollector()
	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     100 * time.Millisecond,
		Result:       ResultSuccess,
		Timestamp:    time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.RecordRequest(metric)
	}
}

// BenchmarkGetStats 基准测试获取统计
func BenchmarkGetStats(b *testing.B) {
	collector := NewCollector()

	// 预先记录一些数据
	for i := 0; i < 1000; i++ {
		metric := RequestMetric{
			FunctionName: "test-func",
			Runtime:      "quickjs",
			Duration:     100 * time.Millisecond,
			Result:       ResultSuccess,
			Timestamp:    time.Now(),
		}
		collector.RecordRequest(metric)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = collector.GetStats()
	}
}

// BenchmarkConcurrentRecordRequest 基准测试并发记录
func BenchmarkConcurrentRecordRequest(b *testing.B) {
	collector := NewCollector()
	metric := RequestMetric{
		FunctionName: "test-func",
		Runtime:      "quickjs",
		Duration:     100 * time.Millisecond,
		Result:       ResultSuccess,
		Timestamp:    time.Now(),
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			collector.RecordRequest(metric)
		}
	})
}

// TestNewMetricsCollector 测试带配置创建收集器
func TestNewMetricsCollector(t *testing.T) {
	config := MetricsConfig{
		WindowSize:        10 * time.Minute,
		MaxRecentRequests: 5000,
		LatencyBuckets:    []float64{0.01, 0.05, 0.1, 0.5, 1.0},
	}

	collector := NewMetricsCollector(config)
	if collector == nil {
		t.Fatal("期望创建收集器成功")
	}

	stats := collector.GetStats()
	if stats.TotalRequests != 0 {
		t.Errorf("期望初始总请求数为 0，实际为 %d", stats.TotalRequests)
	}
}

// TestNewMetricsCollectorDefaultBuckets 测试带空桶配置创建收集器
func TestNewMetricsCollectorDefaultBuckets(t *testing.T) {
	config := MetricsConfig{
		WindowSize:        10 * time.Minute,
		MaxRecentRequests: 5000,
		LatencyBuckets:    nil, // 空桶，应使用默认值
	}

	collector := NewMetricsCollector(config)
	if collector == nil {
		t.Fatal("期望创建收集器成功")
	}
}

// TestNewMetricsCollectorZeroMaxRecent 测试零最大请求数配置
func TestNewMetricsCollectorZeroMaxRecent(t *testing.T) {
	config := MetricsConfig{
		WindowSize:        10 * time.Minute,
		MaxRecentRequests: 0, // 零值，应使用默认值
		LatencyBuckets:    DefaultLatencyBuckets(),
	}

	collector := NewMetricsCollector(config)
	if collector == nil {
		t.Fatal("期望创建收集器成功")
	}
}

// TestDefaultMetricsConfig 测试默认指标配置
func TestDefaultMetricsConfig(t *testing.T) {
	config := DefaultMetricsConfig()

	if config.WindowSize != 5*time.Minute {
		t.Errorf("期望默认窗口大小为 5 分钟，实际为 %v", config.WindowSize)
	}
	if config.MaxRecentRequests != 10000 {
		t.Errorf("期望默认最大请求数为 10000，实际为 %d", config.MaxRecentRequests)
	}
	if len(config.LatencyBuckets) == 0 {
		t.Error("期望默认延迟桶不为空")
	}
}
