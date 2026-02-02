package trace

import (
	"testing"
)

// TestTraceModeIsValid 测试 TraceMode.IsValid 方法
func TestTraceModeIsValid(t *testing.T) {
	tests := []struct {
		mode     TraceMode
		expected bool
	}{
		{ModeOff, true},
		{ModeConditional, true},
		{ModeFull, true},
		{TraceMode("invalid"), false},
		{TraceMode(""), false},
	}

	for _, tt := range tests {
		t.Run(string(tt.mode), func(t *testing.T) {
			if got := tt.mode.IsValid(); got != tt.expected {
				t.Errorf("TraceMode(%q).IsValid() = %v, want %v", tt.mode, got, tt.expected)
			}
		})
	}
}

// TestTraceModeString 测试 TraceMode.String 方法
func TestTraceModeString(t *testing.T) {
	tests := []struct {
		mode     TraceMode
		expected string
	}{
		{ModeOff, "off"},
		{ModeConditional, "conditional"},
		{ModeFull, "full"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			if got := tt.mode.String(); got != tt.expected {
				t.Errorf("TraceMode.String() = %v, want %v", got, tt.expected)
			}
		})
	}
}
