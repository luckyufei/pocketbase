package trace

import (
	"sync"
)

const defaultBufferSize = 10000

// RingBuffer 是一个线程安全的环形缓冲区
// 用于暂存 Span 数据，支持溢出时丢弃最旧数据
type RingBuffer struct {
	mu           sync.Mutex
	data         []*Span
	head         int   // 读取位置
	tail         int   // 写入位置
	count        int   // 当前元素数量
	capacity     int   // 容量
	droppedCount int64 // 丢弃计数
}

// NewRingBuffer 创建指定大小的 RingBuffer
func NewRingBuffer(size int) *RingBuffer {
	if size <= 0 {
		size = defaultBufferSize
	}
	return &RingBuffer{
		data:     make([]*Span, size),
		capacity: size,
	}
}

// Push 将 span 添加到缓冲区
// 如果缓冲区已满，会丢弃最旧的数据
// 返回 false 如果 span 为 nil
func (b *RingBuffer) Push(span *Span) bool {
	if span == nil {
		return false
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// 如果缓冲区已满，丢弃最旧的数据
	if b.count == b.capacity {
		b.head = (b.head + 1) % b.capacity
		b.count--
		b.droppedCount++
	}

	// 写入数据
	b.data[b.tail] = span
	b.tail = (b.tail + 1) % b.capacity
	b.count++

	return true
}

// Flush 从缓冲区取出最多 n 个 span
// 返回的 span 按 FIFO 顺序排列
func (b *RingBuffer) Flush(n int) []*Span {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.count == 0 || n <= 0 {
		return nil
	}

	// 确定要取出的数量
	toFlush := n
	if toFlush > b.count {
		toFlush = b.count
	}

	result := make([]*Span, toFlush)
	for i := 0; i < toFlush; i++ {
		result[i] = b.data[b.head]
		b.data[b.head] = nil // 帮助 GC
		b.head = (b.head + 1) % b.capacity
		b.count--
	}

	return result
}

// Len 返回当前缓冲区中的元素数量
func (b *RingBuffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.count
}

// Cap 返回缓冲区容量
func (b *RingBuffer) Cap() int {
	return b.capacity
}

// DroppedCount 返回因缓冲区满而丢弃的 span 数量
func (b *RingBuffer) DroppedCount() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.droppedCount
}

// Clear 清空缓冲区
func (b *RingBuffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()

	for i := range b.data {
		b.data[i] = nil
	}
	b.head = 0
	b.tail = 0
	b.count = 0
}
