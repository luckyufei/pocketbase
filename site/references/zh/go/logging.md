# 日志

`app.Logger()` 可用于将任何日志写入数据库，以便稍后可以从 PocketBase *仪表盘 > 日志* 部分进行浏览。

::: info
为了提高性能并最小化热路径上的阻塞，日志会进行防抖和批量写入：

- 在最后一次防抖日志写入后 3 秒
- 当达到批量阈值时（当前为 200 条）
- 在应用终止前尝试保存现有日志队列中的所有内容
:::

[[toc]]

## 日志方法

所有标准的 [`slog.Logger`](https://pkg.go.dev/log/slog#Logger) 方法都可用，以下是一些最常用的方法列表。请注意，属性以键值对参数的形式表示。

### Debug(message, attrs...)

```go
app.Logger().Debug("调试消息！")

app.Logger().Debug(
    "带属性的调试消息！",
    "name", "John Doe",
    "id", 123,
)
```

### Info(message, attrs...)

```go
app.Logger().Info("信息消息！")

app.Logger().Info(
    "带属性的信息消息！",
    "name", "John Doe",
    "id", 123,
)
```

### Warn(message, attrs...)

```go
app.Logger().Warn("警告消息！")

app.Logger().Warn(
    "带属性的警告消息！",
    "name", "John Doe",
    "id", 123,
)
```

### Error(message, attrs...)

```go
app.Logger().Error("错误消息！")

app.Logger().Error(
    "带属性的错误消息！",
    "id", 123,
    "error", err,
)
```

### With(attrs...)

`With(attrs...)` 创建一个新的本地日志记录器，它会在每个后续日志中"注入"指定的属性。

```go
l := app.Logger().With("total", 123)

// 结果日志数据为 {"total": 123}
l.Info("message A")

// 结果日志数据为 {"total": 123, "name": "john"}
l.Info("message B", "name", "john")
```

### WithGroup(name)

`WithGroup(name)` 创建一个新的本地日志记录器，它将所有日志属性包装在指定的组名下。

```go
l := app.Logger().WithGroup("sub")

// 结果日志数据为 {"sub": { "total": 123 }}
l.Info("message A", "total", 123)
```

## 日志设置

你可以从日志设置面板控制各种日志设置，如日志保留期限、最小日志级别、请求 IP 记录等：

![日志设置截图](/images/screenshots/logs.png)

## 自定义日志查询

日志通常用于从 UI 进行过滤，但如果你想以编程方式检索和过滤存储的日志，可以使用 [`app.LogQuery()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#App) 查询构建器方法。例如：

```go
logs := []*core.Log{}

// 参见 https://pocketbase.io/docs/go-database/#query-builder
err := app.LogQuery().
    // 只针对 debug 和 info 日志
    AndWhere(dbx.In("level", -4, 0)).
    // data 列是序列化的 json 对象，可以是任何内容
    AndWhere(dbx.NewExp("json_extract(data, '$.type') = 'request'")).
    OrderBy("created DESC").
    Limit(100).
    All(&logs)
```

## 拦截日志写入

如果你想在持久化到数据库之前修改日志数据，或将其转发到外部系统，可以通过附加到 [基础模型钩子](/docs/go-event-hooks/#base-model-hooks) 来监听 `_logs` 表的变化。例如：

```go
app.OnModelCreate(core.LogsTableName).BindFunc(func(e *core.ModelEvent) error {
    l := e.Model.(*core.Log)

    fmt.Println(l.Id)
    fmt.Println(l.Created)
    fmt.Println(l.Level)
    fmt.Println(l.Message)
    fmt.Println(l.Data)

    return e.Next()
})
```

## 查看日志

可以从仪表板的"日志"中查看日志，或通过 API：

```
GET /api/logs
```

::: warning
在钩子中向日志数据库写入可能会导致性能问题，如果频繁执行的话。对于高频日志需求，请考虑使用外部日志解决方案。
:::
