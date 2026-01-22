# 日志

PocketBase 使用基于标准 `log/slog` 包的结构化日志。

## 使用日志记录器

```go
// 访问应用日志记录器
app.Logger().Info("Something happened")
app.Logger().Warn("Warning message")
app.Logger().Error("Error occurred", "error", err)

// 带有额外上下文
app.Logger().Info("User action",
    "userId", user.Id,
    "action", "login",
    "ip", request.RemoteAddr,
)
```

## 日志级别

- `Debug` - 详细的调试信息
- `Info` - 一般运行信息
- `Warn` - 警告消息
- `Error` - 错误状况

## 配置日志

日志设置可以从仪表板的"设置 > 日志"中配置，或以编程方式配置：

```go
settings := app.Settings()
settings.Logs.MaxDays = 7      // 保留日志 7 天
settings.Logs.MinLevel = 0     // 0=Debug, 1=Info, 2=Warn, 3=Error
settings.Logs.LogIP = true     // 记录客户端 IP
settings.Logs.LogAuthId = true // 记录已认证用户 ID

if err := app.Save(settings); err != nil {
    return err
}
```

## 自定义日志处理程序

你可以替换默认的日志处理程序：

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // 创建自定义处理程序
    handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    })
    
    app.Logger().SetHandler(handler)
    
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
