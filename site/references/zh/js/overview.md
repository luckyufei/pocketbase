# JavaScript SDK 概述

## 入门指南

PocketBase 可以使用嵌入式 JSVM（JavaScript 虚拟机）通过 JavaScript 进行扩展。这允许你编写自定义业务逻辑，而无需编译 Go 代码。

JavaScript 文件放置在 `pb_hooks` 目录中，PocketBase 启动时会自动加载。

## 基本结构

在 `pb_hooks/` 中创建一个 JavaScript 文件：

```javascript
// pb_hooks/main.pb.js

// 注册自定义路由
routerAdd("GET", "/hello/{name}", (e) => {
    const name = e.request.pathValue("name")
    return e.string(200, `Hello ${name}!`)
})

// 注册事件钩子
onRecordCreateRequest((e) => {
    // 记录创建前的自定义逻辑
    e.next()
}, "posts")
```

## 文件命名

- 文件必须有 `.pb.js` 扩展名
- 文件按字母顺序加载
- 使用前缀如 `01_`、`02_` 来控制加载顺序

## 热重载

在开发期间，PocketBase 会监视 `pb_hooks/` 中的更改并自动重新加载 JavaScript 文件。

::: tip
对于生产环境，考虑使用 `--hooksWatch=0` 标志来禁用文件监视以提高性能。
:::

## JavaScript vs Go

| 特性 | JavaScript | Go |
|---------|------------|-----|
| 设置 | 无需编译 | 需要 Go 工具链 |
| 性能 | 略有开销 | 原生性能 |
| 库 | 限于内置 | 完整 Go 生态系统 |
| 类型安全 | 运行时检查 | 编译时检查 |
| 热重载 | 自动 | 需要重启 |

**选择 JavaScript 如果：**
- 你想快速原型开发
- 你不需要外部 Go 库
- 你更喜欢 JavaScript 语法

**选择 Go 如果：**
- 你需要最大性能
- 你需要外部 Go 库
- 你想要编译时类型安全
