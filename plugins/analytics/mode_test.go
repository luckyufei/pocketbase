package analytics

import (
	"testing"
)

func TestAnalyticsModeConstants(t *testing.T) {
	// 验证模式常量定义正确
	if ModeOff != "off" {
		t.Errorf("ModeOff should be 'off', got %s", ModeOff)
	}
	if ModeConditional != "conditional" {
		t.Errorf("ModeConditional should be 'conditional', got %s", ModeConditional)
	}
	if ModeFull != "full" {
		t.Errorf("ModeFull should be 'full', got %s", ModeFull)
	}
}

func TestAnalyticsModeIsValid(t *testing.T) {
	tests := []struct {
		mode  AnalyticsMode
		valid bool
	}{
		{ModeOff, true},
		{ModeConditional, true},
		{ModeFull, true},
		{AnalyticsMode("invalid"), false},
		{AnalyticsMode(""), false},
	}

	for _, tt := range tests {
		t.Run(string(tt.mode), func(t *testing.T) {
			if got := tt.mode.IsValid(); got != tt.valid {
				t.Errorf("AnalyticsMode(%q).IsValid() = %v, want %v", tt.mode, got, tt.valid)
			}
		})
	}
}

func TestAnalyticsModeString(t *testing.T) {
	tests := []struct {
		mode AnalyticsMode
		want string
	}{
		{ModeOff, "off"},
		{ModeConditional, "conditional"},
		{ModeFull, "full"},
	}

	for _, tt := range tests {
		t.Run(string(tt.mode), func(t *testing.T) {
			if got := tt.mode.String(); got != tt.want {
				t.Errorf("AnalyticsMode.String() = %v, want %v", got, tt.want)
			}
		})
	}
}
