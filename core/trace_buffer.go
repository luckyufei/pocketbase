package core

import (
	"sync"
	"sync/atomic"
)

// ============================================================================
// RingBuffer - 高性能环形缓冲区
// ============================================================================

// RingBuffer 是一个线程安全的环形缓冲区，用于暂存 Span 数据
// 当缓冲区满时，新的 Span 会被丢弃（溢出丢弃策略）
type RingBuffer struct {
	buffer   []*Span
	capacity int
	head     int64 // 写入位置（原子操作）
	tail     int64 // 读取位置（原子操作）
	mu       sync.Mutex
	overflow int64 // 溢出计数（原子操作）
}

// NewRingBuffer 创建一个新的环形缓冲区
func NewRingBuffer(capacity int) *RingBuffer {
	if capacity <= 0 {
		capacity = 10000 // 默认容量
	}
	return &RingBuffer{
		buffer:   make([]*Span, capacity),
		capacity: capacity,
	}
}

// Capacity 返回缓冲区容量
func (rb *RingBuffer) Capacity() int {
	return rb.capacity
}

// Len 返回当前缓冲区中的元素数量
func (rb *RingBuffer) Len() int {
	rb.mu.Lock()
	defer rb.mu.Unlock()
	return int(rb.head - rb.tail)
}

// Push 将 Span 写入缓冲区
// 如果缓冲区已满，返回 false 并增加溢出计数
func (rb *RingBuffer) Push(span *Span) bool {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	// 检查是否溢出
	if rb.head-rb.tail >= int64(rb.capacity) {
		atomic.AddInt64(&rb.overflow, 1)
		return false // 丢弃
	}

	// 写入
	idx := rb.head % int64(rb.capacity)
	rb.buffer[idx] = span
	rb.head++
	return true
}

// Flush 批量获取 Span，最多返回 batchSize 个
// 返回的 Span 会从缓冲区中移除
func (rb *RingBuffer) Flush(batchSize int) []*Span {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	count := rb.head - rb.tail
	if count == 0 {
		return nil
	}

	if count > int64(batchSize) {
		count = int64(batchSize)
	}

	result := make([]*Span, count)
	for i := int64(0); i < count; i++ {
		idx := (rb.tail + i) % int64(rb.capacity)
		result[i] = rb.buffer[idx]
		rb.buffer[idx] = nil // 帮助 GC
	}
	rb.tail += count

	return result
}

// Overflow 返回溢出计数
func (rb *RingBuffer) Overflow() int64 {
	return atomic.LoadInt64(&rb.overflow)
}

// ResetOverflow 重置溢出计数
func (rb *RingBuffer) ResetOverflow() {
	atomic.StoreInt64(&rb.overflow, 0)
}

// IsFull 返回缓冲区是否已满
func (rb *RingBuffer) IsFull() bool {
	rb.mu.Lock()
	defer rb.mu.Unlock()
	return rb.head-rb.tail >= int64(rb.capacity)
}

// IsEmpty 返回缓冲区是否为空
func (rb *RingBuffer) IsEmpty() bool {
	rb.mu.Lock()
	defer rb.mu.Unlock()
	return rb.head == rb.tail
}
