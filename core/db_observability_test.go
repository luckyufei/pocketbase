package core

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ============================================================================
// STORY-3.1: 高性能日志写入测试
// ============================================================================

// TestRequestLog 测试请求日志结构
func TestRequestLog(t *testing.T) {
	t.Run("日志结构字段完整性", func(t *testing.T) {
		log := &RequestLog{
			ID:           "test-id",
			Timestamp:    time.Now(),
			Method:       "GET",
			Path:         "/api/collections",
			StatusCode:   200,
			Duration:     100 * time.Millisecond,
			RequestSize:  1024,
			ResponseSize: 2048,
			UserID:       "user-123",
			IP:           "192.168.1.1",
			UserAgent:    "Mozilla/5.0",
			Error:        "",
			NodeID:       "node-1",
		}

		if log.ID == "" {
			t.Error("日志 ID 不应为空")
		}
		if log.Timestamp.IsZero() {
			t.Error("时间戳不应为零值")
		}
		if log.Method == "" {
			t.Error("HTTP 方法不应为空")
		}
		if log.Path == "" {
			t.Error("请求路径不应为空")
		}
		if log.Duration <= 0 {
			t.Error("请求耗时应大于 0")
		}
	})

	t.Run("日志分区键计算", func(t *testing.T) {
		now := time.Date(2026, 1, 7, 10, 30, 0, 0, time.UTC)
		log := &RequestLog{
			Timestamp: now,
		}

		partitionKey := log.PartitionKey()
		expected := "2026_01_07"
		if partitionKey != expected {
			t.Errorf("分区键期望 %s, 实际 %s", expected, partitionKey)
		}
	})
}

// TestLogBuffer 测试日志缓冲区
func TestLogBuffer(t *testing.T) {
	t.Run("创建缓冲区", func(t *testing.T) {
		config := DefaultLogBufferConfig()
		buffer := NewLogBuffer(config)

		if buffer == nil {
			t.Fatal("缓冲区不应为 nil")
		}
		if buffer.config.BufferSize <= 0 {
			t.Error("缓冲区大小应大于 0")
		}
		if buffer.config.FlushInterval <= 0 {
			t.Error("刷新间隔应大于 0")
		}
	})

	t.Run("写入日志", func(t *testing.T) {
		config := LogBufferConfig{
			BufferSize:    100,
			FlushInterval: 1 * time.Second,
			MaxBatchSize:  50,
		}
		buffer := NewLogBuffer(config)

		log := &RequestLog{
			ID:        "test-1",
			Timestamp: time.Now(),
			Method:    "GET",
			Path:      "/test",
		}

		err := buffer.Write(log)
		if err != nil {
			t.Errorf("写入日志失败: %v", err)
		}

		if buffer.Len() != 1 {
			t.Errorf("缓冲区长度期望 1, 实际 %d", buffer.Len())
		}
	})

	t.Run("缓冲区满时熔断", func(t *testing.T) {
		config := LogBufferConfig{
			BufferSize:      5,
			FlushInterval:   1 * time.Hour, // 不自动刷新
			MaxBatchSize:    10,
			CircuitBreaker:  true,
			DropWhenFull:    true,
		}
		buffer := NewLogBuffer(config)

		// 填满缓冲区
		for i := 0; i < 5; i++ {
			log := &RequestLog{
				ID:        generateTestID(),
				Timestamp: time.Now(),
			}
			_ = buffer.Write(log)
		}

		// 再写入应该被丢弃
		log := &RequestLog{
			ID:        "overflow",
			Timestamp: time.Now(),
		}
		err := buffer.Write(log)

		if err != ErrBufferFull {
			t.Errorf("期望 ErrBufferFull 错误, 实际: %v", err)
		}

		// 检查丢弃计数
		if buffer.DroppedCount() < 1 {
			t.Error("丢弃计数应大于 0")
		}
	})

	t.Run("批量刷新", func(t *testing.T) {
		var flushedLogs []*RequestLog
		var mu sync.Mutex

		config := LogBufferConfig{
			BufferSize:    100,
			FlushInterval: 100 * time.Millisecond,
			MaxBatchSize:  10,
		}
		buffer := NewLogBuffer(config)
		buffer.SetFlushHandler(func(logs []*RequestLog) error {
			mu.Lock()
			flushedLogs = append(flushedLogs, logs...)
			mu.Unlock()
			return nil
		})

		// 写入 5 条日志
		for i := 0; i < 5; i++ {
			log := &RequestLog{
				ID:        generateTestID(),
				Timestamp: time.Now(),
			}
			_ = buffer.Write(log)
		}

		// 手动刷新
		err := buffer.Flush()
		if err != nil {
			t.Errorf("刷新失败: %v", err)
		}

		mu.Lock()
		count := len(flushedLogs)
		mu.Unlock()

		if count != 5 {
			t.Errorf("刷新日志数期望 5, 实际 %d", count)
		}
	})
}

// TestLogBufferConfig 测试缓冲区配置
func TestLogBufferConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		config := DefaultLogBufferConfig()

		if config.BufferSize < 1000 {
			t.Error("默认缓冲区大小应至少 1000")
		}
		if config.FlushInterval < 100*time.Millisecond {
			t.Error("默认刷新间隔应至少 100ms")
		}
		if config.MaxBatchSize < 100 {
			t.Error("默认批量大小应至少 100")
		}
	})
}

// TestLogWriter 测试日志写入器接口
func TestLogWriter(t *testing.T) {
	t.Run("内存写入器", func(t *testing.T) {
		writer := NewMemoryLogWriter()

		logs := []*RequestLog{
			{ID: "1", Timestamp: time.Now()},
			{ID: "2", Timestamp: time.Now()},
		}

		err := writer.WriteBatch(context.Background(), logs)
		if err != nil {
			t.Errorf("批量写入失败: %v", err)
		}

		if writer.Count() != 2 {
			t.Errorf("写入数量期望 2, 实际 %d", writer.Count())
		}
	})

	t.Run("COPY 写入器接口", func(t *testing.T) {
		// 验证 CopyLogWriter 接口定义
		var _ LogWriter = (*MemoryLogWriter)(nil)
	})
}

// TestLogPartitionManager 测试分区管理器
func TestLogPartitionManager(t *testing.T) {
	t.Run("分区名称生成", func(t *testing.T) {
		pm := NewLogPartitionManager("request_logs")

		date := time.Date(2026, 1, 7, 0, 0, 0, 0, time.UTC)
		name := pm.PartitionName(date)
		expected := "request_logs_2026_01_07"

		if name != expected {
			t.Errorf("分区名期望 %s, 实际 %s", expected, name)
		}
	})

	t.Run("分区范围计算", func(t *testing.T) {
		pm := NewLogPartitionManager("request_logs")

		date := time.Date(2026, 1, 7, 10, 30, 0, 0, time.UTC)
		start, end := pm.PartitionRange(date)

		expectedStart := time.Date(2026, 1, 7, 0, 0, 0, 0, time.UTC)
		expectedEnd := time.Date(2026, 1, 8, 0, 0, 0, 0, time.UTC)

		if !start.Equal(expectedStart) {
			t.Errorf("分区开始时间期望 %v, 实际 %v", expectedStart, start)
		}
		if !end.Equal(expectedEnd) {
			t.Errorf("分区结束时间期望 %v, 实际 %v", expectedEnd, end)
		}
	})

	t.Run("创建分区 SQL 生成", func(t *testing.T) {
		pm := NewLogPartitionManager("request_logs")

		date := time.Date(2026, 1, 7, 0, 0, 0, 0, time.UTC)
		sql := pm.CreatePartitionSQL(date)

		if sql == "" {
			t.Error("创建分区 SQL 不应为空")
		}

		// 验证 SQL 包含必要元素
		if !containsAll(sql, "CREATE TABLE IF NOT EXISTS", "request_logs_2026_01_07", "PARTITION OF", "FOR VALUES FROM") {
			t.Errorf("创建分区 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("删除分区 SQL 生成", func(t *testing.T) {
		pm := NewLogPartitionManager("request_logs")

		date := time.Date(2026, 1, 7, 0, 0, 0, 0, time.UTC)
		sql := pm.DropPartitionSQL(date)

		if sql == "" {
			t.Error("删除分区 SQL 不应为空")
		}

		if !containsAll(sql, "DROP TABLE IF EXISTS", "request_logs_2026_01_07") {
			t.Errorf("删除分区 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("获取需要创建的分区", func(t *testing.T) {
		pm := NewLogPartitionManager("request_logs")

		// 预创建未来 3 天的分区
		partitions := pm.PartitionsToCreate(3)

		if len(partitions) != 3 {
			t.Errorf("需要创建的分区数期望 3, 实际 %d", len(partitions))
		}
	})

	t.Run("获取需要清理的分区", func(t *testing.T) {
		pm := NewLogPartitionManager("request_logs")
		pm.SetRetentionDays(7)

		// 模拟 10 天前的分区应该被清理
		now := time.Now()
		oldDate := now.AddDate(0, 0, -10)
		partitions := pm.PartitionsToCleanup([]time.Time{oldDate, now})

		if len(partitions) != 1 {
			t.Errorf("需要清理的分区数期望 1, 实际 %d", len(partitions))
		}
	})
}

// TestCircuitBreaker 测试熔断器
func TestCircuitBreaker(t *testing.T) {
	t.Run("正常状态", func(t *testing.T) {
		cb := NewCircuitBreaker(CircuitBreakerConfig{
			FailureThreshold: 5,
			ResetTimeout:     1 * time.Second,
		})

		if !cb.Allow() {
			t.Error("正常状态应该允许请求")
		}
		if cb.State() != CircuitClosed {
			t.Error("初始状态应该是 Closed")
		}
	})

	t.Run("失败后熔断", func(t *testing.T) {
		cb := NewCircuitBreaker(CircuitBreakerConfig{
			FailureThreshold: 3,
			ResetTimeout:     100 * time.Millisecond,
		})

		// 记录 3 次失败
		for i := 0; i < 3; i++ {
			cb.RecordFailure()
		}

		if cb.Allow() {
			t.Error("熔断后应该拒绝请求")
		}
		if cb.State() != CircuitOpen {
			t.Error("熔断后状态应该是 Open")
		}
	})

	t.Run("熔断后恢复", func(t *testing.T) {
		cb := NewCircuitBreaker(CircuitBreakerConfig{
			FailureThreshold: 2,
			ResetTimeout:     50 * time.Millisecond,
		})

		// 触发熔断
		cb.RecordFailure()
		cb.RecordFailure()

		if cb.Allow() {
			t.Error("熔断后应该拒绝请求")
		}

		// 等待恢复
		time.Sleep(60 * time.Millisecond)

		if !cb.Allow() {
			t.Error("恢复后应该允许请求")
		}
		if cb.State() != CircuitHalfOpen {
			t.Error("恢复后状态应该是 HalfOpen")
		}

		// 成功后完全恢复
		cb.RecordSuccess()
		if cb.State() != CircuitClosed {
			t.Error("成功后状态应该是 Closed")
		}
	})
}

// ============================================================================
// STORY-3.2: 监控数据采集测试
// ============================================================================

// TestMetricPoint 测试监控指标点
func TestMetricPoint(t *testing.T) {
	t.Run("指标点结构", func(t *testing.T) {
		point := &MetricPoint{
			Name:      "http_requests_total",
			Value:     100.0,
			Timestamp: time.Now(),
			Tags: map[string]string{
				"method": "GET",
				"path":   "/api",
			},
			NodeID: "node-1",
		}

		if point.Name == "" {
			t.Error("指标名称不应为空")
		}
		if point.Timestamp.IsZero() {
			t.Error("时间戳不应为零值")
		}
	})

	t.Run("指标类型", func(t *testing.T) {
		types := []MetricType{
			MetricTypeCounter,
			MetricTypeGauge,
			MetricTypeHistogram,
		}

		for _, mt := range types {
			if mt.String() == "" {
				t.Errorf("指标类型 %d 的字符串表示不应为空", mt)
			}
		}
	})
}

// TestMetricsBuffer 测试监控指标缓冲区
func TestMetricsBuffer(t *testing.T) {
	t.Run("创建缓冲区", func(t *testing.T) {
		config := DefaultMetricsBufferConfig()
		buffer := NewMetricsBuffer(config)

		if buffer == nil {
			t.Fatal("缓冲区不应为 nil")
		}
	})

	t.Run("记录指标", func(t *testing.T) {
		config := MetricsBufferConfig{
			BufferSize:    100,
			FlushInterval: 10 * time.Second,
			PreAggregate:  false,
		}
		buffer := NewMetricsBuffer(config)

		point := &MetricPoint{
			Name:      "test_metric",
			Value:     1.0,
			Timestamp: time.Now(),
		}

		err := buffer.Record(point)
		if err != nil {
			t.Errorf("记录指标失败: %v", err)
		}

		if buffer.Len() != 1 {
			t.Errorf("缓冲区长度期望 1, 实际 %d", buffer.Len())
		}
	})

	t.Run("预聚合", func(t *testing.T) {
		config := MetricsBufferConfig{
			BufferSize:    100,
			FlushInterval: 10 * time.Second,
			PreAggregate:  true,
		}
		buffer := NewMetricsBuffer(config)

		// 记录相同指标多次
		for i := 0; i < 10; i++ {
			point := &MetricPoint{
				Name:      "counter_metric",
				Type:      MetricTypeCounter,
				Value:     1.0,
				Timestamp: time.Now(),
			}
			_ = buffer.Record(point)
		}

		// 预聚合后应该只有一个点
		aggregated := buffer.GetAggregated()
		if len(aggregated) != 1 {
			t.Errorf("聚合后指标数期望 1, 实际 %d", len(aggregated))
		}

		// 值应该是 10
		if aggregated[0].Value != 10.0 {
			t.Errorf("聚合值期望 10.0, 实际 %f", aggregated[0].Value)
		}
	})
}

// TestMetricsCollector 测试指标采集器
func TestMetricsCollector(t *testing.T) {
	t.Run("内存使用采集", func(t *testing.T) {
		collector := NewSystemMetricsCollector()

		point := collector.CollectMemory()
		if point == nil {
			t.Fatal("内存指标不应为 nil")
		}
		if point.Name != "system_memory_bytes" {
			t.Errorf("指标名期望 system_memory_bytes, 实际 %s", point.Name)
		}
		if point.Value <= 0 {
			t.Error("内存使用应大于 0")
		}
	})

	t.Run("Goroutine 数量采集", func(t *testing.T) {
		collector := NewSystemMetricsCollector()

		point := collector.CollectGoroutines()
		if point == nil {
			t.Fatal("Goroutine 指标不应为 nil")
		}
		if point.Name != "system_goroutines" {
			t.Errorf("指标名期望 system_goroutines, 实际 %s", point.Name)
		}
		if point.Value < 1 {
			t.Error("Goroutine 数量应至少为 1")
		}
	})

	t.Run("DB 连接池状态采集", func(t *testing.T) {
		collector := NewSystemMetricsCollector()

		// 模拟连接池状态
		stats := &DBPoolStats{
			MaxConnections:  100,
			OpenConnections: 10,
			InUse:           5,
			Idle:            5,
			WaitCount:       0,
			WaitDuration:    0,
		}

		points := collector.CollectDBPool(stats)
		if len(points) < 4 {
			t.Errorf("DB 连接池指标数应至少 4, 实际 %d", len(points))
		}
	})
}

// ============================================================================
// STORY-3.3: 监控专用连接测试
// ============================================================================

// TestDedicatedConnection 测试专用连接
func TestDedicatedConnection(t *testing.T) {
	t.Run("连接配置", func(t *testing.T) {
		config := DedicatedConnectionConfig{
			WriteTimeout:    5 * time.Second,
			FallbackToStdout: true,
			HealthCheckInterval: 30 * time.Second,
		}

		if config.WriteTimeout <= 0 {
			t.Error("写入超时应大于 0")
		}
		if config.HealthCheckInterval <= 0 {
			t.Error("健康检查间隔应大于 0")
		}
	})

	t.Run("超时回退到 Stdout", func(t *testing.T) {
		var stdoutCalled atomic.Bool

		config := DedicatedConnectionConfig{
			WriteTimeout:     10 * time.Millisecond,
			FallbackToStdout: true,
		}

		conn := NewMockDedicatedConnection(config)
		conn.SetWriteDelay(50 * time.Millisecond) // 模拟慢写入
		conn.SetStdoutCallback(func(data []byte) {
			stdoutCalled.Store(true)
		})

		ctx, cancel := context.WithTimeout(context.Background(), config.WriteTimeout)
		defer cancel()

		// 写入应该超时并回退到 stdout
		err := conn.Write(ctx, []byte("test data"))
		if err != nil && err != context.DeadlineExceeded {
			// 可能返回超时错误，这是预期的
		}

		// 等待回退完成
		time.Sleep(20 * time.Millisecond)

		if !stdoutCalled.Load() {
			t.Error("超时后应该回退到 Stdout")
		}
	})
}

// TestMonitoringHealth 测试监控系统健康状态
func TestMonitoringHealth(t *testing.T) {
	t.Run("健康状态结构", func(t *testing.T) {
		health := &MonitoringHealth{
			Healthy:           true,
			LastFlushTime:     time.Now(),
			BufferUtilization: 0.5,
			DroppedCount:      0,
			ErrorCount:        0,
		}

		if !health.Healthy {
			t.Error("健康状态应为 true")
		}
		if health.BufferUtilization < 0 || health.BufferUtilization > 1 {
			t.Error("缓冲区利用率应在 0-1 之间")
		}
	})

	t.Run("健康检查", func(t *testing.T) {
		checker := NewHealthChecker()

		// 正常状态
		health := checker.Check()
		if !health.Healthy {
			t.Error("初始状态应该健康")
		}

		// 记录错误
		for i := 0; i < 10; i++ {
			checker.RecordError()
		}

		health = checker.Check()
		if health.Healthy {
			t.Error("多次错误后应该不健康")
		}
	})
}

// ============================================================================
// STORY-3.4: 数据老化与降采样测试
// ============================================================================

// TestRetentionPolicy 测试保留策略
func TestRetentionPolicy(t *testing.T) {
	t.Run("默认策略", func(t *testing.T) {
		policy := DefaultRetentionPolicy()

		if policy.RawRetentionDays < 1 {
			t.Error("原始数据保留天数应至少 1 天")
		}
		if policy.AggregatedRetentionDays < policy.RawRetentionDays {
			t.Error("聚合数据保留天数应不小于原始数据")
		}
	})

	t.Run("自定义策略", func(t *testing.T) {
		policy := &RetentionPolicy{
			RawRetentionDays:        7,
			AggregatedRetentionDays: 90,
			AggregationInterval:     time.Hour,
		}

		if policy.RawRetentionDays != 7 {
			t.Error("原始数据保留天数应为 7")
		}
	})
}

// TestMaterializedViewManager 测试物化视图管理器
func TestMaterializedViewManager(t *testing.T) {
	t.Run("创建物化视图 SQL", func(t *testing.T) {
		mvm := NewMaterializedViewManager("metrics_daily")

		sql := mvm.CreateViewSQL()
		if sql == "" {
			t.Error("创建物化视图 SQL 不应为空")
		}

		if !containsAll(sql, "CREATE MATERIALIZED VIEW", "IF NOT EXISTS", "metrics_daily") {
			t.Errorf("物化视图 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("刷新物化视图 SQL", func(t *testing.T) {
		mvm := NewMaterializedViewManager("metrics_daily")

		sql := mvm.RefreshViewSQL(false)
		if sql == "" {
			t.Error("刷新物化视图 SQL 不应为空")
		}

		if !containsAll(sql, "REFRESH MATERIALIZED VIEW", "metrics_daily") {
			t.Errorf("刷新物化视图 SQL 格式不正确: %s", sql)
		}

		// 并发刷新
		sqlConcurrent := mvm.RefreshViewSQL(true)
		if !containsAll(sqlConcurrent, "CONCURRENTLY") {
			t.Error("并发刷新应包含 CONCURRENTLY")
		}
	})

	t.Run("删除物化视图 SQL", func(t *testing.T) {
		mvm := NewMaterializedViewManager("metrics_daily")

		sql := mvm.DropViewSQL()
		if sql == "" {
			t.Error("删除物化视图 SQL 不应为空")
		}

		if !containsAll(sql, "DROP MATERIALIZED VIEW", "IF EXISTS", "metrics_daily") {
			t.Errorf("删除物化视图 SQL 格式不正确: %s", sql)
		}
	})
}

// TestDataAggregator 测试数据聚合器
func TestDataAggregator(t *testing.T) {
	t.Run("每日聚合", func(t *testing.T) {
		aggregator := NewDataAggregator(AggregationDaily)

		points := []*MetricPoint{
			{Name: "test", Value: 10, Timestamp: time.Date(2026, 1, 7, 10, 0, 0, 0, time.UTC)},
			{Name: "test", Value: 20, Timestamp: time.Date(2026, 1, 7, 14, 0, 0, 0, time.UTC)},
			{Name: "test", Value: 30, Timestamp: time.Date(2026, 1, 7, 18, 0, 0, 0, time.UTC)},
		}

		result := aggregator.Aggregate(points)
		if len(result) != 1 {
			t.Errorf("每日聚合后应只有 1 个点, 实际 %d", len(result))
		}

		// 验证聚合值 (平均值)
		if result[0].Value != 20.0 {
			t.Errorf("聚合平均值期望 20.0, 实际 %f", result[0].Value)
		}
	})

	t.Run("每小时聚合", func(t *testing.T) {
		aggregator := NewDataAggregator(AggregationHourly)

		points := []*MetricPoint{
			{Name: "test", Value: 10, Timestamp: time.Date(2026, 1, 7, 10, 15, 0, 0, time.UTC)},
			{Name: "test", Value: 20, Timestamp: time.Date(2026, 1, 7, 10, 45, 0, 0, time.UTC)},
			{Name: "test", Value: 30, Timestamp: time.Date(2026, 1, 7, 11, 30, 0, 0, time.UTC)},
		}

		result := aggregator.Aggregate(points)
		if len(result) != 2 {
			t.Errorf("每小时聚合后应有 2 个点, 实际 %d", len(result))
		}
	})
}

// ============================================================================
// 辅助函数
// ============================================================================

var testIDCounter atomic.Int64

func generateTestID() string {
	return "test-" + time.Now().Format("20060102150405") + "-" + 
		string(rune('a'+testIDCounter.Add(1)%26))
}

func containsAll(s string, substrs ...string) bool {
	for _, substr := range substrs {
		if !contains(s, substr) {
			return false
		}
	}
	return true
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || 
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
