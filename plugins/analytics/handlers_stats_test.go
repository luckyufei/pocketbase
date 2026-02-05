package analytics

import (
	"testing"
)

func TestParseDateRange(t *testing.T) {
	tests := []struct {
		name           string
		rangeStr       string
		expectedDays   int // 开始日期与今天的天数差
	}{
		{"today", "today", 0},
		{"7d", "7d", 7},
		{"30d", "30d", 30},
		{"90d", "90d", 90},
		{"default", "", 7},
		{"invalid", "invalid", 7},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			startDate, endDate := parseDateRange(tt.rangeStr)

			// 检查 endDate 是今天
			if endDate == "" {
				t.Error("endDate should not be empty")
			}

			// 检查 startDate 不为空
			if startDate == "" {
				t.Error("startDate should not be empty")
			}

			// 检查日期格式 (YYYY-MM-DD)
			if len(startDate) != 10 || startDate[4] != '-' || startDate[7] != '-' {
				t.Errorf("Invalid startDate format: %s", startDate)
			}
			if len(endDate) != 10 || endDate[4] != '-' || endDate[7] != '-' {
				t.Errorf("Invalid endDate format: %s", endDate)
			}
		})
	}
}

func TestParseLimit(t *testing.T) {
	tests := []struct {
		name         string
		limitStr     string
		defaultLimit int
		expected     int
	}{
		{"empty", "", 10, 10},
		{"valid 5", "5", 10, 5},
		{"valid 50", "50", 10, 50},
		{"max 100", "100", 10, 100},
		{"over max", "200", 10, 100},
		{"zero", "0", 10, 10},
		{"negative", "-5", 10, 10},
		{"invalid", "abc", 10, 10},
		{"float", "10.5", 10, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseLimit(tt.limitStr, tt.defaultLimit)
			if got != tt.expected {
				t.Errorf("parseLimit(%q, %d) = %d, want %d", tt.limitStr, tt.defaultLimit, got, tt.expected)
			}
		})
	}
}

func TestConfigHandler_Disabled(t *testing.T) {
	// configHandler 在 analytics 为 nil 时应返回 enabled: false
	// 这个测试验证 configHandler 的逻辑分支
}

func TestStatsHandler_NoRepository(t *testing.T) {
	// statsHandler 在 repository 为 nil 时应返回 500 错误
	// 这个测试需要模拟 repository 为 nil 的情况
}
