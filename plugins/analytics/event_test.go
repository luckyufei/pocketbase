package analytics

import (
	"testing"
	"time"
)

func TestEventValidate(t *testing.T) {
	tests := []struct {
		name    string
		event   Event
		wantErr error
	}{
		{
			name: "valid event",
			event: Event{
				Event:     "page_view",
				Path:      "/home",
				SessionID: "session-123",
			},
			wantErr: nil,
		},
		{
			name: "missing event name",
			event: Event{
				Path:      "/home",
				SessionID: "session-123",
			},
			wantErr: ErrEventRequired,
		},
		{
			name: "missing path",
			event: Event{
				Event:     "page_view",
				SessionID: "session-123",
			},
			wantErr: ErrPathRequired,
		},
		{
			name: "missing session id",
			event: Event{
				Event: "page_view",
				Path:  "/home",
			},
			wantErr: ErrSessionRequired,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.event.Validate()
			if err != tt.wantErr {
				t.Errorf("Event.Validate() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestEventInputToEvent(t *testing.T) {
	input := &EventInput{
		Event:     "page_view",
		Timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
		UserID:    "user-123",
		SessionID: "session-456",
		Path:      "/home",
		Query:     "ref=twitter",
		Referrer:  "https://google.com",
		Title:     "Home Page",
		Language:  "en-US",
		Props:     map[string]any{"key": "value"},
		PerfMs:    150,
	}

	event := input.ToEvent("event-id", "192.168.1.1", "Mozilla/5.0", "Chrome", "Windows", "desktop")

	// 验证字段
	if event.ID != "event-id" {
		t.Errorf("ID = %q, want %q", event.ID, "event-id")
	}
	if event.Event != "page_view" {
		t.Errorf("Event = %q, want %q", event.Event, "page_view")
	}
	if event.UserID != "user-123" {
		t.Errorf("UserID = %q, want %q", event.UserID, "user-123")
	}
	if event.SessionID != "session-456" {
		t.Errorf("SessionID = %q, want %q", event.SessionID, "session-456")
	}
	if event.Path != "/home" {
		t.Errorf("Path = %q, want %q", event.Path, "/home")
	}
	if event.IP != "192.168.1.1" {
		t.Errorf("IP = %q, want %q", event.IP, "192.168.1.1")
	}
	if event.UserAgent != "Mozilla/5.0" {
		t.Errorf("UserAgent = %q, want %q", event.UserAgent, "Mozilla/5.0")
	}
	if event.Browser != "Chrome" {
		t.Errorf("Browser = %q, want %q", event.Browser, "Chrome")
	}
	if event.OS != "Windows" {
		t.Errorf("OS = %q, want %q", event.OS, "Windows")
	}
	if event.Device != "desktop" {
		t.Errorf("Device = %q, want %q", event.Device, "desktop")
	}
	if event.PerfMs != 150 {
		t.Errorf("PerfMs = %d, want %d", event.PerfMs, 150)
	}
}

func TestEventInputToEventNoTimestamp(t *testing.T) {
	input := &EventInput{
		Event:     "page_view",
		SessionID: "session-456",
		Path:      "/home",
	}

	before := time.Now()
	event := input.ToEvent("event-id", "", "", "", "", "")
	after := time.Now()

	// 验证时间戳被设置为当前时间
	if event.Timestamp.Before(before) || event.Timestamp.After(after) {
		t.Errorf("Timestamp should be between %v and %v, got %v", before, after, event.Timestamp)
	}
}

func TestEventInputToEventWithTimestamp(t *testing.T) {
	// 使用一个固定的时间戳
	ts := int64(1704067200000) // 2024-01-01 00:00:00 UTC
	input := &EventInput{
		Event:     "page_view",
		Timestamp: ts,
		SessionID: "session-456",
		Path:      "/home",
	}

	event := input.ToEvent("event-id", "", "", "", "", "")

	expected := time.UnixMilli(ts)
	if !event.Timestamp.Equal(expected) {
		t.Errorf("Timestamp = %v, want %v", event.Timestamp, expected)
	}
}
