# Logging

PocketBase uses structured logging based on the standard `log/slog` package.

## Using the logger

```go
// Access the app logger
app.Logger().Info("Something happened")
app.Logger().Warn("Warning message")
app.Logger().Error("Error occurred", "error", err)

// With additional context
app.Logger().Info("User action",
    "userId", user.Id,
    "action", "login",
    "ip", request.RemoteAddr,
)
```

## Log levels

- `Debug` - Detailed debugging information
- `Info` - General operational information
- `Warn` - Warning messages
- `Error` - Error conditions

## Configuring logging

Log settings can be configured from the Dashboard under Settings > Logs, or programmatically:

```go
settings := app.Settings()
settings.Logs.MaxDays = 7      // keep logs for 7 days
settings.Logs.MinLevel = 0     // 0=Debug, 1=Info, 2=Warn, 3=Error
settings.Logs.LogIP = true     // log client IPs
settings.Logs.LogAuthId = true // log authenticated user IDs

if err := app.Save(settings); err != nil {
    return err
}
```

## Custom log handler

You can replace the default log handler:

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // Create a custom handler
    handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    })
    
    app.Logger().SetHandler(handler)
    
    return e.Next()
})
```

## Viewing logs

Logs can be viewed from the Dashboard under Logs, or via the API:

```
GET /api/logs
```

::: warning
Writing to the logs database from within hooks can cause performance issues if done excessively. Consider using external logging solutions for high-volume logging needs.
:::
