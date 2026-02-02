# Implementation Plan: Observability Plugin 重构

**Branch**: `019-observability-plugin-refactor` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)

## Summary

将现有 `core/` 中的 Observability 实现重构为可插拔插件，遵循 PocketBase 插件规范。主要变更：
1. 默认关闭，显式注册后启用
2. 支持三种运行模式：Off / Conditional / Full
3. 支持条件过滤器：ErrorOnly、SlowRequest、VIPUser、DyedUser 等
4. 支持用户染色功能（动态追踪特定用户）
5. 删除 `core/` 旧实现，在 `plugins/trace/` 重新实现

> **简化说明**: 项目未上线，无需迁移，直接删除旧代码并重新实现。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 无新增依赖  
**Testing**: Go test (unit + integration + benchmark)  
**Target Platform**: Linux/macOS/Windows  
**Constraints**: 无向后兼容约束（项目未上线）

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 插件编译进主二进制 |
| Zero External Dependencies | ✅ PASS | 无新增依赖 |
| Anti-Stupidity | ✅ PASS | 默认关闭，零配置零开销 |
| Data Locality | ✅ PASS | 数据存储方式不变 |
| Graceful Degradation | ✅ PASS | 未注册时返回 NoopTrace |
| **Opt-in Design** | ✅ PASS | **显式注册，默认不启用** |

## Project Structure

```text
# 新增文件
plugins/
└── trace/
    ├── trace.go                 # 主入口
    ├── config.go                # 配置和环境变量
    ├── mode.go                  # 运行模式
    ├── filter.go                # Filter 接口
    ├── filters/
    │   ├── error_only.go
    │   ├── slow_request.go
    │   ├── path.go
    │   ├── sample.go
    │   ├── vip_user.go
    │   ├── dyed_user.go         # 染色用户过滤器
    │   └── custom.go
    ├── dye/                      # 用户染色功能
    │   ├── store.go             # DyeStore 接口
    │   ├── store_memory.go      # 内存存储
    │   ├── store_db.go          # 数据库存储 (可选)
    │   └── routes.go            # 染色管理 API
    ├── middleware.go            # HTTP 中间件
    ├── span.go
    ├── buffer.go
    ├── context.go
    ├── repository.go
    ├── repository_pg.go
    ├── repository_sqlite.go
    ├── routes.go
    └── noop.go                  # NoopTrace

# core 保留文件
core/
├── trace_interface.go           # 接口定义
└── trace_noop.go                # NoopTrace 默认实现

# 待删除文件
core/trace.go
core/trace_buffer.go
core/trace_context.go
core/trace_span.go
core/trace_repository.go
core/trace_repository_pg.go
core/trace_repository_sqlite.go
core/trace_benchmark_test.go
apis/middlewares_trace.go
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PocketBase App                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                           core.App                                    │  │
│   │                                                                       │  │
│   │   func (a *App) Trace() Trace {                                      │  │
│   │       if a.trace != nil {                                            │  │
│   │           return a.trace      // 已注册插件                           │  │
│   │       }                                                               │  │
│   │       return noopTrace        // 未注册，返回空实现                    │  │
│   │   }                                                                   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                        │
│                    ┌────────────────┴────────────────┐                      │
│                    │          Plugin 注册            │                      │
│                    │   trace.MustRegister(app, ...)  │                      │
│                    └────────────────┬────────────────┘                      │
│                                     │                                        │
│   ┌─────────────────────────────────▼────────────────────────────────────┐  │
│   │                      plugins/trace                                    │  │
│   │                                                                       │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                    TraceMode Switch                          │   │  │
│   │   │                                                              │   │  │
│   │   │   ModeOff ──────────► No-op (零开销)                         │   │  │
│   │   │                                                              │   │  │
│   │   │   ModeConditional ──► Filter Chain ──► Match? ──► Record    │   │  │
│   │   │                                    └──► No ──► Skip          │   │  │
│   │   │                                                              │   │  │
│   │   │   ModeFull ─────────► Record All                             │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                       │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                    Filter Chain (OR logic)                   │   │  │
│   │   │                                                              │   │  │
│   │   │   ErrorOnly ──┐                                              │   │  │
│   │   │               │                                              │   │  │
│   │   │   SlowRequest ├──► Any Match? ──► Yes ──► SampleRate ──► Record │  │
│   │   │               │                   │                          │   │  │
│   │   │   VIPUser ────┘                   └──► No ──► Skip           │   │  │
│   │   │                                                              │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                       │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow (Conditional Mode)

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│                  Trace Middleware                        │
│                                                          │
│   1. Check Mode                                          │
│      └─ ModeOff? ──► Return immediately                  │
│                                                          │
│   2. Pre-filters (before execution)                      │
│      ├─ PathExclude("/_/") ──► Skip if match             │
│      └─ PathPrefix("/api/") ──► Continue if match        │
│                                                          │
│   3. Execute Request (defer span.End)                    │
│                                                          │
│   4. Post-filters (after execution)                      │
│      ├─ ErrorOnly() ──► Check status code                │
│      ├─ SlowRequest(100ms) ──► Check duration            │
│      └─ VIPUser("is_vip") ──► Check auth record          │
│                                                          │
│   5. Any filter matched?                                 │
│      ├─ Yes ──► SampleRate ──► Record Span               │
│      └─ No ──► Discard Span                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 两阶段过滤

**Decision**: 过滤器分为"前置过滤"和"后置过滤"两类

**Rationale**:
- 前置过滤（PathExclude）可以在请求执行前决定，避免创建 Span 的开销
- 后置过滤（ErrorOnly, SlowRequest）需要在请求执行后才能判断

**Implementation**:
```go
type Filter interface {
    // Phase 返回过滤器阶段
    Phase() FilterPhase // PreExecution / PostExecution
    
    // ShouldTrace 判断是否采集
    ShouldTrace(ctx *FilterContext) bool
}

type FilterPhase int
const (
    PreExecution FilterPhase = iota
    PostExecution
)
```

### 2. 延迟 Span 创建

**Decision**: Conditional 模式下，仅在确定需要采集时才创建 Span

**Rationale**:
- 避免为最终不采集的请求分配 Span 内存
- 降低 GC 压力

**Implementation**:
```go
// 使用 LazySpan 延迟创建
type LazySpan struct {
    trace     *Trace
    name      string
    startTime time.Time
    span      *Span // nil until needed
}

func (ls *LazySpan) Materialize() *Span {
    if ls.span == nil {
        ls.span = ls.trace.createSpan(ls.name, ls.startTime)
    }
    return ls.span
}
```

### 3. NoopTrace 默认实现

**Decision**: 未注册插件时，`app.Trace()` 返回 NoopTrace

**Rationale**:
- 保持 API 兼容性，调用方无需检查 nil
- 零开销，所有方法立即返回

**Implementation**:
```go
// core/trace_noop.go
type noopTrace struct{}

func (noopTrace) StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder) {
    return ctx, noopSpanBuilder{}
}
func (noopTrace) IsEnabled() bool { return false }
// ... 其他方法同样返回空值
```

### 4. 环境变量优先级

**Decision**: 环境变量 > 代码配置 > 默认值

**Rationale**:
- 遵循 12-factor app 原则
- 便于运维在不修改代码的情况下调整配置

**Implementation**:
```go
func applyEnvOverrides(config *Config) {
    if mode := os.Getenv("PB_TRACE_MODE"); mode != "" {
        config.Mode = TraceMode(mode)
    }
    if rate := os.Getenv("PB_TRACE_SAMPLE_RATE"); rate != "" {
        if r, err := strconv.ParseFloat(rate, 64); err == nil {
            config.SampleRate = r
        }
    }
    // ...
}
```

## Filter Implementation Details

### ErrorOnly Filter

```go
type errorOnlyFilter struct{}

func (f *errorOnlyFilter) Phase() FilterPhase { return PostExecution }

func (f *errorOnlyFilter) ShouldTrace(ctx *FilterContext) bool {
    if ctx.Response == nil {
        return false
    }
    return ctx.Response.StatusCode >= 400
}
```

### SlowRequest Filter

```go
type slowRequestFilter struct {
    threshold time.Duration
}

func (f *slowRequestFilter) Phase() FilterPhase { return PostExecution }

func (f *slowRequestFilter) ShouldTrace(ctx *FilterContext) bool {
    return ctx.Duration >= f.threshold
}
```

### VIPUser Filter

```go
type vipUserFilter struct {
    field  string
    values []any
}

func (f *vipUserFilter) Phase() FilterPhase { return PostExecution }

func (f *vipUserFilter) ShouldTrace(ctx *FilterContext) bool {
    // 从 context 获取 Auth Record
    authRecord := core.AuthRecordFromContext(ctx.Context)
    if authRecord == nil {
        return false
    }
    
    fieldValue := authRecord.Get(f.field)
    if fieldValue == nil {
        return false
    }
    
    // 如果没有指定 values，字段非空即匹配
    if len(f.values) == 0 {
        return true
    }
    
    // 检查值是否在列表中
    for _, v := range f.values {
        if fieldValue == v {
            return true
        }
    }
    return false
}
```

## Performance Optimizations

### 1. 无锁 Ring Buffer (P2)

当前实现使用 `sync.Mutex`，可优化为无锁结构：

```go
type LockFreeRingBuffer struct {
    buffer   []*Span
    capacity int64
    head     int64 // atomic
    tail     int64 // atomic
}

func (rb *LockFreeRingBuffer) Push(span *Span) bool {
    for {
        head := atomic.LoadInt64(&rb.head)
        tail := atomic.LoadInt64(&rb.tail)
        
        if head-tail >= rb.capacity {
            return false // overflow
        }
        
        if atomic.CompareAndSwapInt64(&rb.head, head, head+1) {
            rb.buffer[head%rb.capacity] = span
            return true
        }
    }
}
```

### 2. 对象池复用 Span

```go
var spanPool = sync.Pool{
    New: func() interface{} {
        return &Span{
            Attributes: make(map[string]any, 8),
        }
    },
}

func acquireSpan() *Span {
    span := spanPool.Get().(*Span)
    // reset fields
    span.TraceID = ""
    span.SpanID = ""
    // ...
    return span
}

func releaseSpan(span *Span) {
    // clear attributes map
    for k := range span.Attributes {
        delete(span.Attributes, k)
    }
    spanPool.Put(span)
}
```

### 3. 字符串拼接优化

```go
// Before: fmt.Sprintf
spanName := fmt.Sprintf("%s %s", r.Method, r.URL.Path)

// After: strings.Builder
var sb strings.Builder
sb.Grow(len(r.Method) + 1 + len(r.URL.Path))
sb.WriteString(r.Method)
sb.WriteByte(' ')
sb.WriteString(r.URL.Path)
spanName := sb.String()
```

## API Compatibility

### 保留的接口

```go
// core/trace_interface.go
type Trace interface {
    StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder)
    RecordSpan(span *Span)
    Query(params *FilterParams) ([]*Span, int64, error)
    GetTrace(traceID string) ([]*Span, error)
    Stats(params *FilterParams) (*TraceStats, error)
    Prune() (int64, error)
    IsEnabled() bool
    Close() error
}

type SpanBuilder interface {
    SetAttribute(key string, value any) SpanBuilder
    SetStatus(status SpanStatus, message string) SpanBuilder
    SetKind(kind SpanKind) SpanBuilder
    End()
}
```

### App.Trace() 修改

```go
// core/base.go
type BaseApp struct {
    // ...
    trace Trace // 可能为 nil
}

func (app *BaseApp) Trace() Trace {
    if app.trace != nil {
        return app.trace
    }
    return noopTrace
}

func (app *BaseApp) SetTrace(t Trace) {
    app.trace = t
}
```

## Testing Strategy

### Unit Tests

1. **Filter Tests**
   - 各过滤器的匹配逻辑
   - 边界条件（nil response, zero duration 等）
   - 过滤器组合（OR 逻辑）

2. **Mode Tests**
   - ModeOff 无采集
   - ModeFull 全采集
   - ModeConditional 按条件采集

3. **Config Tests**
   - 环境变量解析
   - 默认值应用
   - 配置覆盖优先级

### Integration Tests

1. **Plugin Registration**
   - 注册后 `app.Trace()` 返回有效实例
   - 未注册时返回 NoopTrace

2. **HTTP Middleware**
   - 请求自动追踪
   - 过滤器生效
   - Span 正确记录

3. **Backward Compatibility**
   - 现有测试全部通过
   - API 调用方式不变

### Benchmark Tests

```go
func BenchmarkNoopTrace(b *testing.B) {
    // 未注册时的开销
}

func BenchmarkFilterCheck(b *testing.B) {
    // 过滤器检查开销
}

func BenchmarkFullTrace(b *testing.B) {
    // 全量采集开销
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API 破坏 | Low | High | NoopTrace 保持兼容 |
| 性能回归 | Low | Medium | Benchmark 对比测试 |
| 迁移遗漏 | Medium | Medium | 完整测试覆盖 |
| 过滤器逻辑错误 | Low | Medium | 单元测试覆盖 |

## Dependencies

### Internal

| Component | Purpose |
|-----------|---------|
| core.App | 插件注册目标 |
| core.RequestEvent | HTTP 请求处理 |
| tools/hook | 钩子系统 |

### External

无新增外部依赖

## Estimated Effort

| Phase | Tasks | Est. Hours |
|-------|-------|------------|
| Phase 1: 插件框架 | 5 | 4h |
| Phase 2: 代码迁移 | 8 | 6h |
| Phase 3: 过滤器实现 | 7 | 5h |
| Phase 4: 测试和文档 | 5 | 4h |
| **Total** | **25** | **~19h** |
