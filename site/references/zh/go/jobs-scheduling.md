# 任务调度

如果你有需要定期执行的任务，可以使用内置的 `app.Cron()` 设置类似 crontab 的任务（*它返回一个应用范围的 [`cron.Cron`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/cron#Cron) 值*）。

任务调度器在应用 `serve` 时自动启动，所以你只需要使用 [`app.Cron().Add(id, cronExpr, handler)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/cron#Cron.Add) 或 [`app.Cron().MustAdd(id, cronExpr, handler)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/cron#Cron.MustAdd) 注册处理程序（*后者在 cron 表达式无效时会 panic*）。

每个计划任务在其自己的 goroutine 中运行，必须具有：

- **id** - 计划任务的标识符；可用于替换或移除现有任务
- **cron 表达式** - 例如 `0 0 * * *`（*支持数字列表、步进、范围或宏如 `@yearly`、`@annually`、`@monthly`、`@weekly`、`@daily`、`@midnight`、`@hourly`*）
- **handler** - 每次任务运行时执行的函数

以下是一个最小示例：

```go
// main.go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
)

func main() {
    app := pocketbase.New()

    // 每 2 分钟打印 "Hello!"
    app.Cron().MustAdd("hello", "*/2 * * * *", func() {
        log.Println("Hello!")
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

要移除已注册的 cron 任务，可以调用 [`app.Cron().Remove(id)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/cron#Cron.Remove)。

所有已注册的应用级 cron 任务也可以在 *Dashboard > Settings > Crons* 部分预览和触发。

::: warning
请记住，`app.Cron()` 也用于运行系统计划任务，如日志清理或自动备份（任务 ID 格式为 `__pb*__`），替换这些系统任务或调用 `RemoveAll()`/`Stop()` 可能会产生意外的副作用。

如果你想要更高级的控制，可以通过 `cron.New()` 初始化独立于应用的 cron 实例。
:::
