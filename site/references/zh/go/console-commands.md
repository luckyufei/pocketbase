# 控制台命令

PocketBase 允许你使用 Cobra 命令库注册自定义控制台命令。

## 注册命令

```go
app.RootCmd.AddCommand(&cobra.Command{
    Use:   "hello",
    Short: "Prints hello world",
    Run: func(cmd *cobra.Command, args []string) {
        fmt.Println("Hello World!")
    },
})
```

## 带标志的命令

```go
var name string

cmd := &cobra.Command{
    Use:   "greet",
    Short: "Greet someone",
    Run: func(cmd *cobra.Command, args []string) {
        fmt.Printf("Hello, %s!\n", name)
    },
}

cmd.Flags().StringVarP(&name, "name", "n", "World", "Name to greet")

app.RootCmd.AddCommand(cmd)
```

## 带参数的命令

```go
app.RootCmd.AddCommand(&cobra.Command{
    Use:   "process [file]",
    Short: "Process a file",
    Args:  cobra.ExactArgs(1),
    Run: func(cmd *cobra.Command, args []string) {
        filename := args[0]
        fmt.Printf("Processing %s...\n", filename)
    },
})
```

## 运行命令

```bash
./pocketbase hello
./pocketbase greet --name John
./pocketbase process myfile.txt
```

## 内置命令

PocketBase 包含几个内置命令：

- `serve` - 启动 Web 服务器
- `migrate` - 运行数据库迁移
- `superuser` - 管理超级用户账户
- `version` - 打印版本信息

有关 Cobra 命令的更多信息，请参阅 [Cobra 文档](https://github.com/spf13/cobra)。
