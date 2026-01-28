# JavaScript SDK 概述

从 PocketBase v0.17+ 开始，预构建的可执行文件内置了 **ES5 JavaScript 引擎**（goja），允许你使用纯 JavaScript 编写自定义服务端代码。

## 快速开始

要使用 JavaScript 扩展，在 PocketBase 可执行文件旁创建 `pb_hooks` 目录，并在其中添加 `*.pb.js` 文件。

```
myapp/
├── pb_hooks/
│   ├── main.pb.js
│   └── utils.pb.js
└── pocketbase
```

### 文件命名

- 文件必须具有 `.pb.js` 扩展名
- 文件按文件名字母顺序加载
- 使用前缀如 `01_`、`02_` 来控制加载顺序

### 热重载

PocketBase 监视 `pb_hooks/` 目录的更改并自动重新加载 JavaScript 文件（仅限 UNIX 平台）。

::: tip
对于生产环境，考虑使用 `--hooksWatch=0` 标志禁用文件监视以提高性能。
:::

## 基本示例

```javascript
// pb_hooks/main.pb.js

// 注册自定义路由
routerAdd("GET", "/hello/{name}", (e) => {
    const name = e.request.pathValue("name")
    return e.json(200, { "message": "Hello " + name })
})

// 注册事件钩子
onRecordCreateRequest((e) => {
    // 记录创建前的自定义逻辑
    e.next()
}, "posts")
```

## 全局对象

以下全局对象可在 JavaScript 代码中的任何位置访问：

| 对象 | 描述 |
|------|------|
| `__hooks` | 应用 `pb_hooks` 目录的绝对路径 |
| `$app` | 当前运行的 PocketBase 应用程序实例 |
| `$apis.*` | API 路由辅助函数和中间件 |
| `$os.*` | 操作系统级原语（读取/删除目录、执行 shell 命令等） |
| `$security.*` | 底层辅助工具，用于创建和解析 JWT、随机字符串生成、AES 加密/解密等 |

完整的 API 参考，请参阅 [JSVM 类型参考](/jsvm/index.html)。

## TypeScript 声明

虽然你不能直接使用 TypeScript（除非先转译为 JS），但 PocketBase 提供了内置的环境 TypeScript 声明，用于代码补全和类型提示。

声明文件位于 `pb_data/types.d.ts`，你可以使用三斜线指令引用它们：

```javascript
/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
    e.next()
    console.log("应用已初始化！")
})
```

::: tip
如果你的编辑器支持 TypeScript LSP（大多数现代编辑器都支持），你将获得所有 PocketBase API 的自动补全和类型信息。

如果引用不起作用，尝试将文件重命名为 `.pb.ts` 扩展名。
:::

## 与 Go API 的差异

使用 JavaScript SDK 时，请注意与 Go API 的这些差异：

1. **方法名**转换为驼峰命名（例如，`app.FindRecordById` → `$app.findRecordById`）

2. **错误**作为常规 JavaScript 异常抛出，而不是作为值返回

3. 单个处理程序内**没有并发执行**（不支持 `setTimeout`/`setInterval`）

## 处理程序作用域

每个处理函数（钩子、路由、中间件等）都在其独立的隔离上下文中序列化和执行。

::: warning 重要
在处理程序作用域外声明的自定义变量和函数在处理程序内部**无法访问**（它们将显示为 `undefined`）。

要在处理程序之间共享代码，请将可重用函数导出为本地模块，并在处理程序内使用 `require()` 加载它们。
:::

```javascript
// ❌ 错误 - 外部变量无法访问
const myVar = "test"
routerAdd("GET", "/example", (e) => {
    console.log(myVar) // undefined!
    return e.string(200, "Hello")
})

// ✅ 正确 - 在处理程序内使用 require()
routerAdd("GET", "/example", (e) => {
    const utils = require(`${__hooks}/utils.js`)
    return e.string(200, utils.getMessage())
})
```

## 相对路径

相对文件路径是相对于**当前工作目录（CWD）**解析的，而不是相对于 `pb_hooks` 目录。

使用 `__hooks` 全局变量获取 `pb_hooks` 的绝对路径：

```javascript
const data = $os.readFile(`${__hooks}/data/config.json`)
```

## 模块加载

### 支持的模块类型

目前，仅支持 **CommonJS（CJS）** 模块：

```javascript
const x = require("./mymodule")
```

对于 ES Modules（ESM），你需要使用 rollup、webpack 或 esbuild 等打包工具预编译它们。

### 模块解析

模块从以下位置加载：
- 本地文件系统路径
- `node_modules` 目录（在 CWD 和父目录中搜索）

::: warning
内置引擎不是 Node.js 或浏览器环境。依赖 `window`、`fs`、`fetch`、`buffer` 或其他非 ES5 规范运行时特定 API 的模块可能无法工作。
:::

### 并发警告

加载的模块使用共享注册表。避免修改模块状态以防止并发问题。

## 性能

### 预热池

预构建的可执行文件包含一个预热的 15 个 JS 运行时池，有助于保持处理程序执行时间与 Go 代码相当。

### 调整池大小

你可以使用 `--hooksPool` 标志手动调整池大小：

```bash
./pocketbase serve --hooksPool=50
```

增加池大小可能提高高并发性能，但也会增加内存使用。

### 计算密集型操作

纯 JS 的重计算操作（加密、随机生成器等）可能会降低性能。优先使用暴露的 Go 绑定：

```javascript
// ✅ 使用 Go 绑定（快速）
const str = $security.randomString(10)

// ❌ 避免纯 JS 实现（较慢）
```

## JavaScript vs Go

| 特性 | JavaScript | Go |
|------|------------|-----|
| 设置 | 无需编译 | 需要 Go 工具链 |
| 性能 | 轻微开销 | 原生性能 |
| 库 | 仅限内置 | 完整的 Go 生态系统 |
| 类型安全 | 运行时检查 | 编译时检查 |
| 热重载 | 自动（UNIX） | 需要重启 |

**选择 JavaScript 如果：**
- 你想快速原型设计
- 你不需要外部 Go 库
- 你更喜欢 JavaScript 语法

**选择 Go 如果：**
- 你需要最大性能
- 你需要外部 Go 库
- 你想要编译时类型安全

## 引擎限制

JavaScript 引擎（goja）有一些限制：

1. **ES6 兼容性**：大多数 ES6 功能已实现但不完全符合规范

2. **无 async/await**：单线程，不支持 `setTimeout`/`setInterval`

3. **Go 结构体包装**：包装的 Go 类型（maps、slices）有一些特性，行为与原生 JS 值不完全相同

4. **JSON 字段**：数据库 JSON 字段值需要使用 `get()` 和 `set()` 辅助方法

完整的 API 文档，请参阅 [JSVM 类型参考](/jsvm/index.html)。
