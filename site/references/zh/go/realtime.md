# 实时功能

PocketBase 通过服务器发送事件（SSE）提供实时功能。

## 发送自定义消息

你可以向已连接的客户端发送自定义实时消息：

```go
// 向订阅特定主题的所有客户端发送消息
app.SubscriptionsBroker().Send("myTopic", []byte(`{"message": "hello"}`))

// 向订阅记录的客户端发送消息
app.SubscriptionsBroker().Send("posts/RECORD_ID", []byte(`{"action": "custom"}`))
```

## 拦截实时事件

```go
app.OnRealtimeConnectRequest().BindFunc(func(e *core.RealtimeConnectRequestEvent) error {
    // 建立连接前的自定义逻辑
    return e.Next()
})

app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
    // 处理订阅前的自定义逻辑
    // e.Subscriptions 包含请求的订阅
    return e.Next()
})

app.OnRealtimeMessageSend().BindFunc(func(e *core.RealtimeMessageSendEvent) error {
    // 发送消息前的自定义逻辑
    // 你可以修改 e.Message 或通过不调用 e.Next() 来阻止发送
    return e.Next()
})
```

## 客户端连接

```go
// 获取所有已连接的客户端
clients := app.SubscriptionsBroker().Clients()

// 检查特定客户端是否已连接
client, ok := app.SubscriptionsBroker().ClientById("clientId")

// 获取客户端订阅
if ok {
    subscriptions := client.Subscriptions()
}
```

## 自定义订阅验证

```go
app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
    // 仅允许已认证用户订阅
    if e.Client.Auth() == nil {
        return apis.NewForbiddenError("Authentication required", nil)
    }
    
    return e.Next()
})
```
