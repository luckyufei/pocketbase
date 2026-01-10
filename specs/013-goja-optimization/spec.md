# Feature Specification: Goja JSVM 优化与安全增强

**Feature Branch**: `013-goja-optimization`  
**Created**: 2026-01-10  
**Status**: Draft  
**Input**: 基于 Serverless vs Goja 性能对比分析，优化现有 JSVM 插件

## 背景与动机

### 性能对比结论

基于 `benchmarks/serverless-vs-hooks` 的测试结果：

| 场景 | Goja (热启动) | QuickJS WASM | 差距 |
|------|---------------|--------------|------|
| 简单调用 | 251 ns | 21,555 ns | **Goja 86x 快** |
| JSON 序列化 | 2.4 μs | 33.6 μs | **Goja 14x 快** |
| 闭包调用 | 181 ns | 16.7 μs | **Goja 92x 快** |
| 计算密集 | 218 μs | 195 μs | QuickJS 1.1x 快 |

### 决策

**保留 Goja JSVM，移除 QuickJS Serverless 插件**

理由：
1. Goja 在大多数场景快 10-90 倍
2. PocketBase 是单租户设计，不需要 WASM 级别隔离
3. Goja 的安全机制（Interrupt + API 隔离）已足够

### 优化目标

1. **安全增强**: 添加执行超时、循环限制、内存监控
2. **性能优化**: 脚本预编译、函数缓存、减少序列化
3. **代码清理**: 移除 Serverless 插件，简化架构

---

## 需求澄清

### Q1: 与现有 Goja Hook 代码的兼容性

**结论: 100% 向后兼容，无需任何代码修改**

现有 Hook API 保持不变：

```javascript
// 这些 API 完全不变
onRecordCreate((e) => { ... }, "posts")
onRecordUpdate((e) => { ... }, "posts")
onModelUpdate((e) => { ... }, "demo1")
routerAdd("GET", "/hello", (e) => { ... })
cronAdd("job1", "*/5 * * * *", () => { ... })
```

**优化是内部实现层面的改进**：

| 层级 | 变化 | 用户影响 |
|------|------|----------|
| 用户 JS 代码 | ❌ 无变化 | 无需修改 |
| Hook API (`onRecordCreate` 等) | ❌ 无变化 | 无需修改 |
| VM 池 (`vmsPool`) | ✅ 内部优化 | 透明，性能提升 |
| 执行器 | ✅ 添加超时控制 | 透明，更安全 |

**实现方式**：

```go
// 现有代码 (binds.go:80-92)
err := executors.run(func(executor *goja.Runtime) error {
    executor.Set("__args", handlerArgs)
    res, err := executor.RunProgram(pr)  // 已经使用预编译！
    executor.Set("__args", goja.Undefined())
    return normalizeException(err)
})

// 优化后 (仅内部变化)
err := executors.runWithTimeout(ctx, func(executor *goja.Runtime) error {
    // 同样的逻辑，但增加超时控制
    executor.Set("__args", handlerArgs)
    res, err := executor.RunProgram(pr)
    executor.Set("__args", goja.Undefined())
    return normalizeException(err)
})
```

**注意**: 现有代码已经使用 `goja.MustCompile()` 预编译脚本，我们的优化主要是：
1. 添加超时控制（防止无限循环）
2. 添加执行监控（记录耗时）
3. 优化 VM 池管理

### Q2: 执行过程监控（耗时/内存）

**结论: 是的，这是重要需求，已纳入规划**

**监控指标设计**：

| 指标 | 类型 | 说明 |
|------|------|------|
| `jsvm_execution_duration_ms` | Histogram | 脚本执行耗时 |
| `jsvm_execution_total` | Counter | 执行总次数 |
| `jsvm_execution_errors` | Counter | 执行错误次数 |
| `jsvm_timeout_total` | Counter | 超时中断次数 |
| `jsvm_pool_size` | Gauge | VM 池当前大小 |
| `jsvm_pool_busy` | Gauge | 正在使用的 VM 数量 |
| `jsvm_cache_hits` | Counter | 预编译缓存命中 |
| `jsvm_cache_misses` | Counter | 预编译缓存未命中 |

**内存监控限制**：

Goja 没有原生内存限制 API，但可以通过以下方式间接监控：

```go
// 方案 1: 执行前后对比 Go runtime 内存
var m runtime.MemStats
runtime.ReadMemStats(&m)
beforeAlloc := m.Alloc

// 执行脚本...

runtime.ReadMemStats(&m)
afterAlloc := m.Alloc
memUsed := afterAlloc - beforeAlloc  // 近似值
```

```go
// 方案 2: 定期采样 + 超时作为内存保护
// 如果脚本执行时间过长，很可能是内存分配过多导致 GC 压力
```

**日志输出示例**：

```json
{
  "level": "info",
  "msg": "jsvm execution completed",
  "hook": "onRecordCreate",
  "collection": "posts",
  "duration_ms": 2.5,
  "mem_alloc_bytes": 1024,
  "cache_hit": true
}
```

```json
{
  "level": "warn",
  "msg": "jsvm execution timeout",
  "hook": "onRecordUpdate",
  "collection": "posts",
  "timeout_ms": 5000,
  "script_hash": "abc123..."
}
```

**集成到现有监控系统**：

可以复用 `001-system-monitoring` 的 MetricsRepository，将 JSVM 指标写入 `_metrics` 表：

```go
type JSVMMetrics struct {
    Timestamp       time.Time
    HookName        string
    Collection      string
    DurationMs      float64
    MemAllocBytes   int64
    CacheHit        bool
    Error           string
}
```

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 安全执行用户脚本 (Priority: P0)

作为 PocketBase 开发者，我希望 JSVM 能够安全执行用户脚本，防止恶意代码导致系统崩溃或资源耗尽。

**Why this priority**: 安全是基础，没有安全保障的 JS 执行环境是危险的。

**Independent Test**: 执行包含无限循环的脚本，验证是否在超时后被中断。

**Acceptance Scenarios**:

1. **Given** 脚本包含无限循环 `for(;;){}`, **When** 执行该脚本, **Then** 在配置的超时时间后被中断，返回超时错误
2. **Given** 脚本尝试访问文件系统 `require('fs')`, **When** 执行该脚本, **Then** 返回 "require is not defined" 错误
3. **Given** 脚本执行超过配置的循环次数限制, **When** 达到限制, **Then** 脚本被中断，返回循环限制错误
4. **Given** 脚本执行正常完成, **When** 返回结果, **Then** 结果正确，无安全警告

---

### User Story 2 - 高性能 Hook 执行 (Priority: P1)

作为 PocketBase 开发者，我希望 JS Hook 执行尽可能快，不影响 API 响应延迟。

**Why this priority**: Hook 在每个请求中执行，性能直接影响用户体验。

**Independent Test**: 对比优化前后的 Hook 执行延迟。

**Acceptance Scenarios**:

1. **Given** 已预编译的 Hook 脚本, **When** 执行 Hook, **Then** 执行时间比冷启动快 50% 以上
2. **Given** 高并发请求（100 QPS）, **When** 每个请求触发 Hook, **Then** P99 延迟增加不超过 5ms
3. **Given** 相同的 Hook 脚本多次执行, **When** 使用函数缓存, **Then** 第二次及之后执行比首次快 20% 以上

---

### User Story 3 - 简化的代码架构 (Priority: P2)

作为 PocketBase 维护者，我希望移除不必要的 Serverless 插件，简化代码维护。

**Why this priority**: 减少维护负担，保持代码简洁。

**Independent Test**: 验证移除 Serverless 后，现有功能不受影响。

**Acceptance Scenarios**:

1. **Given** 移除 Serverless 插件后, **When** 运行所有现有测试, **Then** 测试全部通过
2. **Given** 移除 Serverless 插件后, **When** 编译二进制, **Then** 二进制大小减少
3. **Given** 使用 JSVM Hook 功能, **When** 执行各种 Hook, **Then** 功能正常，无回归

---

### Edge Cases

- 脚本抛出异常时，VM 状态如何恢复？重置 VM 或从池中获取新 VM
- 超时中断后，正在执行的异步操作如何处理？取消所有挂起的操作
- 预编译缓存满时如何处理？LRU 淘汰最久未使用的脚本
- 并发执行同一脚本时，如何共享预编译结果？使用读写锁保护缓存

---

## Requirements *(mandatory)*

### Functional Requirements

**安全增强**:
- **FR-001**: 系统 MUST 支持配置脚本执行超时时间（默认 5 秒）
- **FR-002**: 系统 MUST 在超时后通过 `vm.Interrupt()` 中断脚本执行
- **FR-003**: 系统 MUST 默认不暴露 `require`, `process`, `fs` 等危险 API（注：当前已暴露，需评估是否收紧）
- **FR-004**: 系统 SHOULD 支持配置循环次数限制（可选，默认关闭）
- **FR-005**: 系统 SHOULD 记录脚本执行时间和资源使用到日志

**性能优化**:
- **FR-006**: 系统 MUST 支持脚本预编译，缓存 `*goja.Program` 对象（注：当前已实现 `goja.MustCompile`）
- **FR-007**: 系统 SHOULD 支持函数引用缓存，避免重复查找（优先级降低）
- **FR-008**: 系统 SHOULD 优化 Go/JS 数据传递，减少 JSON 序列化
- **FR-009**: 系统 MUST 保持现有 VM 池化机制

**执行监控** (新增):
- **FR-013**: 系统 MUST 记录每次 Hook 执行的耗时（毫秒级）
- **FR-014**: 系统 SHOULD 记录执行的 Hook 名称和关联集合
- **FR-015**: 系统 SHOULD 记录超时中断事件
- **FR-016**: 系统 MAY 记录近似内存分配量（通过 runtime.MemStats）
- **FR-017**: 系统 SHOULD 支持通过配置开关启用/禁用详细监控

**代码清理**:
- **FR-010**: 系统 MUST 移除 `plugins/serverless` 目录
- **FR-011**: 系统 MUST 更新相关文档和测试
- **FR-012**: 系统 MUST 保持 API 向后兼容（所有现有 Hook JS 代码无需修改）

### Non-Functional Requirements

- **NFR-001**: 优化后 Hook 执行 P99 延迟不超过 10ms
- **NFR-002**: 预编译缓存内存占用不超过 100MB
- **NFR-003**: 代码覆盖率保持 90% 以上
- **NFR-004**: 监控开销不超过执行时间的 1%

### Key Entities

- **SafeExecutor**: 安全执行包装器，处理超时和中断
- **ScriptCache**: 预编译脚本缓存，LRU 淘汰策略（注：评估是否需要，当前已有编译）
- **EnhancedPool**: 增强的 VM 池，支持超时控制和执行监控
- **JSVMMetrics**: 执行监控指标收集器

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 简单 Hook 执行时间 < 500 ns（热启动）
- **SC-002**: 无限循环脚本在 5 秒内被中断
- **SC-003**: 预编译脚本执行比冷启动快 50%
- **SC-004**: 移除 Serverless 后二进制大小减少 > 1MB
- **SC-005**: 所有现有 JSVM 测试通过
- **SC-006**: 新增安全测试覆盖率 > 90%

---

## Assumptions

- PocketBase 继续作为单租户 BaaS 使用
- 用户脚本来源相对可信（自己编写或审核过）
- 现有 Goja 版本稳定，无需升级
- 不需要支持 ES6+ 模块语法（使用 CommonJS 风格）

---

## Out of Scope

- 多租户隔离（使用外部 FaaS 服务）
- ES6 模块系统支持
- Node.js API 兼容层
- 脚本调试器
