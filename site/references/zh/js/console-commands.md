# 控制台命令（JavaScript）

PocketBase 允许你在 JavaScript 中注册自定义控制台命令。

## 注册命令

```javascript
$app.rootCmd.addCommand(new Command({
    use: "hello",
    short: "Prints hello world",
    run: (cmd, args) => {
        console.log("Hello World!")
    }
}))
```

## 带参数的命令

```javascript
$app.rootCmd.addCommand(new Command({
    use: "greet [name]",
    short: "Greet someone",
    run: (cmd, args) => {
        const name = args.length > 0 ? args[0] : "World"
        console.log(`Hello, ${name}!`)
    }
}))
```

## 运行命令

```bash
./pocketbase hello
./pocketbase greet John
```

## 示例：数据导出命令

```javascript
$app.rootCmd.addCommand(new Command({
    use: "export-posts",
    short: "Export all posts to JSON",
    run: (cmd, args) => {
        const records = $app.findAllRecords("posts")
        
        const data = records.map(r => ({
            id: r.id,
            title: r.getString("title"),
            created: r.getString("created")
        }))
        
        console.log(JSON.stringify(data, null, 2))
    }
}))
```

## 内置命令

PocketBase 包含几个内置命令：

- `serve` - 启动 Web 服务器
- `migrate` - 运行数据库迁移
- `superuser` - 管理超级用户账户
- `version` - 打印版本信息
