package core

import (
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

const (
	// MetricsCollectionInterval 指标采集间隔
	MetricsCollectionInterval = 60 * time.Second

	// LatencyBufferSize Ring Buffer 大小，存储最近的请求延迟
	LatencyBufferSize = 1000
)

// LatencyBuffer 延迟数据的 Ring Buffer 实现
type LatencyBuffer struct {
	data  []float64
	index int
	count int
	mu    sync.Mutex
}

// NewLatencyBuffer 创建新的延迟 Ring Buffer
func NewLatencyBuffer(size int) *LatencyBuffer {
	return &LatencyBuffer{
		data: make([]float64, size),
	}
}

// Add 添加一个延迟样本
func (b *LatencyBuffer) Add(latencyMs float64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.data[b.index] = latencyMs
	b.index = (b.index + 1) % len(b.data)
	if b.count < len(b.data) {
		b.count++
	}
}

// P95 计算 P95 延迟
// 注意：Ring Buffer 满后数据在数组中的顺序不连续，但排序后取 P95 不受影响
func (b *LatencyBuffer) P95() float64 {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.count == 0 {
		return 0
	}

	// 复制数据用于排序（排序后顺序无关紧要）
	samples := make([]float64, b.count)
	copy(samples, b.data[:b.count])
	sort.Float64s(samples)

	// 计算 P95 索引
	p95Index := int(math.Ceil(float64(len(samples))*0.95)) - 1
	if p95Index < 0 {
		p95Index = 0
	}
	if p95Index >= len(samples) {
		p95Index = len(samples) - 1
	}

	return samples[p95Index]
}

// Reset 重置 buffer
func (b *LatencyBuffer) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.index = 0
	b.count = 0
}

// MetricsCollector 系统指标采集器
type MetricsCollector struct {
	app           App
	repository    *MetricsRepository
	latencyBuffer *LatencyBuffer
	http5xxCount  atomic.Int64
	stopCh        chan struct{}
	wg            sync.WaitGroup
	mu            sync.Mutex // 保护 Start/Stop 的互斥锁
	running       bool
}

// NewMetricsCollector 创建指标采集器实例
func NewMetricsCollector(app App) *MetricsCollector {
	return &MetricsCollector{
		app:           app,
		repository:    NewMetricsRepository(app),
		latencyBuffer: NewLatencyBuffer(LatencyBufferSize),
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

// collectionLoop 采集主循环
func (c *MetricsCollector) collectionLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(MetricsCollectionInterval)
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

	// GCCPUFraction 是自程序启动以来 GC 使用的 CPU 时间占比 (0-1)
	gcCPUPercent := math.Round(m.GCCPUFraction*100*100) / 100
	// 内存分配转换为 MB
	allocMB := math.Round(float64(m.Alloc)/1024/1024*100) / 100

	metrics := &SystemMetrics{
		Timestamp:       types.NowDateTime(),
		CpuUsagePercent: gcCPUPercent,
		MemoryAllocMB:   allocMB,
		GoroutinesCount: runtime.NumGoroutine(),
		SqliteWalSizeMB: c.collectWALSize(),
		SqliteOpenConns: c.collectOpenConns(),
		P95LatencyMs:    c.collectP95Latency(),
		Http5xxCount:    c.collectAndReset5xxCount(),
	}
	// 使用 BaseModel 的 Id 字段
	metrics.Id = security.RandomString(15)

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
func (c *MetricsCollector) collectP95Latency() float64 {
	p95 := c.latencyBuffer.P95()
	return math.Round(p95*100) / 100
}

// collectAndReset5xxCount 采集并重置 5xx 错误计数
func (c *MetricsCollector) collectAndReset5xxCount() int {
	return int(c.http5xxCount.Swap(0))
}

// GetLatencyBuffer 返回延迟 buffer（用于中间件注入数据）
func (c *MetricsCollector) GetLatencyBuffer() *LatencyBuffer {
	return c.latencyBuffer
}
