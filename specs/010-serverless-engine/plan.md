# Implementation Plan: PocketBase Serverless Engine (WASM)

**Branch**: `010-serverless-engine` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-serverless-engine/spec.md`

## Summary

为 PocketBase 新增基于 WASM 的 Serverless 运行时，使用 **QuickJS + wazero** 实现现代 JavaScript/TypeScript 执行环境。支持 **Vercel AI SDK**、**流式响应**、**向量搜索** 等 AI Agent 核心能力。保持"单二进制文件"交付，无需 Node.js 容器。

## Technical Context

**Language/Version**: Go 1.24.0 + TypeScript (开发者代码)
**Primary Dependencies**: 
- `github.com/tetratelabs/wazero` v1.8+ (纯 Go WASM 运行时)
- QuickJS (编译为 WASM，嵌入二进制)
- `wasi-sdk` v22+ (QuickJS 编译工具链)
- `github.com/evanw/esbuild` (TypeScript 打包)

**Runtime**: QuickJS (WASM via wazero) - 三层沙箱架构
**Testing**: Go test (unit + integration) + JS 集成测试
**Target Platform**: Linux/macOS/Windows 服务器
**Project Type**: Go Backend (PocketBase 核心扩展)
**Performance Goals**: 
- 热启动 < 2ms（实例池）
- 冷启动 < 50ms（无预编译）/ < 5ms（预编译 Bytecode）
- Fetch 开销 < 5ms
- 并发 > 50 Function 执行
**Constraints**: 不支持 Node.js 内置模块，内存限制 128MB，HTTP 超时 30s
**Scale/Scope**: 单机部署

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | WASM 运行时编译进主二进制，无外部 Node.js 依赖 |
| Zero External Dependencies | ✅ PASS | 使用 wazero（纯 Go WASM 运行时），无 CGO |
| Anti-Stupidity | ✅ PASS | 消除 Node.js 运维负担，边界安全隔离 |
| Data Locality | ✅ PASS | 通过 Host Functions 访问 PocketBase 数据层 |
| Graceful Degradation | ✅ PASS | 函数超时/OOM 自动终止，不影响主进程 |
| **Database Agnostic** | ✅ PASS | **同时支持 SQLite 和 PostgreSQL** |

## Project Structure

### Documentation (this feature)

```text
specs/010-serverless-engine/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
plugins/serverless/
├── runtime/
│   ├── engine.go             # WASM 运行时引擎
│   ├── engine_test.go        # 运行时单元测试
│   ├── pool.go               # 实例池管理
│   ├── pool_test.go          # 实例池测试
│   └── config.go             # 运行时配置
│
├── hostfn/
│   ├── fetch.go              # fetch Host Function
│   ├── fetch_test.go         # fetch 测试
│   ├── db.go                 # 数据库操作 Host Function
│   ├── db_test.go            # 数据库测试
│   ├── vector.go             # 向量搜索 Host Function
│   ├── vector_test.go        # 向量搜索测试
│   ├── kv.go                 # KV Storage Host Function
│   ├── file.go               # File API Host Function
│   ├── secrets.go            # Secrets Host Function
│   ├── jobs.go               # Job Queue Host Function
│   ├── console.go            # console.log Host Function
│   ├── utils.go              # Utility Host Functions
│   └── tx.go                 # Transaction Host Function
│
├── loader/
│   ├── loader.go             # 代码加载器
│   ├── loader_test.go        # 加载器测试
│   ├── bytecode.go           # Bytecode 预编译
│   └── sourcemap.go          # Source Map 支持
│
├── hooks/
│   ├── registry.go           # Hook 注册表
│   ├── registry_test.go      # 注册表测试
│   └── bindings.go           # DB Hook 绑定
│
├── triggers/
│   ├── http.go               # HTTP 触发器
│   ├── http_test.go          # HTTP 触发器测试
│   ├── cron.go               # Cron 触发器
│   └── hook.go               # DB Hook 触发器
│
├── polyfill/
│   ├── web_api.js            # Web API Polyfills
│   ├── console.js            # console Polyfill
│   └── stream.js             # ReadableStream Polyfill
│
├── security/
│   ├── sandbox.go            # 沙箱安全策略
│   ├── whitelist.go          # 网络白名单
│   └── quota.go              # 资源配额
│
└── serverless.go             # 插件入口

apis/
├── serverless_routes.go      # HTTP API 路由
└── serverless_routes_test.go # HTTP API 测试

# JS SDK (开发者使用)
pb_serverless/                # 示例项目模板
├── package.json
├── tsconfig.json
├── src/
│   ├── routes/
│   │   └── hello.ts
│   ├── hooks/
│   │   └── users.ts
│   └── workers/
│       └── pdf.ts
└── dist/
    └── bundle.js

# TypeScript 类型定义
plugins/serverless/types/
├── pocketbase.d.ts           # PocketBase SDK 类型
└── global.d.ts               # 全局类型定义
```

**Structure Decision**: 遵循 PocketBase 插件架构，Serverless 相关代码放入 `plugins/serverless/` 目录，与现有 `plugins/jsvm/` 保持一致。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PocketBase                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Trigger Layer                                   │ │
│  │  HTTP Request | DB Hooks | Cron Schedule                               │ │
│  └───────────────────────────────┬────────────────────────────────────────┘ │
│                                  │                                           │
│  ┌───────────────────────────────▼────────────────────────────────────────┐ │
│  │                      Security Layer                                     │ │
│  │  Sandbox | Network Whitelist | Resource Quotas                         │ │
│  └───────────────────────────────┬────────────────────────────────────────┘ │
│                                  │                                           │
│  ┌───────────────────────────────▼────────────────────────────────────────┐ │
│  │                      WASM Runtime Pool                                  │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │ │
│  │  │   Instance Pool         │  │   QuickJS Engine                    │  │ │
│  │  │   (10 instances)        │  │   (WASM via wazero)                 │  │ │
│  │  │                         │  │                                     │  │ │
│  │  │   • Instance 1          │  │   • ES2022+ Support                 │  │ │
│  │  │   • Instance 2          │  │   • async/await                     │  │ │
│  │  │   • ...                 │  │   • Modules                         │  │ │
│  │  │   • Instance N          │  │   • Web APIs                        │  │ │
│  │  └─────────────────────────┘  └─────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                           │
│  ┌───────────────────────────────▼────────────────────────────────────────┐ │
│  │                      Host Functions Bridge                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │  fetch   │ │    db    │ │  vector  │ │    kv    │ │   file   │     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │ secrets  │ │   jobs   │ │ console  │ │  utils   │ │    tx    │     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                           │
│  ┌───────────────────────────────▼────────────────────────────────────────┐ │
│  │                      PocketBase Core                                    │ │
│  │  Database (SQLite/PostgreSQL) | FileSystem | KV | Jobs | Secrets       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### HTTP Request Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│  HTTP API   │────▶│  Security   │────▶│  Runtime    │
│         │     │  /pb_sls/*  │     │  Check      │     │  Pool       │
└─────────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
                       │                   │                   │
                       ▼                   ▼                   ▼
                ┌──────────┐        ┌──────────┐        ┌──────────┐
                │  Route   │        │  Auth    │        │  Acquire │
                │  Match   │        │  Verify  │        │  Instance│
                └──────────┘        └──────────┘        └──────┬───┘
                                                               │
                                                               ▼
                                                        ┌──────────┐
                                                        │  Execute │
                                                        │  Function│
                                                        └──────┬───┘
                                                               │
                    ┌──────────────────────────────────────────┤
                    │                                          │
                    ▼                                          ▼
             ┌──────────┐                               ┌──────────┐
             │  Host    │                               │  Return  │
             │  Calls   │                               │  Response│
             └──────────┘                               └──────────┘
```

1. 客户端发起 HTTP 请求到 `/api/pb_serverless/*`
2. 路由匹配到对应的 Serverless 函数
3. 安全检查（认证、白名单）
4. 从实例池获取 WASM 实例
5. 执行 JavaScript 函数
6. Host Function 调用（fetch、db、kv 等）
7. 返回响应（支持流式）

### DB Hook Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  DB Event   │────▶│  Hook       │────▶│  Runtime    │
│  (Create)   │     │  Registry   │     │  Execute    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    ┌──────────┐        ┌──────────┐
                    │  Match   │        │  Invoke  │
                    │  Hooks   │        │  Handler │
                    └──────────┘        └──────┬───┘
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                             ┌──────────┐          ┌──────────┐
                             │  Modify  │          │  Abort   │
                             │  Record  │          │  (throw) │
                             └──────────┘          └──────────┘
```

## Key Design Decisions

### 1. WASM Runtime 选择

**Decision**: QuickJS + wazero (自研集成)

> **📖 详细技术规格**: 完整的 QuickJS WASM 集成方案请参考 [`specs/_research/quickjs-wasm.md`](../_research/quickjs-wasm.md)

**Rationale**:
- QuickJS: 轻量级 JS 引擎，支持 ES2022+，启动快（< 2ms）
- wazero: 纯 Go WASM 运行时，无 CGO 依赖
- 组合优势：保持单二进制交付

**Trade-off**: QuickJS 性能不如 V8，但启动速度更快，更适合 Serverless 场景

**集成方案**: 将 QuickJS 编译为 WASM，通过 `//go:embed` 嵌入 Go 二进制

### 2. 三层沙箱架构 (Matryoshka Model)

**Decision**: Layer 1 (Go) → Layer 2 (WASM) → Layer 3 (JS)

> **📖 详细架构图**: 参考 [`specs/_research/quickjs-wasm.md` Section 3](../_research/quickjs-wasm.md)

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Host (Go/PocketBase)                                   │
│   - 完整系统权限                                                  │
│   - Wazero Runtime                                               │
│   - Host Functions API                                           │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Guest (WASM Binary)                                     │
│   - QuickJS Engine (Compiled to WASM)                            │
│   - PocketBase JS Bindings (C/C++)                               │
│   - 无法访问宿主文件系统                                          │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: User Space (JavaScript)                                 │
│   - 用户函数代码                                                  │
│   - pb-serverless-sdk.js                                         │
│   - 只能通过 SDK 调用受限 API                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale**:
- 军事级别隔离：JS 无法穿透三层沙箱访问文件系统或网络
- 单实例仅占 2-4MB 内存，单机可跑数千个并发实例

### 3. 内存模型与数据交换

**Decision**: JSON 序列化 + Shared Linear Memory

**Memory Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                    WASM Linear Memory                        │
├─────────────────────────────────────────────────────────────┤
│  [0x0000 - 0x1000]  Reserved (Stack Guard)                  │
│  [0x1000 - 0x2000]  Request Buffer (JSON)                   │
│  [0x2000 - 0x3000]  Response Buffer (JSON)                  │
│  [0x3000 - ...]     Heap (QuickJS Managed)                  │
└─────────────────────────────────────────────────────────────┘
```

**交互协议 (ABI)**:
1. JS 调用 `pb_op(op_code, payload_ptr, payload_len)`
2. Payload 是 JSON 序列化后的字节流
3. Go 读取 WASM 内存，解析 JSON，执行逻辑
4. Go 将结果写入 Response Buffer
5. JS 从内存读取结果并 `JSON.parse`

### 4. Host Functions 设计

**Decision**: 万能网关模式 (`host_request`)

> **📖 详细 ABI 规格**: 参考 [`specs/_research/quickjs-wasm.md` Section 4.3](../_research/quickjs-wasm.md)

| Host Function | Signature | Description |
|---------------|-----------|-------------|
| `host_log` | `(ptr, len, level) -> void` | console.log 转发 |
| `host_request` | `(op, ptr, len) -> res_ptr` | 万能网关（DB/Fetch/KV/Queue）|
| `host_error` | `(ptr, len) -> void` | 致命错误，终止实例 |
| `host_alloc` | `(size) -> ptr` | WASM 堆内存分配 |
| `host_free` | `(ptr) -> void` | WASM 堆内存释放 |

**Rationale**:
- 单一入口简化 FFI 绑定
- JSON 序列化简单可靠
- 共享内存用于大数据传输

### 5. 异步处理

**Decision**: Host Blocking 模式

**Mechanism**:
- JS 的 `await` 对应 Go 的同步阻塞调用
- 每个 Request 都有独立的 Goroutine，不会阻塞主线程

**Rationale**:
- Asyncify 会增加 WASM 二进制大小 (~20%)
- 实现复杂度高，调试困难
- Host Blocking 足够满足需求

### 6. 实例池设计

**Decision**: 固定大小实例池 + 预热

**Default**: 10 实例

**Rationale**:
- 控制内存使用（10 * 128MB = 1.28GB 上限）
- 避免冷启动延迟
- 实例复用提升性能

### 3. Host Function 通信

**Decision**: JSON 序列化 + 共享内存

**Rationale**:
- JSON 序列化简单可靠
- 共享内存用于大数据传输（如文件）
- 避免复杂的 FFI 绑定

### 4. 安全隔离

**Decision**: 多层沙箱

**Layers**:
1. WASM 内存隔离（每实例独立）
2. 网络白名单（默认禁止内网）
3. 资源配额（CPU 指令计数、内存限制）
4. 文件系统隔离（仅通过 pb.files API）

### 5. 流式响应

**Decision**: 透传 Host 的 ReadableStream

**Rationale**:
- AI SDK 需要流式响应
- 通过 Host Function 桥接 Go 的 io.Reader
- 保持连接活跃，不受超时限制

### 6. 事务支持

**Decision**: Scope-based Transaction

**Mechanism**:
- `pb.tx()` 开启事务
- 事务 ID 绑定到 WASM 实例上下文
- 后续 db 操作自动使用该事务
- 函数结束时自动 Commit/Rollback

## API Design

### Core Interface

```go
// ServerlessEngine 主接口
type ServerlessEngine interface {
    // 执行函数
    Execute(ctx context.Context, req *ExecuteRequest) (*ExecuteResponse, error)
    
    // 注册 Hook
    RegisterHook(collection string, event string, handler string) error
    
    // 注册 Cron
    RegisterCron(name string, schedule string, handler string) error
    
    // 加载代码
    LoadBundle(path string) error
    
    // 预编译
    Compile(source string) ([]byte, error)
    
    // 生命周期
    Start() error
    Stop() error
}

// ExecuteRequest 执行请求
type ExecuteRequest struct {
    Handler   string            // 函数名
    Method    string            // HTTP 方法
    Path      string            // 请求路径
    Headers   map[string]string // 请求头
    Body      []byte            // 请求体
    Query     map[string]string // 查询参数
    Auth      *auth.Record      // 认证信息
    TraceID   string            // 追踪 ID
}

// ExecuteResponse 执行响应
type ExecuteResponse struct {
    Status    int               // HTTP 状态码
    Headers   map[string]string // 响应头
    Body      io.Reader         // 响应体（支持流式）
    IsStream  bool              // 是否流式响应
}
```

### Host Functions Interface

```go
// HostFunctions 定义所有 Host Function
type HostFunctions interface {
    // Network
    Fetch(req *FetchRequest) (*FetchResponse, error)
    
    // Database
    DBQuery(sql string, args []any) ([]map[string]any, error)
    DBExec(sql string, args []any) (int64, error)
    
    // Vector
    VectorSearch(collection string, opts *VectorSearchOpts) ([]map[string]any, error)
    
    // KV
    KVGet(key string) (any, error)
    KVSet(key string, value any, ttl int) error
    KVDelete(key string) error
    
    // File
    FileRead(collection, record, filename string) ([]byte, error)
    FileSave(collection, record string, file *FileData) error
    
    // Secrets
    SecretGet(name string) (string, error)
    
    // Jobs
    JobEnqueue(topic string, payload any) (string, error)
    
    // Transaction
    TxBegin() (string, error)
    TxCommit(txID string) error
    TxRollback(txID string) error
    
    // Utility
    UUID() string
    Hash(input string) string
    RandomString(length int) string
}
```

### JavaScript SDK (Runtime)

```typescript
// 全局 pb 对象
declare const pb: {
    // 数据库操作
    collection(name: string): CollectionService;
    
    // KV 存储
    kv: {
        get(key: string): Promise<any>;
        set(key: string, value: any, opts?: { ttl?: number }): Promise<void>;
        delete(key: string): Promise<void>;
    };
    
    // 文件操作
    files: {
        read(collection: string, record: string, filename: string): Promise<ArrayBuffer>;
        save(collection: string, record: string, file: { filename: string; data: ArrayBuffer }): Promise<void>;
    };
    
    // 密钥
    secrets: {
        get(name: string): string | null;
    };
    
    // 任务队列
    jobs: {
        enqueue(topic: string, payload: any): Promise<string>;
    };
    
    // 事务
    tx<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
    
    // 工具
    utils: {
        uuid(): string;
        hash(input: string): string;
        randomString(length: number): string;
    };
    
    // Hooks
    onRecordBeforeCreate(collection: string, handler: (e: RecordEvent) => Promise<void>): void;
    onRecordAfterCreate(collection: string, handler: (e: RecordEvent) => Promise<void>): void;
    onRecordBeforeUpdate(collection: string, handler: (e: RecordEvent) => Promise<void>): void;
    onRecordAfterUpdate(collection: string, handler: (e: RecordEvent) => Promise<void>): void;
    onRecordBeforeDelete(collection: string, handler: (e: RecordEvent) => Promise<void>): void;
    onRecordAfterDelete(collection: string, handler: (e: RecordEvent) => Promise<void>): void;
    
    // Cron
    cron(name: string, schedule: string, handler: () => Promise<void>): void;
};

// 向量搜索扩展
interface CollectionService {
    vectorSearch(opts: {
        vector: number[];
        field: string;
        filter?: string;
        top?: number;
    }): Promise<Record[]>;
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| QuickJS 与 AI SDK 不兼容 | Medium | High | 提前进行兼容性测试，准备 Polyfill |
| WASM 冷启动过慢 | Medium | Medium | 实例池预热 + Bytecode 预编译 |
| 内存泄漏导致 OOM | Low | High | 严格的内存限制 + 实例定期回收 |
| 死循环导致 CPU 占满 | Low | High | 指令计数器 + 超时机制 |
| Host Function 性能瓶颈 | Medium | Medium | 批量操作 + 连接池复用 |
| 安全漏洞（SSRF 等）| Low | Critical | 网络白名单 + 沙箱隔离 |

## Performance Expectations

| Operation | Latency | Throughput |
|-----------|---------|------------|
| 冷启动（无预编译）| < 50ms | - |
| 冷启动（预编译）| < 20ms | - |
| 热启动（实例复用）| < 1ms | - |
| Fetch 开销 | < 5ms | - |
| DB Query 开销 | < 2ms | - |
| Vector Search (1M docs) | < 100ms | - |
| 并发执行 | - | > 50 并发 |

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| [QuickJS](https://bellard.org/quickjs/) | 2024-01 | JavaScript 引擎核心 |
| [wazero](https://github.com/tetratelabs/wazero) | v1.8+ | 纯 Go WASM 运行时 |
| [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) | v22+ | QuickJS 编译工具链 |
| [esbuild](https://esbuild.github.io/) | v0.20+ | TypeScript 打包 |

### QuickJS WASM 编译

> **📖 完整编译指南**: 参考 [`specs/_research/quickjs-wasm.md` Section 5](../_research/quickjs-wasm.md)

```bash
# 使用 wasi-sdk 编译 QuickJS 为 WASM
# 详细参数和步骤请参考 quickjs-wasm.md
wasi-sdk/bin/clang \
  -O3 \
  -D_WASI_EMULATED_MMAN \
  -DCONFIG_BIGNUM \
  -o pb_runtime.wasm \
  quickjs.c \
  pb_bridge.c \
  bootloader.c
```

**⚠️ 当前状态**: 现有 WASM 实现为 **Demo 版本**，需按照 `quickjs-wasm.md` 规格重新编译

### 二进制嵌入

```go
// plugins/serverless/runtime/wasm/embed.go
//go:embed pb_runtime.wasm
var runtimeWasm []byte
```

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| core/base.go | App 结构体集成 |
| core/kv_store.go | KV Storage (006-pocketbase-kv) |
| core/secret_store.go | Secrets (007-secret-management) |
| core/job_store.go | Job Queue (008-job-queue) |
| tools/observability/ | Structured Logging (009-unified-observability) |
| plugins/jsvm/ | Utility Functions 复用 |

## Testing Strategy

### Unit Tests
- 每个 Host Function 的正确性测试
- 实例池管理测试
- 安全策略测试

### Integration Tests
- HTTP Handler 端到端测试
- DB Hook 触发测试
- Cron 定时触发测试
- 流式响应测试

### Compatibility Tests
- Vercel AI SDK 兼容性测试
- OpenAI SDK 兼容性测试
- LangChain 兼容性测试

### Benchmark Tests
- 冷启动延迟基准
- 热启动延迟基准
- Fetch 吞吐量基准
- 并发执行基准

### Security Tests
- SSRF 防护测试
- 内存限制测试
- 超时机制测试
- 沙箱逃逸测试
