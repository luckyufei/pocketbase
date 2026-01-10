# Serverless 性能优化与可靠性提升研究报告

## 1. 概述

本文档调研业内 Serverless 场景的性能优化和可靠性提升方法，并分析如何应用到 PocketBase Serverless 插件中。

### 1.1 当前 PocketBase Serverless 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    PocketBase Serverless                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Loader    │  │  Runtime    │  │     Triggers        │  │
│  │  (bytecode) │  │   Pool      │  │  (HTTP/Hook/Cron)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │              │
│         ▼                ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              QuickJS WASM (wazero)                   │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │    │
│  │  │Engine 1 │  │Engine 2 │  │Engine 3 │  │Engine N │ │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 调研范围

- 冷启动优化
- 运行时性能优化
- 内存管理优化
- 可靠性与容错
- 可观测性
- 安全隔离

---

## 2. 业内最佳实践

### 2.1 冷启动优化

#### 2.1.1 华为云进程级快照 (Process-level Snapshot)

**原理**: 将已初始化的运行时状态保存为快照，新请求直接从快照恢复，跳过初始化过程。

**效果**: 冷启动速度提升 90%

**实现方式**:
```
传统冷启动:
[创建容器] → [加载运行时] → [初始化代码] → [执行请求]
    100ms       50ms           100ms           10ms
    
快照恢复:
[恢复快照] → [执行请求]
    20ms         10ms
```

**PocketBase 应用方案**:
```go
// 建议实现: 运行时快照
type RuntimeSnapshot struct {
    // WASM 内存快照
    Memory []byte
    // 全局变量状态
    Globals map[string]interface{}
    // 已加载的模块
    LoadedModules []string
}

// 从快照恢复引擎
func (p *Pool) AcquireFromSnapshot(ctx context.Context, snapshot *RuntimeSnapshot) (*Engine, error)
```

#### 2.1.2 预热池 (Warm Pool)

**原理**: 预先创建并初始化一定数量的运行时实例，请求到来时直接使用。

**当前状态**: ✅ 已实现 (`runtime/pool.go`)

**优化建议**:
1. **动态池大小调整**: 根据负载自动扩缩容
2. **分级预热**: 热门函数预热更多实例
3. **预测性预热**: 基于历史流量模式预测并预热

```go
// 建议实现: 动态池管理
type DynamicPool struct {
    minSize     int
    maxSize     int
    scaleUpThreshold   float64  // 使用率超过此值时扩容
    scaleDownThreshold float64  // 使用率低于此值时缩容
    
    // 流量预测
    trafficPredictor *TrafficPredictor
}

func (p *DynamicPool) AutoScale(ctx context.Context) {
    usage := float64(p.InUse()) / float64(p.Size())
    
    if usage > p.scaleUpThreshold && p.Size() < p.maxSize {
        p.ScaleUp(1)
    } else if usage < p.scaleDownThreshold && p.Size() > p.minSize {
        p.ScaleDown(1)
    }
}
```

#### 2.1.3 字节码预编译 (Bytecode Pre-compilation)

**原理**: 将 JavaScript 代码预编译为字节码，避免运行时解析开销。

**当前状态**: ✅ 已实现 (`loader/bytecode.go`)

**优化建议**:
1. **AOT 编译**: 使用 wazero 的 AOT 编译功能
2. **增量编译**: 只重新编译修改的文件
3. **编译缓存持久化**: 将编译结果保存到磁盘

```go
// 建议实现: AOT 编译缓存
type AOTCache struct {
    cacheDir string
    
    // 编译后的机器码缓存
    compiledModules map[string]*CompiledModule
}

func (c *AOTCache) GetOrCompile(wasmBytes []byte) (*CompiledModule, error) {
    hash := sha256.Sum256(wasmBytes)
    key := hex.EncodeToString(hash[:])
    
    // 检查磁盘缓存
    if cached, err := c.loadFromDisk(key); err == nil {
        return cached, nil
    }
    
    // AOT 编译
    compiled, err := wazero.CompileModule(wasmBytes, wazero.NewCompileConfig().
        WithMemorySizer(func(min, max uint32) uint32 {
            return max // 预分配最大内存
        }))
    
    // 保存到磁盘
    c.saveToDisk(key, compiled)
    
    return compiled, nil
}
```

### 2.2 运行时性能优化

#### 2.2.1 V8 Isolate 池化 (Cloudflare Workers 方案)

**原理**: Cloudflare Workers 使用 V8 Isolate 而非容器，每个 Isolate 启动时间仅 5ms。

**PocketBase 对应**: QuickJS WASM 实例池

**优化建议**:
1. **实例复用**: 同一函数的请求复用同一实例
2. **状态隔离**: 确保请求间状态完全隔离
3. **资源限制**: 精确控制每个实例的 CPU 和内存

```go
// 建议实现: 函数级实例池
type FunctionPool struct {
    // 按函数名分组的实例池
    pools map[string]*Pool
    
    // 全局共享池（用于冷函数）
    sharedPool *Pool
}

func (fp *FunctionPool) Acquire(ctx context.Context, functionName string) (*Engine, error) {
    // 热门函数使用专用池
    if pool, ok := fp.pools[functionName]; ok {
        return pool.Acquire(ctx)
    }
    
    // 冷函数使用共享池
    return fp.sharedPool.Acquire(ctx)
}
```

#### 2.2.2 JIT 优化提示

**原理**: 为 JavaScript 引擎提供类型提示，帮助 JIT 编译器生成更优代码。

**QuickJS 特点**: QuickJS 不支持 JIT，但支持字节码优化。

**优化建议**:
1. **内联缓存**: 缓存属性访问路径
2. **类型特化**: 为常见类型生成特化代码
3. **死代码消除**: 移除未使用的代码

```go
// 建议实现: 字节码优化器
type BytecodeOptimizer struct {
    // 优化级别
    level OptimizationLevel
}

const (
    OptNone OptimizationLevel = iota
    OptBasic    // 基本优化：常量折叠、死代码消除
    OptAggressive // 激进优化：内联、循环展开
)

func (o *BytecodeOptimizer) Optimize(bytecode []byte) []byte {
    switch o.level {
    case OptBasic:
        bytecode = o.constantFolding(bytecode)
        bytecode = o.deadCodeElimination(bytecode)
    case OptAggressive:
        bytecode = o.inlineFunctions(bytecode)
        bytecode = o.loopUnrolling(bytecode)
    }
    return bytecode
}
```

#### 2.2.3 内存预分配

**原理**: 预先分配 WASM 线性内存，避免运行时内存增长开销。

**当前状态**: 部分实现（配置了 MaxMemory）

**优化建议**:
```go
// 建议实现: 内存预分配策略
type MemoryConfig struct {
    // 初始内存大小
    InitialMemory uint64
    
    // 最大内存大小
    MaxMemory uint64
    
    // 内存增长步长
    GrowthStep uint64
    
    // 是否预分配
    Preallocate bool
}

func NewEngineWithMemory(config MemoryConfig) (*Engine, error) {
    // 预分配内存
    if config.Preallocate {
        memory := make([]byte, config.InitialMemory)
        // 触发物理页分配
        for i := 0; i < len(memory); i += 4096 {
            memory[i] = 0
        }
    }
    // ...
}
```

### 2.3 内存管理优化

#### 2.3.1 分代垃圾回收

**原理**: 将对象按存活时间分代，对不同代采用不同回收策略。

**QuickJS GC**: QuickJS 使用引用计数 + 循环检测

**优化建议**:
1. **增量 GC**: 将 GC 工作分散到多个时间片
2. **并发 GC**: 在后台线程执行 GC
3. **GC 调优**: 根据工作负载调整 GC 参数

```go
// 建议实现: GC 调优接口
type GCConfig struct {
    // GC 触发阈值（已分配内存）
    Threshold uint64
    
    // 增量 GC 时间片（毫秒）
    IncrementalSliceMs int
    
    // 是否启用并发 GC
    ConcurrentGC bool
}

func (e *Engine) ConfigureGC(config GCConfig) error {
    // 通过 Host Function 配置 QuickJS GC
    return e.callHostFn("__pb_configure_gc", config)
}
```

#### 2.3.2 内存池

**原理**: 复用已分配的内存块，减少分配/释放开销。

**优化建议**:
```go
// 建议实现: 对象池
var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 0, 4096)
    },
}

func (e *Engine) Execute(ctx context.Context, code string, cfg RuntimeConfig) (*ExecuteResult, error) {
    // 从池中获取缓冲区
    buf := bufferPool.Get().([]byte)
    defer bufferPool.Put(buf[:0])
    
    // 使用缓冲区...
}
```

#### 2.3.3 内存限制与 OOM 保护

**原理**: 限制单个实例的内存使用，防止 OOM 影响其他实例。

**当前状态**: ✅ 已实现（MaxMemoryMB 配置）

**优化建议**:
1. **软限制**: 接近限制时触发 GC
2. **硬限制**: 超过限制时终止执行
3. **内存监控**: 实时监控内存使用

```go
// 建议实现: 内存监控
type MemoryMonitor struct {
    softLimit uint64
    hardLimit uint64
    
    // 内存使用回调
    onSoftLimit func()
    onHardLimit func() error
}

func (m *MemoryMonitor) Check(currentUsage uint64) error {
    if currentUsage >= m.hardLimit {
        return m.onHardLimit()
    }
    
    if currentUsage >= m.softLimit {
        m.onSoftLimit() // 触发 GC
    }
    
    return nil
}
```

### 2.4 可靠性与容错

#### 2.4.1 断路器模式 (Circuit Breaker)

**原理**: 当错误率超过阈值时，自动"熔断"，快速失败而非等待超时。

**状态机**:
```
     成功请求
  ┌────────────┐
  │            ▼
┌─┴──┐     ┌──────┐     超时后      ┌───────────┐
│关闭│────▶│ 打开 │───────────────▶│ 半开      │
└────┘     └──────┘                 └───────────┘
  ▲         失败率                    │  │
  │         超阈值                    │  │
  │                                   │  │
  └───────────────────────────────────┘  │
           成功请求                       │
                                         │
  ┌──────────────────────────────────────┘
  │ 失败请求
  ▼
┌──────┐
│ 打开 │
└──────┘
```

**建议实现**:
```go
// 建议实现: 断路器
type CircuitBreaker struct {
    name          string
    state         State
    failureCount  int
    successCount  int
    
    // 配置
    failureThreshold int
    successThreshold int
    timeout          time.Duration
    
    // 状态转换时间
    lastStateChange time.Time
}

type State int

const (
    StateClosed State = iota
    StateOpen
    StateHalfOpen
)

func (cb *CircuitBreaker) Execute(fn func() error) error {
    if !cb.AllowRequest() {
        return ErrCircuitOpen
    }
    
    err := fn()
    cb.RecordResult(err == nil)
    
    return err
}

func (cb *CircuitBreaker) AllowRequest() bool {
    switch cb.state {
    case StateClosed:
        return true
    case StateOpen:
        if time.Since(cb.lastStateChange) > cb.timeout {
            cb.state = StateHalfOpen
            return true
        }
        return false
    case StateHalfOpen:
        return true
    }
    return false
}
```

#### 2.4.2 重试机制 (Retry with Backoff)

**原理**: 失败后按指数退避策略重试，避免雪崩效应。

**建议实现**:
```go
// 建议实现: 指数退避重试
type RetryConfig struct {
    MaxRetries     int
    InitialBackoff time.Duration
    MaxBackoff     time.Duration
    Multiplier     float64
    Jitter         float64
}

func DefaultRetryConfig() RetryConfig {
    return RetryConfig{
        MaxRetries:     3,
        InitialBackoff: 100 * time.Millisecond,
        MaxBackoff:     10 * time.Second,
        Multiplier:     2.0,
        Jitter:         0.1,
    }
}

func (c RetryConfig) Execute(ctx context.Context, fn func() error) error {
    var lastErr error
    backoff := c.InitialBackoff
    
    for i := 0; i <= c.MaxRetries; i++ {
        if err := fn(); err == nil {
            return nil
        } else {
            lastErr = err
        }
        
        if i < c.MaxRetries {
            // 添加抖动
            jitter := time.Duration(float64(backoff) * c.Jitter * (rand.Float64()*2 - 1))
            sleep := backoff + jitter
            
            select {
            case <-time.After(sleep):
            case <-ctx.Done():
                return ctx.Err()
            }
            
            // 指数退避
            backoff = time.Duration(float64(backoff) * c.Multiplier)
            if backoff > c.MaxBackoff {
                backoff = c.MaxBackoff
            }
        }
    }
    
    return fmt.Errorf("重试 %d 次后失败: %w", c.MaxRetries, lastErr)
}
```

#### 2.4.3 超时控制

**原理**: 为每个操作设置超时，防止单个请求阻塞整个系统。

**当前状态**: ✅ 已实现（TimeoutSeconds 配置）

**优化建议**:
1. **分级超时**: 不同类型操作使用不同超时
2. **自适应超时**: 根据历史延迟动态调整
3. **级联超时**: 确保子操作超时小于父操作

```go
// 建议实现: 分级超时
type TimeoutConfig struct {
    // HTTP 请求超时
    HTTPTimeout time.Duration
    
    // 数据库操作超时
    DBTimeout time.Duration
    
    // 外部 API 调用超时
    ExternalAPITimeout time.Duration
    
    // 总执行超时
    TotalTimeout time.Duration
}

func DefaultTimeoutConfig() TimeoutConfig {
    return TimeoutConfig{
        HTTPTimeout:        30 * time.Second,
        DBTimeout:          5 * time.Second,
        ExternalAPITimeout: 10 * time.Second,
        TotalTimeout:       60 * time.Second,
    }
}
```

#### 2.4.4 优雅降级

**原理**: 当系统压力过大时，自动降级非核心功能，保证核心功能可用。

**建议实现**:
```go
// 建议实现: 降级策略
type DegradationStrategy struct {
    // 当前降级级别
    level DegradationLevel
    
    // 降级触发条件
    triggers []DegradationTrigger
}

type DegradationLevel int

const (
    LevelNormal DegradationLevel = iota
    LevelWarning   // 禁用非关键日志
    LevelCritical  // 禁用非关键功能
    LevelEmergency // 只保留核心功能
)

type DegradationTrigger struct {
    Metric    string  // cpu_usage, memory_usage, error_rate
    Threshold float64
    Level     DegradationLevel
}

func (s *DegradationStrategy) ShouldExecute(feature string) bool {
    switch s.level {
    case LevelEmergency:
        return isCriticalFeature(feature)
    case LevelCritical:
        return !isNonCriticalFeature(feature)
    default:
        return true
    }
}
```

### 2.5 可观测性

#### 2.5.1 结构化日志

**原理**: 使用结构化格式记录日志，便于查询和分析。

**当前状态**: 部分实现（console polyfill）

**优化建议**:
```go
// 建议实现: 结构化日志
type LogEntry struct {
    Timestamp   time.Time              `json:"timestamp"`
    Level       string                 `json:"level"`
    Message     string                 `json:"message"`
    FunctionID  string                 `json:"function_id"`
    RequestID   string                 `json:"request_id"`
    Duration    time.Duration          `json:"duration,omitempty"`
    Error       string                 `json:"error,omitempty"`
    Extra       map[string]interface{} `json:"extra,omitempty"`
}

type Logger interface {
    Log(entry LogEntry)
    WithRequestID(requestID string) Logger
    WithFunctionID(functionID string) Logger
}
```

#### 2.5.2 指标收集 (Metrics)

**原理**: 收集关键性能指标，用于监控和告警。

**关键指标**:
- 请求量 (QPS)
- 延迟分布 (P50/P95/P99)
- 错误率
- 冷启动率
- 内存使用
- 池利用率

**建议实现**:
```go
// 建议实现: 指标收集
type Metrics struct {
    // 请求计数
    RequestCount   *prometheus.CounterVec
    
    // 请求延迟
    RequestLatency *prometheus.HistogramVec
    
    // 错误计数
    ErrorCount     *prometheus.CounterVec
    
    // 冷启动计数
    ColdStartCount *prometheus.CounterVec
    
    // 池统计
    PoolSize       prometheus.Gauge
    PoolInUse      prometheus.Gauge
    
    // 内存使用
    MemoryUsage    prometheus.Gauge
}

func NewMetrics(namespace string) *Metrics {
    return &Metrics{
        RequestCount: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Namespace: namespace,
                Name:      "requests_total",
                Help:      "Total number of requests",
            },
            []string{"function", "method", "status"},
        ),
        RequestLatency: prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Namespace: namespace,
                Name:      "request_duration_seconds",
                Help:      "Request duration in seconds",
                Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
            },
            []string{"function", "method"},
        ),
        // ...
    }
}
```

#### 2.5.3 分布式追踪 (Tracing)

**原理**: 追踪请求在系统中的完整路径，定位性能瓶颈。

**建议实现**:
```go
// 建议实现: OpenTelemetry 集成
type Tracer struct {
    tracer trace.Tracer
}

func (t *Tracer) StartSpan(ctx context.Context, name string) (context.Context, trace.Span) {
    return t.tracer.Start(ctx, name,
        trace.WithSpanKind(trace.SpanKindServer),
    )
}

func (e *Engine) Execute(ctx context.Context, code string, cfg RuntimeConfig) (*ExecuteResult, error) {
    ctx, span := tracer.StartSpan(ctx, "serverless.execute")
    defer span.End()
    
    span.SetAttributes(
        attribute.String("function.name", cfg.FunctionName),
        attribute.Int64("code.length", int64(len(code))),
    )
    
    // 执行代码...
    
    span.SetAttributes(
        attribute.Int64("execution.duration_ms", duration.Milliseconds()),
    )
    
    return result, nil
}
```

### 2.6 安全隔离

#### 2.6.1 沙箱隔离

**原理**: 将每个函数运行在独立的沙箱中，防止相互影响。

**当前状态**: ✅ 已实现（WASM 天然沙箱）

**优化建议**:
1. **网络隔离**: 限制可访问的网络地址
2. **文件系统隔离**: 限制可访问的文件路径
3. **系统调用限制**: 限制可用的系统调用

```go
// 建议实现: 安全策略
type SecurityPolicy struct {
    // 网络白名单
    NetworkWhitelist []string
    
    // 文件系统访问路径
    AllowedPaths []string
    
    // 禁用的 Host Functions
    DisabledHostFunctions []string
    
    // 最大执行时间
    MaxExecutionTime time.Duration
    
    // 最大内存
    MaxMemory uint64
}

func (p *SecurityPolicy) Validate(request HostFunctionRequest) error {
    switch request.Op {
    case OpFetch:
        return p.validateNetwork(request.URL)
    case OpFileRead:
        return p.validatePath(request.Path)
    }
    return nil
}
```

#### 2.6.2 资源配额

**原理**: 为每个函数/租户设置资源配额，防止资源滥用。

**建议实现**:
```go
// 建议实现: 资源配额
type ResourceQuota struct {
    // 每秒请求数限制
    RequestsPerSecond int
    
    // 并发执行数限制
    MaxConcurrency int
    
    // 每日执行次数限制
    DailyExecutions int
    
    // 每日执行时间限制（秒）
    DailyExecutionSeconds int
    
    // 内存配额（MB）
    MemoryMB int
}

type QuotaManager struct {
    quotas map[string]*ResourceQuota
    usage  map[string]*ResourceUsage
}

func (m *QuotaManager) CheckQuota(tenantID string) error {
    quota := m.quotas[tenantID]
    usage := m.usage[tenantID]
    
    if usage.RequestsThisSecond >= quota.RequestsPerSecond {
        return ErrRateLimited
    }
    
    if usage.CurrentConcurrency >= quota.MaxConcurrency {
        return ErrConcurrencyLimited
    }
    
    return nil
}
```

---

## 3. 优化方案优先级

### 3.1 高优先级（建议立即实施）

| 方案 | 预期收益 | 实现复杂度 | 建议时间 |
|------|---------|-----------|---------|
| 动态池大小调整 | 资源利用率提升 30% | 中 | 1 周 |
| 断路器模式 | 系统稳定性提升 | 低 | 3 天 |
| 结构化日志 | 问题定位效率提升 | 低 | 2 天 |
| 指标收集 | 可观测性提升 | 中 | 1 周 |

### 3.2 中优先级（建议下个迭代实施）

| 方案 | 预期收益 | 实现复杂度 | 建议时间 |
|------|---------|-----------|---------|
| AOT 编译缓存 | 冷启动时间减少 50% | 中 | 1 周 |
| 函数级实例池 | 热门函数性能提升 | 中 | 1 周 |
| 重试机制 | 瞬时错误恢复 | 低 | 3 天 |
| 分布式追踪 | 性能分析能力 | 中 | 1 周 |

### 3.3 低优先级（长期规划）

| 方案 | 预期收益 | 实现复杂度 | 建议时间 |
|------|---------|-----------|---------|
| 运行时快照 | 冷启动时间减少 90% | 高 | 2 周 |
| 流量预测预热 | 冷启动率减少 | 高 | 2 周 |
| 资源配额管理 | 多租户支持 | 中 | 1 周 |
| 优雅降级 | 极端负载下稳定性 | 中 | 1 周 |

---

## 4. 实施路线图

### Phase 1: 基础可靠性（2 周）

```
Week 1:
├── 断路器模式实现
├── 重试机制实现
└── 结构化日志改进

Week 2:
├── 指标收集系统
├── 健康检查增强
└── 告警集成
```

### Phase 2: 性能优化（3 周）

```
Week 3:
├── 动态池大小调整
├── AOT 编译缓存
└── 内存预分配优化

Week 4:
├── 函数级实例池
├── 字节码优化器
└── GC 调优

Week 5:
├── 分布式追踪集成
├── 性能基准测试
└── 优化效果验证
```

### Phase 3: 高级特性（2 周）

```
Week 6:
├── 运行时快照（实验性）
├── 流量预测预热
└── 资源配额管理

Week 7:
├── 优雅降级机制
├── 安全策略增强
└── 文档和示例
```

---

## 5. 参考资料

### 5.1 论文

1. [Benchmarking, Analysis, and Optimization of Serverless Function Snapshots](https://www.usenix.org/conference/atc21/presentation/ustiugov) - USENIX ATC'21
2. [Performance Modeling of Serverless Computing Platforms](https://ieeexplore.ieee.org/document/9251210) - IEEE TPDS
3. [A Berkeley View on Serverless Computing](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-3.pdf) - Berkeley

### 5.2 行业实践

1. [华为云冷启动加速方案](https://zhuanlan.zhihu.com/p/601659161)
2. [Cloudflare Workers 架构](https://blog.cloudflare.com/cloud-computing-without-containers/)
3. [AWS Lambda SnapStart](https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html)
4. [Deno Deploy Edge Runtime](https://deno.com/deploy)

### 5.3 开源项目

1. [wazero](https://github.com/tetratelabs/wazero) - Go WebAssembly Runtime
2. [QuickJS](https://github.com/nickelca/quickjs-ng) - JavaScript Engine
3. [OpenTelemetry Go](https://github.com/open-telemetry/opentelemetry-go) - Observability

---

## 6. 附录

### 6.1 性能基准对比

| 平台 | 冷启动时间 | 内存开销 | 隔离级别 |
|------|-----------|---------|---------|
| AWS Lambda | 100-500ms | 128MB+ | 容器 |
| Cloudflare Workers | 0-5ms | 128MB | V8 Isolate |
| Deno Deploy | 0-10ms | 128MB | V8 Isolate |
| **PocketBase Serverless** | 10-50ms | 32-128MB | WASM |

### 6.2 配置建议

```go
// 生产环境推荐配置
serverless.Config{
    // 根据系统内存自动配置
    AutoConfig: true,
    
    // 或手动配置
    PoolSize:            8,
    MaxMemoryMB:         128,
    TimeoutSeconds:      30,
    CronTimeoutMinutes:  15,
    EnableBytecodeCache: true,
    
    // 网络白名单（可选）
    NetworkWhitelist: []string{
        "api.openai.com",
        "api.anthropic.com",
    },
}
```
