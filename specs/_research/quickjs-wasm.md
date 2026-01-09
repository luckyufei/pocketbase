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


飞将军，这是一个非常“工程师思维”的问题。

现状是：市面上**没有**一个开箱即用、专为 PocketBase/Go 设计的 `quickjs-wasm` 插件包。
大部分现存的方案（如 `quickjs-emscripten`）是为浏览器（JS 环境）设计的，而不是为 Go（Wazero 环境）设计的。

为了符合 Hangar **"High Performance & Secure"** 的标准，我推荐以下**两条路径**。其中 **方案 A** 是最符合我们刚刚设计的 Hangar Spec 的“正道”。

---

### 方案 A: The "Hangar Native" Way (推荐)

**自己编译 QuickJS 为 WASI (WebAssembly System Interface)**。

这是最“Anti-Stupidity”的做法：不引入任何中间层的黑盒，完全掌控运行时。

#### 1. 为什么选这条路？

* **体积最小**: 仅包含 QuickJS Core + Hangar Bindings，无冗余代码。
* **接口最对齐**: 可以直接按照我们 Spec 里的 `host_request` 定义导出函数。
* **Wazero 友好**: 产出的 `.wasm` 文件是标准的 WASI 格式，Wazero 跑起来最顺滑。

#### 2. 怎么做？(Actionable Guide)

你需要使用 **WASI-SDK** 将 QuickJS 的 C 源码编译成 `.wasm`。

**步骤 1: 准备 C 入口 (`main.c`)**
这是运行时的“微内核”代码，负责初始化 JS 引擎并等待 Go 调用。

```c
// main.c (简化版示意)
#include "quickjs.h"
#include <string.h>
#include <stdlib.h>

// 导入 Go 的 Host Functions
__attribute__((import_module("env"), import_name("host_request")))
char* host_request(char* op, char* payload);

JSRuntime *rt;
JSContext *ctx;

// 初始化引擎
void init() {
    rt = JS_NewRuntime();
    ctx = JS_NewContext(rt);
    // ... 在这里注册全局对象 'pb' 和桥接函数 ...
}

// 导出给 Go 调用的执行入口
__attribute__((export_name("run_handler")))
char* run_handler(char* source_code) {
    JSValue val = JS_Eval(ctx, source_code, strlen(source_code), "<input>", JS_EVAL_TYPE_GLOBAL);
    
    if (JS_IsException(val)) {
        // ... 处理错误并返回 JSON ...
        return "{\"error\": \"...\"}";
    }
    
    // ... 序列化结果并返回 ...
    return "{\"data\": ...}";
}

int main() {
    // 保持 WASM 实例存活，等待 invoke
    return 0; 
}

```

**步骤 2: 编译 (Makefile)**

下载 [WASI-SDK](https://github.com/WebAssembly/wasi-sdk) 和 [QuickJS 源码](https://github.com/bellard/quickjs)。

```makefile
CC = /opt/wasi-sdk/bin/clang
CFLAGS = -O3 -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_MMAN

# 关键：导出 malloc/free 给 Go 使用，以便 Go 往 WASM 内存写数据
LDFLAGS = -Wl,--export=malloc -Wl,--export=free -Wl,--no-entry -Wl,--allow-undefined

target:
	$(CC) $(CFLAGS) $(LDFLAGS) \
	-I quickjs/ \
	quickjs/quickjs.c quickjs/libregexp.c quickjs/libunicode.c \
	quickjs/cutils.c quickjs/libbf.c \
	main.c \
	-o runtime.wasm

```

**步骤 3: Go (Wazero) 调用**

```go
// 初始化 Wazero
r := wazero.NewRuntime(ctx)
_, _ = r.NewHostModuleBuilder("env").
    NewFunctionBuilder().WithFunc(func(ctx context.Context, mod api.Module, opPtr, payloadPtr uint32) uint32 {
        // 实现 host_request 逻辑
        return resultPtr
    }).Export("host_request").
    Instantiate(ctx)

// 加载编译好的 runtime.wasm
mod, _ := r.Instantiate(ctx, compiledCode)

// 调用 run_handler
runHandler := mod.ExportedFunction("run_handler")
resPtr, _ := runHandler.Call(ctx, sourcePtr)

```

---

### 方案 B: The "Industry Standard" Way (Javy)

**使用 Shopify 开源的 `Javy**`

如果你不想自己折腾 C 代码编译，Shopify 的 [Javy](https://github.com/bytecodealliance/javy) 是目前业界最成熟的 "JS to WASM" 工具链。

* **优点**: 极其成熟，Shopify 生产环境在用。
* **缺点**: 它的模式是“预编译”（把 JS 转成 WASM），而不是 Hangar 想要的“动态求值”（Runtime 读取 JS 字符串执行）。这意味着用户每改一行代码，Hangar 都要在后台调用 Javy 编译一次，稍微重了一点。
* **适用场景**: 如果你决定不让用户在 Admin UI 随便写脚本，而是类似 Git Push 发布流程，那用 Javy 很合适。

---

### 方案 C: The "Pure Go" Alternative (Goja)

**使用 `dop251/goja**`

虽然你指定了要 WASM，但我必须提及 **Goja**。它是纯 Go 实现的 JS 引擎（类似 k6 在用的）。

* **优点**: **Zero CGO, Zero WASM**. 编译极其简单，和 Go 也就是同一个进程，交互性能（Data Passing）比 WASM 快 10 倍。
* **缺点**: **没有强沙箱**。Goja 里的 `while(true)` 会卡死你的 Go 协程（虽然有 Interrupt 机制，但不如 WASM 彻底）。且没有 WASM 那种内存空间的物理隔离。
* **决策建议**:
* 如果脚本是**内部开发人员**写的（可信）：用 **Goja**。性能最好，开发最快。
* 如果脚本是**外部租户/AI 生成**写的（不可信）：必须用 **方案 A (QuickJS + WASM)**。



---

### 飞将军的最终建议

既然我们的愿景是 **"AI Native"** 且代码可能由 AI 生成（不可信），我强烈建议**方案 A**。

虽然前期要写点 C 代码来编译 `runtime.wasm`，但这是一劳永逸的。
你可以直接 fork 这个项目作为起点：[second-state/WasmEdge-quickjs](https://www.google.com/search?q=https://github.com/second-state/WasmEdge-quickjs) —— 这是一个很好的参考，虽然它是为 WasmEdge 优化的，但代码结构可以直接拿来改为标准 WASI 供 Wazero 使用。
