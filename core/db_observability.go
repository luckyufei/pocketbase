package core

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// ============================================================================
// STORY-3.1: 高性能日志写入
// ============================================================================

// ErrBufferFull 表示缓冲区已满
var ErrBufferFull = errors.New("log buffer is full")

// RequestLog 表示一条请求日志
type RequestLog struct {
	ID           string        `json:"id"`
	Timestamp    time.Time     `json:"timestamp"`
	Method       string        `json:"method"`
	Path         string        `json:"path"`
	StatusCode   int           `json:"status_code"`
	Duration     time.Duration `json:"duration"`
	RequestSize  int64         `json:"request_size"`
	ResponseSize int64         `json:"response_size"`
	UserID       string        `json:"user_id,omitempty"`
	IP           string        `json:"ip"`
	UserAgent    string        `json:"user_agent"`
	Error        string        `json:"error,omitempty"`
	NodeID       string        `json:"node_id"`
}

// PartitionKey 返回日志的分区键 (按天分区)
func (l *RequestLog) PartitionKey() string {
	return l.Timestamp.Format("2006_01_02")
}

// LogBufferConfig 日志缓冲区配置
type LogBufferConfig struct {
	BufferSize     int           // 缓冲区大小
	FlushInterval  time.Duration // 刷新间隔
	MaxBatchSize   int           // 最大批量大小
	CircuitBreaker bool          // 是否启用熔断
	DropWhenFull   bool          // 缓冲区满时是否丢弃
}

// DefaultLogBufferConfig 返回默认日志缓冲区配置
func DefaultLogBufferConfig() LogBufferConfig {
	return LogBufferConfig{
		BufferSize:     10000,
		FlushInterval:  500 * time.Millisecond,
		MaxBatchSize:   1000,
		CircuitBreaker: true,
		DropWhenFull:   true,
	}
}

// LogBuffer 日志缓冲区
type LogBuffer struct {
	config       LogBufferConfig
	buffer       chan *RequestLog
	flushHandler func([]*RequestLog) error
	droppedCount atomic.Int64
	mu           sync.RWMutex
	closed       atomic.Bool
}

// NewLogBuffer 创建日志缓冲区
func NewLogBuffer(config LogBufferConfig) *LogBuffer {
	return &LogBuffer{
		config: config,
		buffer: make(chan *RequestLog, config.BufferSize),
	}
}

// SetFlushHandler 设置刷新处理器
func (lb *LogBuffer) SetFlushHandler(handler func([]*RequestLog) error) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.flushHandler = handler
}

// Write 写入日志
func (lb *LogBuffer) Write(log *RequestLog) error {
	if lb.closed.Load() {
		return errors.New("buffer is closed")
	}

	select {
	case lb.buffer <- log:
		return nil
	default:
		if lb.config.DropWhenFull {
			lb.droppedCount.Add(1)
			return ErrBufferFull
		}
		// 阻塞等待
		lb.buffer <- log
		return nil
	}
}

// Len 返回缓冲区当前长度
func (lb *LogBuffer) Len() int {
	return len(lb.buffer)
}

// DroppedCount 返回丢弃的日志数
func (lb *LogBuffer) DroppedCount() int64 {
	return lb.droppedCount.Load()
}

// Flush 刷新缓冲区
func (lb *LogBuffer) Flush() error {
	lb.mu.RLock()
	handler := lb.flushHandler
	lb.mu.RUnlock()

	if handler == nil {
		return nil
	}

	logs := make([]*RequestLog, 0, lb.config.MaxBatchSize)

	// 收集日志
	for {
		select {
		case log := <-lb.buffer:
			logs = append(logs, log)
			if len(logs) >= lb.config.MaxBatchSize {
				if err := handler(logs); err != nil {
					return err
				}
				logs = logs[:0]
			}
		default:
			// 缓冲区空了
			if len(logs) > 0 {
				return handler(logs)
			}
			return nil
		}
	}
}

// Close 关闭缓冲区
func (lb *LogBuffer) Close() error {
	lb.closed.Store(true)
	return lb.Flush()
}

// LogWriter 日志写入器接口
type LogWriter interface {
	WriteBatch(ctx context.Context, logs []*RequestLog) error
	Close() error
}

// MemoryLogWriter 内存日志写入器 (用于测试)
type MemoryLogWriter struct {
	logs  []*RequestLog
	mu    sync.Mutex
	count atomic.Int64
}

// NewMemoryLogWriter 创建内存日志写入器
func NewMemoryLogWriter() *MemoryLogWriter {
	return &MemoryLogWriter{
		logs: make([]*RequestLog, 0),
	}
}

// WriteBatch 批量写入日志
func (w *MemoryLogWriter) WriteBatch(ctx context.Context, logs []*RequestLog) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.logs = append(w.logs, logs...)
	w.count.Add(int64(len(logs)))
	return nil
}

// Count 返回写入的日志数
func (w *MemoryLogWriter) Count() int64 {
	return w.count.Load()
}

// Close 关闭写入器
func (w *MemoryLogWriter) Close() error {
	return nil
}

// LogPartitionManager 日志分区管理器
type LogPartitionManager struct {
	tableName     string
	retentionDays int
}

// NewLogPartitionManager 创建日志分区管理器
func NewLogPartitionManager(tableName string) *LogPartitionManager {
	return &LogPartitionManager{
		tableName:     tableName,
		retentionDays: 7, // 默认保留 7 天
	}
}

// SetRetentionDays 设置保留天数
func (pm *LogPartitionManager) SetRetentionDays(days int) {
	pm.retentionDays = days
}

// PartitionName 生成分区名称
func (pm *LogPartitionManager) PartitionName(date time.Time) string {
	return fmt.Sprintf("%s_%s", pm.tableName, date.Format("2006_01_02"))
}

// PartitionRange 计算分区范围
func (pm *LogPartitionManager) PartitionRange(date time.Time) (start, end time.Time) {
	start = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	end = start.AddDate(0, 0, 1)
	return
}

// CreatePartitionSQL 生成创建分区 SQL
func (pm *LogPartitionManager) CreatePartitionSQL(date time.Time) string {
	partitionName := pm.PartitionName(date)
	start, end := pm.PartitionRange(date)

	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s PARTITION OF %s
FOR VALUES FROM ('%s') TO ('%s')`,
		partitionName,
		pm.tableName,
		start.Format("2006-01-02"),
		end.Format("2006-01-02"))
}

// DropPartitionSQL 生成删除分区 SQL
func (pm *LogPartitionManager) DropPartitionSQL(date time.Time) string {
	partitionName := pm.PartitionName(date)
	return fmt.Sprintf("DROP TABLE IF EXISTS %s", partitionName)
}

// PartitionsToCreate 获取需要创建的分区 (未来 N 天)
func (pm *LogPartitionManager) PartitionsToCreate(days int) []time.Time {
	now := time.Now().UTC()
	partitions := make([]time.Time, days)
	for i := 0; i < days; i++ {
		partitions[i] = now.AddDate(0, 0, i)
	}
	return partitions
}

// PartitionsToCleanup 获取需要清理的分区
func (pm *LogPartitionManager) PartitionsToCleanup(existingPartitions []time.Time) []time.Time {
	now := time.Now().UTC()
	cutoff := now.AddDate(0, 0, -pm.retentionDays)

	var toCleanup []time.Time
	for _, p := range existingPartitions {
		if p.Before(cutoff) {
			toCleanup = append(toCleanup, p)
		}
	}
	return toCleanup
}

// CreateTableSQL 生成创建主表 SQL (UNLOGGED 分区表)
func (pm *LogPartitionManager) CreateTableSQL() string {
	return fmt.Sprintf(`CREATE UNLOGGED TABLE IF NOT EXISTS %s (
    id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms BIGINT NOT NULL,
    request_size BIGINT,
    response_size BIGINT,
    user_id TEXT,
    ip TEXT,
    user_agent TEXT,
    error TEXT,
    node_id TEXT NOT NULL,
    PRIMARY KEY (timestamp, id)
) PARTITION BY RANGE (timestamp)`, pm.tableName)
}

// ============================================================================
// 熔断器
// ============================================================================

// CircuitState 熔断器状态
type CircuitState int

const (
	CircuitClosed   CircuitState = iota // 正常
	CircuitOpen                         // 熔断
	CircuitHalfOpen                     // 半开
)

// CircuitBreakerConfig 熔断器配置
type CircuitBreakerConfig struct {
	FailureThreshold int           // 失败阈值
	ResetTimeout     time.Duration // 重置超时
}

// CircuitBreaker 熔断器
type CircuitBreaker struct {
	config       CircuitBreakerConfig
	state        atomic.Int32
	failureCount atomic.Int32
	lastFailure  atomic.Int64
	mu           sync.RWMutex
}

// NewCircuitBreaker 创建熔断器
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	cb := &CircuitBreaker{
		config: config,
	}
	cb.state.Store(int32(CircuitClosed))
	return cb
}

// Allow 检查是否允许请求
func (cb *CircuitBreaker) Allow() bool {
	state := CircuitState(cb.state.Load())

	switch state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		// 检查是否可以尝试恢复
		lastFailure := time.Unix(0, cb.lastFailure.Load())
		if time.Since(lastFailure) > cb.config.ResetTimeout {
			cb.state.Store(int32(CircuitHalfOpen))
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	}
	return false
}

// State 返回当前状态
func (cb *CircuitBreaker) State() CircuitState {
	return CircuitState(cb.state.Load())
}

// RecordSuccess 记录成功
func (cb *CircuitBreaker) RecordSuccess() {
	cb.failureCount.Store(0)
	cb.state.Store(int32(CircuitClosed))
}

// RecordFailure 记录失败
func (cb *CircuitBreaker) RecordFailure() {
	count := cb.failureCount.Add(1)
	cb.lastFailure.Store(time.Now().UnixNano())

	if int(count) >= cb.config.FailureThreshold {
		cb.state.Store(int32(CircuitOpen))
	}
}

// ============================================================================
// STORY-3.2: 监控数据采集
// ============================================================================

// MetricType 指标类型
type MetricType int

const (
	MetricTypeCounter MetricType = iota
	MetricTypeGauge
	MetricTypeHistogram
)

// String 返回指标类型字符串
func (mt MetricType) String() string {
	switch mt {
	case MetricTypeCounter:
		return "counter"
	case MetricTypeGauge:
		return "gauge"
	case MetricTypeHistogram:
		return "histogram"
	default:
		return "unknown"
	}
}

// MetricPoint 监控指标点
type MetricPoint struct {
	Name      string            `json:"name"`
	Type      MetricType        `json:"type"`
	Value     float64           `json:"value"`
	Timestamp time.Time         `json:"timestamp"`
	Tags      map[string]string `json:"tags,omitempty"`
	NodeID    string            `json:"node_id"`
}

// MetricsBufferConfig 监控指标缓冲区配置
type MetricsBufferConfig struct {
	BufferSize    int           // 缓冲区大小
	FlushInterval time.Duration // 刷新间隔
	PreAggregate  bool          // 是否预聚合
}

// DefaultMetricsBufferConfig 返回默认配置
func DefaultMetricsBufferConfig() MetricsBufferConfig {
	return MetricsBufferConfig{
		BufferSize:    10000,
		FlushInterval: 10 * time.Second,
		PreAggregate:  true,
	}
}

// MetricsBuffer 监控指标缓冲区
type MetricsBuffer struct {
	config     MetricsBufferConfig
	points     []*MetricPoint
	aggregated map[string]*MetricPoint // 预聚合缓存
	mu         sync.RWMutex
}

// NewMetricsBuffer 创建监控指标缓冲区
func NewMetricsBuffer(config MetricsBufferConfig) *MetricsBuffer {
	return &MetricsBuffer{
		config:     config,
		points:     make([]*MetricPoint, 0, config.BufferSize),
		aggregated: make(map[string]*MetricPoint),
	}
}

// Record 记录指标
func (mb *MetricsBuffer) Record(point *MetricPoint) error {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	if mb.config.PreAggregate && point.Type == MetricTypeCounter {
		// 预聚合计数器
		key := point.Name
		if existing, ok := mb.aggregated[key]; ok {
			existing.Value += point.Value
		} else {
			mb.aggregated[key] = &MetricPoint{
				Name:      point.Name,
				Type:      point.Type,
				Value:     point.Value,
				Timestamp: point.Timestamp,
				Tags:      point.Tags,
				NodeID:    point.NodeID,
			}
		}
	} else {
		mb.points = append(mb.points, point)
	}

	return nil
}

// Len 返回缓冲区长度
func (mb *MetricsBuffer) Len() int {
	mb.mu.RLock()
	defer mb.mu.RUnlock()
	return len(mb.points) + len(mb.aggregated)
}

// GetAggregated 获取聚合后的指标
func (mb *MetricsBuffer) GetAggregated() []*MetricPoint {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	result := make([]*MetricPoint, 0, len(mb.aggregated)+len(mb.points))
	for _, p := range mb.aggregated {
		result = append(result, p)
	}
	result = append(result, mb.points...)
	return result
}

// DBPoolStats 数据库连接池状态
type DBPoolStats struct {
	MaxConnections  int
	OpenConnections int
	InUse           int
	Idle            int
	WaitCount       int64
	WaitDuration    time.Duration
}

// SystemMetricsCollector 系统指标采集器
type SystemMetricsCollector struct {
	nodeID string
}

// NewSystemMetricsCollector 创建系统指标采集器
func NewSystemMetricsCollector() *SystemMetricsCollector {
	return &SystemMetricsCollector{
		nodeID: GenerateNodeID(),
	}
}

// CollectMemory 采集内存使用
func (c *SystemMetricsCollector) CollectMemory() *MetricPoint {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return &MetricPoint{
		Name:      "system_memory_bytes",
		Type:      MetricTypeGauge,
		Value:     float64(m.Alloc),
		Timestamp: time.Now(),
		Tags: map[string]string{
			"type": "alloc",
		},
		NodeID: c.nodeID,
	}
}

// CollectGoroutines 采集 Goroutine 数量
func (c *SystemMetricsCollector) CollectGoroutines() *MetricPoint {
	return &MetricPoint{
		Name:      "system_goroutines",
		Type:      MetricTypeGauge,
		Value:     float64(runtime.NumGoroutine()),
		Timestamp: time.Now(),
		NodeID:    c.nodeID,
	}
}

// CollectDBPool 采集数据库连接池状态
func (c *SystemMetricsCollector) CollectDBPool(stats *DBPoolStats) []*MetricPoint {
	now := time.Now()
	return []*MetricPoint{
		{
			Name:      "db_pool_max_connections",
			Type:      MetricTypeGauge,
			Value:     float64(stats.MaxConnections),
			Timestamp: now,
			NodeID:    c.nodeID,
		},
		{
			Name:      "db_pool_open_connections",
			Type:      MetricTypeGauge,
			Value:     float64(stats.OpenConnections),
			Timestamp: now,
			NodeID:    c.nodeID,
		},
		{
			Name:      "db_pool_in_use",
			Type:      MetricTypeGauge,
			Value:     float64(stats.InUse),
			Timestamp: now,
			NodeID:    c.nodeID,
		},
		{
			Name:      "db_pool_idle",
			Type:      MetricTypeGauge,
			Value:     float64(stats.Idle),
			Timestamp: now,
			NodeID:    c.nodeID,
		},
		{
			Name:      "db_pool_wait_count",
			Type:      MetricTypeCounter,
			Value:     float64(stats.WaitCount),
			Timestamp: now,
			NodeID:    c.nodeID,
		},
	}
}

// ============================================================================
// STORY-3.3: 监控专用连接
// ============================================================================

// DedicatedConnectionConfig 专用连接配置
type DedicatedConnectionConfig struct {
	WriteTimeout        time.Duration
	FallbackToStdout    bool
	HealthCheckInterval time.Duration
}

// DedicatedConnection 专用连接接口
type DedicatedConnection interface {
	Write(ctx context.Context, data []byte) error
	Close() error
}

// MockDedicatedConnection 模拟专用连接 (用于测试)
type MockDedicatedConnection struct {
	config         DedicatedConnectionConfig
	writeDelay     time.Duration
	stdoutCallback func([]byte)
	mu             sync.Mutex
}

// NewMockDedicatedConnection 创建模拟专用连接
func NewMockDedicatedConnection(config DedicatedConnectionConfig) *MockDedicatedConnection {
	return &MockDedicatedConnection{
		config: config,
	}
}

// SetWriteDelay 设置写入延迟 (模拟慢写入)
func (c *MockDedicatedConnection) SetWriteDelay(delay time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.writeDelay = delay
}

// SetStdoutCallback 设置 stdout 回调
func (c *MockDedicatedConnection) SetStdoutCallback(callback func([]byte)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stdoutCallback = callback
}

// Write 写入数据
func (c *MockDedicatedConnection) Write(ctx context.Context, data []byte) error {
	c.mu.Lock()
	delay := c.writeDelay
	callback := c.stdoutCallback
	c.mu.Unlock()

	// 模拟写入延迟
	if delay > 0 {
		select {
		case <-time.After(delay):
			// 写入完成
		case <-ctx.Done():
			// 超时，回退到 stdout
			if c.config.FallbackToStdout && callback != nil {
				callback(data)
			}
			return ctx.Err()
		}
	}

	return nil
}

// Close 关闭连接
func (c *MockDedicatedConnection) Close() error {
	return nil
}

// MonitoringHealth 监控系统健康状态
type MonitoringHealth struct {
	Healthy           bool
	LastFlushTime     time.Time
	BufferUtilization float64
	DroppedCount      int64
	ErrorCount        int64
}

// HealthChecker 健康检查器
type HealthChecker struct {
	errorCount    atomic.Int64
	errorThreshold int64
}

// NewHealthChecker 创建健康检查器
func NewHealthChecker() *HealthChecker {
	return &HealthChecker{
		errorThreshold: 5,
	}
}

// RecordError 记录错误
func (hc *HealthChecker) RecordError() {
	hc.errorCount.Add(1)
}

// Check 检查健康状态
func (hc *HealthChecker) Check() *MonitoringHealth {
	errorCount := hc.errorCount.Load()
	return &MonitoringHealth{
		Healthy:    errorCount < hc.errorThreshold,
		ErrorCount: errorCount,
	}
}

// ============================================================================
// STORY-3.4: 数据老化与降采样
// ============================================================================

// RetentionPolicy 保留策略
type RetentionPolicy struct {
	RawRetentionDays        int           // 原始数据保留天数
	AggregatedRetentionDays int           // 聚合数据保留天数
	AggregationInterval     time.Duration // 聚合间隔
}

// DefaultRetentionPolicy 返回默认保留策略
func DefaultRetentionPolicy() *RetentionPolicy {
	return &RetentionPolicy{
		RawRetentionDays:        7,
		AggregatedRetentionDays: 90,
		AggregationInterval:     time.Hour,
	}
}

// MaterializedViewManager 物化视图管理器
type MaterializedViewManager struct {
	viewName string
}

// NewMaterializedViewManager 创建物化视图管理器
func NewMaterializedViewManager(viewName string) *MaterializedViewManager {
	return &MaterializedViewManager{
		viewName: viewName,
	}
}

// CreateViewSQL 生成创建物化视图 SQL
func (mvm *MaterializedViewManager) CreateViewSQL() string {
	return fmt.Sprintf(`CREATE MATERIALIZED VIEW IF NOT EXISTS %s AS
SELECT
    date_trunc('day', timestamp) AS day,
    name,
    node_id,
    COUNT(*) AS count,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    SUM(value) AS sum_value
FROM metrics
GROUP BY date_trunc('day', timestamp), name, node_id`, mvm.viewName)
}

// RefreshViewSQL 生成刷新物化视图 SQL
func (mvm *MaterializedViewManager) RefreshViewSQL(concurrent bool) string {
	if concurrent {
		return fmt.Sprintf("REFRESH MATERIALIZED VIEW CONCURRENTLY %s", mvm.viewName)
	}
	return fmt.Sprintf("REFRESH MATERIALIZED VIEW %s", mvm.viewName)
}

// DropViewSQL 生成删除物化视图 SQL
func (mvm *MaterializedViewManager) DropViewSQL() string {
	return fmt.Sprintf("DROP MATERIALIZED VIEW IF EXISTS %s", mvm.viewName)
}

// AggregationLevel 聚合级别
type AggregationLevel int

const (
	AggregationHourly AggregationLevel = iota
	AggregationDaily
)

// DataAggregator 数据聚合器
type DataAggregator struct {
	level AggregationLevel
}

// NewDataAggregator 创建数据聚合器
func NewDataAggregator(level AggregationLevel) *DataAggregator {
	return &DataAggregator{
		level: level,
	}
}

// Aggregate 聚合数据点
func (da *DataAggregator) Aggregate(points []*MetricPoint) []*MetricPoint {
	if len(points) == 0 {
		return nil
	}

	// 按时间桶分组
	buckets := make(map[string][]*MetricPoint)
	for _, p := range points {
		key := da.bucketKey(p)
		buckets[key] = append(buckets[key], p)
	}

	// 聚合每个桶
	result := make([]*MetricPoint, 0, len(buckets))
	for _, bucket := range buckets {
		if len(bucket) == 0 {
			continue
		}

		// 计算平均值
		var sum float64
		for _, p := range bucket {
			sum += p.Value
		}
		avg := sum / float64(len(bucket))

		result = append(result, &MetricPoint{
			Name:      bucket[0].Name,
			Type:      bucket[0].Type,
			Value:     avg,
			Timestamp: da.bucketTime(bucket[0]),
			Tags:      bucket[0].Tags,
			NodeID:    bucket[0].NodeID,
		})
	}

	return result
}

func (da *DataAggregator) bucketKey(p *MetricPoint) string {
	switch da.level {
	case AggregationHourly:
		return p.Timestamp.Format("2006-01-02-15")
	case AggregationDaily:
		return p.Timestamp.Format("2006-01-02")
	default:
		return p.Timestamp.Format("2006-01-02")
	}
}

func (da *DataAggregator) bucketTime(p *MetricPoint) time.Time {
	switch da.level {
	case AggregationHourly:
		return time.Date(p.Timestamp.Year(), p.Timestamp.Month(), p.Timestamp.Day(),
			p.Timestamp.Hour(), 0, 0, 0, p.Timestamp.Location())
	case AggregationDaily:
		return time.Date(p.Timestamp.Year(), p.Timestamp.Month(), p.Timestamp.Day(),
			0, 0, 0, 0, p.Timestamp.Location())
	default:
		return p.Timestamp
	}
}

// ============================================================================
// PostgreSQL COPY 写入器
// ============================================================================

// CopyLogWriter PostgreSQL COPY 写入器
type CopyLogWriter struct {
	dsn    string
	mu     sync.Mutex
	writer io.Writer
}

// NewCopyLogWriter 创建 COPY 写入器
func NewCopyLogWriter(dsn string) *CopyLogWriter {
	return &CopyLogWriter{
		dsn:    dsn,
		writer: os.Stdout, // 默认输出到 stdout
	}
}

// WriteBatch 批量写入日志 (使用 COPY 协议)
func (w *CopyLogWriter) WriteBatch(ctx context.Context, logs []*RequestLog) error {
	if len(logs) == 0 {
		return nil
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	// TODO: 实际实现需要使用 pgx 的 CopyFrom
	// 这里只是接口定义
	return nil
}

// Close 关闭写入器
func (w *CopyLogWriter) Close() error {
	return nil
}

// ============================================================================
// 监控系统管理器
// ============================================================================

// ObservabilityManager 可观测性管理器
type ObservabilityManager struct {
	logBuffer       *LogBuffer
	metricsBuffer   *MetricsBuffer
	collector       *SystemMetricsCollector
	partitionMgr    *LogPartitionManager
	retentionPolicy *RetentionPolicy
	healthChecker   *HealthChecker
	nodeID          string
	mu              sync.RWMutex
	closed          atomic.Bool
}

// NewObservabilityManager 创建可观测性管理器
func NewObservabilityManager() *ObservabilityManager {
	nodeID := GenerateNodeID()
	return &ObservabilityManager{
		logBuffer:       NewLogBuffer(DefaultLogBufferConfig()),
		metricsBuffer:   NewMetricsBuffer(DefaultMetricsBufferConfig()),
		collector:       NewSystemMetricsCollector(),
		partitionMgr:    NewLogPartitionManager("request_logs"),
		retentionPolicy: DefaultRetentionPolicy(),
		healthChecker:   NewHealthChecker(),
		nodeID:          nodeID,
	}
}

// LogRequest 记录请求日志
func (om *ObservabilityManager) LogRequest(log *RequestLog) error {
	if log.NodeID == "" {
		log.NodeID = om.nodeID
	}
	return om.logBuffer.Write(log)
}

// RecordMetric 记录指标
func (om *ObservabilityManager) RecordMetric(point *MetricPoint) error {
	if point.NodeID == "" {
		point.NodeID = om.nodeID
	}
	return om.metricsBuffer.Record(point)
}

// CollectSystemMetrics 采集系统指标
func (om *ObservabilityManager) CollectSystemMetrics() {
	// 内存
	om.RecordMetric(om.collector.CollectMemory())
	// Goroutines
	om.RecordMetric(om.collector.CollectGoroutines())
}

// Health 返回健康状态
func (om *ObservabilityManager) Health() *MonitoringHealth {
	health := om.healthChecker.Check()
	health.BufferUtilization = float64(om.logBuffer.Len()) / float64(om.logBuffer.config.BufferSize)
	health.DroppedCount = om.logBuffer.DroppedCount()
	return health
}

// Close 关闭管理器
func (om *ObservabilityManager) Close() error {
	om.closed.Store(true)
	return om.logBuffer.Close()
}
