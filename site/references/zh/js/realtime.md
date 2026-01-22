# 实时功能（JavaScript）

PocketBase 通过服务器发送事件（SSE）提供实时功能。

## 发送自定义消息

```javascript
// 向订阅主题的所有客户端发送消息
$app.subscriptionsBroker().send("myTopic", JSON.stringify({
    message: "hello"
}))

// 向订阅记录的客户端发送消息
$app.subscriptionsBroker().send("posts/RECORD_ID", JSON.stringify({
    action: "custom"
}))
```

## 拦截实时事件

```javascript
onRealtimeConnectRequest((e) => {
    // 建立连接前的自定义逻辑
    console.log("Client connecting:", e.client.id())
    e.next()
})

onRealtimeSubscribeRequest((e) => {
    // 处理订阅前的自定义逻辑
    console.log("Subscribing to:", e.subscriptions)
    e.next()
})

onRealtimeMessageSend((e) => {
    // 发送消息前的自定义逻辑
    // 你可以修改 e.message 或阻止发送
    e.next()
})
```

## 自定义订阅验证

```javascript
onRealtimeSubscribeRequest((e) => {
    // 仅允许已认证用户订阅
    if (!e.client.auth()) {
        throw new ForbiddenError("Authentication required")
    }
    
    e.next()
})
```

## 示例：广播给所有客户端

```javascript
routerAdd("POST", "/api/broadcast", (e) => {
    const data = e.requestInfo().body
    
    // 广播给所有订阅 "announcements" 的客户端
    $app.subscriptionsBroker().send("announcements", JSON.stringify({
        type: "announcement",
        message: data.message,
        timestamp: new Date().toISOString()
    }))
    
    return e.json(200, { success: true })
}, $apis.requireSuperuserAuth())
```
