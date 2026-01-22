# 事件钩子

修改 PocketBase 的标准方式是通过 Go 代码中的**事件钩子**。

所有钩子都有 3 个主要方法：

- **`Bind(handler)`** - 向指定的事件钩子添加新的处理程序。处理程序有 3 个字段：
  - `Id` *（可选）* - 处理程序的名称（可用作 `Unbind` 的参数）
  - `Priority` *（可选）* - 处理程序的执行顺序（如果为空，则回退到代码中的注册顺序）
  - `Func` *（必需）* - 处理函数

- **`BindFunc(func)`** - 类似于 `Bind`，但仅从提供的函数注册新处理程序。注册的处理程序以默认优先级 0 添加，ID 自动生成（返回的字符串值）。

- **`Trigger(event, oneOffHandlerFuncs...)`** - 触发事件钩子。*用户很少需要手动调用此方法。*

要删除已注册的钩子处理程序，你可以使用处理程序 ID 并将其传递给 `Unbind(id)` 或使用 `UnbindAll()` 删除所有处理程序（*！包括系统处理程序*）。

::: info
所有钩子处理函数共享相同的 `func(e T) error` 签名，并期望用户调用 `e.Next()` 以继续执行链。

**如果你需要从钩子处理程序内部访问应用实例，请优先使用 `e.App` 字段而不是重用父作用域的 app 变量，因为钩子可能是数据库事务的一部分，可能导致死锁。**

还要避免在钩子处理程序内部使用全局互斥锁，因为它可能被递归调用（例如级联删除），可能导致死锁。
:::

## 应用钩子

### OnServe

当应用通过 `app.Start()` 启动时触发。

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 注册自定义路由、中间件等
    return se.Next()
})
```

### OnBootstrap

当应用启动时触发。

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // 自定义初始化逻辑
    return e.Next()
})
```

## 记录钩子

### OnRecordCreate

当创建新记录时触发。

```go
app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
    // e.Record 包含正在创建的记录
    return e.Next()
})
```

### OnRecordUpdate

当更新记录时触发。

```go
app.OnRecordUpdate("posts").BindFunc(func(e *core.RecordEvent) error {
    // e.Record 包含正在更新的记录
    return e.Next()
})
```

### OnRecordDelete

当删除记录时触发。

```go
app.OnRecordDelete("posts").BindFunc(func(e *core.RecordEvent) error {
    // e.Record 包含正在删除的记录
    return e.Next()
})
```

### OnRecordCreateRequest

在记录创建 API 请求时触发。

```go
app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
    // 如果不是超级用户，将新提交的 "posts" 记录状态覆盖为待审核
    if !e.HasSuperuserAuth() {
        e.Record.Set("status", "pending")
    }
    return e.Next()
})
```

### OnRecordUpdateRequest

在记录更新 API 请求时触发。

```go
app.OnRecordUpdateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
    // 自定义验证或修改
    return e.Next()
})
```

### OnRecordDeleteRequest

在记录删除 API 请求时触发。

```go
app.OnRecordDeleteRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
    // 删除前的自定义验证
    return e.Next()
})
```

### OnRecordEnrich

在每次记录丰富时触发（列表、查看、创建、更新、实时更改等）。

```go
app.OnRecordEnrich("articles").BindFunc(func(e *core.RecordEnrichEvent) error {
    // 动态显示/隐藏记录字段
    if e.RequestInfo.Auth == nil || !e.RequestInfo.Auth.IsSuperuser() {
        e.Record.Hide("someSecretField")
    }
    return e.Next()
})
```

有关可用钩子的完整列表，请参阅 [PocketBase Go 文档](https://pkg.go.dev/github.com/pocketbase/pocketbase)。
