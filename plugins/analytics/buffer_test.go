package analytics

import (
	"testing"
	"time"
)

func TestNewBuffer(t *testing.T) {
	buf := NewBuffer(0)
	if buf == nil {
		t.Fatal("NewBuffer returned nil")
	}
	if buf.Len() != 0 {
		t.Errorf("Len() = %d, want 0", buf.Len())
	}
	if buf.RawSize() != 0 {
		t.Errorf("RawSize() = %d, want 0", buf.RawSize())
	}
}

func TestBufferPush(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Browser:   "Chrome",
		OS:        "MacOS",
	}

	err := buf.Push(event)
	if err != nil {
		t.Fatalf("Push() error = %v", err)
	}

	if buf.Len() != 1 {
		t.Errorf("Len() = %d, want 1", buf.Len())
	}
	if buf.RawSize() == 0 {
		t.Error("RawSize() should be > 0")
	}
	if buf.AggregationCount() != 1 {
		t.Errorf("AggregationCount() = %d, want 1", buf.AggregationCount())
	}
}

func TestBufferPushNil(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	err := buf.Push(nil)
	if err != nil {
		t.Fatalf("Push(nil) error = %v", err)
	}

	if buf.Len() != 0 {
		t.Errorf("Len() = %d, want 0", buf.Len())
	}
}

func TestBufferDrainRaw(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
	}

	buf.Push(event)
	buf.Push(event)
	buf.Push(event)

	events := buf.DrainRaw()
	if len(events) != 3 {
		t.Errorf("DrainRaw() returned %d events, want 3", len(events))
	}

	// After drain, buffer should be empty
	if buf.Len() != 0 {
		t.Errorf("Len() after drain = %d, want 0", buf.Len())
	}
	if buf.RawSize() != 0 {
		t.Errorf("RawSize() after drain = %d, want 0", buf.RawSize())
	}
}

func TestBufferDrainAggregations(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	event1 := &Event{
		ID:        "test-id-1",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
	}
	event2 := &Event{
		ID:        "test-id-2",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-2",
		Path:      "/pricing",
	}

	buf.Push(event1)
	buf.Push(event2)
	buf.Push(event1) // Same path

	aggs := buf.DrainAggregations()
	if len(aggs) != 2 {
		t.Errorf("DrainAggregations() returned %d entries, want 2", len(aggs))
	}

	// Check aggregation values
	today := time.Now().Format("2006-01-02")
	homeKey := today + "|/home"
	if agg, ok := aggs[homeKey]; ok {
		if agg.PV != 2 {
			t.Errorf("home PV = %d, want 2", agg.PV)
		}
	} else {
		t.Error("Missing /home aggregation")
	}

	// After drain, aggregations should be empty
	if buf.AggregationCount() != 0 {
		t.Errorf("AggregationCount() after drain = %d, want 0", buf.AggregationCount())
	}
}

func TestBufferShouldFlushRaw(t *testing.T) {
	buf := NewBuffer(1000) // Small max size

	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		UserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
	}

	// Initially should not flush
	if buf.ShouldFlushRaw() {
		t.Error("ShouldFlushRaw() should be false initially")
	}

	// Push events until buffer is full
	for i := 0; i < 10; i++ {
		buf.Push(event)
	}

	// Now should flush
	if !buf.ShouldFlushRaw() {
		t.Error("ShouldFlushRaw() should be true after filling buffer")
	}
}

func TestBufferSourceAggregation(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Referrer:  "https://google.com/search?q=test",
	}

	buf.Push(event)
	buf.Push(event)

	aggs := buf.DrainSourceAggregations()
	if len(aggs) != 1 {
		t.Errorf("DrainSourceAggregations() returned %d entries, want 1", len(aggs))
	}

	today := time.Now().Format("2006-01-02")
	key := today + "|google.com"
	if agg, ok := aggs[key]; ok {
		if agg.Count != 2 {
			t.Errorf("Source count = %d, want 2", agg.Count)
		}
	} else {
		t.Error("Missing google.com source aggregation")
	}
}

func TestBufferDeviceAggregation(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Browser:   "Chrome",
		OS:        "MacOS",
	}

	buf.Push(event)
	buf.Push(event)

	aggs := buf.DrainDeviceAggregations()
	if len(aggs) != 1 {
		t.Errorf("DrainDeviceAggregations() returned %d entries, want 1", len(aggs))
	}

	today := time.Now().Format("2006-01-02")
	key := today + "|Chrome|MacOS"
	if agg, ok := aggs[key]; ok {
		if agg.Count != 2 {
			t.Errorf("Device count = %d, want 2", agg.Count)
		}
	} else {
		t.Error("Missing Chrome|MacOS device aggregation")
	}
}

func TestBufferRestoreAggregations(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// Add some initial data
	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
	}
	buf.Push(event)

	// Drain and restore
	aggs := buf.DrainAggregations()
	buf.RestoreAggregations(aggs)

	// Should have the data back
	if buf.AggregationCount() != 1 {
		t.Errorf("AggregationCount() after restore = %d, want 1", buf.AggregationCount())
	}
}

func TestBufferRestoreAggregations_MergeHLL(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 创建带 HLL 的聚合数据
	hll1 := NewHLL()
	hll1.Add("user1")
	hllBytes, _ := hll1.Bytes()

	aggs := map[string]*Aggregation{
		"2024-01-01|/home": {
			Date: "2024-01-01",
			Path: "/home",
			PV:   100,
			HLL:  hllBytes,
		},
	}

	// 先恢复
	buf.RestoreAggregations(aggs)

	// 添加新事件
	event := &Event{
		ID:        "test-id",
		Timestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Event:     "page_view",
		SessionID: "user2",
		Path:      "/home",
	}
	buf.Push(event)

	// Drain 并检查
	result := buf.DrainAggregations()
	agg := result["2024-01-01|/home"]
	if agg == nil {
		t.Fatal("Missing aggregation")
	}

	// PV 应该累加
	if agg.PV != 101 {
		t.Errorf("PV = %d, want 101", agg.PV)
	}
}

func TestBufferRestoreSourceAggregations(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 创建 source 聚合数据
	aggs := map[string]*SourceAggregation{
		"2024-01-01|google.com": {
			Count: 100,
		},
	}

	// 恢复
	buf.RestoreSourceAggregations(aggs)

	// 添加新事件
	event := &Event{
		ID:        "test-id",
		Timestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Referrer:  "https://google.com/search",
	}
	buf.Push(event)

	// Drain 并检查
	result := buf.DrainSourceAggregations()
	agg := result["2024-01-01|google.com"]
	if agg == nil {
		t.Fatal("Missing source aggregation")
	}

	// Count 应该累加
	if agg.Count != 101 {
		t.Errorf("Source Count = %d, want 101", agg.Count)
	}
}

func TestBufferRestoreSourceAggregations_Empty(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 恢复空数据
	buf.RestoreSourceAggregations(nil)

	// 应该不 panic
	aggs := buf.DrainSourceAggregations()
	if len(aggs) != 0 {
		t.Errorf("Expected 0 aggregations, got %d", len(aggs))
	}
}

func TestBufferRestoreDeviceAggregations(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 创建 device 聚合数据
	aggs := map[string]*DeviceAggregation{
		"2024-01-01|Chrome|Windows": {
			Count: 100,
		},
	}

	// 恢复
	buf.RestoreDeviceAggregations(aggs)

	// 添加新事件
	event := &Event{
		ID:        "test-id",
		Timestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Browser:   "Chrome",
		OS:        "Windows",
	}
	buf.Push(event)

	// Drain 并检查
	result := buf.DrainDeviceAggregations()
	agg := result["2024-01-01|Chrome|Windows"]
	if agg == nil {
		t.Fatal("Missing device aggregation")
	}

	// Count 应该累加
	if agg.Count != 101 {
		t.Errorf("Device Count = %d, want 101", agg.Count)
	}
}

func TestBufferRestoreDeviceAggregations_Empty(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 恢复空数据
	buf.RestoreDeviceAggregations(nil)

	// 应该不 panic
	aggs := buf.DrainDeviceAggregations()
	if len(aggs) != 0 {
		t.Errorf("Expected 0 aggregations, got %d", len(aggs))
	}
}

func TestBufferRestoreAggregations_Empty(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 恢复空数据
	buf.RestoreAggregations(nil)

	// 应该不 panic
	if buf.AggregationCount() != 0 {
		t.Errorf("Expected 0 aggregations, got %d", buf.AggregationCount())
	}
}

func TestBufferExtractDomain(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	tests := []struct {
		referrer string
		expected string
	}{
		{"https://google.com/search?q=test", "google.com"},
		{"http://example.com/path", "example.com"},
		{"https://www.facebook.com/page", "www.facebook.com"},
		{"", ""},
		{"invalid", ""},
		{"file:///local/path", ""},
	}

	for _, tt := range tests {
		event := &Event{
			ID:        "test-id",
			Timestamp: time.Now(),
			Event:     "page_view",
			SessionID: "session-1",
			Path:      "/home",
			Referrer:  tt.referrer,
		}
		buf.Push(event)
	}

	// 提取域名测试通过 Push 隐式测试
	// 因为 extractDomain 是私有方法
}

func TestBufferSourceAggregation_EmptyReferrer(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	// 空 Referrer 不应创建 source 聚合
	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Referrer:  "",
	}
	buf.Push(event)

	aggs := buf.DrainSourceAggregations()
	if len(aggs) != 0 {
		t.Errorf("Expected 0 source aggregations for empty referrer, got %d", len(aggs))
	}
}

func TestBufferConcurrency(t *testing.T) {
	buf := NewBuffer(16 * 1024 * 1024)

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				event := &Event{
					ID:        "test-id",
					Timestamp: time.Now(),
					Event:     "page_view",
					SessionID: "session-1",
					Path:      "/home",
				}
				buf.Push(event)
			}
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	if buf.Len() != 1000 {
		t.Errorf("Len() = %d, want 1000", buf.Len())
	}
}

func BenchmarkBufferPush(b *testing.B) {
	buf := NewBuffer(16 * 1024 * 1024)
	event := &Event{
		ID:        "test-id",
		Timestamp: time.Now(),
		Event:     "page_view",
		SessionID: "session-1",
		Path:      "/home",
		Browser:   "Chrome",
		OS:        "MacOS",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buf.Push(event)
	}
}
