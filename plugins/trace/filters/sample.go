package filters

import (
	"math/rand"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// sampleRateFilter 采样率过滤器
type sampleRateFilter struct {
	rate float64
}

// SampleRate 返回采样率过滤器
// rate 应该在 [0.0, 1.0] 范围内
// 0.0 = 不采样, 1.0 = 全采样
func SampleRate(rate float64) trace.Filter {
	// 规范化 rate 到 [0.0, 1.0]
	if rate < 0 {
		rate = 0
	}
	if rate > 1 {
		rate = 1
	}
	return &sampleRateFilter{rate: rate}
}

// Name 返回过滤器名称
func (f *sampleRateFilter) Name() string {
	return "sample_rate"
}

// Phase 返回过滤器阶段
func (f *sampleRateFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

// ShouldTrace 判断是否应该追踪
// 根据采样率随机决定
func (f *sampleRateFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if f.rate >= 1.0 {
		return true
	}
	if f.rate <= 0.0 {
		return false
	}
	return rand.Float64() < f.rate
}
