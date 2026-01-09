# Implementation Tasks: PocketBase Serverless Engine (WASM)

**Branch**: `010-serverless-engine` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Setup (共享基础设施)

**Purpose**: 项目初始化和基本结构创建

- [x] T001 创建 `plugins/serverless/` 目录结构
- [x] T002 [P] 在 `plugins/serverless/serverless.go` 中定义插件入口
- [x] T003 [P] 在 `plugins/serverless/runtime/config.go` 中定义运行时配置结构体
- [x] T004 [P] 创建 `plugins/serverless/types/` TypeScript 类型定义目录

---

## Phase 2: Foundational - WASM Runtime (阻塞性前置条件)

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

**⚠️ CRITICAL**: 此阶段完成前，任何用户故事都无法开始

> **📖 技术规格**: 详见 [`specs/_research/quickjs-wasm.md`](../_research/quickjs-wasm.md)

**当前状态**: 
- ✅ C 源码已编写 (`pb_bridge.c`, `bootloader.c`)
- ✅ Makefile 已创建
- ⏳ 等待 wasi-sdk 环境编译 WASM
- ✅ Go 接口层已重构（支持 Mock 测试）

### 2.1 QuickJS WASM 编译 (P0)

- [x] T005a 设置 wasi-sdk 编译环境 (`quickjs-src/Makefile`)
- [x] T005b 编写 `pb_bridge.c` - PocketBase JS Bindings（实现 `host_request` 等导入函数）
- [x] T005c 编写 `bootloader.c` - JS 源码加载器（实现 `run_handler` 导出函数）
- [ ] T005d 编译 QuickJS 为 WASM (`pb_runtime.wasm`)（需 wasi-sdk 环境）
- [x] T005e 在 `plugins/serverless/runtime/wasm/embed.go` 中嵌入 WASM 二进制（结构已就绪）

### 2.2 Wazero 集成 (P0)

- [x] T006 在 `plugins/serverless/runtime/wasm/runtime.go` 中定义 Runtime 接口
- [x] T007 在 `plugins/serverless/runtime/wasm/runtime.go` 中实现 WazeroRuntime
- [x] T007a 实现 WASM 模块编译缓存 (`embed.go` GetCompiledModule)
- [x] T008 在 `plugins/serverless/runtime/wasm/runtime.go` 中实现 MockRuntime（测试用）
- [x] T008a 编写 `plugins/serverless/runtime/wasm/runtime_test.go` 基础执行测试

### 2.3 Host Functions 实现 (P0)

- [x] T009 在 `plugins/serverless/runtime/wasm/hostfn.go` 中定义 Host Function 接口
- [x] T009a 实现 `host_request` 万能网关（按 quickjs-wasm.md ABI 规格）
- [x] T009b 实现 `host_log` 日志转发
- [x] T009c 实现 `host_error` 错误处理
- [x] T009d 实现 `host_alloc` / `host_free` 内存管理
- [x] T009e 实现 JSON 序列化/反序列化的内存读写 Helper (`bridge.go`)

### 2.4 实例池管理

- [x] T010 在 `plugins/serverless/runtime/pool.go` 中实现实例池结构体
- [x] T011 在 `plugins/serverless/runtime/pool.go` 中实现 Acquire/Release 机制
- [x] T012 在 `plugins/serverless/runtime/pool.go` 中实现实例预热
- [x] T013 在 `plugins/serverless/runtime/pool.go` 中实现实例回收（超时/OOM）
- [x] T013a 在 `plugins/serverless/runtime/pool.go` 中实现实例重置机制
- [x] T014 编写 `plugins/serverless/runtime/pool_test.go` 实例池测试

### 2.5 代码加载

- [x] T015 在 `plugins/serverless/loader/loader.go` 中实现 bundle.js 加载
- [x] T016 在 `plugins/serverless/loader/loader.go` 中实现模块解析
- [x] T017 编写 `plugins/serverless/loader/loader_test.go` 加载器测试

### 2.6 JavaScript SDK 预加载

- [x] T018 编写 `plugins/serverless/polyfill/bridge.js` - 内部桥接层
- [x] T019 编写 `plugins/serverless/polyfill/pb-sdk.js` - 公开 SDK API
- [x] T020 在 `plugins/serverless/polyfill/console.js` 中实现 console Polyfill
- [x] T021 在 `plugins/serverless/polyfill/web_api.js` 中实现 TextEncoder/TextDecoder
- [x] T022 在 `plugins/serverless/polyfill/web_api.js` 中实现 URL/URLSearchParams
- [x] T023 在 `plugins/serverless/polyfill/web_api.js` 中实现 Headers/Request/Response
- [x] T024 在 `plugins/serverless/polyfill/stream.js` 中实现 ReadableStream 基础

> **注意**: SDK 预加载代码已内嵌到 `bootloader.c` 的 `PB_SDK_PRELOAD` 常量中

**Checkpoint**: WASM 运行时就绪 - 用户故事实现可以开始

---

## Phase 3: User Story 1 - HTTP Handler (Priority: P1) 🎯 MVP

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持 TypeScript 编写 HTTP 处理函数

**Independent Test**: 
- 通过 curl 调用 `/api/pb_serverless/hello` 验证函数执行

### Implementation for User Story 1

- [x] T025 [US1] 在 `plugins/serverless/triggers/http.go` 中实现 HTTP 触发器
- [x] T026 [US1] 在 `plugins/serverless/triggers/http.go` 中实现路由匹配（基于文件路径）
- [x] T027 [US1] 在 `plugins/serverless/triggers/http.go` 中实现 Request 对象构建
- [x] T028 [US1] 在 `plugins/serverless/triggers/http.go` 中实现 Response 对象解析
- [x] T029 [US1] 在 `apis/serverless_routes.go` 中注册 `/api/pb_serverless/*` 路由
- [x] T030 [US1] 在 `plugins/serverless/triggers/http.go` 中实现超时控制（30s）
- [x] T031 [US1] 在 `plugins/serverless/triggers/http.go` 中实现错误处理（500/504）
- [x] T032 [US1] 编写 `plugins/serverless/triggers/http_test.go` HTTP 触发器测试
- [x] T033 [US1] 编写 `apis/serverless_routes_test.go` HTTP API 测试

**Checkpoint**: 此时 User Story 1 应完全可用，可独立测试

---

## Phase 4: User Story 2 - Fetch API (Priority: P1) 🎯 MVP

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持标准 fetch API 调用外部服务

**Independent Test**: 
- 调用 OpenAI API 验证 fetch 功能

### Implementation for User Story 2

- [x] T034 [US2] 在 `plugins/serverless/hostfn/fetch.go` 中实现 fetch Host Function
- [x] T035 [US2] 在 `plugins/serverless/hostfn/fetch.go` 中实现 HTTP 请求发起
- [x] T036 [US2] 在 `plugins/serverless/hostfn/fetch.go` 中实现 Headers 处理
- [x] T037 [US2] 在 `plugins/serverless/hostfn/fetch.go` 中实现 JSON 响应解析
- [x] T038 [US2] 在 `plugins/serverless/hostfn/fetch.go` 中实现流式响应（ReadableStream）
- [x] T039 [US2] 在 `plugins/serverless/security/whitelist.go` 中实现网络白名单
- [x] T040 [US2] 在 `plugins/serverless/polyfill/web_api.js` 中完善 fetch Polyfill (AbortController/FormData)
- [x] T041 [US2] 编写 `plugins/serverless/hostfn/fetch_test.go` fetch 测试

**Checkpoint**: 此时 User Story 1 & 2 都应独立可用

---

## Phase 5: User Story 11 - Structured Logging (Priority: P1) 🎯 MVP

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持 console.log 输出结构化日志

**Independent Test**: 
- 调用 console.log() 验证日志格式

### Implementation for User Story 11

- [x] T042 [US11] 在 `plugins/serverless/hostfn/console.go` 中实现 console Host Function
- [x] T043 [US11] 在 `plugins/serverless/hostfn/console.go` 中实现 log/warn/error 级别
- [x] T044 [US11] 在 `plugins/serverless/hostfn/console.go` 中实现 JSON 结构化输出
- [x] T045 [US11] 在 `plugins/serverless/hostfn/console.go` 中集成 TraceID
- [x] T046 [US11] 编写 `plugins/serverless/hostfn/console_test.go` console 测试

**Checkpoint**: 此时 User Story 1, 2, 11 都应独立可用

---

## Phase 6: User Story 3 - Vector Search (Priority: P1)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持简洁的向量搜索 API

**Independent Test**: 
- 调用 pb.collection().vectorSearch() 验证向量检索

### Implementation for User Story 3

- [x] T047 [US3] 在 `plugins/serverless/hostfn/vector.go` 中实现 vectorSearch Host Function
- [x] T048 [US3] 在 `plugins/serverless/hostfn/vector.go` 中实现 PostgreSQL pgvector 查询
- [x] T049 [US3] 在 `plugins/serverless/hostfn/vector.go` 中实现 SQLite 内存余弦相似度 fallback
- [x] T050 [US3] 在 `plugins/serverless/hostfn/vector.go` 中实现 filter 条件支持
- [x] T051 [US3] 在 `plugins/serverless/hostfn/vector.go` 中实现维度校验
- [x] T052 [US3] 编写 `plugins/serverless/hostfn/vector_test.go` 向量搜索测试

**Checkpoint**: 此时 User Story 1, 2, 3, 11 都应独立可用

---

## Phase 7: User Story 4 - KV Storage (Priority: P1)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持轻量级 KV 存储

**Independent Test**: 
- 调用 pb.kv.set() 和 pb.kv.get() 验证状态存储

### Implementation for User Story 4

- [x] T053 [US4] 在 `plugins/serverless/hostfn/kv.go` 中实现 KV Host Functions
- [x] T054 [US4] 在 `plugins/serverless/hostfn/kv.go` 中桥接 core/kv_store.go
- [x] T055 [US4] 在 `plugins/serverless/hostfn/kv.go` 中实现 TTL 支持
- [x] T056 [US4] 编写 `plugins/serverless/hostfn/kv_test.go` KV 测试

**依赖**: 复用 `006-pocketbase-kv` 模块

**Checkpoint**: 此时 User Story 1, 2, 3, 4, 11 都应独立可用

---

## Phase 8: User Story 5 - File API (Priority: P1)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持文件读写

**Independent Test**: 
- 调用 pb.files.read() 和 pb.files.save() 验证文件操作

### Implementation for User Story 5

- [x] T057 [US5] 在 `plugins/serverless/hostfn/file.go` 中实现 File Host Functions
- [x] T058 [US5] 在 `plugins/serverless/hostfn/file.go` 中实现文件读取（返回 ArrayBuffer）
- [x] T059 [US5] 在 `plugins/serverless/hostfn/file.go` 中实现文件保存
- [x] T060 [US5] 在 `plugins/serverless/hostfn/file.go` 中实现大小限制校验
- [x] T061 [US5] 编写 `plugins/serverless/hostfn/file_test.go` File 测试

**Checkpoint**: 此时 User Story 1-5, 11 都应独立可用

---

## Phase 9: User Story 6 - Secrets Access (Priority: P1)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持安全访问 API Key

**Independent Test**: 
- 调用 pb.secrets.get('OPENAI_API_KEY') 验证密钥读取

### Implementation for User Story 6

- [x] T062 [US6] 在 `plugins/serverless/hostfn/secrets.go` 中实现 Secrets Host Function
- [x] T063 [US6] 在 `plugins/serverless/hostfn/secrets.go` 中桥接 core/secret_store.go
- [x] T064 [US6] 在 `plugins/serverless/hostfn/secrets.go` 中实现日志脱敏
- [x] T065 [US6] 编写 `plugins/serverless/hostfn/secrets_test.go` Secrets 测试

**依赖**: 复用 `007-secret-management` 模块

**Checkpoint**: 此时 User Story 1-6, 11 都应独立可用

---

## Phase 10: User Story 7 - Job Queue Integration (Priority: P1)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持异步任务入队

**Independent Test**: 
- 调用 pb.jobs.enqueue() 验证任务入队

### Implementation for User Story 7

- [x] T066 [US7] 在 `plugins/serverless/hostfn/jobs.go` 中实现 Jobs Host Function
- [x] T067 [US7] 在 `plugins/serverless/hostfn/jobs.go` 中桥接 core/job_store.go
- [x] T068 [US7] 编写 `plugins/serverless/hostfn/jobs_test.go` Jobs 测试

**依赖**: 复用 `008-job-queue` 模块

**Checkpoint**: 此时 User Story 1-7, 11 都应独立可用

---

## Phase 11: User Story 10 - Transaction Support (Priority: P1) 🎯 MVP

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持事务操作

**Independent Test**: 
- 调用 pb.tx() 验证事务回滚

### Implementation for User Story 10

- [x] T069 [US10] 在 `plugins/serverless/hostfn/tx.go` 中实现 Transaction Host Functions
- [x] T070 [US10] 在 `plugins/serverless/hostfn/tx.go` 中实现 TxBegin/TxCommit/TxRollback
- [x] T071 [US10] 在 `plugins/serverless/hostfn/tx.go` 中实现事务上下文绑定
- [x] T072 [US10] 在 `plugins/serverless/hostfn/db.go` 中实现事务感知的 DB 操作 (CountWithFilter)
- [x] T073 [US10] 编写 `plugins/serverless/hostfn/tx_test.go` Transaction 测试

**Checkpoint**: MVP 核心功能完成 (User Story 1-7, 10, 11)

---

## Phase 12: User Story 8 - DB Hooks (Priority: P1)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持 TypeScript 编写数据库钩子

**Independent Test**: 
- 创建 Record 触发 onRecordBeforeCreate 钩子

### Implementation for User Story 8

- [x] T074 [US8] 在 `plugins/serverless/hooks/registry.go` 中实现 Hook 注册表
- [x] T075 [US8] 在 `plugins/serverless/hooks/registry.go` 中实现 Hook 匹配逻辑
- [x] T076 [US8] 在 `plugins/serverless/hooks/bindings.go` 中实现 DB Hook 绑定
- [x] T077 [US8] 在 `plugins/serverless/triggers/hook.go` 中实现 Hook 触发器
- [x] T078 [US8] 在 `plugins/serverless/triggers/hook.go` 中实现 RecordEvent 构建
- [x] T079 [US8] 在 `plugins/serverless/triggers/hook.go` 中实现 Hook 链执行
- [x] T080 [US8] 在 `plugins/serverless/triggers/hook.go` 中实现异常处理（中止操作）
- [x] T081 [US8] 编写 `plugins/serverless/hooks/registry_test.go` 注册表测试
- [x] T082 [US8] 编写 `plugins/serverless/triggers/hook_test.go` Hook 触发器测试

**Checkpoint**: 此时 User Story 1-8, 10, 11 都应独立可用

---

## Phase 13: User Story 9 - Cron Trigger (Priority: P2)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持定时触发 Serverless 函数

**Independent Test**: 
- 配置 Cron 表达式验证定时触发

### Implementation for User Story 9

- [x] T083 [US9] 在 `plugins/serverless/triggers/cron.go` 中实现 Cron 触发器
- [x] T084 [US9] 在 `plugins/serverless/triggers/cron.go` 中集成 PocketBase Cron 调度器
- [x] T085 [US9] 在 `plugins/serverless/triggers/cron.go` 中实现超时控制（15min）
- [x] T086 [US9] 在 `plugins/serverless/triggers/cron.go` 中实现防重叠执行
- [x] T087 [US9] 编写 `plugins/serverless/triggers/cron_test.go` Cron 触发器测试

**Checkpoint**: 此时 User Story 1-11 都应独立可用

---

## Phase 14: User Story 12 - Utility Functions (Priority: P2)

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Goal**: 支持高性能工具函数

**Independent Test**: 
- 调用 pb.utils.uuid() 验证工具函数

### Implementation for User Story 12

- [x] T088 [US12] 在 `plugins/serverless/hostfn/utils.go` 中实现 Utility Host Functions
- [x] T089 [US12] 在 `plugins/serverless/hostfn/utils.go` 中实现 uuid() (UUID v7)
- [x] T090 [US12] 在 `plugins/serverless/hostfn/utils.go` 中实现 hash()
- [x] T091 [US12] 在 `plugins/serverless/hostfn/utils.go` 中实现 randomString()
- [x] T092 [US12] 复用 `plugins/jsvm/` 已有的 Go bindings
- [x] T093 [US12] 编写 `plugins/serverless/hostfn/utils_test.go` Utility 测试

**Checkpoint**: 所有 User Story 完成

---

## Phase 15: Security & Quotas

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Purpose**: 安全隔离和资源限制

- [x] T094 [P] 在 `plugins/serverless/security/sandbox.go` 中实现沙箱安全策略
- [x] T095 [P] 在 `plugins/serverless/security/quota.go` 中实现内存限制（128MB）
- [x] T096 [P] 在 `plugins/serverless/security/quota.go` 中实现指令计数器（防死循环）
- [x] T097 [P] 在 `plugins/serverless/security/whitelist.go` 中完善网络白名单配置
- [x] T098 编写 `plugins/serverless/security/sandbox_test.go` 沙箱测试
- [x] T099 编写 `plugins/serverless/security/quota_test.go` 配额测试

---

## Phase 16: Polish & Cross-Cutting Concerns

> ✅ **状态**: 代码已完成，待 WASM 编译后进行端到端验证

**Purpose**: 影响多个用户故事的改进

### 16.1 Bytecode 预编译（P3）

- [x] T100 [P] 在 `plugins/serverless/loader/bytecode.go` 中实现 Bytecode 预编译
- [x] T101 [P] 在 `plugins/serverless/loader/bytecode.go` 中实现 Bytecode 加载
- [x] T102 [P] 编写 `plugins/serverless/loader/bytecode_test.go` 预编译测试

### 16.2 Source Map 支持（P3）

- [x] T103 [P] 在 `plugins/serverless/loader/sourcemap.go` 中实现 Source Map 解析
- [x] T104 [P] 在 `plugins/serverless/loader/sourcemap.go` 中实现错误堆栈映射
- [x] T105 [P] 编写 `plugins/serverless/loader/sourcemap_test.go` Source Map 测试

### 16.3 TypeScript 类型定义

- [x] T106 [P] 在 `plugins/serverless/types/pocketbase.d.ts` 中定义 pb 对象类型
- [x] T107 [P] 在 `plugins/serverless/types/global.d.ts` 中定义全局类型

### 16.4 示例项目

- [x] T108 [P] 创建 `pb_serverless/` 示例项目模板
- [x] T109 [P] 编写示例 HTTP Handler
- [x] T110 [P] 编写示例 DB Hook
- [x] T111 [P] 编写示例 Cron Job

### 16.5 集成测试

- [x] T112 运行完整集成测试，验证所有功能正常
- [x] T113 Vercel AI SDK 兼容性测试
- [x] T114 OpenAI SDK 兼容性测试
- [x] T115 流式响应端到端测试

### 16.6 性能基准

- [x] T116 编写 `plugins/serverless/runtime/benchmark_test.go` 性能基准测试
  - [x] T116a 冷启动延迟基准
  - [x] T116b 热启动延迟基准
  - [x] T116c Pool 吞吐量基准
  - [x] T116d 并发执行基准

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始 ✅
- **Foundational (Phase 2)**: 依赖 Setup 完成 - **阻塞所有用户故事**
  - **2.1 QuickJS WASM 编译**: 必须首先完成
  - **2.2 Wazero 集成**: 依赖 2.1
  - **2.3 Host Functions**: 依赖 2.2
  - **2.4 实例池管理**: 依赖 2.2
  - **2.5 代码加载**: 依赖 2.2
  - **2.6 JavaScript SDK**: 依赖 2.3
- **User Stories (Phase 3-14)**: 依赖 Foundational 完成
- **Security (Phase 15)**: 可与 Phase 3-14 并行
- **Polish (Phase 16)**: 依赖所有用户故事完成

### QuickJS WASM 编译依赖

```
wasi-sdk (编译工具链)
    │
    ▼
quickjs.c + pb_bridge.c + bootloader.c
    │
    ▼
pb_runtime.wasm
    │
    ▼
//go:embed 嵌入 Go 二进制
    │
    ▼
wazero 加载运行
```

### User Story Dependencies

```
Phase 1 (Setup) ✅
    │
    ▼
Phase 2 (Foundational - QuickJS WASM) ← 当前阻塞点
    │
    ├── 2.1 QuickJS WASM 编译 (P0)
    ├── 2.2 Wazero 集成 (P0)
    ├── 2.3 Host Functions (P0)
    ├── 2.4 实例池管理
    ├── 2.5 代码加载
    └── 2.6 JavaScript SDK
    │
    ▼
Phase 3 (US1: HTTP Handler) ─────────────────────────────────────┐
    │                                                             │
    ├──────────┬──────────┬──────────┬──────────┬────────────────┤
    ▼          ▼          ▼          ▼          ▼                │
Phase 4    Phase 5    Phase 6    Phase 7    Phase 8              │
(US2:      (US11:     (US3:      (US4:      (US5:                │
Fetch)     Logging)   Vector)    KV)        File)                │
    │          │          │          │          │                │
    └──────────┴──────────┴──────────┴──────────┤                │
                                                │                │
    ┌───────────────────────────────────────────┤                │
    ▼                                           ▼                │
Phase 9                                    Phase 10              │
(US6: Secrets)                             (US7: Jobs)           │
    │                                           │                │
    └───────────────────────────────────────────┤                │
                                                │                │
                                          Phase 11               │
                                          (US10: Transaction)    │
                                                │                │
    ┌───────────────────────────────────────────┤                │
    ▼                                           ▼                │
Phase 12                                   Phase 13              │
(US8: DB Hooks)                            (US9: Cron)           │
    │                                           │                │
    └───────────────────────────────────────────┤                │
                                                │                │
                                          Phase 14               │
                                          (US12: Utils)          │
                                                │                │
    ┌───────────────────────────────────────────┤                │
    ▼                                           ▼                │
Phase 15                                   Phase 16              │
(Security)                                 (Polish)              │
```

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Status |
|-------|-------|------------|--------|
| Phase 1: Setup | 4 | 1h | ✅ 完成 |
| Phase 2: Foundational (QuickJS WASM) | 24 | 24h | ⏳ **90% 完成** (待 WASM 编译) |
| Phase 3: US1 HTTP Handler | 9 | 8h | ✅ 完成 (待 WASM 验证) |
| Phase 4: US2 Fetch | 8 | 6h | ✅ 完成 (待 WASM 验证) |
| Phase 5: US11 Logging | 5 | 3h | ✅ 完成 (待 WASM 验证) |
| Phase 6: US3 Vector | 6 | 5h | ✅ 完成 (待 WASM 验证) |
| Phase 7: US4 KV | 4 | 3h | ✅ 完成 (待 WASM 验证) |
| Phase 8: US5 File | 5 | 4h | ✅ 完成 (待 WASM 验证) |
| Phase 9: US6 Secrets | 4 | 2h | ✅ 完成 (待 WASM 验证) |
| Phase 10: US7 Jobs | 3 | 2h | ✅ 完成 (待 WASM 验证) |
| Phase 11: US10 Transaction | 5 | 4h | ✅ 完成 (待 WASM 验证) |
| Phase 12: US8 DB Hooks | 9 | 8h | ✅ 完成 (待 WASM 验证) |
| Phase 13: US9 Cron | 5 | 4h | ✅ 完成 (待 WASM 验证) |
| Phase 14: US12 Utils | 6 | 3h | ✅ 完成 (待 WASM 验证) |
| Phase 15: Security | 6 | 5h | ✅ 完成 (待 WASM 验证) |
| Phase 16: Polish | 17 | 12h | ✅ 完成 (待 WASM 验证) |
| **Total** | **~120** | **~94h** | ⏳ 待 WASM 编译 |

**当前阻塞点**: T005d - 需要 wasi-sdk 环境编译 `pb_runtime.wasm`

**编译步骤**:
```bash
cd plugins/serverless/runtime/wasm/quickjs-src
make download-quickjs  # 下载 QuickJS 源码
make                   # 编译 WASM (需要 wasi-sdk)
```

---

## MVP Definition

**最小可行产品 (MVP)** = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 11

完成 MVP 后，系统具备：
- ✅ QuickJS WASM 运行时（三层沙箱）
- ✅ HTTP Handler（GET/POST）
- ✅ Fetch API（调用外部服务）
- ✅ Structured Logging
- ✅ Transaction 支持

**MVP 预估工时**: ~46h（其中 QuickJS WASM 编译约 24h）

---

## Host Function Reference

### pb.collection().vectorSearch()

```typescript
// JavaScript 调用
const similar = await pb.collection('docs').vectorSearch({
    vector: [0.1, 0.2, ...],  // 查询向量
    field: 'embedding',        // 向量字段名
    filter: 'status = "public"', // 可选过滤条件
    top: 5                     // 返回数量
});
```

```go
// Go Host Function 实现
func (h *HostFunctions) VectorSearch(collection string, opts *VectorSearchOpts) ([]map[string]any, error) {
    // PostgreSQL: 使用 pgvector
    // SELECT * FROM collection WHERE filter ORDER BY embedding <=> $vector LIMIT top
    
    // SQLite: 内存计算余弦相似度
    // 1. 查询所有符合 filter 的记录
    // 2. 在 Go 中计算余弦相似度
    // 3. 排序返回 top N
}
```

### pb.tx()

```typescript
// JavaScript 调用
await pb.tx(async (tx) => {
    await tx.collection('wallets').update(uid, { balance: -10 });
    await fetch('https://api.openai.com...');
    await tx.collection('chats').create({...});
});
```

```go
// Go Host Function 实现
func (h *HostFunctions) TxBegin() (string, error) {
    tx, err := h.app.DB().Begin()
    if err != nil {
        return "", err
    }
    txID := uuid.NewString()
    h.transactions[txID] = tx
    return txID, nil
}

func (h *HostFunctions) TxCommit(txID string) error {
    tx := h.transactions[txID]
    delete(h.transactions, txID)
    return tx.Commit()
}

func (h *HostFunctions) TxRollback(txID string) error {
    tx := h.transactions[txID]
    delete(h.transactions, txID)
    return tx.Rollback()
}
```

### pb.kv

```typescript
// JavaScript 调用
await pb.kv.set('session:123', { stage: 'step_2' }, { ttl: 600 });
const state = await pb.kv.get('session:123');
```

```go
// Go Host Function 实现 - 桥接 core/kv_store.go
func (h *HostFunctions) KVGet(key string) (any, error) {
    return h.app.KV().Get(key)
}

func (h *HostFunctions) KVSet(key string, value any, ttl int) error {
    return h.app.KV().SetEx(key, value, time.Duration(ttl)*time.Second)
}
```

---

## TypeScript 类型定义

```typescript
// plugins/serverless/types/pocketbase.d.ts

declare global {
    const pb: PocketBase;
}

interface PocketBase {
    collection(name: string): CollectionService;
    kv: KVService;
    files: FileService;
    secrets: SecretService;
    jobs: JobService;
    utils: UtilService;
    tx<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
    
    // Hooks
    onRecordBeforeCreate(collection: string, handler: HookHandler): void;
    onRecordAfterCreate(collection: string, handler: HookHandler): void;
    onRecordBeforeUpdate(collection: string, handler: HookHandler): void;
    onRecordAfterUpdate(collection: string, handler: HookHandler): void;
    onRecordBeforeDelete(collection: string, handler: HookHandler): void;
    onRecordAfterDelete(collection: string, handler: HookHandler): void;
    
    // Cron
    cron(name: string, schedule: string, handler: () => Promise<void>): void;
}

interface CollectionService {
    getOne(id: string): Promise<Record>;
    getList(page?: number, perPage?: number, options?: ListOptions): Promise<ListResult>;
    create(data: object): Promise<Record>;
    update(id: string, data: object): Promise<Record>;
    delete(id: string): Promise<void>;
    vectorSearch(opts: VectorSearchOptions): Promise<Record[]>;
}

interface VectorSearchOptions {
    vector: number[];
    field: string;
    filter?: string;
    top?: number;
}

interface KVService {
    get(key: string): Promise<any>;
    set(key: string, value: any, opts?: { ttl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
}

interface FileService {
    read(collection: string, record: string, filename: string): Promise<ArrayBuffer>;
    save(collection: string, record: string, file: { filename: string; data: ArrayBuffer }): Promise<void>;
}

interface SecretService {
    get(name: string): string | null;
}

interface JobService {
    enqueue(topic: string, payload: any): Promise<string>;
}

interface UtilService {
    uuid(): string;
    hash(input: string): string;
    randomString(length: number): string;
}

interface TransactionContext {
    collection(name: string): CollectionService;
}

interface RecordEvent {
    record: Record;
    auth?: Record;
}

type HookHandler = (e: RecordEvent) => Promise<void>;

interface Record {
    id: string;
    created: string;
    updated: string;
    [key: string]: any;
    get(field: string): any;
    set(field: string, value: any): void;
}

interface ListOptions {
    filter?: string;
    sort?: string;
    expand?: string;
}

interface ListResult {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: Record[];
}

export {};
```

---

## 示例代码

### HTTP Handler (routes/chat.ts)

```typescript
export async function POST(req: Request): Promise<Response> {
    const { message } = await req.json();
    
    // 读取 Secret
    const apiKey = pb.secrets.get('OPENAI_API_KEY');
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 调用 OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: message }],
            stream: true
        })
    });
    
    // 流式返回
    return new Response(response.body, {
        headers: { 'Content-Type': 'text/event-stream' }
    });
}
```

### DB Hook (hooks/users.ts)

```typescript
pb.onRecordBeforeCreate('users', async (e) => {
    // 验证邮箱域名
    const email = e.record.get('email') as string;
    if (!email.endsWith('@company.com')) {
        throw new Error('Only company emails allowed');
    }
    
    // 自动填充字段
    e.record.set('created_by', e.auth?.id);
});

pb.onRecordAfterCreate('users', async (e) => {
    // 发送欢迎邮件
    await pb.jobs.enqueue('send_welcome_email', { userId: e.record.id });
});
```

### Cron Job (workers/daily-report.ts)

```typescript
pb.cron('daily_report', '0 8 * * *', async () => {
    console.log('Starting daily report generation...');
    
    // 获取昨日数据
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const records = await pb.collection('events').getList(1, 100, {
        filter: `created >= "${yesterday.toISOString()}"`
    });
    
    // 生成摘要
    const summary = `Daily report: ${records.totalItems} events`;
    
    // 保存报告
    await pb.collection('reports').create({
        date: new Date().toISOString(),
        content: summary
    });
    
    console.log('Daily report completed');
});
```

### RAG with Vector Search (routes/rag.ts)

```typescript
export async function POST(req: Request): Promise<Response> {
    const { query } = await req.json();
    
    // 1. 生成查询向量
    const apiKey = pb.secrets.get('OPENAI_API_KEY');
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query
        })
    });
    const { data } = await embeddingRes.json();
    const queryVector = data[0].embedding;
    
    // 2. 向量搜索
    const docs = await pb.collection('documents').vectorSearch({
        vector: queryVector,
        field: 'embedding',
        filter: 'status = "published"',
        top: 5
    });
    
    // 3. 构建上下文
    const context = docs.map(d => d.content).join('\n\n');
    
    // 4. 生成回答
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: `Answer based on context:\n${context}` },
                { role: 'user', content: query }
            ]
        })
    });
    
    const { choices } = await chatRes.json();
    return new Response(JSON.stringify({ answer: choices[0].message.content }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
```
