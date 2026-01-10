# Serverless 优化实施计划

## 1. 高优先级优化项

### 1.1 断路器模式

**文件**: `plugins/serverless/reliability/circuit_breaker.go`

```go
package reliability

import (
    "errors"
    "sync"
    "time"
)

var ErrCircuitOpen = errors.New("circuit breaker is open")

type State int

const (
    StateClosed State = iota
    StateOpen
    StateHalfOpen
)

type CircuitBreaker struct {
    mu sync.RWMutex
    
    name             string
    state            State
    failureCount     int
    successCount     int
    lastFailureTime  time.Time
    lastStateChange  time.Time
    
    // 配置
    failureThreshold int           // 失败阈值
    successThreshold int           // 半开状态成功阈值
    timeout          time.Duration // 开启状态超时时间
    
    // 回调
    onStateChange func(from, to State)
}

type CircuitBreakerConfig struct {
    Name             string
    FailureThreshold int
    SuccessThreshold int
    Timeout          time.Duration
    OnStateChange    func(from, to State)
}

func DefaultCircuitBreakerConfig(name string) CircuitBreakerConfig {
    return CircuitBreakerConfig{
        Name:             name,
        FailureThreshold: 5,
        SuccessThreshold: 3,
        Timeout:          30 * time.Second,
    }
}

func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
    return &CircuitBreaker{
        name:             config.Name,
        state:            StateClosed,
        failureThreshold: config.FailureThreshold,
        successThreshold: config.SuccessThreshold,
        timeout:          config.Timeout,
        onStateChange:    config.OnStateChange,
        lastStateChange:  time.Now(),
    }
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
    if !cb.AllowRequest() {
        return ErrCircuitOpen
    }
    
    err := fn()
    cb.RecordResult(err == nil)
    
    return err
}

func (cb *CircuitBreaker) AllowRequest() bool {
    cb.mu.RLock()
    state := cb.state
    lastChange := cb.lastStateChange
    cb.mu.RUnlock()
    
    switch state {
    case StateClosed:
        return true
    case StateOpen:
        if time.Since(lastChange) > cb.timeout {
            cb.mu.Lock()
            if cb.state == StateOpen {
                cb.transitionTo(StateHalfOpen)
            }
            cb.mu.Unlock()
            return true
        }
        return false
    case StateHalfOpen:
        return true
    }
    return false
}

func (cb *CircuitBreaker) RecordResult(success bool) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    switch cb.state {
    case StateClosed:
        if success {
            cb.failureCount = 0
        } else {
            cb.failureCount++
            cb.lastFailureTime = time.Now()
            if cb.failureCount >= cb.failureThreshold {
                cb.transitionTo(StateOpen)
            }
        }
    case StateHalfOpen:
        if success {
            cb.successCount++
            if cb.successCount >= cb.successThreshold {
                cb.transitionTo(StateClosed)
            }
        } else {
            cb.transitionTo(StateOpen)
        }
    }
}

func (cb *CircuitBreaker) transitionTo(newState State) {
    oldState := cb.state
    cb.state = newState
    cb.lastStateChange = time.Now()
    cb.failureCount = 0
    cb.successCount = 0
    
    if cb.onStateChange != nil {
        go cb.onStateChange(oldState, newState)
    }
}

func (cb *CircuitBreaker) State() State {
    cb.mu.RLock()
    defer cb.mu.RUnlock()
    return cb.state
}

func (cb *CircuitBreaker) Reset() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.state = StateClosed
    cb.failureCount = 0
    cb.successCount = 0
    cb.lastStateChange = time.Now()
}
```

### 1.2 动态池大小调整

**文件**: `plugins/serverless/runtime/dynamic_pool.go`

```go
package runtime

import (
    "context"
    "sync"
    "time"
)

type DynamicPoolConfig struct {
    MinSize            int
    MaxSize            int
    ScaleUpThreshold   float64 // 使用率超过此值时扩容
    ScaleDownThreshold float64 // 使用率低于此值时缩容
    ScaleInterval      time.Duration
}

func DefaultDynamicPoolConfig() DynamicPoolConfig {
    return DynamicPoolConfig{
        MinSize:            2,
        MaxSize:            16,
        ScaleUpThreshold:   0.8,
        ScaleDownThreshold: 0.3,
        ScaleInterval:      10 * time.Second,
    }
}

type DynamicPool struct {
    mu     sync.RWMutex
    config DynamicPoolConfig
    pool   *Pool
    
    // 统计
    totalRequests   int64
    totalWaitTime   time.Duration
    scaleUpCount    int
    scaleDownCount  int
    
    // 控制
    stopCh chan struct{}
    wg     sync.WaitGroup
}

func NewDynamicPool(config DynamicPoolConfig) (*DynamicPool, error) {
    pool, err := NewPool(config.MinSize)
    if err != nil {
        return nil, err
    }
    
    dp := &DynamicPool{
        config: config,
        pool:   pool,
        stopCh: make(chan struct{}),
    }
    
    // 启动自动扩缩容
    dp.wg.Add(1)
    go dp.autoScaleLoop()
    
    return dp, nil
}

func (dp *DynamicPool) Acquire(ctx context.Context) (*Engine, error) {
    start := time.Now()
    engine, err := dp.pool.Acquire(ctx)
    
    dp.mu.Lock()
    dp.totalRequests++
    dp.totalWaitTime += time.Since(start)
    dp.mu.Unlock()
    
    return engine, err
}

func (dp *DynamicPool) Release(engine *Engine) {
    dp.pool.Release(engine)
}

func (dp *DynamicPool) autoScaleLoop() {
    defer dp.wg.Done()
    
    ticker := time.NewTicker(dp.config.ScaleInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            dp.checkAndScale()
        case <-dp.stopCh:
            return
        }
    }
}

func (dp *DynamicPool) checkAndScale() {
    stats := dp.pool.Stats()
    usage := float64(stats.InUse) / float64(stats.Total)
    
    dp.mu.Lock()
    defer dp.mu.Unlock()
    
    if usage > dp.config.ScaleUpThreshold && stats.Total < dp.config.MaxSize {
        dp.scaleUp(1)
    } else if usage < dp.config.ScaleDownThreshold && stats.Total > dp.config.MinSize {
        dp.scaleDown(1)
    }
}

func (dp *DynamicPool) scaleUp(count int) {
    for i := 0; i < count; i++ {
        engine, err := NewEngine()
        if err != nil {
            break
        }
        dp.pool.instances <- engine
        dp.pool.size++
        dp.scaleUpCount++
    }
}

func (dp *DynamicPool) scaleDown(count int) {
    for i := 0; i < count; i++ {
        select {
        case engine := <-dp.pool.instances:
            engine.Close()
            dp.pool.size--
            dp.scaleDownCount++
        default:
            return
        }
    }
}

func (dp *DynamicPool) Stats() DynamicPoolStats {
    dp.mu.RLock()
    defer dp.mu.RUnlock()
    
    poolStats := dp.pool.Stats()
    
    return DynamicPoolStats{
        PoolStats:      poolStats,
        TotalRequests:  dp.totalRequests,
        AvgWaitTime:    dp.avgWaitTime(),
        ScaleUpCount:   dp.scaleUpCount,
        ScaleDownCount: dp.scaleDownCount,
    }
}

func (dp *DynamicPool) avgWaitTime() time.Duration {
    if dp.totalRequests == 0 {
        return 0
    }
    return dp.totalWaitTime / time.Duration(dp.totalRequests)
}

func (dp *DynamicPool) Close() error {
    close(dp.stopCh)
    dp.wg.Wait()
    return dp.pool.Close()
}

type DynamicPoolStats struct {
    PoolStats
    TotalRequests  int64
    AvgWaitTime    time.Duration
    ScaleUpCount   int
    ScaleDownCount int
}
```

### 1.3 指标收集

**文件**: `plugins/serverless/metrics/metrics.go`

```go
package metrics

import (
    "sync"
    "sync/atomic"
    "time"
)

// Metrics 收集 serverless 运行时指标
type Metrics struct {
    // 请求计数
    requestCount   int64
    successCount   int64
    errorCount     int64
    coldStartCount int64
    
    // 延迟统计
    latencySum     int64 // 纳秒
    latencyCount   int64
    latencyBuckets [12]int64 // 1ms, 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s
    
    // 池统计
    poolSize      int64
    poolInUse     int64
    poolAvailable int64
    
    // 内存统计
    memoryUsed    int64
    memoryLimit   int64
    
    // 时间窗口统计
    mu            sync.RWMutex
    windowStart   time.Time
    windowMetrics WindowMetrics
}

type WindowMetrics struct {
    RequestCount int64
    ErrorCount   int64
    LatencySum   int64
    LatencyCount int64
}

var bucketBounds = []time.Duration{
    1 * time.Millisecond,
    5 * time.Millisecond,
    10 * time.Millisecond,
    25 * time.Millisecond,
    50 * time.Millisecond,
    100 * time.Millisecond,
    250 * time.Millisecond,
    500 * time.Millisecond,
    1 * time.Second,
    2500 * time.Millisecond,
    5 * time.Second,
    10 * time.Second,
}

func NewMetrics() *Metrics {
    return &Metrics{
        windowStart: time.Now(),
    }
}

func (m *Metrics) RecordRequest(duration time.Duration, success bool, coldStart bool) {
    atomic.AddInt64(&m.requestCount, 1)
    
    if success {
        atomic.AddInt64(&m.successCount, 1)
    } else {
        atomic.AddInt64(&m.errorCount, 1)
    }
    
    if coldStart {
        atomic.AddInt64(&m.coldStartCount, 1)
    }
    
    // 记录延迟
    nanos := duration.Nanoseconds()
    atomic.AddInt64(&m.latencySum, nanos)
    atomic.AddInt64(&m.latencyCount, 1)
    
    // 更新直方图
    for i, bound := range bucketBounds {
        if duration <= bound {
            atomic.AddInt64(&m.latencyBuckets[i], 1)
            break
        }
    }
    
    // 更新窗口统计
    m.mu.Lock()
    m.windowMetrics.RequestCount++
    if !success {
        m.windowMetrics.ErrorCount++
    }
    m.windowMetrics.LatencySum += nanos
    m.windowMetrics.LatencyCount++
    m.mu.Unlock()
}

func (m *Metrics) UpdatePoolStats(size, inUse, available int) {
    atomic.StoreInt64(&m.poolSize, int64(size))
    atomic.StoreInt64(&m.poolInUse, int64(inUse))
    atomic.StoreInt64(&m.poolAvailable, int64(available))
}

func (m *Metrics) UpdateMemoryStats(used, limit int64) {
    atomic.StoreInt64(&m.memoryUsed, used)
    atomic.StoreInt64(&m.memoryLimit, limit)
}

func (m *Metrics) GetStats() Stats {
    m.mu.RLock()
    defer m.mu.RUnlock()
    
    requestCount := atomic.LoadInt64(&m.requestCount)
    latencyCount := atomic.LoadInt64(&m.latencyCount)
    
    var avgLatency time.Duration
    if latencyCount > 0 {
        avgLatency = time.Duration(atomic.LoadInt64(&m.latencySum) / latencyCount)
    }
    
    return Stats{
        RequestCount:   requestCount,
        SuccessCount:   atomic.LoadInt64(&m.successCount),
        ErrorCount:     atomic.LoadInt64(&m.errorCount),
        ColdStartCount: atomic.LoadInt64(&m.coldStartCount),
        AvgLatency:     avgLatency,
        PoolSize:       int(atomic.LoadInt64(&m.poolSize)),
        PoolInUse:      int(atomic.LoadInt64(&m.poolInUse)),
        PoolAvailable:  int(atomic.LoadInt64(&m.poolAvailable)),
        MemoryUsed:     atomic.LoadInt64(&m.memoryUsed),
        MemoryLimit:    atomic.LoadInt64(&m.memoryLimit),
    }
}

func (m *Metrics) GetWindowStats(windowDuration time.Duration) WindowStats {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    now := time.Now()
    elapsed := now.Sub(m.windowStart)
    
    stats := WindowStats{
        Duration:     elapsed,
        RequestCount: m.windowMetrics.RequestCount,
        ErrorCount:   m.windowMetrics.ErrorCount,
    }
    
    if m.windowMetrics.LatencyCount > 0 {
        stats.AvgLatency = time.Duration(m.windowMetrics.LatencySum / m.windowMetrics.LatencyCount)
    }
    
    if elapsed > 0 {
        stats.QPS = float64(m.windowMetrics.RequestCount) / elapsed.Seconds()
    }
    
    if m.windowMetrics.RequestCount > 0 {
        stats.ErrorRate = float64(m.windowMetrics.ErrorCount) / float64(m.windowMetrics.RequestCount)
    }
    
    // 重置窗口
    if elapsed >= windowDuration {
        m.windowStart = now
        m.windowMetrics = WindowMetrics{}
    }
    
    return stats
}

type Stats struct {
    RequestCount   int64
    SuccessCount   int64
    ErrorCount     int64
    ColdStartCount int64
    AvgLatency     time.Duration
    PoolSize       int
    PoolInUse      int
    PoolAvailable  int
    MemoryUsed     int64
    MemoryLimit    int64
}

type WindowStats struct {
    Duration     time.Duration
    RequestCount int64
    ErrorCount   int64
    AvgLatency   time.Duration
    QPS          float64
    ErrorRate    float64
}
```

---

## 2. 集成到现有代码

### 2.1 修改 `serverless.go`

```go
// 在 Plugin 结构体中添加
type Plugin struct {
    app            core.App
    config         Config
    pool           *runtime.Pool
    dynamicPool    *runtime.DynamicPool  // 新增
    httpTrigger    *triggers.HTTPTrigger
    loader         *loader.Loader
    metrics        *metrics.Metrics       // 新增
    circuitBreaker *reliability.CircuitBreaker // 新增
}

// 在 register() 中初始化
func (p *Plugin) register() error {
    // ... 现有代码 ...
    
    // 初始化指标收集
    p.metrics = metrics.NewMetrics()
    
    // 初始化断路器
    p.circuitBreaker = reliability.NewCircuitBreaker(
        reliability.DefaultCircuitBreakerConfig("serverless"),
    )
    
    // ... 其余代码 ...
}

// 在请求处理中使用断路器
func (p *Plugin) handleRequest(ctx context.Context, ...) error {
    return p.circuitBreaker.Execute(func() error {
        start := time.Now()
        err := p.executeFunction(ctx, ...)
        
        // 记录指标
        p.metrics.RecordRequest(time.Since(start), err == nil, coldStart)
        
        return err
    })
}
```

### 2.2 添加指标 API 端点

```go
// 在 registerRoutes() 中添加
e.Router.GET("/api/serverless/metrics", func(re *core.RequestEvent) error {
    stats := p.metrics.GetStats()
    windowStats := p.metrics.GetWindowStats(time.Minute)
    
    return re.JSON(http.StatusOK, map[string]any{
        "total": stats,
        "window": windowStats,
        "circuit_breaker": map[string]any{
            "state": p.circuitBreaker.State().String(),
        },
    })
})
```

---

## 3. 测试计划

### 3.1 断路器测试

```go
func TestCircuitBreaker(t *testing.T) {
    t.Run("正常情况保持关闭", func(t *testing.T) {
        cb := NewCircuitBreaker(DefaultCircuitBreakerConfig("test"))
        
        for i := 0; i < 10; i++ {
            err := cb.Execute(func() error { return nil })
            assert.NoError(t, err)
        }
        
        assert.Equal(t, StateClosed, cb.State())
    })
    
    t.Run("失败超过阈值后打开", func(t *testing.T) {
        cb := NewCircuitBreaker(CircuitBreakerConfig{
            FailureThreshold: 3,
            Timeout:          time.Second,
        })
        
        for i := 0; i < 3; i++ {
            cb.Execute(func() error { return errors.New("fail") })
        }
        
        assert.Equal(t, StateOpen, cb.State())
        
        // 打开状态拒绝请求
        err := cb.Execute(func() error { return nil })
        assert.Equal(t, ErrCircuitOpen, err)
    })
    
    t.Run("超时后进入半开状态", func(t *testing.T) {
        cb := NewCircuitBreaker(CircuitBreakerConfig{
            FailureThreshold: 1,
            SuccessThreshold: 1,
            Timeout:          100 * time.Millisecond,
        })
        
        cb.Execute(func() error { return errors.New("fail") })
        assert.Equal(t, StateOpen, cb.State())
        
        time.Sleep(150 * time.Millisecond)
        
        // 应该允许请求并进入半开状态
        cb.AllowRequest()
        assert.Equal(t, StateHalfOpen, cb.State())
    })
}
```

### 3.2 动态池测试

```go
func TestDynamicPool(t *testing.T) {
    t.Run("高负载时扩容", func(t *testing.T) {
        config := DynamicPoolConfig{
            MinSize:            2,
            MaxSize:            8,
            ScaleUpThreshold:   0.5,
            ScaleDownThreshold: 0.2,
            ScaleInterval:      100 * time.Millisecond,
        }
        
        pool, err := NewDynamicPool(config)
        require.NoError(t, err)
        defer pool.Close()
        
        // 获取所有实例模拟高负载
        engines := make([]*Engine, 0)
        for i := 0; i < 2; i++ {
            e, _ := pool.Acquire(context.Background())
            engines = append(engines, e)
        }
        
        // 等待扩容
        time.Sleep(200 * time.Millisecond)
        
        stats := pool.Stats()
        assert.Greater(t, stats.Total, 2)
        
        // 释放
        for _, e := range engines {
            pool.Release(e)
        }
    })
}
```

---

## 4. 部署检查清单

- [ ] 断路器配置合理（阈值、超时）
- [ ] 动态池配置合理（最小/最大大小）
- [ ] 指标端点已启用
- [ ] 告警规则已配置
- [ ] 性能基准测试已运行
- [ ] 文档已更新
