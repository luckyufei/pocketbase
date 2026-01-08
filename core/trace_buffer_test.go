package core_test

import (
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// Phase 2: Ring Buffer 测试
// ============================================================================

func createTestSpan(name string) *core.Span {
	return &core.Span{
		TraceID:   "0123456789abcdef0123456789abcdef",
		SpanID:    "0123456789abcdef",
		Name:      name,
		Kind:      core.SpanKindServer,
		StartTime: time.Now().UnixMicro(),
		Status:    core.SpanStatusOK,
	}
}

func TestNewRingBuffer(t *testing.T) {
	rb := core.NewRingBuffer(100)
	if rb == nil {
		t.Fatal("NewRingBuffer returned nil")
	}
	if rb.Capacity() != 100 {
		t.Errorf("Capacity() = %d, want 100", rb.Capacity())
	}
	if rb.Len() != 0 {
		t.Errorf("Len() = %d, want 0", rb.Len())
	}
}

func TestRingBufferPush(t *testing.T) {
	rb := core.NewRingBuffer(10)

	span := createTestSpan("test")
	ok := rb.Push(span)

	if !ok {
		t.Error("Push() returned false")
	}
	if rb.Len() != 1 {
		t.Errorf("Len() = %d, want 1", rb.Len())
	}
}

func TestRingBufferPushMultiple(t *testing.T) {
	rb := core.NewRingBuffer(10)

	for i := 0; i < 5; i++ {
		rb.Push(createTestSpan("test"))
	}

	if rb.Len() != 5 {
		t.Errorf("Len() = %d, want 5", rb.Len())
	}
}

func TestRingBufferFlush(t *testing.T) {
	rb := core.NewRingBuffer(10)

	for i := 0; i < 5; i++ {
		rb.Push(createTestSpan("test"))
	}

	spans := rb.Flush(3)
	if len(spans) != 3 {
		t.Errorf("Flush(3) returned %d spans, want 3", len(spans))
	}
	if rb.Len() != 2 {
		t.Errorf("Len() = %d, want 2", rb.Len())
	}

	spans = rb.Flush(10)
	if len(spans) != 2 {
		t.Errorf("Flush(10) returned %d spans, want 2", len(spans))
	}
	if rb.Len() != 0 {
		t.Errorf("Len() = %d, want 0", rb.Len())
	}
}

func TestRingBufferFlushEmpty(t *testing.T) {
	rb := core.NewRingBuffer(10)

	spans := rb.Flush(10)
	if spans != nil {
		t.Errorf("Flush() on empty buffer should return nil, got %v", spans)
	}
}

func TestRingBufferOverflow(t *testing.T) {
	rb := core.NewRingBuffer(5)

	// 填满 buffer
	for i := 0; i < 5; i++ {
		ok := rb.Push(createTestSpan("test"))
		if !ok {
			t.Errorf("Push %d failed", i)
		}
	}

	// 继续 push 应该溢出
	ok := rb.Push(createTestSpan("overflow"))
	if ok {
		t.Error("Push() should return false when buffer is full")
	}

	if rb.Overflow() != 1 {
		t.Errorf("Overflow() = %d, want 1", rb.Overflow())
	}

	// 再次溢出
	rb.Push(createTestSpan("overflow2"))
	if rb.Overflow() != 2 {
		t.Errorf("Overflow() = %d, want 2", rb.Overflow())
	}
}

func TestRingBufferWrapAround(t *testing.T) {
	rb := core.NewRingBuffer(3)

	// 写入 3 个
	for i := 0; i < 3; i++ {
		rb.Push(createTestSpan("span"))
	}

	// 读取 2 个
	spans := rb.Flush(2)
	if len(spans) != 2 {
		t.Errorf("Flush(2) returned %d spans", len(spans))
	}

	// 再写入 2 个（应该 wrap around）
	for i := 0; i < 2; i++ {
		ok := rb.Push(createTestSpan("new"))
		if !ok {
			t.Errorf("Push after flush failed")
		}
	}

	if rb.Len() != 3 {
		t.Errorf("Len() = %d, want 3", rb.Len())
	}

	// 读取所有
	spans = rb.Flush(10)
	if len(spans) != 3 {
		t.Errorf("Flush(10) returned %d spans, want 3", len(spans))
	}
}

func TestRingBufferConcurrentPush(t *testing.T) {
	rb := core.NewRingBuffer(1000)
	var wg sync.WaitGroup
	numGoroutines := 10
	pushPerGoroutine := 50

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < pushPerGoroutine; j++ {
				rb.Push(createTestSpan("concurrent"))
			}
		}()
	}

	wg.Wait()

	expected := numGoroutines * pushPerGoroutine
	if rb.Len() != expected {
		t.Errorf("Len() = %d, want %d", rb.Len(), expected)
	}
}

func TestRingBufferConcurrentPushAndFlush(t *testing.T) {
	rb := core.NewRingBuffer(100)
	var wg sync.WaitGroup
	var totalFlushed int64
	var mu sync.Mutex

	// 启动 push goroutines
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				rb.Push(createTestSpan("concurrent"))
				time.Sleep(time.Microsecond)
			}
		}()
	}

	// 启动 flush goroutines
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				spans := rb.Flush(10)
				mu.Lock()
				totalFlushed += int64(len(spans))
				mu.Unlock()
				time.Sleep(time.Microsecond * 10)
			}
		}()
	}

	wg.Wait()

	// 最终 flush 剩余的
	remaining := rb.Flush(1000)
	totalFlushed += int64(len(remaining))

	// 总共 push 了 500 个，加上溢出的应该等于 500
	totalPushed := totalFlushed + int64(rb.Overflow())
	if totalPushed != 500 {
		t.Errorf("totalPushed = %d, want 500 (flushed: %d, overflow: %d)",
			totalPushed, totalFlushed, rb.Overflow())
	}
}

func TestRingBufferResetOverflow(t *testing.T) {
	rb := core.NewRingBuffer(2)

	rb.Push(createTestSpan("1"))
	rb.Push(createTestSpan("2"))
	rb.Push(createTestSpan("overflow"))

	if rb.Overflow() != 1 {
		t.Errorf("Overflow() = %d, want 1", rb.Overflow())
	}

	rb.ResetOverflow()

	if rb.Overflow() != 0 {
		t.Errorf("Overflow() after reset = %d, want 0", rb.Overflow())
	}
}
