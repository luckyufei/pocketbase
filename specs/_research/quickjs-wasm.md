这是为您补全的 **Hangar Serverless Runtime (QuickJS Engine)** 深度技术规格说明书。

它解决了一个核心矛盾：**WASM 的强隔离性** vs **JavaScript 的高易用性**。
我们不是简单的把 QuickJS 编译成 WASM，而是构建了一个**专门为 Hangar 优化的 JS 运行时微内核**。

---

# Spec: Hangar Serverless Runtime (QuickJS on WASM)

**Version**: 1.0.0 (The Micro-Kernel)
**Type**: Core Infrastructure
**Target**: `v2.0`
**Core Concept**: "Sandboxed Interpreter". Run untrusted JS code inside a WASM container with near-native startup time.

## 1. Problem Essence (核心问题)

* **痛点**: 原生 WASM 开发门槛太高（需要 Rust/Go/TinyGo）。普通开发者只想要 "编写 JS，即刻运行"。
* **挑战**: Node.js 太重（启动慢、内存大），不适合作为高密度 Serverless 运行时；直接运行 JS 缺乏安全沙箱（可以访问 syscall）。
* **解法**: 将轻量级 JS 引擎 (QuickJS) 编译为 WASM，作为“中间件”运行在 Hangar 的 Wazero 运行时中。

## 2. Efficiency ROI (效能回报)

* **Cold Start**: **< 2ms**. QuickJS 引擎初始化极快，配合 Wazero 的 Snapshot 机制，几乎零冷启动延迟。
* **Isolation**: **Military Grade**. JS 代码运行在 QuickJS 里，QuickJS 运行在 WASM 里，WASM 运行在 Go 里。JS 无法穿透三层沙箱去访问文件系统或网络。
* **Density**: **High**. 单个 Runtime 实例仅占 2-4MB 内存，单机可跑数千个并发实例。

## 3. Architecture: The Matryoshka Model (套娃模型)

```mermaid
graph TD
    subgraph "Layer 1: Host (Go/Hangar)"
        Host[Hangar Core]
        Wazero[Wazero Runtime]
        HostFuncs[Host Functions API]
    end

    subgraph "Layer 2: Guest (WASM Binary)"
        QJS[QuickJS Engine (Compiled to WASM)]
        Bindings[Hangar JS Bindings (C/C++)]
    end

    subgraph "Layer 3: User Space (JavaScript)"
        UserCode[index.js]
        SDK[hangar-sdk.js]
    end

    %% Interaction
    UserCode -->|Call| SDK
    SDK -->|Internal| QJS
    QJS -->|FFI Call| Bindings
    Bindings -->|WASM Import| HostFuncs
    HostFuncs -->|Execute| Host

```

## 4. Spec/Design (核心设计)

### 4.1 The Runtime Binary (`runtime.wasm`)

我们需要预编译一个通用的 `runtime.wasm` 文件，它包含：

1. **QuickJS Core**: 2024 版本，开启 `BIGNUM` 支持。
2. **Bootloader**: C 代码，负责读取内存中的 JS 源码并求值。
3. **Hangar Bridge**: C 代码，定义了 JS 如何调用 Go 的标准接口。

### 4.2 Memory Model & Data Exchange (内存模型)

JS 和 Go 之间无法直接共享对象，必须通过 **Shared Linear Memory** 进行交换。

**交互协议 (The ABI)**:

1. **JS -> Go**:
* JS 调用 `pb_op(op_code, payload_ptr, payload_len)`。
* Payload 是 JSON 序列化后的字节流。
* Go 读取 WASM 内存，解析 JSON，执行逻辑。


2. **Go -> JS**:
* Go 将结果写入 WASM 内存。
* Go 修改 WASM 中的 `ret_ptr` 和 `ret_len`。
* JS 从内存读取结果并 `JSON.parse`。



### 4.3 Host Function Definitions (宿主函数)

在 `runtime.wasm` 中导入 (Import) 以下 Go 函数：

| Host Function | Signature (WASM) | Description |
| --- | --- | --- |
| **`host_log`** | `(ptr, len, level) -> void` | 将 JS 的 console.log 转发给 Hangar 的 Tracing 系统 |
| **`host_request`** | `(op, ptr, len) -> res_ptr` | **万能网关**。所有 DB/Fetch/Queue 操作都走这个入口。 |
| **`host_error`** | `(ptr, len) -> void` | 抛出致命错误，终止实例 |

### 4.4 The JavaScript SDK (`hangar-sdk.js`)

在 QuickJS 内部预加载的 JS 垫片，屏蔽底层的内存操作。

```javascript
// _internal/bridge.js (Preloaded)

const memory = new Uint8Array(WASM_MEMORY_BUFFER);

function hostCall(op, data) {
    const json = JSON.stringify(data);
    const ptr = alloc(json.length); // C侧分配内存
    writeString(ptr, json);
    
    // 调用 WASM Import 的宿主函数
    const resPtr = globalThis.__host_request(op, ptr, json.length);
    
    const resJson = readString(resPtr);
    free(ptr); // 释放内存
    
    const res = JSON.parse(resJson);
    if (res.error) throw new Error(res.error);
    return res.data;
}

// Public SDK
globalThis.pb = {
    collection: (name) => ({
        getList: (page, perPage) => hostCall("db_list", { col: name, page, perPage }),
        create: (data) => hostCall("db_create", { col: name, data }),
    }),
    secrets: {
        get: (key) => hostCall("secret_get", { key })
    }
};

```

### 4.5 Asynchronous & Event Loop (异步处理)

QuickJS 是单线程的，但 Hangar 业务是异步的（如 Fetch, DB Query）。

**机制**: **"Asyncify"** (或者简单的 Promise 桥接)。
由于 QuickJS 在 WASM 中是同步执行的，当 JS 调用 `await pb.collection().getList()` 时：

1. **JS Side**: 返回一个 Promise。
2. **Go Side**:
* Wazero 暂停当前 WASM 栈（如果是 Asyncify）。
* 或者（更简单的方案）：Go 执行阻塞操作（因为是在独立的 Goroutine 中），直到 DB 返回。
* Go 将结果写入内存，WASM 继续执行。



*决策*: 为了简化实现，v2.0 阶段采用 **Host Blocking** 模式。即 JS 的 `await` 对应 Go 的同步阻塞调用。因为每个 Request 都有独立的 Goroutine，这不会阻塞 Hangar 主线程。

## 5. Execution Lifecycle (执行生命周期)

当一个 HTTP 请求 `POST /api/serverless/my-script` 到达时：

1. **Load**: Hangar 从 `_scripts` 表取出 JS 源码。
2. **Instantiate**: 从 `Wazero Module Cache` 中取出一个 `runtime.wasm` 实例（毫秒级）。
3. **Inject**: 将 Request Body 和 Headers 写入 WASM 内存。
4. **Eval**: 调用 WASM 导出函数 `run_handler(source_ptr)`。
5. **Output**: QuickJS 执行 JS，通过 Host Function 写回 Response。
6. **Destroy**: 销毁实例（或重置内存归还对象池）。

## 6. Boundaries & Anti-Stupidity (防愚蠢)

1. **NO Node.js Modules**:
* **Anti-Pattern**: 用户试图 `import fs from 'fs'` 或 `require('express')`。
* **Constraint**: 仅支持 ESM (`import ...`)，且仅限于 Hangar 内置的 SDK 和纯算法库（如 lodash-es, date-fns）。不支持任何 Native Module。
* **Error**: 遇到不支持的 import 直接抛出 "Module not found (Hangar is not Node.js)".


2. **Execution Timeout**:
* **Limit**: 默认 10秒。
* **Mechanism**: Go 在 Context 中设置 Deadline。超时后直接 `Close()` WASM 实例，QuickJS 会被强制终止。


3. **Memory Limit**:
* **Limit**: 默认 128MB。
* **Mechanism**: Wazero 启动时限制 MaxMemory页数。防止用户写 `while(true) array.push(1)` 撑爆服务器。



## 7. Implementation Roadmap (实施路线)

1. **The Core (C/WASM)**:
* 编写 `main.c`：集成 quickjs.c，实现 `__host_request` 导入定义。
* 使用 `emcc` 或 `wasi-sdk` 编译出 `hangar_runtime.wasm`。


2. **The Host (Go)**:
* Wazero 初始化逻辑，Host Function 绑定。
* 实现 JSON 序列化/反序列化的内存读写 Helper。


3. **The SDK (JS)**:
* 编写 `bridge.js` 和 `pb.d.ts` (TypeScript 定义)。



---

**飞将军的总结**

这个方案是 Hangar Serverless 的心脏。
我们没有引入 V8 (太重)，也没有引入 Node (太乱)。
我们用 **QuickJS + WASM** 打造了一个**专属于 Hangar 的、纯净的、安全的** JavaScript 运行时。

这就好比给 Docker 容器里装的不是笨重的 Ubuntu，而是一个精简的 Alpine Linux。极致的高效。