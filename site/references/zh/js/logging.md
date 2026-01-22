# 日志（JavaScript）

PocketBase 通过 `$app.logger()` 方法提供日志功能。

## 使用日志记录器

```javascript
// 日志级别
$app.logger().debug("Debug message")
$app.logger().info("Info message")
$app.logger().warn("Warning message")
$app.logger().error("Error message", "error", err)

// 带额外上下文
$app.logger().info("User action",
    "userId", user.id,
    "action", "login",
    "ip", request.remoteAddr
)
```

## 控制台日志

对于简单的日志记录，你也可以使用 `console`：

```javascript
console.log("Simple log message")
console.warn("Warning message")
console.error("Error message")
```

## 示例：请求日志

```javascript
routerAdd("POST", "/api/myapp/action", (e) => {
    $app.logger().info("API action called",
        "user", e.auth ? e.auth.id : "anonymous",
        "path", e.request.url.path
    )
    
    try {
        // 执行某些操作
        return e.json(200, { success: true })
    } catch (err) {
        $app.logger().error("Action failed",
            "error", err.message,
            "user", e.auth ? e.auth.id : "anonymous"
        )
        throw err
    }
})
```

## 查看日志

可以从以下位置查看日志：
- 仪表板的"日志"
- API：`GET /api/logs`（仅限超级用户）
- 控制台输出（如果已配置）

::: warning
避免在钩子中过度日志记录，因为这会影响性能。使用适当的日志级别，对于高频需求考虑使用外部日志解决方案。
:::
