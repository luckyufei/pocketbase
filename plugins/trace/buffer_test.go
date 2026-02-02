package trace

import (
	"testing"
)

// TestRingBufferNew 测试创建 RingBuffer
func TestRingBufferNew(t *testing.T) {
	t.Run("创建指定大小的 buffer", func(t *testing.T) {
		buf := NewRingBuffer(100)
		if buf == nil {
			t.Fatal("NewRingBuffer should not return nil")
		}
		if buf.Cap() != 100 {
			t.Errorf("Cap() should be 100, got %d", buf.Cap())
		}
		if buf.Len() != 0 {
			t.Errorf("Len() should be 0, got %d", buf.Len())
		}
	})

	t.Run("大小为0时使用默认值", func(t *testing.T) {
		buf := NewRingBuffer(0)
		if buf.Cap() != defaultBufferSize {
			t.Errorf("Cap() should be %d, got %d", defaultBufferSize, buf.Cap())
		}
	})

	t.Run("负数大小时使用默认值", func(t *testing.T) {
		buf := NewRingBuffer(-1)
		if buf.Cap() != defaultBufferSize {
			t.Errorf("Cap() should be %d, got %d", defaultBufferSize, buf.Cap())
		}
	})
}

// TestRingBufferPush 测试 Push 操作
func TestRingBufferPush(t *testing.T) {
	t.Run("成功 Push span", func(t *testing.T) {
		buf := NewRingBuffer(10)
		span := &Span{TraceID: "trace-1", Name: "test"}

		ok := buf.Push(span)
		if !ok {
			t.Error("Push should return true")
		}
		if buf.Len() != 1 {
			t.Errorf("Len() should be 1, got %d", buf.Len())
		}
	})

	t.Run("Push nil span 被忽略", func(t *testing.T) {
		buf := NewRingBuffer(10)

		ok := buf.Push(nil)
		if ok {
			t.Error("Push nil should return false")
		}
		if buf.Len() != 0 {
			t.Errorf("Len() should be 0, got %d", buf.Len())
		}
	})

	t.Run("buffer 满时丢弃旧数据", func(t *testing.T) {
		buf := NewRingBuffer(3)

		// 填满 buffer
		for i := 0; i < 3; i++ {
			buf.Push(&Span{TraceID: "trace-1", Name: "span-" + string(rune('a'+i))})
		}

		// 再 push 一个
		ok := buf.Push(&Span{TraceID: "trace-1", Name: "span-d"})
		if !ok {
			t.Error("Push to full buffer should still return true (overwrite)")
		}

		// 验证最旧的被丢弃
		spans := buf.Flush(10)
		if len(spans) != 3 {
			t.Errorf("Expected 3 spans, got %d", len(spans))
		}
		// 验证 span-a 被丢弃
		for _, s := range spans {
			if s.Name == "span-a" {
				t.Error("span-a should have been dropped")
			}
		}
	})

	t.Run("并发 Push", func(t *testing.T) {
		buf := NewRingBuffer(1000)
		done := make(chan bool)

		// 启动多个 goroutine 并发 push
		for i := 0; i < 10; i++ {
			go func(id int) {
				for j := 0; j < 100; j++ {
					buf.Push(&Span{TraceID: "trace-1", Name: "span"})
				}
				done <- true
			}(i)
		}

		// 等待所有 goroutine 完成
		for i := 0; i < 10; i++ {
			<-done
		}

		// 验证没有丢失数据（buffer 够大）
		if buf.Len() != 1000 {
			t.Errorf("Expected 1000 spans, got %d", buf.Len())
		}
	})
}

// TestRingBufferFlush 测试 Flush 操作
func TestRingBufferFlush(t *testing.T) {
	t.Run("Flush 空 buffer", func(t *testing.T) {
		buf := NewRingBuffer(10)
		spans := buf.Flush(10)
		if len(spans) != 0 {
			t.Errorf("Flush empty buffer should return empty slice, got %d", len(spans))
		}
	})

	t.Run("Flush 部分数据", func(t *testing.T) {
		buf := NewRingBuffer(10)
		for i := 0; i < 5; i++ {
			buf.Push(&Span{TraceID: "trace-1", Name: "span"})
		}

		spans := buf.Flush(3)
		if len(spans) != 3 {
			t.Errorf("Expected 3 spans, got %d", len(spans))
		}
		if buf.Len() != 2 {
			t.Errorf("Expected 2 remaining, got %d", buf.Len())
		}
	})

	t.Run("Flush 全部数据", func(t *testing.T) {
		buf := NewRingBuffer(10)
		for i := 0; i < 5; i++ {
			buf.Push(&Span{TraceID: "trace-1", Name: "span"})
		}

		spans := buf.Flush(10)
		if len(spans) != 5 {
			t.Errorf("Expected 5 spans, got %d", len(spans))
		}
		if buf.Len() != 0 {
			t.Errorf("Expected 0 remaining, got %d", buf.Len())
		}
	})

	t.Run("Flush 保持 FIFO 顺序", func(t *testing.T) {
		buf := NewRingBuffer(10)
		for i := 0; i < 5; i++ {
			buf.Push(&Span{TraceID: "trace-1", Name: "span-" + string(rune('a'+i))})
		}

		spans := buf.Flush(5)
		for i, s := range spans {
			expected := "span-" + string(rune('a'+i))
			if s.Name != expected {
				t.Errorf("Expected %s, got %s", expected, s.Name)
			}
		}
	})
}

// TestRingBufferStats 测试统计方法
func TestRingBufferStats(t *testing.T) {
	buf := NewRingBuffer(100)

	// 初始状态
	if buf.Len() != 0 {
		t.Errorf("Initial Len() should be 0, got %d", buf.Len())
	}
	if buf.Cap() != 100 {
		t.Errorf("Cap() should be 100, got %d", buf.Cap())
	}
	if buf.DroppedCount() != 0 {
		t.Errorf("Initial DroppedCount() should be 0, got %d", buf.DroppedCount())
	}

	// Push 一些数据
	for i := 0; i < 50; i++ {
		buf.Push(&Span{TraceID: "trace-1", Name: "span"})
	}

	if buf.Len() != 50 {
		t.Errorf("Len() should be 50, got %d", buf.Len())
	}
}

// TestRingBufferDropCount 测试丢弃计数
func TestRingBufferDropCount(t *testing.T) {
	buf := NewRingBuffer(3)

	// 填满 buffer
	for i := 0; i < 3; i++ {
		buf.Push(&Span{TraceID: "trace-1", Name: "span"})
	}

	if buf.DroppedCount() != 0 {
		t.Errorf("DroppedCount should be 0, got %d", buf.DroppedCount())
	}

	// 再 push 2 个（会丢弃 2 个）
	buf.Push(&Span{TraceID: "trace-1", Name: "span"})
	buf.Push(&Span{TraceID: "trace-1", Name: "span"})

	if buf.DroppedCount() != 2 {
		t.Errorf("DroppedCount should be 2, got %d", buf.DroppedCount())
	}
}

// TestRingBufferClear 测试 Clear 操作
func TestRingBufferClear(t *testing.T) {
	t.Run("清空缓冲区", func(t *testing.T) {
		buf := NewRingBuffer(10)

		// 添加一些数据
		for i := 0; i < 5; i++ {
			buf.Push(&Span{TraceID: "trace-1", Name: "span"})
		}

		if buf.Len() != 5 {
			t.Errorf("Expected 5 spans before clear, got %d", buf.Len())
		}

		// 清空
		buf.Clear()

		if buf.Len() != 0 {
			t.Errorf("Expected 0 spans after clear, got %d", buf.Len())
		}

		// 清空后还能正常使用
		buf.Push(&Span{TraceID: "trace-2", Name: "new-span"})
		if buf.Len() != 1 {
			t.Errorf("Expected 1 span after push, got %d", buf.Len())
		}
	})

	t.Run("清空空缓冲区", func(t *testing.T) {
		buf := NewRingBuffer(10)
		buf.Clear() // 不应 panic

		if buf.Len() != 0 {
			t.Errorf("Expected 0 after clearing empty buffer, got %d", buf.Len())
		}
	})

	t.Run("清空后 DroppedCount 不变", func(t *testing.T) {
		buf := NewRingBuffer(3)

		// 填满并溢出
		for i := 0; i < 5; i++ {
			buf.Push(&Span{TraceID: "trace-1", Name: "span"})
		}

		droppedBefore := buf.DroppedCount()
		buf.Clear()

		// DroppedCount 应该保持不变
		if buf.DroppedCount() != droppedBefore {
			t.Errorf("DroppedCount should remain %d after clear, got %d", droppedBefore, buf.DroppedCount())
		}
	})
}

// TestRingBufferFlushWithZeroOrNegativeN 测试 Flush 边界条件
func TestRingBufferFlushWithZeroOrNegativeN(t *testing.T) {
	buf := NewRingBuffer(10)
	for i := 0; i < 5; i++ {
		buf.Push(&Span{TraceID: "trace-1", Name: "span"})
	}

	t.Run("Flush 0 个返回 nil", func(t *testing.T) {
		spans := buf.Flush(0)
		if spans != nil {
			t.Errorf("Flush(0) should return nil, got %v", spans)
		}
	})

	t.Run("Flush 负数返回 nil", func(t *testing.T) {
		spans := buf.Flush(-1)
		if spans != nil {
			t.Errorf("Flush(-1) should return nil, got %v", spans)
		}
	})
}
