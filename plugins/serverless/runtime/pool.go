package runtime

import (
	"context"
	"errors"
	"sync"
)

// PoolStats 实例池统计信息
type PoolStats struct {
	Total     int // 总实例数
	InUse     int // 使用中的实例数
	Available int // 可用实例数
}

// Pool 是 WASM 运行时实例池
type Pool struct {
	mu        sync.Mutex
	size      int
	instances chan *Engine
	inUse     int
	closed    bool
}

// NewPool 创建新的实例池并预热指定数量的实例
func NewPool(size int) (*Pool, error) {
	if size <= 0 {
		return nil, errors.New("pool size 必须大于 0")
	}

	pool := &Pool{
		size:      size,
		instances: make(chan *Engine, size),
	}

	// 预热实例
	for i := 0; i < size; i++ {
		engine, err := NewEngine()
		if err != nil {
			pool.Close()
			return nil, err
		}
		pool.instances <- engine
	}

	return pool, nil
}

// Size 返回池大小
func (p *Pool) Size() int {
	return p.size
}

// Available 返回可用实例数
func (p *Pool) Available() int {
	return len(p.instances)
}

// Acquire 从池中获取一个实例
// 如果没有可用实例，会阻塞直到有实例可用或上下文取消
func (p *Pool) Acquire(ctx context.Context) (*Engine, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil, errors.New("pool 已关闭")
	}
	p.mu.Unlock()

	select {
	case engine := <-p.instances:
		p.mu.Lock()
		p.inUse++
		p.mu.Unlock()
		return engine, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Release 将实例归还到池中
func (p *Pool) Release(engine *Engine) {
	if engine == nil {
		return
	}

	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		engine.Close()
		return
	}
	p.inUse--
	p.mu.Unlock()

	// 重置实例状态
	engine.Reset()

	select {
	case p.instances <- engine:
		// 成功归还
	default:
		// 池已满，关闭多余实例
		engine.Close()
	}
}

// Stats 返回池统计信息
func (p *Pool) Stats() PoolStats {
	p.mu.Lock()
	defer p.mu.Unlock()

	return PoolStats{
		Total:     p.size,
		InUse:     p.inUse,
		Available: len(p.instances),
	}
}

// Close 关闭池并释放所有实例
func (p *Pool) Close() error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil
	}
	p.closed = true
	p.mu.Unlock()

	close(p.instances)
	for engine := range p.instances {
		engine.Close()
	}

	return nil
}
