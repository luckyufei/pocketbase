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
- **FR-003**: 系统 MUST 默认不暴露 `require`, `process`, `fs` 等危险 API
- **FR-004**: 系统 SHOULD 支持配置循环次数限制（可选，默认关闭）
- **FR-005**: 系统 SHOULD 记录脚本执行时间和资源使用到日志

**性能优化**:
- **FR-006**: 系统 MUST 支持脚本预编译，缓存 `*goja.Program` 对象
- **FR-007**: 系统 MUST 支持函数引用缓存，避免重复查找
- **FR-008**: 系统 SHOULD 优化 Go/JS 数据传递，减少 JSON 序列化
- **FR-009**: 系统 MUST 保持现有 VM 池化机制

**代码清理**:
- **FR-010**: 系统 MUST 移除 `plugins/serverless` 目录
- **FR-011**: 系统 MUST 更新相关文档和测试
- **FR-012**: 系统 MUST 保持 API 向后兼容

### Non-Functional Requirements

- **NFR-001**: 优化后 Hook 执行 P99 延迟不超过 10ms
- **NFR-002**: 预编译缓存内存占用不超过 100MB
- **NFR-003**: 代码覆盖率保持 90% 以上

### Key Entities

- **SafeExecutor**: 安全执行包装器，处理超时和中断
- **ScriptCache**: 预编译脚本缓存，LRU 淘汰策略
- **EnhancedPool**: 增强的 VM 池，支持预编译和函数缓存

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
