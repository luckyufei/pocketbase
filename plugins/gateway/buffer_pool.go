// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"sync"
	"sync/atomic"
)

// DefaultBufferSize 默认缓冲区大小（32KB）
// 与 io.Copy 默认值一致
// FR-017
const DefaultBufferSize = 32 * 1024

// BytesPoolStats 缓冲区池统计信息
type BytesPoolStats struct {
	Gets      int64 // 获取次数
	Puts      int64 // 归还次数
	Allocates int64 // 新分配次数（fallback）
}

// BytesPool 字节缓冲区池
// 实现 httputil.BufferPool 接口，用于减少 GC 压力
//
// FR-016: BufferPool 接口
// FR-017: 32KB 固定缓冲区
type BytesPool struct {
	pool       sync.Pool
	bufferSize int

	// 统计信息（原子操作）
	gets      int64
	puts      int64
	allocates int64
}

// defaultBytesPool 全局默认池（延迟初始化）
var (
	defaultBytesPool     *BytesPool
	defaultBytesPoolOnce sync.Once
)

// NewBytesPool 创建字节缓冲区池
// bufferSize <= 0 时使用默认大小
//
// T032, T033: 实现 BytesPool
func NewBytesPool(bufferSize int) *BytesPool {
	if bufferSize <= 0 {
		bufferSize = DefaultBufferSize
	}

	bp := &BytesPool{
		bufferSize: bufferSize,
	}

	bp.pool = sync.Pool{
		New: func() interface{} {
			// T034a: 内存池耗尽时的回退逻辑
			// 记录新分配（用于监控）
			atomic.AddInt64(&bp.allocates, 1)
			return make([]byte, bufferSize)
		},
	}

	return bp
}

// Get 获取缓冲区
// 实现 httputil.BufferPool.Get 接口
//
// T034: 实现接口
func (p *BytesPool) Get() []byte {
	atomic.AddInt64(&p.gets, 1)
	return p.pool.Get().([]byte)
}

// Put 归还缓冲区
// 实现 httputil.BufferPool.Put 接口
// nil 和错误大小的缓冲区被安全忽略
//
// T034: 实现接口
func (p *BytesPool) Put(b []byte) {
	// 安全检查：忽略 nil
	if b == nil {
		return
	}

	// 严格检查大小：只接受正确大小的缓冲区
	// 错误大小的缓冲区（可能来自其他地方）被忽略
	if len(b) != p.bufferSize {
		return
	}

	atomic.AddInt64(&p.puts, 1)
	p.pool.Put(b)
}

// BufferSize 返回缓冲区大小
func (p *BytesPool) BufferSize() int {
	return p.bufferSize
}

// Stats 返回统计信息
func (p *BytesPool) Stats() BytesPoolStats {
	return BytesPoolStats{
		Gets:      atomic.LoadInt64(&p.gets),
		Puts:      atomic.LoadInt64(&p.puts),
		Allocates: atomic.LoadInt64(&p.allocates),
	}
}

// DefaultBytesPool 返回全局默认缓冲区池
// 使用 32KB 缓冲区，单例模式
func DefaultBytesPool() *BytesPool {
	defaultBytesPoolOnce.Do(func() {
		defaultBytesPool = NewBytesPool(DefaultBufferSize)
	})
	return defaultBytesPool
}
