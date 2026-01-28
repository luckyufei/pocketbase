# 控制台命令

你可以使用 `app.rootCmd.addCommand(cmd)` 注册自定义控制台命令，其中 `cmd` 是一个 [Command](/jsvm/classes/Command.html) 实例。

这是一个示例：

```javascript
$app.rootCmd.addCommand(new Command({
    use: "hello",
    run: (cmd, args) => {
        console.log("Hello world!")
    },
}))
```

要运行该命令，你可以执行：

```bash
./pocketbase hello
```

::: info
请记住，控制台命令在它们自己独立的应用进程中执行，独立于主 `serve` 命令运行（即不同进程之间的钩子和实时事件不会相互共享）。
:::
