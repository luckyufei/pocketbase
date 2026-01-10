package runtime

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// DynamicPoolConfig 动态池配置
type DynamicPoolConfig struct {
	// MinSize 最小池大小
	MinSize int
	// MaxSize 最大池大小
	MaxSize int
	// InitialSize 初始池大小（0 表示使用 MinSize）
	InitialSize int
	// ScaleUpThreshold 扩容阈值（使用率超过此值时扩容）
	ScaleUpThreshold float64
	// ScaleDownThreshold 缩容阈值（使用率低于此值时缩容）
	ScaleDownThreshold float64
	// ScaleInterval 扩缩容检查间隔
	ScaleInterval time.Duration
	// ScaleUpStep 每次扩容的实例数
	ScaleUpStep int
	// ScaleDownStep 每次缩容的实例数
	ScaleDownStep int
	// IdleTimeout 空闲实例超时时间（超时后可被回收）
	IdleTimeout time.Duration
	// OnScaleUp 扩容回调
	OnScaleUp func(oldSize, newSize int)
	// OnScaleDown 缩容回调
	OnScaleDown func(oldSize, newSize int)
}

// DefaultDynamicPoolConfig 返回默认动态池配置
func DefaultDynamicPoolConfig() DynamicPoolConfig {
	return DynamicPoolConfig{
		MinSize:            2,
		MaxSize:            20,
		InitialSize:        0, // 使用 MinSize
		ScaleUpThreshold:   0.8,
		ScaleDownThreshold: 0.3,
		ScaleInterval:      5 * time.Second,
		ScaleUpStep:        2,
		ScaleDownStep:      1,
		IdleTimeout:        30 * time.Second,
	}
}

// DynamicPoolStats 动态池统计信息
type DynamicPoolStats struct {
	// Size 当前池大小
	Size int
	// Available 可用实例数
	Available int
	// InUse 使用中实例数
	InUse int
	// WaitingRequests 等待中的请求数
	WaitingRequests int
	// TotalCreated 总共创建的实例数
	TotalCreated int64
	// TotalDestroyed 总共销毁的实例数
	TotalDestroyed int64
	// Utilization 使用率 (0-1)
	Utilization float64
}

// DynamicPool 动态大小的实例池
type DynamicPool struct {
	config DynamicPoolConfig

	mu        sync.RWMutex
	instances chan *Engine
	inUse     int
	size      int
	closed    bool

	// 统计信息
	totalCreated   int64
	totalDestroyed int64
	waitingCount   int32

	// 控制
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewDynamicPool 创建新的动态池
func NewDynamicPool(config DynamicPoolConfig) (*DynamicPool, error) {
	// 验证配置
	if config.MinSize <= 0 {
		return nil, errors.New("MinSize 必须大于 0")
	}
	if config.MaxSize < config.MinSize {
		return nil, errors.New("MaxSize 必须大于等于 MinSize")
	}

	// 设置初始大小
	initialSize := config.InitialSize
	if initialSize <= 0 {
		initialSize = config.MinSize
	}
	if initialSize > config.MaxSize {
		initialSize = config.MaxSize
	}

	pool := &DynamicPool{
		config:    config,
		instances: make(chan *Engine, config.MaxSize),
		size:      0,
		stopCh:    make(chan struct{}),
	}

	// 预热实例
	for i := 0; i < initialSize; i++ {
		engine, err := NewEngine()
		if err != nil {
			pool.Close()
			return nil, err
		}
		pool.instances <- engine
		pool.size++
		atomic.AddInt64(&pool.totalCreated, 1)
	}

	// 启动自动扩缩容协程
	if config.ScaleInterval > 0 {
		pool.wg.Add(1)
		go pool.autoScaleLoop()
	}

	return pool, nil
}

// Acquire 从池中获取一个实例
func (p *DynamicPool) Acquire(ctx context.Context) (*Engine, error) {
	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return nil, errors.New("pool 已关闭")
	}
	p.mu.RUnlock()

	atomic.AddInt32(&p.waitingCount, 1)
	defer atomic.AddInt32(&p.waitingCount, -1)

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
func (p *DynamicPool) Release(engine *Engine) {
	if engine == nil {
		return
	}

	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		engine.Close()
		atomic.AddInt64(&p.totalDestroyed, 1)
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
		atomic.AddInt64(&p.totalDestroyed, 1)
		p.mu.Lock()
		p.size--
		p.mu.Unlock()
	}
}

// Stats 返回池统计信息
func (p *DynamicPool) Stats() DynamicPoolStats {
	p.mu.RLock()
	defer p.mu.RUnlock()

	available := len(p.instances)
	utilization := float64(0)
	if p.size > 0 {
		utilization = float64(p.inUse) / float64(p.size)
	}

	return DynamicPoolStats{
		Size:            p.size,
		Available:       available,
		InUse:           p.inUse,
		WaitingRequests: int(atomic.LoadInt32(&p.waitingCount)),
		TotalCreated:    atomic.LoadInt64(&p.totalCreated),
		TotalDestroyed:  atomic.LoadInt64(&p.totalDestroyed),
		Utilization:     utilization,
	}
}

// Close 关闭池并释放所有实例
func (p *DynamicPool) Close() error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil
	}
	p.closed = true
	p.mu.Unlock()

	// 停止自动扩缩容
	close(p.stopCh)
	p.wg.Wait()

	// 关闭实例通道并清理
	close(p.instances)
	for engine := range p.instances {
		engine.Close()
		atomic.AddInt64(&p.totalDestroyed, 1)
	}

	return nil
}

// autoScaleLoop 自动扩缩容循环
func (p *DynamicPool) autoScaleLoop() {
	defer p.wg.Done()

	ticker := time.NewTicker(p.config.ScaleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopCh:
			return
		case <-ticker.C:
			p.checkAndScale()
		}
	}
}

// checkAndScale 检查并执行扩缩容
func (p *DynamicPool) checkAndScale() {
	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return
	}

	size := p.size
	inUse := p.inUse
	p.mu.RUnlock()

	if size == 0 {
		return
	}

	utilization := float64(inUse) / float64(size)

	// 检查是否需要扩容
	if utilization > p.config.ScaleUpThreshold && size < p.config.MaxSize {
		p.scaleUp()
		return
	}

	// 检查是否需要缩容
	if utilization < p.config.ScaleDownThreshold && size > p.config.MinSize {
		p.scaleDown()
	}
}

// scaleUp 扩容
func (p *DynamicPool) scaleUp() {
	p.mu.Lock()
	if p.closed || p.size >= p.config.MaxSize {
		p.mu.Unlock()
		return
	}

	oldSize := p.size
	targetSize := p.size + p.config.ScaleUpStep
	if targetSize > p.config.MaxSize {
		targetSize = p.config.MaxSize
	}
	toCreate := targetSize - p.size
	p.mu.Unlock()

	// 创建新实例
	created := 0
	for i := 0; i < toCreate; i++ {
		engine, err := NewEngine()
		if err != nil {
			break
		}

		p.mu.Lock()
		if p.closed || p.size >= p.config.MaxSize {
			p.mu.Unlock()
			engine.Close()
			break
		}
		p.size++
		p.mu.Unlock()

		select {
		case p.instances <- engine:
			atomic.AddInt64(&p.totalCreated, 1)
			created++
		default:
			engine.Close()
			p.mu.Lock()
			p.size--
			p.mu.Unlock()
		}
	}

	// 触发回调
	if created > 0 && p.config.OnScaleUp != nil {
		p.config.OnScaleUp(oldSize, oldSize+created)
	}
}

// scaleDown 缩容
func (p *DynamicPool) scaleDown() {
	p.mu.Lock()
	if p.closed || p.size <= p.config.MinSize {
		p.mu.Unlock()
		return
	}

	oldSize := p.size
	toRemove := p.config.ScaleDownStep
	if p.size-toRemove < p.config.MinSize {
		toRemove = p.size - p.config.MinSize
	}
	p.mu.Unlock()

	// 移除空闲实例
	removed := 0
	for i := 0; i < toRemove; i++ {
		select {
		case engine := <-p.instances:
			engine.Close()
			atomic.AddInt64(&p.totalDestroyed, 1)
			p.mu.Lock()
			p.size--
			p.mu.Unlock()
			removed++
		default:
			// 没有空闲实例可移除
			break
		}
	}

	// 触发回调
	if removed > 0 && p.config.OnScaleDown != nil {
		p.config.OnScaleDown(oldSize, oldSize-removed)
	}
}
