package metrics

import (
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

// MetricsCollector 系统指标采集器
type MetricsCollector struct {
	app           core.App
	repository    *MetricsRepository
	config        Config
	latencyBuffer *LatencyBuffer
	cpuSampler    *CPUSampler
	http5xxCount  atomic.Int64
	stopCh        chan struct{}
	wg            sync.WaitGroup
	mu            sync.Mutex // 保护 Start/Stop 的互斥锁
	running       bool
}

// NewMetricsCollector 创建指标采集器实例
func NewMetricsCollector(app core.App, repository *MetricsRepository, config Config) *MetricsCollector {
	return &MetricsCollector{
		app:           app,
		repository:    repository,
		config:        config,
		latencyBuffer: NewLatencyBuffer(config.LatencyBufferSize),
		cpuSampler:    NewCPUSampler(),
	}
}

// Start 启动指标采集器
func (c *MetricsCollector) Start() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.running {
		return // 已经在运行
	}

	c.running = true
	c.stopCh = make(chan struct{}) // 每次启动创建新 channel
	c.wg.Add(1)
	go c.collectionLoop()
}

// Stop 停止指标采集器
func (c *MetricsCollector) Stop() {
	c.mu.Lock()
	if !c.running {
		c.mu.Unlock()
		return // 没有在运行
	}
	c.running = false
	close(c.stopCh)
	c.mu.Unlock()

	c.wg.Wait()
}

// IsRunning 返回采集器是否正在运行
func (c *MetricsCollector) IsRunning() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.running
}

// RecordLatency 记录请求延迟（由 HTTP 中间件调用）
func (c *MetricsCollector) RecordLatency(latencyMs float64) {
	c.latencyBuffer.Add(latencyMs)
}

// RecordError 记录 5xx 错误（由 HTTP 中间件调用）
func (c *MetricsCollector) RecordError(statusCode int) {
	if statusCode >= 500 && statusCode < 600 {
		c.http5xxCount.Add(1)
	}
}

// GetLatencyBuffer 返回延迟 buffer（用于外部访问）
func (c *MetricsCollector) GetLatencyBuffer() *LatencyBuffer {
	return c.latencyBuffer
}

// collectionLoop 采集主循环
func (c *MetricsCollector) collectionLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.config.CollectionInterval)
	defer ticker.Stop()

	// 立即采集一次
	c.collectAndStore()

	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.collectAndStore()
		}
	}
}

// collectAndStore 采集并存储指标
func (c *MetricsCollector) collectAndStore() {
	metrics := c.collectMetrics()

	if err := c.repository.Insert(metrics); err != nil {
		c.app.Logger().Error(
			"Failed to store metrics",
			"error", err,
		)
	}
}

// collectMetrics 采集所有指标
func (c *MetricsCollector) collectMetrics() *SystemMetrics {
	// 一次性读取 MemStats，避免多次 STW
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// 内存分配转换为 MB
	allocMB := math.Round(float64(m.Alloc)/1024/1024*100) / 100

	// 采集 P95 延迟并根据配置决定是否重置 buffer
	p95Latency, resetBuffer := c.collectP95Latency()

	metrics := &SystemMetrics{
		Timestamp:       types.NowDateTime(),
		CpuUsagePercent: c.cpuSampler.CPUPercent(), // 使用新的 CPU 采样器
		MemoryAllocMB:   allocMB,
		GoroutinesCount: runtime.NumGoroutine(),
		SqliteWalSizeMB: c.collectWALSize(),
		SqliteOpenConns: c.collectOpenConns(),
		P95LatencyMs:    p95Latency,
		Http5xxCount:    c.collectAndReset5xxCount(),
	}
	// 使用 BaseModel 的 Id 字段
	metrics.Id = security.RandomString(15)

	// 根据配置在采集后重置延迟 buffer
	if resetBuffer && c.config.ResetLatencyBufferOnCollect {
		c.latencyBuffer.Reset()
	}

	return metrics
}

// collectWALSize 采集 WAL 文件大小
func (c *MetricsCollector) collectWALSize() float64 {
	dataDir := c.app.DataDir()

	// 检查主数据库 WAL
	dataWalPath := filepath.Join(dataDir, "data.db-wal")
	var totalSize int64

	if info, err := os.Stat(dataWalPath); err == nil {
		totalSize += info.Size()
	}

	// 检查辅助数据库 WAL
	auxWalPath := filepath.Join(dataDir, "auxiliary.db-wal")
	if info, err := os.Stat(auxWalPath); err == nil {
		totalSize += info.Size()
	}

	// 转换为 MB
	sizeMB := float64(totalSize) / 1024 / 1024
	return math.Round(sizeMB*100) / 100
}

// collectOpenConns 采集数据库连接数
func (c *MetricsCollector) collectOpenConns() int {
	totalConns := 0

	// 获取主数据库连接数
	// ConcurrentDB() 返回 dbx.Builder 接口，需要类型断言为 *dbx.DB
	if db := c.app.ConcurrentDB(); db != nil {
		if dbxDB, ok := db.(*dbx.DB); ok && dbxDB.DB() != nil {
			stats := dbxDB.DB().Stats()
			totalConns += stats.OpenConnections
		}
	}

	return totalConns
}

// collectP95Latency 采集 P95 延迟
// 返回 (P95值, 是否应该重置buffer)
func (c *MetricsCollector) collectP95Latency() (float64, bool) {
	p95 := c.latencyBuffer.P95()
	hasData := c.latencyBuffer.Count() > 0
	return math.Round(p95*100) / 100, hasData
}

// collectAndReset5xxCount 采集并重置 5xx 错误计数
func (c *MetricsCollector) collectAndReset5xxCount() int {
	return int(c.http5xxCount.Swap(0))
}
