# Realtime (JavaScript)

PocketBase provides realtime capabilities through Server-Sent Events (SSE).

## Sending custom messages

```javascript
// Send to all clients subscribed to a topic
$app.subscriptionsBroker().send("myTopic", JSON.stringify({
    message: "hello"
}))

// Send to clients subscribed to a record
$app.subscriptionsBroker().send("posts/RECORD_ID", JSON.stringify({
    action: "custom"
}))
```

## Intercepting realtime events

```javascript
onRealtimeConnectRequest((e) => {
    // Custom logic before connection is established
    console.log("Client connecting:", e.client.id())
    e.next()
})

onRealtimeSubscribeRequest((e) => {
    // Custom logic before subscription is processed
    console.log("Subscribing to:", e.subscriptions)
    e.next()
})

onRealtimeMessageSend((e) => {
    // Custom logic before message is sent
    // You can modify e.message or prevent sending
    e.next()
})
```

## Custom subscription validation

```javascript
onRealtimeSubscribeRequest((e) => {
    // Only allow authenticated users to subscribe
    if (!e.client.auth()) {
        throw new ForbiddenError("Authentication required")
    }
    
    e.next()
})
```

## Example: Broadcast to all clients

```javascript
routerAdd("POST", "/api/broadcast", (e) => {
    const data = e.requestInfo().body
    
    // Broadcast to all clients subscribed to "announcements"
    $app.subscriptionsBroker().send("announcements", JSON.stringify({
        type: "announcement",
        message: data.message,
        timestamp: new Date().toISOString()
    }))
    
    return e.json(200, { success: true })
}, $apis.requireSuperuserAuth())
```
