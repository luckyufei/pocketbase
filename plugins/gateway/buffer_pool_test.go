package gateway

import (
	"sync"
	"testing"
)

// TestNewBytesPool 验证 BytesPool 创建
func TestNewBytesPool(t *testing.T) {
	tests := []struct {
		name       string
		bufferSize int
		wantSize   int
	}{
		{"default 32KB", 32 * 1024, 32 * 1024},
		{"custom 64KB", 64 * 1024, 64 * 1024},
		{"small 1KB", 1024, 1024},
		{"zero uses default", 0, DefaultBufferSize},
		{"negative uses default", -1, DefaultBufferSize},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pool := NewBytesPool(tt.bufferSize)
			if pool == nil {
				t.Fatal("NewBytesPool should not return nil")
			}

			if pool.BufferSize() != tt.wantSize {
				t.Errorf("BufferSize: want %d, got %d", tt.wantSize, pool.BufferSize())
			}
		})
	}
}

// TestBytesPoolGetPut 验证基本获取和归还
func TestBytesPoolGetPut(t *testing.T) {
	pool := NewBytesPool(1024)

	// 获取缓冲区
	buf := pool.Get()
	if buf == nil {
		t.Fatal("Get() should not return nil")
	}
	if len(buf) != 1024 {
		t.Errorf("Buffer length: want 1024, got %d", len(buf))
	}

	// 归还缓冲区
	pool.Put(buf)

	// 再次获取应该返回同一个缓冲区（复用）
	buf2 := pool.Get()
	if buf2 == nil {
		t.Fatal("Second Get() should not return nil")
	}
}

// TestBytesPoolReuse 验证缓冲区复用
func TestBytesPoolReuse(t *testing.T) {
	pool := NewBytesPool(1024)

	// 获取并标记缓冲区
	buf1 := pool.Get()
	buf1[0] = 0xAA
	buf1[1] = 0xBB
	pool.Put(buf1)

	// 获取应该是同一个（内容被复用）
	buf2 := pool.Get()
	if buf2[0] != 0xAA || buf2[1] != 0xBB {
		t.Log("Buffer was not reused (this may happen under GC pressure)")
	}
}

// TestBytesPoolInterface 验证 httputil.BufferPool 接口实现
func TestBytesPoolInterface(t *testing.T) {
	pool := NewBytesPool(32 * 1024)

	// 验证 Get 返回 []byte
	var buf []byte = pool.Get()
	if buf == nil {
		t.Error("Get() should return []byte")
	}

	// 验证 Put 接受 []byte
	pool.Put(buf)
}

// TestBytesPoolConcurrency 验证并发安全性
func TestBytesPoolConcurrency(t *testing.T) {
	pool := NewBytesPool(1024)
	var wg sync.WaitGroup

	// 并发获取和归还
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			buf := pool.Get()
			if buf == nil {
				t.Error("Get() returned nil in concurrent access")
				return
			}

			// 模拟使用
			buf[0] = 0xFF

			pool.Put(buf)
		}()
	}

	wg.Wait()
}

// TestBytesPoolFallback 验证内存池耗尽时的回退逻辑 (T034a)
func TestBytesPoolFallback(t *testing.T) {
	pool := NewBytesPool(1024)

	// 即使 sync.Pool 内部机制复杂，Get 应该总是返回有效缓冲区
	// 因为 New 函数会在需要时创建新的
	buffers := make([][]byte, 100)
	for i := 0; i < 100; i++ {
		buffers[i] = pool.Get()
		if buffers[i] == nil {
			t.Errorf("Get() returned nil at iteration %d", i)
		}
	}

	// 归还所有
	for _, buf := range buffers {
		pool.Put(buf)
	}
}

// TestBytesPoolPutNil 验证 Put(nil) 安全
func TestBytesPoolPutNil(t *testing.T) {
	pool := NewBytesPool(1024)

	// Put nil 不应该 panic
	pool.Put(nil)

	// 仍然能正常获取
	buf := pool.Get()
	if buf == nil {
		t.Error("Get() returned nil after Put(nil)")
	}
}

// TestBytesPoolPutWrongSize 验证 Put 错误大小的缓冲区
func TestBytesPoolPutWrongSize(t *testing.T) {
	pool := NewBytesPool(1024)

	// Put 错误大小的缓冲区应该被忽略或安全处理
	wrongSizeBuf := make([]byte, 512)
	pool.Put(wrongSizeBuf) // 不应该 panic

	// 获取应该返回正确大小
	buf := pool.Get()
	if len(buf) != 1024 {
		t.Errorf("Get() returned wrong size after Put wrong size: %d", len(buf))
	}
}

// TestBytesPoolStats 验证统计信息
func TestBytesPoolStats(t *testing.T) {
	pool := NewBytesPool(1024)

	// 初始统计
	stats := pool.Stats()
	if stats.Gets != 0 || stats.Puts != 0 {
		t.Error("Initial stats should be zero")
	}

	// 执行操作
	buf := pool.Get()
	pool.Put(buf)

	// 更新后的统计
	stats = pool.Stats()
	if stats.Gets != 1 {
		t.Errorf("Gets: want 1, got %d", stats.Gets)
	}
	if stats.Puts != 1 {
		t.Errorf("Puts: want 1, got %d", stats.Puts)
	}
}

// TestDefaultBytesPool 验证全局默认池
func TestDefaultBytesPool(t *testing.T) {
	pool := DefaultBytesPool()

	if pool == nil {
		t.Fatal("DefaultBytesPool should not return nil")
	}

	if pool.BufferSize() != DefaultBufferSize {
		t.Errorf("Default BufferSize: want %d, got %d", DefaultBufferSize, pool.BufferSize())
	}
}

// BenchmarkBytesPoolGetPut 性能基准测试
func BenchmarkBytesPoolGetPut(b *testing.B) {
	pool := NewBytesPool(32 * 1024)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			buf := pool.Get()
			pool.Put(buf)
		}
	})
}

// BenchmarkBytesPoolVsAllocate 对比直接分配
func BenchmarkBytesPoolVsAllocate(b *testing.B) {
	b.Run("Pool", func(b *testing.B) {
		pool := NewBytesPool(32 * 1024)
		for i := 0; i < b.N; i++ {
			buf := pool.Get()
			pool.Put(buf)
		}
	})

	b.Run("Allocate", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			buf := make([]byte, 32*1024)
			_ = buf
		}
	})
}
