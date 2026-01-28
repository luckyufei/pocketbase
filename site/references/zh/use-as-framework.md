# 扩展 PocketBase

PocketBase 的主要特性之一是**它可以作为框架使用**，这使你能够用 [Go](/zh/go/overview) 或 [JavaScript](/zh/js/overview) 编写自己的自定义应用业务逻辑，并最终获得一个可移植的后端。

**如果你已经熟悉 Go 语言或有时间学习它，请选择[使用 Go 扩展](/zh/go/overview)。**作为 PocketBase 的主要语言，Go API 有更好的文档，而且你可以与任何第三方 Go 库集成，因为你对应用程序流程有更多的控制。唯一的缺点是 Go API 稍微冗长一些，可能需要一些时间来适应，特别是如果这是你第一次使用 Go。

**如果你不打算编写太多自定义代码并想快速探索 PocketBase 功能，请选择[使用 JavaScript 扩展](/zh/js/overview)。**嵌入式 JavaScript 引擎是现有 Go API 的可插拔包装器，所以大多数时候轻微的性能损失可以忽略不计，因为它会在底层调用 Go 函数。

作为额外好处，因为 JS VM 镜像了 Go API，如果你遇到瓶颈或想要更多控制执行流程，你可以在后期逐步从 JS -> Go 迁移，而无需太多代码更改。

使用 Go 和 JavaScript，你可以：

## 注册自定义路由

<CodeTabs>
<template #go>

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.GET("/hello", func(e *core.RequestEvent) error {
        return e.String(http.StatusOK, "Hello world!")
    })

    return se.Next()
})
```

</template>
<template #js>

```javascript
routerAdd("GET", "/hello", (e) => {
    return e.string(200, "Hello world!")
})
```

</template>
</CodeTabs>

## 绑定到事件钩子并拦截响应

<CodeTabs>
<template #go>

```go
app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
    // 如果不是超级用户，将新提交的 "posts" 记录状态覆盖为待审核
    if !e.HasSuperuserAuth() {
        e.Record.Set("status", "pending")
    }

    return e.Next()
})
```

</template>
<template #js>

```javascript
onRecordCreateRequest((e) => {
    // 如果不是超级用户，将新提交的 "posts" 记录状态覆盖为待审核
    if (!e.hasSuperuserAuth()) {
        e.record.set("status", "pending")
    }

    e.next()
}, "posts")
```

</template>
</CodeTabs>

## 注册自定义控制台命令

<CodeTabs>
<template #go>

```go
app.RootCmd.AddCommand(&cobra.Command{
    Use: "hello",
    Run: func(cmd *cobra.Command, args []string) {
        print("Hello world!")
    },
})
```

</template>
<template #js>

```javascript
$app.rootCmd.addCommand(new Command({
    use: "hello",
    run: (cmd, args) => {
        console.log("Hello world!")
    },
}))
```

</template>
</CodeTabs>

...还有更多！

更多信息，请查看相关的[使用 Go 扩展](/zh/go/overview)或[使用 JavaScript 扩展](/zh/js/overview)指南。
