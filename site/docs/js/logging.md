# Logging (JavaScript)

PocketBase provides logging capabilities through the `$app.logger()` method.

## Using the logger

```javascript
// Log levels
$app.logger().debug("Debug message")
$app.logger().info("Info message")
$app.logger().warn("Warning message")
$app.logger().error("Error message", "error", err)

// With additional context
$app.logger().info("User action",
    "userId", user.id,
    "action", "login",
    "ip", request.remoteAddr
)
```

## Console logging

For simple logging, you can also use `console`:

```javascript
console.log("Simple log message")
console.warn("Warning message")
console.error("Error message")
```

## Example: Request logging

```javascript
routerAdd("POST", "/api/myapp/action", (e) => {
    $app.logger().info("API action called",
        "user", e.auth ? e.auth.id : "anonymous",
        "path", e.request.url.path
    )
    
    try {
        // do something
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

## Viewing logs

Logs can be viewed from:
- Dashboard under Logs
- API: `GET /api/logs` (superusers only)
- Console output (if configured)

::: warning
Avoid excessive logging in hooks as it can impact performance. Use appropriate log levels and consider external logging solutions for high-volume needs.
:::
