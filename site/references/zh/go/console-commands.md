# 控制台命令

你可以使用 `app.RootCmd.AddCommand(cmd)` 注册自定义控制台命令，其中 `cmd` 是一个 [cobra](https://pkg.go.dev/github.com/spf13/cobra) 命令。

这是一个示例：

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/spf13/cobra"
)

func main() {
    app := pocketbase.New()

    app.RootCmd.AddCommand(&cobra.Command{
        Use: "hello",
        Run: func(cmd *cobra.Command, args []string) {
            log.Println("Hello world!")
        },
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

要运行该命令，你可以构建你的 Go 应用程序并执行：

```bash
# 或 "go run main.go hello"
./myapp hello
```

::: info
请记住，控制台命令在它们自己独立的应用进程中执行，独立于主 `serve` 命令运行（即不同进程之间的钩子和实时事件不会相互共享）。
:::
