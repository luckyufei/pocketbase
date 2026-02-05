package analytics

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// mockRepository 用于测试的 mock Repository 实现
type mockRepository struct {
	mu              sync.Mutex
	dailyStats      map[string]*DailyStat
	sourceStats     map[string]*SourceStat
	deviceStats     map[string]*DeviceStat
	upsertDailyErr  error
	upsertSourceErr error
	upsertDeviceErr error
	callCount       atomic.Int32
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		dailyStats:  make(map[string]*DailyStat),
		sourceStats: make(map[string]*SourceStat),
		deviceStats: make(map[string]*DeviceStat),
	}
}

func (m *mockRepository) UpsertDaily(ctx context.Context, stat *DailyStat) error {
	m.callCount.Add(1)
	if m.upsertDailyErr != nil {
		return m.upsertDailyErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.dailyStats[stat.ID] = stat
	return nil
}

func (m *mockRepository) UpsertSource(ctx context.Context, stat *SourceStat) error {
	m.callCount.Add(1)
	if m.upsertSourceErr != nil {
		return m.upsertSourceErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sourceStats[stat.ID] = stat
	return nil
}

func (m *mockRepository) UpsertDevice(ctx context.Context, stat *DeviceStat) error {
	m.callCount.Add(1)
	if m.upsertDeviceErr != nil {
		return m.upsertDeviceErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deviceStats[stat.ID] = stat
	return nil
}

func (m *mockRepository) GetDailyStats(ctx context.Context, startDate, endDate string) ([]*DailyStat, error) {
	return nil, nil
}

func (m *mockRepository) GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*DailyStat, error) {
	return nil, nil
}

func (m *mockRepository) GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*SourceStat, error) {
	return nil, nil
}

func (m *mockRepository) GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*DeviceStat, error) {
	return nil, nil
}

func (m *mockRepository) GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error) {
	return nil, nil
}

func (m *mockRepository) DeleteBefore(ctx context.Context, date string) error {
	return nil
}

func (m *mockRepository) Close() error {
	return nil
}

// TestNewFlusher 测试创建 Flusher
func TestNewFlusher(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)

	if flusher == nil {
		t.Fatal("NewFlusher returned nil")
	}
	if flusher.buffer != buffer {
		t.Error("buffer not set correctly")
	}
	if flusher.repository != repo {
		t.Error("repository not set correctly")
	}
	if flusher.config != &config {
		t.Error("config not set correctly")
	}
}

// TestFlusherStartStop 测试 Flusher 启动和停止
func TestFlusherStartStop(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()
	config.FlushInterval = 50 * time.Millisecond

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 启动
	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// 确认已运行
	if !flusher.running {
		t.Error("flusher should be running after Start")
	}

	// 重复启动应该是 no-op
	err = flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Second Start should succeed: %v", err)
	}

	// 停止
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Stop failed: %v", err)
	}

	// 确认已停止
	if flusher.running {
		t.Error("flusher should not be running after Stop")
	}

	// 重复停止应该是 no-op
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Second Stop should succeed: %v", err)
	}
}

// TestFlusherFlush 测试立即刷新
func TestFlusherFlush(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件到 buffer
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	// 刷新
	err := flusher.Flush(ctx)
	if err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	// 验证数据已写入
	if len(repo.dailyStats) != 1 {
		t.Errorf("expected 1 daily stat, got %d", len(repo.dailyStats))
	}
}

// TestFlusherFlushNilBuffer 测试 nil buffer 时的刷新
func TestFlusherFlushNilBuffer(t *testing.T) {
	flusher := &Flusher{}
	ctx := context.Background()

	err := flusher.Flush(ctx)
	if err != nil {
		t.Fatalf("Flush with nil buffer should not error: %v", err)
	}
}

// TestFlusherFlushNilRepository 测试 nil repository 时的刷新
func TestFlusherFlushNilRepository(t *testing.T) {
	buffer := NewBuffer(1024)
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, nil, &config)
	ctx := context.Background()

	// 添加事件到 buffer
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.Flush(ctx)
	if err != nil {
		t.Fatalf("Flush with nil repository should not error: %v", err)
	}
}

// TestFlusherFlushWithRetry 测试带重试的刷新
func TestFlusherFlushWithRetry(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件到 buffer
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.FlushWithRetry(ctx, 3, 10*time.Millisecond)
	if err != nil {
		t.Fatalf("FlushWithRetry failed: %v", err)
	}

	// 验证数据已写入
	if len(repo.dailyStats) != 1 {
		t.Errorf("expected 1 daily stat, got %d", len(repo.dailyStats))
	}
}

// TestFlusherFlushWithRetryNilBuffer 测试 nil buffer 时的重试刷新
func TestFlusherFlushWithRetryNilBuffer(t *testing.T) {
	repo := newMockRepository()
	flusher := &Flusher{repository: repo}
	ctx := context.Background()

	err := flusher.FlushWithRetry(ctx, 3, 10*time.Millisecond)
	if err != nil {
		t.Fatalf("FlushWithRetry with nil buffer should not error: %v", err)
	}
}

// TestFlusherFlushWithRetryNilRepository 测试 nil repository 时的重试刷新
func TestFlusherFlushWithRetryNilRepository(t *testing.T) {
	buffer := NewBuffer(1024)
	flusher := &Flusher{buffer: buffer}
	ctx := context.Background()

	err := flusher.FlushWithRetry(ctx, 3, 10*time.Millisecond)
	if err != nil {
		t.Fatalf("FlushWithRetry with nil repository should not error: %v", err)
	}
}

// TestFlusherFlushWithRetryError 测试重试失败
func TestFlusherFlushWithRetryError(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	repo.upsertDailyErr = errors.New("database error")
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件到 buffer
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.FlushWithRetry(ctx, 2, 10*time.Millisecond)
	if err == nil {
		t.Fatal("FlushWithRetry should have failed")
	}

	// 验证数据被放回 buffer（以便下次重试）
	aggs := buffer.DrainAggregations()
	if len(aggs) != 1 {
		t.Errorf("expected aggregations to be restored, got %d", len(aggs))
	}
}

// TestFlusherFlushWithRetryContextCancel 测试 context 取消时的重试
func TestFlusherFlushWithRetryContextCancel(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	repo.upsertDailyErr = errors.New("database error")
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx, cancel := context.WithCancel(context.Background())

	// 添加事件到 buffer
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	// 在短时间后取消 context
	go func() {
		time.Sleep(5 * time.Millisecond)
		cancel()
	}()

	err := flusher.FlushWithRetry(ctx, 10, 50*time.Millisecond)
	if err == nil {
		t.Fatal("FlushWithRetry should have failed due to context cancel")
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled error, got %v", err)
	}

	// 验证数据被放回 buffer
	aggs := buffer.DrainAggregations()
	if len(aggs) != 1 {
		t.Errorf("expected aggregations to be restored, got %d", len(aggs))
	}
}

// TestFlusherFlushEmptyBuffer 测试空 buffer 的刷新
func TestFlusherFlushEmptyBuffer(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	err := flusher.FlushWithRetry(ctx, 3, 10*time.Millisecond)
	if err != nil {
		t.Fatalf("FlushWithRetry with empty buffer should not error: %v", err)
	}

	// 验证没有数据被写入
	if len(repo.dailyStats) != 0 {
		t.Errorf("expected 0 daily stats, got %d", len(repo.dailyStats))
	}
}

// TestFlusherSourceStats 测试来源统计的刷新
func TestFlusherSourceStats(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件到 buffer，包含来源信息
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Referrer:  "https://google.com/search",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.Flush(ctx)
	if err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	// 验证来源数据已写入
	if len(repo.sourceStats) != 1 {
		t.Errorf("expected 1 source stat, got %d", len(repo.sourceStats))
	}
}

// TestFlusherDeviceStats 测试设备统计的刷新
func TestFlusherDeviceStats(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件到 buffer，包含设备信息
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Browser:   "Chrome",
		OS:        "Windows",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.Flush(ctx)
	if err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	// 验证设备数据已写入
	if len(repo.deviceStats) != 1 {
		t.Errorf("expected 1 device stat, got %d", len(repo.deviceStats))
	}
}

// TestFlusherAutoFlush 测试自动定时刷新
func TestFlusherAutoFlush(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()
	config.FlushInterval = 50 * time.Millisecond

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	// 启动
	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// 等待自动刷新
	time.Sleep(100 * time.Millisecond)

	// 停止
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Stop failed: %v", err)
	}

	// 验证数据已写入
	if len(repo.dailyStats) != 1 {
		t.Errorf("expected 1 daily stat after auto flush, got %d", len(repo.dailyStats))
	}
}

// TestFlusherDefaultInterval 测试默认刷新间隔
func TestFlusherDefaultInterval(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()
	config.FlushInterval = 0 // 使用默认值

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// 验证已启动
	if !flusher.running {
		t.Error("flusher should be running")
	}

	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Stop failed: %v", err)
	}
}

// TestGenerateID 测试 ID 生成
func TestGenerateID(t *testing.T) {
	tests := []struct {
		date     string
		key      string
		expected string
	}{
		{"2026-01-09", "/home", "2026-01-09|/home"},
		{"2026-01-09", "google.com", "2026-01-09|google.com"},
		{"2026-01-09", "Chrome|Windows", "2026-01-09|Chrome|Windows"},
		{"", "", "|"},
	}

	for _, tt := range tests {
		result := generateID(tt.date, tt.key)
		if result != tt.expected {
			t.Errorf("generateID(%q, %q) = %q, want %q", tt.date, tt.key, result, tt.expected)
		}
	}
}

// TestFlusherFlushSourceError 测试来源统计写入错误
func TestFlusherFlushSourceError(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	repo.upsertSourceErr = errors.New("source error")
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加带来源的事件
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Referrer:  "https://google.com",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.Flush(ctx)
	if err == nil {
		t.Fatal("Flush should have failed with source error")
	}
}

// TestFlusherFlushDeviceError 测试设备统计写入错误
func TestFlusherFlushDeviceError(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	repo.upsertDeviceErr = errors.New("device error")
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加带设备信息的事件
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Browser:   "Chrome",
		OS:        "Windows",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	err := flusher.Flush(ctx)
	if err == nil {
		t.Fatal("Flush should have failed with device error")
	}
}

// TestFlusherRunContextCancel 测试 context 取消时的运行循环
func TestFlusherRunContextCancel(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()
	config.FlushInterval = 100 * time.Millisecond

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx, cancel := context.WithCancel(context.Background())

	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// 取消 context
	cancel()

	// 等待一小段时间让循环退出
	time.Sleep(50 * time.Millisecond)

	// 确认可以再次停止（应该是 no-op）
	err = flusher.Stop(context.Background())
	if err != nil {
		t.Fatalf("Stop should succeed: %v", err)
	}
}

// TestFlusherFlushRawToParquet 测试 Parquet 刷新（目前是 TODO，只验证不 panic）
func TestFlusherFlushRawToParquet(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 添加事件到 buffer
	event := &Event{
		Path:      "/home",
		SessionID: "session1",
		Timestamp: time.Now(),
	}
	buffer.Push(event)

	// 调用 flushRawToParquet（私有方法，通过反射测试或直接调用）
	err := flusher.flushRawToParquet(ctx)
	if err != nil {
		t.Fatalf("flushRawToParquet failed: %v", err)
	}

	// 验证 buffer 被清空
	if buffer.Len() != 0 {
		t.Errorf("Expected buffer to be drained, got %d events", buffer.Len())
	}
}

// TestFlusherFlushRawToParquetEmpty 测试空 buffer 的 Parquet 刷新
func TestFlusherFlushRawToParquetEmpty(t *testing.T) {
	buffer := NewBuffer(1024)
	repo := newMockRepository()
	config := DefaultConfig()

	flusher := NewFlusher(nil, buffer, repo, &config)
	ctx := context.Background()

	// 空 buffer 调用应该成功
	err := flusher.flushRawToParquet(ctx)
	if err != nil {
		t.Fatalf("flushRawToParquet with empty buffer failed: %v", err)
	}
}
