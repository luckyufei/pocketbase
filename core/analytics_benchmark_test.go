package core_test

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// BenchmarkAnalyticsBufferPush 测试单线程事件推送性能。
// 目标：验证单核能达到 10,000+ events/sec。
func BenchmarkAnalyticsBufferPush(b *testing.B) {
	buffer := core.NewAnalyticsBuffer(64 * 1024 * 1024) // 64MB

	event := &core.AnalyticsEvent{
		ID:        "test-event-id",
		Event:     "page_view",
		Path:      "/pricing",
		Referrer:  "https://google.com/search?q=test",
		Title:     "Pricing Page",
		IP:        "192.168.1.1",
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		Browser:   "Chrome",
		OS:        "Windows",
		Device:    "Desktop",
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		buffer.Push(event)
	}

	b.StopTimer()

	// 计算吞吐量
	eventsPerSec := float64(b.N) / b.Elapsed().Seconds()
	b.ReportMetric(eventsPerSec, "events/sec")
}

// BenchmarkAnalyticsBufferPushParallel 测试并发事件推送性能。
// 目标：验证多核并发能达到 10,000+ events/sec。
func BenchmarkAnalyticsBufferPushParallel(b *testing.B) {
	buffer := core.NewAnalyticsBuffer(64 * 1024 * 1024) // 64MB

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		event := &core.AnalyticsEvent{
			ID:        "test-event-id",
			Event:     "page_view",
			Path:      "/pricing",
			Referrer:  "https://google.com/search?q=test",
			Title:     "Pricing Page",
			IP:        "192.168.1.1",
			UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			Browser:   "Chrome",
			OS:        "Windows",
			Device:    "Desktop",
			Timestamp: time.Now(),
		}

		for pb.Next() {
			buffer.Push(event)
		}
	})

	b.StopTimer()

	// 计算吞吐量
	eventsPerSec := float64(b.N) / b.Elapsed().Seconds()
	b.ReportMetric(eventsPerSec, "events/sec")
}

// BenchmarkAnalyticsBufferDrain 测试 Drain 操作性能。
func BenchmarkAnalyticsBufferDrain(b *testing.B) {
	for _, eventCount := range []int{100, 1000, 10000} {
		b.Run(fmt.Sprintf("events=%d", eventCount), func(b *testing.B) {
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				b.StopTimer()
				buffer := core.NewAnalyticsBuffer(64 * 1024 * 1024)
				for j := 0; j < eventCount; j++ {
					buffer.Push(&core.AnalyticsEvent{
						ID:        fmt.Sprintf("event-%d", j),
						Event:     "page_view",
						Path:      fmt.Sprintf("/page-%d", j%100),
						Timestamp: time.Now(),
					})
				}
				b.StartTimer()

				buffer.DrainRaw()
				buffer.DrainAggregations()
				buffer.DrainSourceAggregations()
				buffer.DrainDeviceAggregations()
			}
		})
	}
}

// TestAnalyticsThroughput 验证系统能达到 10,000 events/sec 的吞吐量。
// 这是一个功能测试而非基准测试，用于验证性能目标。
func TestAnalyticsThroughput(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping throughput test in short mode")
	}

	buffer := core.NewAnalyticsBuffer(64 * 1024 * 1024) // 64MB

	// 目标：10,000 events/sec
	targetEventsPerSec := 10000
	testDuration := 1 * time.Second
	_ = targetEventsPerSec * int(testDuration.Seconds()) // targetEvents for reference

	// 准备事件
	event := &core.AnalyticsEvent{
		ID:        "test-event-id",
		Event:     "page_view",
		Path:      "/pricing",
		Referrer:  "https://google.com/search?q=test",
		Title:     "Pricing Page",
		IP:        "192.168.1.1",
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		Browser:   "Chrome",
		OS:        "Windows",
		Device:    "Desktop",
		Timestamp: time.Now(),
	}

	// 并发推送事件
	var wg sync.WaitGroup
	eventCount := 0
	var countMu sync.Mutex

	start := time.Now()
	done := make(chan struct{})

	// 启动多个 goroutine 并发推送
	numWorkers := 4
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			localCount := 0
			for {
				select {
				case <-done:
					countMu.Lock()
					eventCount += localCount
					countMu.Unlock()
					return
				default:
					buffer.Push(event)
					localCount++
				}
			}
		}()
	}

	// 运行指定时间
	time.Sleep(testDuration)
	close(done)
	wg.Wait()

	elapsed := time.Since(start)
	eventsPerSec := float64(eventCount) / elapsed.Seconds()

	t.Logf("Throughput test results:")
	t.Logf("  Duration: %v", elapsed)
	t.Logf("  Events pushed: %d", eventCount)
	t.Logf("  Events/sec: %.0f", eventsPerSec)
	t.Logf("  Target: %d events/sec", targetEventsPerSec)

	// 验证是否达到目标
	if eventsPerSec < float64(targetEventsPerSec) {
		t.Errorf("Throughput %.0f events/sec is below target %d events/sec", eventsPerSec, targetEventsPerSec)
	} else {
		t.Logf("✓ Throughput target achieved: %.0f >= %d events/sec", eventsPerSec, targetEventsPerSec)
	}

	// 验证数据完整性
	if buffer.Len() != eventCount {
		t.Errorf("Buffer length %d != event count %d", buffer.Len(), eventCount)
	}

	// 验证聚合正确性
	if buffer.AggregationCount() == 0 {
		t.Error("No aggregations created")
	}

	// 清理并验证 Drain
	events := buffer.DrainRaw()
	if len(events) != eventCount {
		t.Errorf("Drained events %d != event count %d", len(events), eventCount)
	}

	t.Logf("  Buffer length after drain: %d", buffer.Len())
	t.Logf("  Aggregation count: %d", buffer.AggregationCount())
}

// BenchmarkAnalyticsEventValidation 测试事件验证性能。
func BenchmarkAnalyticsEventValidation(b *testing.B) {
	event := core.AnalyticsEvent{
		ID:        "test-event-id",
		Event:     "page_view",
		Path:      "/pricing",
		Referrer:  "https://google.com/search?q=test",
		Title:     "Pricing Page",
		IP:        "192.168.1.1",
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		Browser:   "Chrome",
		OS:        "Windows",
		Device:    "Desktop",
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		event.Validate()
	}
}

// BenchmarkAnalyticsURLNormalization 测试 URL 规范化性能。
func BenchmarkAnalyticsURLNormalization(b *testing.B) {
	urls := []string{
		"/pricing?utm_source=google&utm_medium=cpc",
		"/products/123?ref=homepage#section",
		"/api/v1/users?page=1&limit=10&sort=name",
		"/blog/2024/01/hello-world?fbclid=abc123",
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		core.NormalizeURL(urls[i%len(urls)])
	}
}

// BenchmarkAnalyticsUserAgentParsing 测试 User-Agent 解析性能。
func BenchmarkAnalyticsUserAgentParsing(b *testing.B) {
	userAgents := []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		core.ParseUserAgent(userAgents[i%len(userAgents)])
	}
}

// BenchmarkAnalyticsBotDetection 测试爬虫检测性能。
func BenchmarkAnalyticsBotDetection(b *testing.B) {
	userAgents := []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
		"Googlebot/2.1 (+http://www.google.com/bot.html)",
		"Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)",
		"Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		core.IsBotUserAgent(userAgents[i%len(userAgents)])
	}
}

// BenchmarkAnalyticsEndToEnd 测试端到端处理性能。
// 模拟从接收事件到推入缓冲区的完整流程。
func BenchmarkAnalyticsEndToEnd(b *testing.B) {
	buffer := core.NewAnalyticsBuffer(64 * 1024 * 1024)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// 模拟事件输入
		input := core.AnalyticsEventInput{
			Event:     "page_view",
			Path:      "/pricing?utm_source=google",
			Referrer:  "https://google.com/search?q=test",
			Title:     "Pricing Page",
			Timestamp: time.Now().UnixMilli(),
		}

		// URL 规范化
		input.Path = core.NormalizeURL(input.Path)

		// UA 解析
		ua := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
		uaInfo := core.ParseUserAgent(ua)

		// 爬虫检测
		if core.IsBotUserAgent(ua) {
			continue
		}

		// 转换为内部事件
		event := input.ToEvent(
			fmt.Sprintf("event-%d", i),
			"192.168.1.1",
			ua,
			uaInfo.Browser,
			uaInfo.OS,
			uaInfo.Device,
		)

		// 验证
		if err := event.Validate(); err != nil {
			continue
		}

		// 推入缓冲区
		buffer.Push(&event)
	}
}
