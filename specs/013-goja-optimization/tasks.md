# Tasks: Goja JSVM 优化与安全增强

**Feature Branch**: `013-goja-optimization`  
**Created**: 2026-01-10  
**Status**: Planning  
**Approach**: TDD (Red-Green-Refactor), 覆盖率目标 90%

---

## Phase 1: 安全增强

### Task 1.1: SafeExecutor 实现 (TDD)

**目标**: 创建安全执行包装器，支持超时中断

**测试文件**: `plugins/jsvm/executor_test.go`

**Red Tests** (先写失败测试):
- [ ] 1.1.1 `TestSafeExecutor_NormalExecution` - 正常脚本执行成功
- [ ] 1.1.2 `TestSafeExecutor_TimeoutInterrupt` - 无限循环在超时后被中断
- [ ] 1.1.3 `TestSafeExecutor_ContextCancel` - context 取消时中断执行
- [ ] 1.1.4 `TestSafeExecutor_ErrorPropagation` - JS 错误正确传播
- [ ] 1.1.5 `TestSafeExecutor_InterruptRecovery` - 中断后 VM 可复用

**Green Implementation**:
- [ ] 1.1.6 创建 `plugins/jsvm/executor.go`
- [ ] 1.1.7 实现 `SafeExecutor` 结构体
- [ ] 1.1.8 实现 `Execute(ctx, script)` 方法
- [ ] 1.1.9 实现 `ExecuteProgram(ctx, program)` 方法

**代码示例**:
```go
type SafeExecutor struct {
    pool           *vmsPool
    defaultTimeout time.Duration
}

type ExecuteOptions struct {
    Timeout time.Duration
    MaxOps  int64
}

func (e *SafeExecutor) Execute(ctx context.Context, script string, opts *ExecuteOptions) (goja.Value, error)
```

**验收标准**: 
- `go test -v -run TestSafeExecutor ./plugins/jsvm/` 全部通过
- 覆盖率 ≥ 90%

---

### Task 1.2: API 隔离配置 (TDD)

**目标**: 确保危险 API 默认不可用，支持配置白名单

**测试文件**: `plugins/jsvm/sandbox_test.go`

**Red Tests**:
- [ ] 1.2.1 `TestSandbox_NoRequire` - `require` 默认不可用
- [ ] 1.2.2 `TestSandbox_NoProcess` - `process` 默认不可用
- [ ] 1.2.3 `TestSandbox_NoFs` - 文件系统 API 默认不可用
- [ ] 1.2.4 `TestSandbox_AllowedGlobals` - 配置的全局对象可用
- [ ] 1.2.5 `TestSandbox_ConsoleLog` - console.log 可配置启用

**Green Implementation**:
- [ ] 1.2.6 创建 `plugins/jsvm/sandbox.go`
- [ ] 1.2.7 实现 `SandboxConfig` 配置结构
- [ ] 1.2.8 实现 `ApplySandbox(vm, config)` 函数
- [ ] 1.2.9 更新 `baseBinds()` 使用沙箱配置

**代码示例**:
```go
type SandboxConfig struct {
    AllowConsole    bool
    AllowedGlobals  []string
    DeniedGlobals   []string
    MaxExecutionOps int64
}

func DefaultSandboxConfig() *SandboxConfig
func ApplySandbox(vm *goja.Runtime, config *SandboxConfig)
```

**验收标准**: 
- `go test -v -run TestSandbox ./plugins/jsvm/` 全部通过
- 覆盖率 ≥ 90%

---

### Task 1.3: 执行监控与日志 (TDD)

**目标**: 记录脚本执行时间、资源使用，支持配置开关

**测试文件**: `plugins/jsvm/metrics_test.go`

**Red Tests**:
- [ ] 1.3.1 `TestExecutionMetrics_Duration` - 记录执行时间（毫秒级）
- [ ] 1.3.2 `TestExecutionMetrics_HookInfo` - 记录 Hook 名称和关联集合
- [ ] 1.3.3 `TestExecutionMetrics_Success` - 记录成功/失败状态
- [ ] 1.3.4 `TestExecutionMetrics_Timeout` - 记录超时中断事件
- [ ] 1.3.5 `TestExecutionMetrics_MemoryApprox` - 记录近似内存分配
- [ ] 1.3.6 `TestExecutionMetrics_ConfigToggle` - 支持配置开关启用/禁用
- [ ] 1.3.7 `TestExecutionMetrics_LowOverhead` - 监控开销 < 1%

**Green Implementation**:
- [ ] 1.3.8 创建 `plugins/jsvm/metrics.go`
- [ ] 1.3.9 实现 `JSVMMetrics` 结构体
- [ ] 1.3.10 实现 `MetricsCollector` 收集器
- [ ] 1.3.11 集成到 `SafeExecutor`
- [ ] 1.3.12 添加 `Config.EnableMetrics` 配置项

**代码示例**:
```go
type JSVMMetrics struct {
    HookName      string        // e.g., "onRecordCreate"
    Collection    string        // e.g., "posts"
    Duration      time.Duration // 执行耗时
    MemAllocBytes int64         // 近似内存分配
    CacheHit      bool          // 预编译缓存命中
    Error         string        // 错误信息（如有）
    Timeout       bool          // 是否超时
}

type MetricsCollector struct {
    enabled bool
    logger  *slog.Logger
}

func (c *MetricsCollector) Record(m *JSVMMetrics)
func (c *MetricsCollector) GetStats() MetricsStats
```

**日志输出格式**:
```json
{
  "level": "info",
  "msg": "jsvm execution",
  "hook": "onRecordCreate",
  "collection": "posts",
  "duration_ms": 2.5,
  "mem_alloc_kb": 1.0,
  "cache_hit": true
}
```

**验收标准**: 
- 执行信息可通过日志查看
- 监控开销 < 1%
- 覆盖率 ≥ 85%

---

## Phase 2: 性能优化

### Task 2.1: ScriptCache 预编译缓存 (TDD) - 优先级降低

**说明**: 经代码分析，现有实现已使用 `goja.MustCompile()` 预编译脚本。此任务优先级降低，仅在发现性能瓶颈时实施。

**目标**: 评估是否需要额外的缓存层（当前已有编译）

**测试文件**: `plugins/jsvm/cache_test.go`

**Red Tests**:
- [ ] 2.1.1 `TestScriptCache_GetOrCompile` - 首次编译并缓存
- [ ] 2.1.2 `TestScriptCache_CacheHit` - 缓存命中返回已编译程序
- [ ] 2.1.3 `TestScriptCache_LRUEviction` - 超过容量时 LRU 淘汰
- [ ] 2.1.4 `TestScriptCache_Concurrent` - 并发安全
- [ ] 2.1.5 `TestScriptCache_InvalidScript` - 无效脚本不缓存
- [ ] 2.1.6 `TestScriptCache_Stats` - 缓存统计信息

**Green Implementation**:
- [ ] 2.1.7 创建 `plugins/jsvm/cache.go`
- [ ] 2.1.8 实现 `ScriptCache` 结构体
- [ ] 2.1.9 实现 LRU 淘汰策略
- [ ] 2.1.10 实现缓存统计

**代码示例**:
```go
type ScriptCache struct {
    mu       sync.RWMutex
    programs map[string]*cachedProgram
    maxSize  int
    lru      *list.List
    stats    CacheStats
}

type CacheStats struct {
    Hits      int64
    Misses    int64
    Evictions int64
}

func NewScriptCache(maxSize int) *ScriptCache
func (c *ScriptCache) GetOrCompile(source string) (*goja.Program, error)
func (c *ScriptCache) Stats() CacheStats
func (c *ScriptCache) Clear()
```

**验收标准**: 
- `go test -v -run TestScriptCache ./plugins/jsvm/` 全部通过
- 覆盖率 ≥ 90%

---

### Task 2.2: 函数引用缓存 (TDD)

**目标**: 缓存常用函数引用，避免每次查找

**测试文件**: `plugins/jsvm/func_cache_test.go`

**Red Tests**:
- [ ] 2.2.1 `TestFuncCache_GetFunction` - 获取并缓存函数引用
- [ ] 2.2.2 `TestFuncCache_CacheHit` - 缓存命中
- [ ] 2.2.3 `TestFuncCache_InvalidFunction` - 无效函数名返回错误
- [ ] 2.2.4 `TestFuncCache_VMReset` - VM 重置后缓存失效

**Green Implementation**:
- [ ] 2.2.5 创建 `plugins/jsvm/func_cache.go`
- [ ] 2.2.6 实现 `FuncCache` 结构体
- [ ] 2.2.7 集成到 `poolItem`

**代码示例**:
```go
type FuncCache struct {
    vm    *goja.Runtime
    funcs map[string]goja.Callable
}

func (c *FuncCache) GetFunc(name string) (goja.Callable, error)
func (c *FuncCache) Clear()
```

**验收标准**: 
- 覆盖率 ≥ 90%

---

### Task 2.3: 增强 VM 池 (TDD)

**目标**: 整合预编译缓存和函数缓存到 VM 池

**测试文件**: `plugins/jsvm/pool_test.go` (更新)

**Red Tests**:
- [ ] 2.3.1 `TestEnhancedPool_RunScript` - 使用预编译执行脚本
- [ ] 2.3.2 `TestEnhancedPool_RunWithTimeout` - 带超时执行
- [ ] 2.3.3 `TestEnhancedPool_CacheIntegration` - 缓存集成正确
- [ ] 2.3.4 `TestEnhancedPool_Concurrent` - 高并发场景

**Green Implementation**:
- [ ] 2.3.5 更新 `plugins/jsvm/pool.go`
- [ ] 2.3.6 添加 `ScriptCache` 字段
- [ ] 2.3.7 添加 `RunScript(ctx, source)` 方法
- [ ] 2.3.8 添加 `RunProgram(ctx, program)` 方法

**验收标准**: 
- 现有测试不回归
- 新测试全部通过

---

### Task 2.4: 性能基准测试

**目标**: 验证优化效果，对比优化前后性能

**测试文件**: `plugins/jsvm/benchmark_test.go`

**Benchmarks**:
- [ ] 2.4.1 `BenchmarkPool_ColdStart` - 冷启动执行
- [ ] 2.4.2 `BenchmarkPool_WarmStart` - 热启动执行
- [ ] 2.4.3 `BenchmarkPool_WithCache` - 使用预编译缓存
- [ ] 2.4.4 `BenchmarkPool_WithFuncCache` - 使用函数缓存
- [ ] 2.4.5 `BenchmarkPool_Concurrent` - 并发执行

**验收标准**:
- 预编译比冷启动快 50%
- 函数缓存比无缓存快 20%
- 结果记录到 `benchmark-results.md`

---

## Phase 3: 代码清理

### Task 3.1: 移除 Serverless 插件

**目标**: 删除 QuickJS Serverless 相关代码

**Checklist**:
- [ ] 3.1.1 删除 `plugins/serverless/` 目录
- [ ] 3.1.2 更新 `go.mod` 移除 quickjs 依赖
- [ ] 3.1.3 运行 `go mod tidy`
- [ ] 3.1.4 更新 `examples/base/main.go` 移除 serverless 引用
- [ ] 3.1.5 删除 `benchmarks/serverless-vs-hooks/` 中的 serverless 测试

**验收标准**: 
- `go build ./...` 无编译错误
- 二进制大小减少

---

### Task 3.2: 更新文档

**Checklist**:
- [ ] 3.2.1 更新 `CODEBUDDY.md` 移除 serverless 相关描述
- [ ] 3.2.2 更新 `README.md` 如有 serverless 说明
- [ ] 3.2.3 创建 `docs/jsvm-security.md` 安全最佳实践
- [ ] 3.2.4 更新 `CHANGELOG.md` 记录变更

---

### Task 3.3: 集成测试

**目标**: 验证整体功能正常

**测试文件**: `tests/jsvm_integration_test.go`

**Tests**:
- [ ] 3.3.1 `TestJSVM_HookExecution` - Hook 执行正常
- [ ] 3.3.2 `TestJSVM_MigrationExecution` - 迁移脚本执行正常
- [ ] 3.3.3 `TestJSVM_SecurityIsolation` - 安全隔离有效
- [ ] 3.3.4 `TestJSVM_PerformanceRegression` - 性能无回归

**验收标准**:
- 所有集成测试通过
- `go test ./...` 全部通过

---

## 执行顺序

```
Phase 1 (安全)                    Phase 2 (性能)
    │                                 │
    ├── Task 1.1 (Executor)          ├── Task 2.1 (Cache)
    │       │                        │       │
    ├── Task 1.2 (Sandbox)           ├── Task 2.2 (FuncCache)
    │       │                        │       │
    └── Task 1.3 (Metrics)           └── Task 2.3 (Pool)
            │                                │
            └────────────┬───────────────────┘
                         │
                         ▼
                 Phase 3 (清理)
                         │
                 ├── Task 3.1 (Remove)
                 ├── Task 3.2 (Docs)
                 └── Task 3.3 (Integration)
```

**并行建议**: Phase 1 和 Phase 2 可以并行开发，Phase 3 在前两者完成后执行。

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Interrupt 不及时 | 低 | 中 | 使用更短的检查间隔 |
| 缓存内存泄漏 | 中 | 中 | 实现 LRU 淘汰 + 定期清理 |
| 并发竞争 | 中 | 高 | 使用读写锁 + 充分测试 |
| 向后兼容问题 | 低 | 高 | 保持现有 API 不变 |

---

## 进度跟踪

| Task | Status | Coverage | Notes |
|------|--------|----------|-------|
| 1.1 SafeExecutor | ✅ Completed | 100% | executor.go 实现超时中断 |
| 1.2 Sandbox | ⏸️ Deferred | - | 当前已暴露 require/process，需评估是否收紧 |
| 1.3 Metrics | ✅ Completed | 95%+ | metrics.go 实现执行监控 |
| 2.1 ScriptCache | ⏸️ Deferred | - | 现有代码已使用 MustCompile |
| 2.2 FuncCache | ⏸️ Deferred | - | 优先级降低 |
| 2.3 EnhancedPool | ⏸️ Deferred | - | 优先级降低 |
| 2.4 Benchmark | ⏸️ Deferred | - | 优先级降低 |
| 3.1 Remove Serverless | ✅ Completed | - | 删除 plugins/serverless 目录 |
| 3.2 Update Docs | ⬜ Pending | - | |
| 3.3 Integration Test | ⬜ Pending | - | |

---

## 预估工时

| Phase | Tasks | 预估时间 |
|-------|-------|----------|
| Phase 1 | 1.1-1.3 | 3-4 天 |
| Phase 2 | 2.1-2.4 | 4-5 天 |
| Phase 3 | 3.1-3.3 | 2-3 天 |
| **Total** | | **9-12 天** |
