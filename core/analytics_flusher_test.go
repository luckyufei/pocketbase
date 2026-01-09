package core

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// mockAnalyticsRepository 是用于测试的 mock repository
type mockAnalyticsRepository struct {
	mu                 sync.Mutex
	dailyStats         map[string]*AnalyticsDailyStat
	sourceStats        map[string]*AnalyticsSourceStat
	deviceStats        map[string]*AnalyticsDeviceStat
	upsertErr          error
	upsertCount        int
	deleteBeforeCalled bool
	deleteBeforeDate   string
}

func newMockAnalyticsRepository() *mockAnalyticsRepository {
	return &mockAnalyticsRepository{
		dailyStats:  make(map[string]*AnalyticsDailyStat),
		sourceStats: make(map[string]*AnalyticsSourceStat),
		deviceStats: make(map[string]*AnalyticsDeviceStat),
	}
}

func (m *mockAnalyticsRepository) UpsertDaily(ctx context.Context, stat *AnalyticsDailyStat) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.upsertErr != nil {
		return m.upsertErr
	}
	m.upsertCount++
	if existing, ok := m.dailyStats[stat.ID]; ok {
		existing.TotalPV += stat.TotalPV
		existing.Visitors += stat.Visitors
	} else {
		m.dailyStats[stat.ID] = stat
	}
	return nil
}

func (m *mockAnalyticsRepository) UpsertSource(ctx context.Context, stat *AnalyticsSourceStat) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.upsertErr != nil {
		return m.upsertErr
	}
	m.upsertCount++
	if existing, ok := m.sourceStats[stat.ID]; ok {
		existing.Visitors += stat.Visitors
	} else {
		m.sourceStats[stat.ID] = stat
	}
	return nil
}

func (m *mockAnalyticsRepository) UpsertDevice(ctx context.Context, stat *AnalyticsDeviceStat) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.upsertErr != nil {
		return m.upsertErr
	}
	m.upsertCount++
	if existing, ok := m.deviceStats[stat.ID]; ok {
		existing.Visitors += stat.Visitors
	} else {
		m.deviceStats[stat.ID] = stat
	}
	return nil
}

func (m *mockAnalyticsRepository) GetDailyStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDailyStat, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []*AnalyticsDailyStat
	for _, stat := range m.dailyStats {
		if stat.Date >= startDate && stat.Date <= endDate {
			result = append(result, stat)
		}
	}
	return result, nil
}

func (m *mockAnalyticsRepository) GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsDailyStat, error) {
	return m.GetDailyStats(ctx, startDate, endDate)
}

func (m *mockAnalyticsRepository) GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsSourceStat, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []*AnalyticsSourceStat
	for _, stat := range m.sourceStats {
		if stat.Date >= startDate && stat.Date <= endDate {
			result = append(result, stat)
		}
	}
	return result, nil
}

func (m *mockAnalyticsRepository) GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDeviceStat, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []*AnalyticsDeviceStat
	for _, stat := range m.deviceStats {
		if stat.Date >= startDate && stat.Date <= endDate {
			result = append(result, stat)
		}
	}
	return result, nil
}

func (m *mockAnalyticsRepository) GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error) {
	return nil, nil
}

func (m *mockAnalyticsRepository) DeleteBefore(ctx context.Context, date string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleteBeforeCalled = true
	m.deleteBeforeDate = date
	for id, stat := range m.dailyStats {
		if stat.Date < date {
			delete(m.dailyStats, id)
		}
	}
	for id, stat := range m.sourceStats {
		if stat.Date < date {
			delete(m.sourceStats, id)
		}
	}
	for id, stat := range m.deviceStats {
		if stat.Date < date {
			delete(m.deviceStats, id)
		}
	}
	return nil
}

func (m *mockAnalyticsRepository) Close() error {
	return nil
}

// 确保 mock 实现了接口
var _ AnalyticsRepository = (*mockAnalyticsRepository)(nil)

func TestAnalyticsFlusher_FlushAggregations(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024) // 16MB
	repo := newMockAnalyticsRepository()
	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	// 添加一些测试事件
	events := []*AnalyticsEvent{
		{
			Path:      "/home",
			Referrer:  "https://google.com/search",
			Browser:   "Chrome",
			OS:        "Windows",
			SessionID: "session1",
			Event:     "page_view",
			Timestamp: time.Now(),
		},
		{
			Path:      "/home",
			Referrer:  "https://google.com/search",
			Browser:   "Chrome",
			OS:        "Windows",
			SessionID: "session2",
			Event:     "page_view",
			Timestamp: time.Now(),
		},
		{
			Path:      "/about",
			Referrer:  "",
			Browser:   "Firefox",
			OS:        "MacOS",
			SessionID: "session3",
			Event:     "page_view",
			Timestamp: time.Now(),
		},
	}

	for _, e := range events {
		buffer.Push(e)
	}

	// 执行 flush
	ctx := context.Background()
	err := flusher.Flush(ctx)
	if err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	// 验证聚合数据已写入
	if len(repo.dailyStats) == 0 {
		t.Error("Expected daily stats to be written")
	}

	if len(repo.sourceStats) == 0 {
		t.Error("Expected source stats to be written")
	}

	if len(repo.deviceStats) == 0 {
		t.Error("Expected device stats to be written")
	}

	// 验证 buffer 已清空
	if buffer.AggregationCount() != 0 {
		t.Errorf("Expected buffer to be empty, got %d aggregations", buffer.AggregationCount())
	}
}

func TestAnalyticsFlusher_StartStop(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:       true,
		FlushInterval: 1, // 1 秒
	}
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024) // 16MB
	repo := newMockAnalyticsRepository()
	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	ctx := context.Background()

	// 启动 flusher
	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// 添加事件
	buffer.Push(&AnalyticsEvent{
		Path:      "/test",
		Browser:   "Chrome",
		OS:        "Windows",
		SessionID: "session1",
		Event:     "page_view",
		Timestamp: time.Now(),
	})

	// 等待 flush 执行
	time.Sleep(1500 * time.Millisecond)

	// 停止 flusher
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Stop failed: %v", err)
	}

	// 验证数据已写入
	if repo.upsertCount == 0 {
		t.Error("Expected upsert to be called")
	}
}

func TestAnalyticsFlusher_FlushWithNilBuffer(t *testing.T) {
	config := DefaultAnalyticsConfig()
	flusher := NewAnalyticsFlusher(nil, nil, nil, config)

	ctx := context.Background()
	err := flusher.Flush(ctx)
	if err != nil {
		t.Errorf("Flush with nil buffer should not error, got: %v", err)
	}
}

func TestAnalyticsFlusher_FlushWithNilRepository(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024)
	flusher := NewAnalyticsFlusher(nil, buffer, nil, config)

	// 添加事件
	buffer.Push(&AnalyticsEvent{
		Path:      "/test",
		Browser:   "Chrome",
		OS:        "Windows",
		SessionID: "session1",
		Event:     "page_view",
		Timestamp: time.Now(),
	})

	ctx := context.Background()
	err := flusher.Flush(ctx)
	if err != nil {
		t.Errorf("Flush with nil repository should not error, got: %v", err)
	}
}

func TestAnalyticsFlusher_DoubleStart(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024)
	repo := newMockAnalyticsRepository()
	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	ctx := context.Background()

	// 第一次启动
	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("First start failed: %v", err)
	}

	// 第二次启动应该是 no-op
	err = flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Second start failed: %v", err)
	}

	// 停止
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Stop failed: %v", err)
	}
}

func TestAnalyticsFlusher_DoubleStop(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024)
	repo := newMockAnalyticsRepository()
	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	ctx := context.Background()

	// 启动
	err := flusher.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// 第一次停止
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("First stop failed: %v", err)
	}

	// 第二次停止应该是 no-op
	err = flusher.Stop(ctx)
	if err != nil {
		t.Fatalf("Second stop failed: %v", err)
	}
}

func TestGenerateAnalyticsID(t *testing.T) {
	tests := []struct {
		date string
		key  string
		want string
	}{
		{"2026-01-09", "/home", "2026-01-09|/home"},
		{"2026-01-09", "google.com", "2026-01-09|google.com"},
		{"2026-01-09", "", "2026-01-09|"},
	}

	for _, tt := range tests {
		got := generateAnalyticsID(tt.date, tt.key)
		if got != tt.want {
			t.Errorf("generateAnalyticsID(%q, %q) = %q, want %q", tt.date, tt.key, got, tt.want)
		}
	}
}

// retryMockRepository 是用于测试重试逻辑的 mock repository
type retryMockRepository struct {
	mu            sync.Mutex
	dailyStats    map[string]*AnalyticsDailyStat
	sourceStats   map[string]*AnalyticsSourceStat
	deviceStats   map[string]*AnalyticsDeviceStat
	failCount     int32 // 前 N 次调用会失败
	currentCount  int32
	failErr       error
	upsertCount   int
}

func newRetryMockRepository(failCount int, failErr error) *retryMockRepository {
	return &retryMockRepository{
		dailyStats:  make(map[string]*AnalyticsDailyStat),
		sourceStats: make(map[string]*AnalyticsSourceStat),
		deviceStats: make(map[string]*AnalyticsDeviceStat),
		failCount:   int32(failCount),
		failErr:     failErr,
	}
}

func (m *retryMockRepository) UpsertDaily(ctx context.Context, stat *AnalyticsDailyStat) error {
	count := atomic.AddInt32(&m.currentCount, 1)
	if count <= m.failCount {
		return m.failErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.upsertCount++
	m.dailyStats[stat.ID] = stat
	return nil
}

func (m *retryMockRepository) UpsertSource(ctx context.Context, stat *AnalyticsSourceStat) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sourceStats[stat.ID] = stat
	return nil
}

func (m *retryMockRepository) UpsertDevice(ctx context.Context, stat *AnalyticsDeviceStat) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deviceStats[stat.ID] = stat
	return nil
}

func (m *retryMockRepository) GetDailyStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDailyStat, error) {
	return nil, nil
}

func (m *retryMockRepository) GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsDailyStat, error) {
	return nil, nil
}

func (m *retryMockRepository) GetTopSources(ctx context.Context, startDate, endDate string, limit int) ([]*AnalyticsSourceStat, error) {
	return nil, nil
}

func (m *retryMockRepository) GetDeviceStats(ctx context.Context, startDate, endDate string) ([]*AnalyticsDeviceStat, error) {
	return nil, nil
}

func (m *retryMockRepository) GetDailyHLLSketches(ctx context.Context, startDate, endDate string) ([][]byte, error) {
	return nil, nil
}

func (m *retryMockRepository) DeleteBefore(ctx context.Context, date string) error {
	return nil
}

func (m *retryMockRepository) Close() error {
	return nil
}

var _ AnalyticsRepository = (*retryMockRepository)(nil)

func TestAnalyticsFlusher_FlushWithRetry(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024)

	// 创建一个会失败 2 次然后成功的 mock repository
	tempErr := errors.New("temporary error")
	repo := newRetryMockRepository(2, tempErr)

	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	// 添加测试事件
	buffer.Push(&AnalyticsEvent{
		Path:      "/test",
		Browser:   "Chrome",
		OS:        "Windows",
		SessionID: "session1",
		Event:     "page_view",
		Timestamp: time.Now(),
	})

	ctx := context.Background()

	// FlushWithRetry 应该在重试后成功
	err := flusher.FlushWithRetry(ctx, 3, 10*time.Millisecond)
	if err != nil {
		t.Errorf("FlushWithRetry should succeed after retries, got: %v", err)
	}

	// 验证数据最终被写入（第 3 次尝试成功）
	if len(repo.dailyStats) == 0 {
		t.Error("Expected daily stats to be written after retries")
	}

	// 验证重试次数
	if atomic.LoadInt32(&repo.currentCount) != 3 {
		t.Errorf("Expected 3 UpsertDaily calls (2 failures + 1 success), got %d", repo.currentCount)
	}
}

func TestAnalyticsFlusher_FlushWithRetry_AllFail(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024)

	// 创建一个总是失败的 mock repository
	persistentErr := errors.New("persistent error")
	repo := newRetryMockRepository(100, persistentErr)

	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	// 添加测试事件
	buffer.Push(&AnalyticsEvent{
		Path:      "/test",
		Browser:   "Chrome",
		OS:        "Windows",
		SessionID: "session1",
		Event:     "page_view",
		Timestamp: time.Now(),
	})

	ctx := context.Background()

	// FlushWithRetry 应该在所有重试失败后返回错误
	err := flusher.FlushWithRetry(ctx, 3, 10*time.Millisecond)
	if err == nil {
		t.Error("FlushWithRetry should fail when all retries exhausted")
	}

	// 验证数据被放回 buffer
	if buffer.AggregationCount() == 0 {
		t.Error("Expected data to be restored to buffer after all retries failed")
	}
}

func TestAnalyticsFlusher_FlushWithRetry_ContextCancelled(t *testing.T) {
	config := DefaultAnalyticsConfig()
	buffer := NewAnalyticsBuffer(16 * 1024 * 1024)

	// 创建一个总是失败的 mock repository
	persistentErr := errors.New("persistent error")
	repo := newRetryMockRepository(100, persistentErr)

	flusher := NewAnalyticsFlusher(nil, buffer, repo, config)

	// 添加测试事件
	buffer.Push(&AnalyticsEvent{
		Path:      "/test",
		Browser:   "Chrome",
		OS:        "Windows",
		SessionID: "session1",
		Event:     "page_view",
		Timestamp: time.Now(),
	})

	// 创建一个已取消的 context
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// FlushWithRetry 应该立即返回 context 错误
	err := flusher.FlushWithRetry(ctx, 3, 100*time.Millisecond)
	if err == nil {
		t.Error("FlushWithRetry should fail with cancelled context")
	}
}
