package core

import (
	"testing"
	"time"
)

func TestAnalyticsEventValidate(t *testing.T) {
	tests := []struct {
		name    string
		event   AnalyticsEvent
		wantErr error
	}{
		{
			name: "valid event",
			event: AnalyticsEvent{
				Event:     "page_view",
				Path:      "/home",
				SessionID: "sess_123",
			},
			wantErr: nil,
		},
		{
			name: "missing event name",
			event: AnalyticsEvent{
				Path:      "/home",
				SessionID: "sess_123",
			},
			wantErr: ErrAnalyticsEventRequired,
		},
		{
			name: "missing path",
			event: AnalyticsEvent{
				Event:     "page_view",
				SessionID: "sess_123",
			},
			wantErr: ErrAnalyticsPathRequired,
		},
		{
			name: "missing session id",
			event: AnalyticsEvent{
				Event: "page_view",
				Path:  "/home",
			},
			wantErr: ErrAnalyticsSessionRequired,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.event.Validate()
			if err != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAnalyticsEventInputToEvent(t *testing.T) {
	input := AnalyticsEventInput{
		Event:     "click_buy",
		Timestamp: 1736400000000, // 2025-01-09 00:00:00 UTC
		UserID:    "user_123",
		SessionID: "sess_456",
		Path:      "/pricing",
		Query:     "plan=pro",
		Referrer:  "https://google.com",
		Title:     "Pricing Page",
		Language:  "zh-CN",
		Props:     map[string]any{"price": 99},
		PerfMs:    150,
	}

	event := input.ToEvent("evt_001", "192.168.1.1", "Mozilla/5.0", "Chrome", "MacOS", "desktop")

	if event.ID != "evt_001" {
		t.Errorf("ID = %v, want evt_001", event.ID)
	}
	if event.Event != "click_buy" {
		t.Errorf("Event = %v, want click_buy", event.Event)
	}
	if event.UserID != "user_123" {
		t.Errorf("UserID = %v, want user_123", event.UserID)
	}
	if event.SessionID != "sess_456" {
		t.Errorf("SessionID = %v, want sess_456", event.SessionID)
	}
	if event.Path != "/pricing" {
		t.Errorf("Path = %v, want /pricing", event.Path)
	}
	if event.IP != "192.168.1.1" {
		t.Errorf("IP = %v, want 192.168.1.1", event.IP)
	}
	if event.Browser != "Chrome" {
		t.Errorf("Browser = %v, want Chrome", event.Browser)
	}
	if event.OS != "MacOS" {
		t.Errorf("OS = %v, want MacOS", event.OS)
	}
	if event.Device != "desktop" {
		t.Errorf("Device = %v, want desktop", event.Device)
	}

	// 验证时间戳转换
	expectedTime := time.UnixMilli(1736400000000)
	if !event.Timestamp.Equal(expectedTime) {
		t.Errorf("Timestamp = %v, want %v", event.Timestamp, expectedTime)
	}

	// 验证 Props
	if price, ok := event.Props["price"].(int); !ok || price != 99 {
		t.Errorf("Props[price] = %v, want 99", event.Props["price"])
	}
}

func TestAnalyticsEventInputToEventDefaultTimestamp(t *testing.T) {
	input := AnalyticsEventInput{
		Event:     "page_view",
		SessionID: "sess_789",
		Path:      "/home",
		// Timestamp 为 0，应使用当前时间
	}

	before := time.Now()
	event := input.ToEvent("evt_002", "", "", "", "", "")
	after := time.Now()

	if event.Timestamp.Before(before) || event.Timestamp.After(after) {
		t.Errorf("Timestamp = %v, should be between %v and %v", event.Timestamp, before, after)
	}
}
