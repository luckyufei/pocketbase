package core

import (
	"sync"
	"testing"
	"time"
)

func TestNewAnalyticsBuffer(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024)

	if buffer == nil {
		t.Fatal("NewAnalyticsBuffer returned nil")
	}
	if buffer.maxRawSize != 1024 {
		t.Errorf("maxRawSize = %d, want 1024", buffer.maxRawSize)
	}
	if buffer.Len() != 0 {
		t.Errorf("Len() = %d, want 0", buffer.Len())
	}
}

func TestNewAnalyticsBufferDefaultSize(t *testing.T) {
	buffer := NewAnalyticsBuffer(0)

	if buffer.maxRawSize != 16*1024*1024 {
		t.Errorf("maxRawSize = %d, want 16MB", buffer.maxRawSize)
	}
}

func TestAnalyticsBufferPush(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024 * 1024)

	event := &AnalyticsEvent{
		ID:        "evt_001",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "sess_123",
		Path:      "/home",
		Referrer:  "https://google.com/search",
		Browser:   "Chrome",
		OS:        "MacOS",
	}

	err := buffer.Push(event)
	if err != nil {
		t.Fatalf("Push() error = %v", err)
	}

	if buffer.Len() != 1 {
		t.Errorf("Len() = %d, want 1", buffer.Len())
	}

	if buffer.RawSize() == 0 {
		t.Error("RawSize() should be > 0")
	}

	if buffer.AggregationCount() != 1 {
		t.Errorf("AggregationCount() = %d, want 1", buffer.AggregationCount())
	}
}

func TestAnalyticsBufferPushNil(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024)

	err := buffer.Push(nil)
	if err != nil {
		t.Fatalf("Push(nil) error = %v", err)
	}

	if buffer.Len() != 0 {
		t.Errorf("Len() = %d, want 0", buffer.Len())
	}
}

func TestAnalyticsBufferAggregation(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024 * 1024)
	now := time.Date(2026, 1, 9, 10, 0, 0, 0, time.UTC)

	// 同一路径的多个事件应该聚合
	for i := 0; i < 5; i++ {
		event := &AnalyticsEvent{
			Timestamp: now,
			Event:     "page_view",
			SessionID: "sess_123",
			Path:      "/pricing",
		}
		buffer.Push(event)
	}

	// 不同路径的事件应该分开聚合
	event := &AnalyticsEvent{
		Timestamp: now,
		Event:     "page_view",
		SessionID: "sess_456",
		Path:      "/home",
	}
	buffer.Push(event)

	if buffer.Len() != 6 {
		t.Errorf("Len() = %d, want 6", buffer.Len())
	}

	if buffer.AggregationCount() != 2 {
		t.Errorf("AggregationCount() = %d, want 2", buffer.AggregationCount())
	}

	// 验证聚合数据
	aggs := buffer.DrainAggregations()
	if len(aggs) != 2 {
		t.Errorf("DrainAggregations() len = %d, want 2", len(aggs))
	}

	pricingKey := "2026-01-09|/pricing"
	if agg, ok := aggs[pricingKey]; ok {
		if agg.PV != 5 {
			t.Errorf("aggs[%s].PV = %d, want 5", pricingKey, agg.PV)
		}
	} else {
		t.Errorf("aggs[%s] not found", pricingKey)
	}

	// Drain 后应该清空
	if buffer.AggregationCount() != 0 {
		t.Errorf("AggregationCount() after Drain = %d, want 0", buffer.AggregationCount())
	}
}

func TestAnalyticsBufferDrainRaw(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024 * 1024)

	for i := 0; i < 3; i++ {
		event := &AnalyticsEvent{
			Timestamp: time.Now(),
			Event:     "page_view",
			SessionID: "sess_123",
			Path:      "/home",
		}
		buffer.Push(event)
	}

	events := buffer.DrainRaw()
	if len(events) != 3 {
		t.Errorf("DrainRaw() len = %d, want 3", len(events))
	}

	if buffer.Len() != 0 {
		t.Errorf("Len() after Drain = %d, want 0", buffer.Len())
	}

	if buffer.RawSize() != 0 {
		t.Errorf("RawSize() after Drain = %d, want 0", buffer.RawSize())
	}
}

func TestAnalyticsBufferShouldFlushRaw(t *testing.T) {
	buffer := NewAnalyticsBuffer(500) // 很小的缓冲区

	if buffer.ShouldFlushRaw() {
		t.Error("ShouldFlushRaw() should be false initially")
	}

	// 添加足够多的事件使缓冲区超过阈值
	for i := 0; i < 10; i++ {
		event := &AnalyticsEvent{
			Timestamp: time.Now(),
			Event:     "page_view",
			SessionID: "sess_123",
			Path:      "/home",
			UserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
		}
		buffer.Push(event)
	}

	if !buffer.ShouldFlushRaw() {
		t.Error("ShouldFlushRaw() should be true after adding events")
	}
}

func TestAnalyticsBufferSourceAggregation(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024 * 1024)
	now := time.Now()

	events := []struct {
		referrer string
		want     string
	}{
		{"https://google.com/search?q=test", "google.com"},
		{"https://www.google.com/", "www.google.com"},
		{"http://twitter.com/post/123", "twitter.com"},
		{"", ""}, // 空 referrer 不应该被聚合
	}

	for _, e := range events {
		event := &AnalyticsEvent{
			Timestamp: now,
			Event:     "page_view",
			SessionID: "sess_123",
			Path:      "/home",
			Referrer:  e.referrer,
		}
		buffer.Push(event)
	}

	aggs := buffer.DrainSourceAggregations()

	// 空 referrer 不应该被聚合，所以只有 3 个
	if len(aggs) != 3 {
		t.Errorf("DrainSourceAggregations() len = %d, want 3", len(aggs))
	}
}

func TestAnalyticsBufferDeviceAggregation(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024 * 1024)
	now := time.Now()

	events := []struct {
		browser string
		os      string
	}{
		{"Chrome", "MacOS"},
		{"Chrome", "MacOS"}, // 重复
		{"Firefox", "Windows"},
		{"Safari", "iOS"},
	}

	for _, e := range events {
		event := &AnalyticsEvent{
			Timestamp: now,
			Event:     "page_view",
			SessionID: "sess_123",
			Path:      "/home",
			Browser:   e.browser,
			OS:        e.os,
		}
		buffer.Push(event)
	}

	aggs := buffer.DrainDeviceAggregations()

	// Chrome+MacOS 应该合并，所以只有 3 个
	if len(aggs) != 3 {
		t.Errorf("DrainDeviceAggregations() len = %d, want 3", len(aggs))
	}
}

func TestAnalyticsBufferConcurrency(t *testing.T) {
	buffer := NewAnalyticsBuffer(1024 * 1024)

	var wg sync.WaitGroup
	numGoroutines := 10
	eventsPerGoroutine := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < eventsPerGoroutine; j++ {
				event := &AnalyticsEvent{
					Timestamp: time.Now(),
					Event:     "page_view",
					SessionID: "sess_123",
					Path:      "/home",
				}
				buffer.Push(event)
			}
		}(i)
	}

	wg.Wait()

	expected := numGoroutines * eventsPerGoroutine
	if buffer.Len() != expected {
		t.Errorf("Len() = %d, want %d", buffer.Len(), expected)
	}
}

func TestExtractDomain(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"https://google.com/search?q=test", "google.com"},
		{"http://www.example.com/path/to/page", "www.example.com"},
		{"https://api.example.com:8080/v1", "api.example.com"},
		{"example.com/page", "example.com"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got := extractDomain(tt.url)
			if got != tt.want {
				t.Errorf("extractDomain(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}
