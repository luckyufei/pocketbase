# 任务调度（JavaScript）

如果你有需要周期性执行的任务，可以使用 `cronAdd(id, expr, handler)` 设置类似 crontab 的任务。

每个调度任务作为 `serve` 命令进程的一部分在其自己的 goroutine 中运行，必须具有：

- **id** - 调度任务的标识符；可用于替换或删除现有任务
- **cron 表达式** - 例如 `0 0 * * *`（*支持数字列表、步长、范围或宏如 `@yearly`、`@annually`、`@monthly`、`@weekly`、`@daily`、`@midnight`、`@hourly`*）
- **handler** - 每次任务运行时执行的函数

这是一个示例：

```javascript
// 每 2 分钟打印 "Hello!"
cronAdd("hello", "*/2 * * * *", () => {
    console.log("Hello!")
})
```

要移除单个已注册的 cron 任务，可以调用 `cronRemove(id)`。

所有已注册的应用级 cron 任务也可以从 *仪表板 > 设置 > Crons* 部分预览和触发。
