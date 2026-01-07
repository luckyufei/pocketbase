// Package dbutils 提供数据库工具函数
package dbutils

import (
	"context"
	"database/sql"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// PoolStats 连接池统计信息
type PoolStats struct {
	// 当前打开的连接数
	OpenConnections int
	// 正在使用的连接数
	InUse int
	// 空闲连接数
	Idle int
	// 等待连接的请求数
	WaitCount int64
	// 等待连接的总时间
	WaitDuration time.Duration
	// 因超时关闭的连接数
	MaxIdleClosed int64
	// 因生命周期到期关闭的连接数
	MaxLifetimeClosed int64
	// 因最大空闲时间关闭的连接数
	MaxIdleTimeClosed int64
}

// GetPoolStats 获取连接池统计信息
func GetPoolStats(db *sql.DB) PoolStats {
	if db == nil {
		return PoolStats{}
	}

	stats := db.Stats()
	return PoolStats{
		OpenConnections:   stats.OpenConnections,
		InUse:             stats.InUse,
		Idle:              stats.Idle,
		WaitCount:         stats.WaitCount,
		WaitDuration:      stats.WaitDuration,
		MaxIdleClosed:     stats.MaxIdleClosed,
		MaxLifetimeClosed: stats.MaxLifetimeClosed,
		MaxIdleTimeClosed: stats.MaxIdleTimeClosed,
	}
}

// ConnectionLeak 表示一个潜在的连接泄漏
type ConnectionLeak struct {
	// 连接获取时间
	AcquiredAt time.Time
	// 连接持有时长
	Duration time.Duration
	// 获取连接时的调用栈
	Stack string
	// 连接 ID
	ID int64
}

// LeakDetector 连接泄漏检测器
type LeakDetector struct {
	mu sync.RWMutex

	// 活跃连接追踪
	activeConns map[int64]*connectionInfo

	// 连接 ID 计数器
	nextID int64

	// 泄漏阈值（连接持有超过此时间视为泄漏）
	leakThreshold time.Duration

	// 是否启用
	enabled bool

	// 检测到的泄漏
	leaks []ConnectionLeak

	// 最大追踪的泄漏数
	maxLeaks int
}

type connectionInfo struct {
	id         int64
	acquiredAt time.Time
	stack      string
}

// NewLeakDetector 创建新的泄漏检测器
func NewLeakDetector(leakThreshold time.Duration) *LeakDetector {
	if leakThreshold <= 0 {
		leakThreshold = 30 * time.Second
	}

	return &LeakDetector{
		activeConns:   make(map[int64]*connectionInfo),
		leakThreshold: leakThreshold,
		enabled:       true,
		maxLeaks:      100,
	}
}

// Enable 启用泄漏检测
func (d *LeakDetector) Enable() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.enabled = true
}

// Disable 禁用泄漏检测
func (d *LeakDetector) Disable() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.enabled = false
}

// IsEnabled 检查是否启用
func (d *LeakDetector) IsEnabled() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.enabled
}

// SetLeakThreshold 设置泄漏阈值
func (d *LeakDetector) SetLeakThreshold(threshold time.Duration) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.leakThreshold = threshold
}

// TrackAcquire 追踪连接获取
func (d *LeakDetector) TrackAcquire() int64 {
	if !d.IsEnabled() {
		return 0
	}

	id := atomic.AddInt64(&d.nextID, 1)

	d.mu.Lock()
	defer d.mu.Unlock()

	d.activeConns[id] = &connectionInfo{
		id:         id,
		acquiredAt: time.Now(),
		stack:      captureStack(3), // 跳过 TrackAcquire 和调用者
	}

	return id
}

// TrackRelease 追踪连接释放
func (d *LeakDetector) TrackRelease(id int64) {
	if !d.IsEnabled() || id == 0 {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	delete(d.activeConns, id)
}

// CheckLeaks 检查泄漏
func (d *LeakDetector) CheckLeaks() []ConnectionLeak {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	var leaks []ConnectionLeak

	for _, conn := range d.activeConns {
		duration := now.Sub(conn.acquiredAt)
		if duration > d.leakThreshold {
			leak := ConnectionLeak{
				AcquiredAt: conn.acquiredAt,
				Duration:   duration,
				Stack:      conn.stack,
				ID:         conn.id,
			}
			leaks = append(leaks, leak)

			// 记录到历史
			if len(d.leaks) < d.maxLeaks {
				d.leaks = append(d.leaks, leak)
			}
		}
	}

	return leaks
}

// GetActiveCount 获取活跃连接数
func (d *LeakDetector) GetActiveCount() int {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return len(d.activeConns)
}

// GetLeakHistory 获取泄漏历史
func (d *LeakDetector) GetLeakHistory() []ConnectionLeak {
	d.mu.RLock()
	defer d.mu.RUnlock()

	result := make([]ConnectionLeak, len(d.leaks))
	copy(result, d.leaks)
	return result
}

// ClearHistory 清除泄漏历史
func (d *LeakDetector) ClearHistory() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.leaks = nil
}

// Reset 重置检测器
func (d *LeakDetector) Reset() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.activeConns = make(map[int64]*connectionInfo)
	d.leaks = nil
}

// captureStack 捕获调用栈
func captureStack(skip int) string {
	const maxFrames = 10
	pc := make([]uintptr, maxFrames)
	n := runtime.Callers(skip+1, pc)
	if n == 0 {
		return ""
	}

	frames := runtime.CallersFrames(pc[:n])
	var result string
	for {
		frame, more := frames.Next()
		result += fmt.Sprintf("%s\n\t%s:%d\n", frame.Function, frame.File, frame.Line)
		if !more {
			break
		}
	}
	return result
}

// PoolMonitor 连接池监控器
type PoolMonitor struct {
	db            *sql.DB
	leakDetector  *LeakDetector
	checkInterval time.Duration
	onLeak        func([]ConnectionLeak)
	stopCh        chan struct{}
	wg            sync.WaitGroup
}

// NewPoolMonitor 创建新的连接池监控器
func NewPoolMonitor(db *sql.DB, leakThreshold, checkInterval time.Duration) *PoolMonitor {
	if checkInterval <= 0 {
		checkInterval = 10 * time.Second
	}

	return &PoolMonitor{
		db:            db,
		leakDetector:  NewLeakDetector(leakThreshold),
		checkInterval: checkInterval,
		stopCh:        make(chan struct{}),
	}
}

// OnLeak 设置泄漏回调
func (m *PoolMonitor) OnLeak(callback func([]ConnectionLeak)) {
	m.onLeak = callback
}

// Start 启动监控
func (m *PoolMonitor) Start(ctx context.Context) {
	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		ticker := time.NewTicker(m.checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-m.stopCh:
				return
			case <-ticker.C:
				leaks := m.leakDetector.CheckLeaks()
				if len(leaks) > 0 && m.onLeak != nil {
					m.onLeak(leaks)
				}
			}
		}
	}()
}

// Stop 停止监控
func (m *PoolMonitor) Stop() {
	close(m.stopCh)
	m.wg.Wait()
}

// GetStats 获取连接池统计
func (m *PoolMonitor) GetStats() PoolStats {
	return GetPoolStats(m.db)
}

// GetLeakDetector 获取泄漏检测器
func (m *PoolMonitor) GetLeakDetector() *LeakDetector {
	return m.leakDetector
}

// TrackAcquire 追踪连接获取
func (m *PoolMonitor) TrackAcquire() int64 {
	return m.leakDetector.TrackAcquire()
}

// TrackRelease 追踪连接释放
func (m *PoolMonitor) TrackRelease(id int64) {
	m.leakDetector.TrackRelease(id)
}
