package filters

import (
	"testing"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// TestSampleRateFilter 测试 SampleRate 过滤器
func TestSampleRateFilter(t *testing.T) {
	t.Run("Name 返回 sample_rate", func(t *testing.T) {
		filter := SampleRate(0.5)
		if filter.Name() != "sample_rate" {
			t.Errorf("Name should be 'sample_rate', got %s", filter.Name())
		}
	})

	t.Run("Phase 返回 PreExecution", func(t *testing.T) {
		filter := SampleRate(0.5)
		if filter.Phase() != trace.PreExecution {
			t.Errorf("Phase should be PreExecution")
		}
	})

	t.Run("rate=1.0 时总是返回 true", func(t *testing.T) {
		filter := SampleRate(1.0)
		ctx := &trace.FilterContext{}

		// 多次测试确保总是返回 true
		for i := 0; i < 100; i++ {
			if !filter.ShouldTrace(ctx) {
				t.Error("ShouldTrace should always return true when rate=1.0")
			}
		}
	})

	t.Run("rate=0.0 时总是返回 false", func(t *testing.T) {
		filter := SampleRate(0.0)
		ctx := &trace.FilterContext{}

		// 多次测试确保总是返回 false
		for i := 0; i < 100; i++ {
			if filter.ShouldTrace(ctx) {
				t.Error("ShouldTrace should always return false when rate=0.0")
			}
		}
	})

	t.Run("rate=0.5 时大约一半返回 true", func(t *testing.T) {
		filter := SampleRate(0.5)
		ctx := &trace.FilterContext{}

		trueCount := 0
		totalCount := 1000

		for i := 0; i < totalCount; i++ {
			if filter.ShouldTrace(ctx) {
				trueCount++
			}
		}

		// 允许 10% 的误差范围
		ratio := float64(trueCount) / float64(totalCount)
		if ratio < 0.4 || ratio > 0.6 {
			t.Errorf("Expected ~50%% true, got %.2f%%", ratio*100)
		}
	})

	t.Run("rate > 1.0 时规范化为 1.0", func(t *testing.T) {
		filter := SampleRate(1.5)
		ctx := &trace.FilterContext{}

		// 应该总是返回 true
		for i := 0; i < 100; i++ {
			if !filter.ShouldTrace(ctx) {
				t.Error("ShouldTrace should always return true when rate > 1.0")
			}
		}
	})

	t.Run("rate < 0.0 时规范化为 0.0", func(t *testing.T) {
		filter := SampleRate(-0.5)
		ctx := &trace.FilterContext{}

		// 应该总是返回 false
		for i := 0; i < 100; i++ {
			if filter.ShouldTrace(ctx) {
				t.Error("ShouldTrace should always return false when rate < 0.0")
			}
		}
	})
}
