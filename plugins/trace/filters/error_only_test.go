package filters

import (
	"testing"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// TestErrorOnlyFilter 测试 ErrorOnly 过滤器
func TestErrorOnlyFilter(t *testing.T) {
	filter := ErrorOnly()

	t.Run("Name 返回 error_only", func(t *testing.T) {
		if filter.Name() != "error_only" {
			t.Errorf("Name should be 'error_only', got %s", filter.Name())
		}
	})

	t.Run("Phase 返回 PostExecution", func(t *testing.T) {
		if filter.Phase() != trace.PostExecution {
			t.Errorf("Phase should be PostExecution")
		}
	})

	t.Run("Response 为 nil 时返回 false", func(t *testing.T) {
		ctx := &trace.FilterContext{
			Response: nil,
		}
		if filter.ShouldTrace(ctx) {
			t.Error("ShouldTrace should return false when Response is nil")
		}
	})

	t.Run("状态码 >= 400 时返回 true", func(t *testing.T) {
		testCases := []struct {
			statusCode int
			expected   bool
		}{
			{200, false},
			{201, false},
			{301, false},
			{399, false},
			{400, true},
			{401, true},
			{404, true},
			{500, true},
			{503, true},
		}

		for _, tc := range testCases {
			ctx := &trace.FilterContext{
				Response: &trace.Response{StatusCode: tc.statusCode},
			}
			result := filter.ShouldTrace(ctx)
			if result != tc.expected {
				t.Errorf("StatusCode %d: expected %v, got %v", tc.statusCode, tc.expected, result)
			}
		}
	})
}
