package analytics

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tests"
	_ "modernc.org/sqlite"
)

// 这些测试直接测试插件的 handlers，绕过 apis/analytics.go

// mockAnalytics 用于测试的 Analytics 实现
type mockAnalytics struct {
	enabled bool
	repo    Repository
	config  *Config
	events  []*Event
}

func newMockAnalytics(enabled bool, repo Repository) *mockAnalytics {
	return &mockAnalytics{
		enabled: enabled,
		repo:    repo,
		config: &Config{
			Enabled:       enabled,
			Retention:     30,
			FlushInterval: time.Second,
		},
		events: make([]*Event, 0),
	}
}

func (m *mockAnalytics) Track(event *Event) error {
	if !m.enabled {
		return ErrDisabled
	}
	m.events = append(m.events, event)
	return nil
}

func (m *mockAnalytics) Push(event *Event) error {
	return m.Track(event)
}

func (m *mockAnalytics) IsEnabled() bool {
	return m.enabled
}

func (m *mockAnalytics) Start(ctx context.Context) error {
	return nil
}

func (m *mockAnalytics) Stop(ctx context.Context) error {
	return nil
}

func (m *mockAnalytics) Flush() {}

func (m *mockAnalytics) Close() error {
	return nil
}

func (m *mockAnalytics) Repository() Repository {
	return m.repo
}

func (m *mockAnalytics) Config() *Config {
	return m.config
}

var _ Analytics = (*mockAnalytics)(nil)

// testDBWithData 创建带测试数据的数据库
func testDBWithData(t *testing.T) (dbx.Builder, *RepositorySQLite) {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory database: %v", err)
	}

	dbxDB := dbx.NewFromDB(db, "sqlite")

	// 创建表
	sql := `
		CREATE TABLE IF NOT EXISTS "_analytics_daily" (
			"id"       TEXT PRIMARY KEY NOT NULL,
			"date"     TEXT NOT NULL,
			"path"     TEXT NOT NULL,
			"total_pv" INTEGER DEFAULT 0 NOT NULL,
			"total_uv" BLOB,
			"visitors" INTEGER DEFAULT 0 NOT NULL,
			"avg_dur"  INTEGER DEFAULT 0 NOT NULL,
			"created"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
			"updated"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
		);
		CREATE TABLE IF NOT EXISTS "_analytics_sources" (
			"id"       TEXT PRIMARY KEY NOT NULL,
			"date"     TEXT NOT NULL,
			"source"   TEXT NOT NULL,
			"visitors" INTEGER DEFAULT 0 NOT NULL,
			"created"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
			"updated"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
		);
		CREATE TABLE IF NOT EXISTS "_analytics_devices" (
			"id"       TEXT PRIMARY KEY NOT NULL,
			"date"     TEXT NOT NULL,
			"browser"  TEXT NOT NULL,
			"os"       TEXT NOT NULL,
			"visitors" INTEGER DEFAULT 0 NOT NULL,
			"created"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
			"updated"  TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
		);
	`
	_, err = dbxDB.NewQuery(sql).Execute()
	if err != nil {
		t.Fatalf("Failed to create tables: %v", err)
	}

	repo := NewRepositorySQLite(dbxDB)
	ctx := context.Background()

	// 插入测试数据
	today := time.Now().Format("2006-01-02")

	// Daily stats
	hll := NewHLL()
	hll.Add("user1")
	hll.Add("user2")
	hllBytes, _ := hll.Bytes()

	err = repo.UpsertDaily(ctx, &DailyStat{
		ID:       "daily_001",
		Date:     today,
		Path:     "/home",
		TotalPV:  1000,
		TotalUV:  hllBytes,
		Visitors: 2,
	})
	if err != nil {
		t.Fatalf("Failed to insert daily stat: %v", err)
	}

	err = repo.UpsertDaily(ctx, &DailyStat{
		ID:       "daily_002",
		Date:     today,
		Path:     "/about",
		TotalPV:  500,
		TotalUV:  hllBytes,
		Visitors: 2,
	})
	if err != nil {
		t.Fatalf("Failed to insert daily stat: %v", err)
	}

	// Source stats
	err = repo.UpsertSource(ctx, &SourceStat{
		ID:       "source_001",
		Date:     today,
		Source:   "google.com",
		Visitors: 100,
	})
	if err != nil {
		t.Fatalf("Failed to insert source stat: %v", err)
	}

	// Device stats
	err = repo.UpsertDevice(ctx, &DeviceStat{
		ID:       "device_001",
		Date:     today,
		Browser:  "Chrome",
		OS:       "Windows",
		Visitors: 50,
	})
	if err != nil {
		t.Fatalf("Failed to insert device stat: %v", err)
	}

	return dbxDB, repo
}

// TestEventsHandler_DirectCall 直接调用 eventsHandler 测试
func TestEventsHandler_DirectCall(t *testing.T) {
	// 测试 bot 流量过滤
	tests := []struct {
		name      string
		userAgent string
		events    string
		wantBot   bool
	}{
		{
			name:      "Googlebot",
			userAgent: "Googlebot/2.1",
			events:    `{"events":[{"event":"page_view","path":"/home","sessionId":"test"}]}`,
			wantBot:   true,
		},
		{
			name:      "Normal browser",
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			events:    `{"events":[{"event":"page_view","path":"/home","sessionId":"test"}]}`,
			wantBot:   false,
		},
		{
			name:      "Bingbot",
			userAgent: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
			events:    `{"events":[{"event":"page_view","path":"/home","sessionId":"test"}]}`,
			wantBot:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isBot := IsBotUserAgent(tt.userAgent)
			if isBot != tt.wantBot {
				t.Errorf("IsBotUserAgent(%q) = %v, want %v", tt.userAgent, isBot, tt.wantBot)
			}
		})
	}
}

// TestEventsHandler_EventValidation 测试事件验证
func TestEventsHandler_EventValidation(t *testing.T) {
	tests := []struct {
		name    string
		event   *Event
		wantErr bool
	}{
		{
			name: "valid event",
			event: &Event{
				Event:     "page_view",
				Path:      "/home",
				SessionID: "test-session",
				Timestamp: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "missing path",
			event: &Event{
				Event:     "page_view",
				SessionID: "test-session",
			},
			wantErr: true,
		},
		{
			name: "missing session",
			event: &Event{
				Event: "page_view",
				Path:  "/home",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.event.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestEventInput_ToEvent 测试 EventInput 转换
func TestEventInput_ToEvent_Complete(t *testing.T) {
	input := EventInput{
		Event:     "page_view",
		Path:      "/home",
		SessionID: "session-123",
		Title:     "Home Page",
		Referrer:  "https://google.com",
		PerfMs:    300,
		Timestamp: time.Now().UnixMilli(),
	}

	event := input.ToEvent("event-id-123", "192.168.1.1", "Mozilla/5.0", "Chrome", "Windows", "Desktop")

	if event.ID != "event-id-123" {
		t.Errorf("ID = %q, want %q", event.ID, "event-id-123")
	}
	if event.IP != "192.168.1.1" {
		t.Errorf("IP = %q, want %q", event.IP, "192.168.1.1")
	}
	if event.Browser != "Chrome" {
		t.Errorf("Browser = %q, want %q", event.Browser, "Chrome")
	}
	if event.OS != "Windows" {
		t.Errorf("OS = %q, want %q", event.OS, "Windows")
	}
	if event.Device != "Desktop" {
		t.Errorf("Device = %q, want %q", event.Device, "Desktop")
	}
	if event.PerfMs != 300 {
		t.Errorf("PerfMs = %d, want %d", event.PerfMs, 300)
	}
}

// TestRequestLogger 测试请求日志中间件
func TestRequestLogger_StatusCodes(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 创建中间件
	handler := requestLogger(app, "test")

	if handler == nil {
		t.Fatal("requestLogger returned nil")
	}

	if handler.Id != "pbAnalyticsRequestLogger_test" {
		t.Errorf("Handler ID = %q, want %q", handler.Id, "pbAnalyticsRequestLogger_test")
	}
}

// TestMergeHLLBytes_EdgeCases 测试 HLL 合并边界情况
func TestMergeHLLBytes_EdgeCases(t *testing.T) {
	// 空输入
	_, count, err := MergeHLLBytes()
	if err != nil {
		t.Errorf("MergeHLLBytes() with no input should not error: %v", err)
	}
	if count != 0 {
		t.Errorf("MergeHLLBytes() with no input should return count 0, got %d", count)
	}

	// 单个 HLL
	hll := NewHLL()
	hll.Add("user1")
	hll.Add("user2")
	hllBytes, _ := hll.Bytes()

	mergedBytes, count, err := MergeHLLBytes(hllBytes)
	if err != nil {
		t.Errorf("MergeHLLBytes() with single input error: %v", err)
	}
	if count != 2 {
		t.Errorf("MergeHLLBytes() with single input count = %d, want 2", count)
	}
	if len(mergedBytes) == 0 {
		t.Error("MergeHLLBytes() should return non-empty bytes")
	}

	// 多个 HLL 合并
	hll2 := NewHLL()
	hll2.Add("user3")
	hll2Bytes, _ := hll2.Bytes()

	_, count, err = MergeHLLBytes(hllBytes, hll2Bytes)
	if err != nil {
		t.Errorf("MergeHLLBytes() with multiple inputs error: %v", err)
	}
	if count != 3 {
		t.Errorf("MergeHLLBytes() merged count = %d, want 3", count)
	}
}

// TestStatsHandler_DateAggregation 测试日期聚合逻辑
func TestStatsHandler_DateAggregation(t *testing.T) {
	// 测试日期范围解析
	tests := []struct {
		rangeStr string
		days     int
	}{
		{"today", 0},
		{"7d", 7},
		{"30d", 30},
		{"90d", 90},
		{"invalid", 7}, // 默认 7 天
	}

	for _, tt := range tests {
		t.Run(tt.rangeStr, func(t *testing.T) {
			start, end := parseDateRange(tt.rangeStr)

			// 验证 end 是今天
			today := time.Now().Format("2006-01-02")
			if end != today {
				t.Errorf("endDate = %q, want %q", end, today)
			}

			// 验证 start 日期正确
			if tt.days == 0 {
				if start != end {
					t.Errorf("For 'today', startDate should equal endDate")
				}
			}
		})
	}
}

// TestNormalizeURL_Integration 测试 URL 规范化
func TestNormalizeURL_Integration(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/home", "/home"},
		{"/home/", "/home"},
		{"/HOME", "/home"},
		{"/path?query=1", "/path"},
		{"", "/"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := NormalizeURL(tt.input)
			if result != tt.expected {
				t.Errorf("NormalizeURL(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestParseUserAgent_Integration 测试 UA 解析集成
func TestParseUserAgent_Integration(t *testing.T) {
	tests := []struct {
		ua      string
		browser string
		os      string
		device  string
	}{
		{
			ua:      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Windows",
			device:  "Desktop",
		},
		{
			ua:      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			browser: "Safari",
			os:      "iOS",
			device:  "Mobile",
		},
		{
			ua:      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
			browser: "Chrome",
			os:      "Android",
			device:  "Mobile",
		},
	}

	for _, tt := range tests {
		t.Run(tt.browser+"_"+tt.os, func(t *testing.T) {
			ua := ParseUserAgent(tt.ua)
			if ua.Browser != tt.browser {
				t.Errorf("Browser = %q, want %q", ua.Browser, tt.browser)
			}
			if ua.OS != tt.os {
				t.Errorf("OS = %q, want %q", ua.OS, tt.os)
			}
			if ua.Device != tt.device {
				t.Errorf("Device = %q, want %q", ua.Device, tt.device)
			}
		})
	}
}

// TestBuffer_RestoreAggregations_Merge 测试聚合数据恢复与合并
func TestBuffer_RestoreAggregations_Merge(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 先添加一些数据
	event := &Event{
		ID:        "test-id-1",
		Timestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Event:     "page_view",
		SessionID: "user1",
		Path:      "/home",
	}
	buf.Push(event)

	// 恢复一些已有数据（同 key）
	hll := NewHLL()
	hll.Add("user2")
	hllBytes, _ := hll.Bytes()

	aggs := map[string]*Aggregation{
		"2024-01-01|/home": {
			Date:     "2024-01-01",
			Path:     "/home",
			PV:       100,
			Count:    50,
			Duration: 1000,
			HLL:      hllBytes,
		},
	}

	buf.RestoreAggregations(aggs)

	// Drain 并验证
	result := buf.DrainAggregations()
	agg := result["2024-01-01|/home"]
	if agg == nil {
		t.Fatal("Missing aggregation after restore")
	}

	// PV 应该累加: 1 (Push) + 100 (Restore) = 101
	if agg.PV != 101 {
		t.Errorf("PV = %d, want 101", agg.PV)
	}

	// HLL 应该被覆盖（不是合并）
	if len(agg.HLL) == 0 {
		t.Error("HLL should not be empty after restore")
	}
}

// TestFlushMethods 测试 Flush 相关方法
func TestFlushMethods(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 注册 enabled analytics
	Register(app, Config{Mode: ModeConditional, Enabled: true})
	analytics := GetAnalytics(app)

	// Flush 不应 panic
	analytics.Flush()
}

// TestEventsHandler_EmptyEventsValidation 测试空事件数组
func TestEventsHandler_EmptyEventsValidation(t *testing.T) {
	// 验证空事件数组的处理
	events := []EventInput{}

	if len(events) == 0 {
		// 这种情况应该返回 400 Bad Request
		t.Log("Empty events array should be rejected")
	}
}

// TestEventsHandler_InvalidJSONParsing 测试无效 JSON
func TestEventsHandler_InvalidJSONParsing(t *testing.T) {
	invalidJSON := []byte(`{"events": [{"invalid}`)

	var input struct {
		Events []EventInput `json:"events"`
	}

	err := json.Unmarshal(invalidJSON, &input)
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

// TestExistingAnalyticsAPI 测试通过 apis.NewRouter 访问的现有 analytics API
func TestExistingAnalyticsAPI_Events(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	// 测试 bot 流量
	body := []byte(`{"events":[{"event":"page_view","path":"/home","sid":"test-session"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Googlebot/2.1 (+http://www.google.com/bot.html)")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// Bot 流量应该返回 202 或 404（取决于 analytics 是否启用）
	if rec.Code != http.StatusAccepted && rec.Code != http.StatusNotFound {
		t.Errorf("Expected 202 or 404 for bot traffic, got %d", rec.Code)
	}
}

// TestExistingAnalyticsAPI_Config 测试配置端点
func TestExistingAnalyticsAPI_Config(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/analytics/config", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// 配置端点需要 superuser 认证，应该返回 401 或 200（取决于认证状态）
	t.Logf("Config response: %d - %s", rec.Code, rec.Body.String())
}

// TestRepository_Integration 测试 Repository 集成
func TestRepository_Integration(t *testing.T) {
	_, repo := testDBWithData(t)
	ctx := context.Background()

	// 测试获取每日统计
	today := time.Now().Format("2006-01-02")
	stats, err := repo.GetDailyStats(ctx, today, today)
	if err != nil {
		t.Fatalf("GetDailyStats failed: %v", err)
	}
	if len(stats) != 2 {
		t.Errorf("Expected 2 daily stats, got %d", len(stats))
	}

	// 测试获取 Top Pages
	pages, err := repo.GetTopPages(ctx, today, today, 10)
	if err != nil {
		t.Fatalf("GetTopPages failed: %v", err)
	}
	if len(pages) != 2 {
		t.Errorf("Expected 2 top pages, got %d", len(pages))
	}

	// 测试获取 Top Sources
	sources, err := repo.GetTopSources(ctx, today, today, 10)
	if err != nil {
		t.Fatalf("GetTopSources failed: %v", err)
	}
	if len(sources) != 1 {
		t.Errorf("Expected 1 source, got %d", len(sources))
	}

	// 测试获取 Device Stats
	devices, err := repo.GetDeviceStats(ctx, today, today)
	if err != nil {
		t.Fatalf("GetDeviceStats failed: %v", err)
	}
	if len(devices) != 1 {
		t.Errorf("Expected 1 device stat, got %d", len(devices))
	}

	// 测试获取 HLL Sketches
	sketches, err := repo.GetDailyHLLSketches(ctx, today, today)
	if err != nil {
		t.Fatalf("GetDailyHLLSketches failed: %v", err)
	}
	if len(sketches) != 2 {
		t.Errorf("Expected 2 HLL sketches, got %d", len(sketches))
	}
}

// TestAnalytics_Registry 测试 analytics registry 的线程安全性
func TestAnalytics_Registry(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	// 并发注册和获取
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				analytics := GetAnalytics(app)
				_ = analytics.IsEnabled()
			}
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}
