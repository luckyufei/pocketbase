package filters

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// TestSlowRequestFilter 测试 SlowRequest 过滤器
func TestSlowRequestFilter(t *testing.T) {
	threshold := 100 * time.Millisecond
	filter := SlowRequest(threshold)

	t.Run("Name 返回 slow_request", func(t *testing.T) {
		if filter.Name() != "slow_request" {
			t.Errorf("Name should be 'slow_request', got %s", filter.Name())
		}
	})

	t.Run("Phase 返回 PostExecution", func(t *testing.T) {
		if filter.Phase() != trace.PostExecution {
			t.Errorf("Phase should be PostExecution")
		}
	})

	t.Run("Duration >= threshold 时返回 true", func(t *testing.T) {
		testCases := []struct {
			duration time.Duration
			expected bool
		}{
			{50 * time.Millisecond, false},
			{99 * time.Millisecond, false},
			{100 * time.Millisecond, true},
			{101 * time.Millisecond, true},
			{500 * time.Millisecond, true},
		}

		for _, tc := range testCases {
			ctx := &trace.FilterContext{
				Duration: tc.duration,
			}
			result := filter.ShouldTrace(ctx)
			if result != tc.expected {
				t.Errorf("Duration %v: expected %v, got %v", tc.duration, tc.expected, result)
			}
		}
	})

	t.Run("不同 threshold 值", func(t *testing.T) {
		filter500ms := SlowRequest(500 * time.Millisecond)

		ctx := &trace.FilterContext{
			Duration: 200 * time.Millisecond,
		}
		if filter500ms.ShouldTrace(ctx) {
			t.Error("200ms should not trigger 500ms threshold")
		}

		ctx.Duration = 600 * time.Millisecond
		if !filter500ms.ShouldTrace(ctx) {
			t.Error("600ms should trigger 500ms threshold")
		}
	})
}
