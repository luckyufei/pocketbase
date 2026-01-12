# Realtime

PocketBase provides realtime capabilities through Server-Sent Events (SSE).

## Sending custom messages

You can send custom realtime messages to connected clients:

```go
// Send to all clients subscribed to a specific topic
app.SubscriptionsBroker().Send("myTopic", []byte(`{"message": "hello"}`))

// Send to clients subscribed to a record
app.SubscriptionsBroker().Send("posts/RECORD_ID", []byte(`{"action": "custom"}`))
```

## Intercepting realtime events

```go
app.OnRealtimeConnectRequest().BindFunc(func(e *core.RealtimeConnectRequestEvent) error {
    // Custom logic before connection is established
    return e.Next()
})

app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
    // Custom logic before subscription is processed
    // e.Subscriptions contains the requested subscriptions
    return e.Next()
})

app.OnRealtimeMessageSend().BindFunc(func(e *core.RealtimeMessageSendEvent) error {
    // Custom logic before message is sent
    // You can modify e.Message or prevent sending by not calling e.Next()
    return e.Next()
})
```

## Client connections

```go
// Get all connected clients
clients := app.SubscriptionsBroker().Clients()

// Check if a specific client is connected
client, ok := app.SubscriptionsBroker().ClientById("clientId")

// Get client subscriptions
if ok {
    subscriptions := client.Subscriptions()
}
```

## Custom subscription validation

```go
app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
    // Only allow authenticated users to subscribe
    if e.Client.Auth() == nil {
        return apis.NewForbiddenError("Authentication required", nil)
    }
    
    return e.Next()
})
```
