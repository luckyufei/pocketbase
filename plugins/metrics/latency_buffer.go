package metrics

import (
	"math"
	"sort"
	"sync"
)

// LatencyBuffer 延迟数据的 Ring Buffer 实现
// 用于存储最近的请求延迟样本，计算 P95 延迟
type LatencyBuffer struct {
	data  []float64
	index int
	count int
	mu    sync.Mutex
}

// NewLatencyBuffer 创建新的延迟 Ring Buffer
func NewLatencyBuffer(size int) *LatencyBuffer {
	if size <= 0 {
		size = DefaultLatencyBufferSize
	}
	return &LatencyBuffer{
		data: make([]float64, size),
	}
}

// Add 添加一个延迟样本
func (b *LatencyBuffer) Add(latencyMs float64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.data[b.index] = latencyMs
	b.index = (b.index + 1) % len(b.data)
	if b.count < len(b.data) {
		b.count++
	}
}

// P95 计算 P95 延迟
// 注意：Ring Buffer 满后数据在数组中的顺序不连续，但排序后取 P95 不受影响
func (b *LatencyBuffer) P95() float64 {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.count == 0 {
		return 0
	}

	// 复制数据用于排序（排序后顺序无关紧要）
	samples := make([]float64, b.count)
	copy(samples, b.data[:b.count])
	sort.Float64s(samples)

	// 计算 P95 索引
	p95Index := int(math.Ceil(float64(len(samples))*0.95)) - 1
	if p95Index < 0 {
		p95Index = 0
	}
	if p95Index >= len(samples) {
		p95Index = len(samples) - 1
	}

	return samples[p95Index]
}

// Reset 重置 buffer
func (b *LatencyBuffer) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.index = 0
	b.count = 0
}

// Count 返回当前缓冲区中的样本数量
func (b *LatencyBuffer) Count() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.count
}
