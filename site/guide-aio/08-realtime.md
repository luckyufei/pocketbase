# 实时订阅

## SSE 实现

PocketBase 使用 Server-Sent Events (SSE) 实现实时订阅。

## 订阅记录变更

```javascript
// 订阅集合所有记录
pb.collection('example').subscribe('*', (e) => {
    console.log(e.action);  // create, update, delete
    console.log(e.record);
});

// 订阅单条记录
pb.collection('example').subscribe('RECORD_ID', (e) => {
    console.log(e.record);
});

// 带选项订阅
pb.collection('example').subscribe('*', callback, {
    expand: 'author',
    filter: 'status = "published"'
});
```

## 取消订阅

```javascript
// 取消特定订阅
pb.collection('example').unsubscribe('*');
pb.collection('example').unsubscribe('RECORD_ID');

// 取消集合所有订阅
pb.collection('example').unsubscribe();

// 取消所有订阅
pb.realtime.unsubscribe();
```

## 权限控制

- 订阅单条记录：使用 `ViewRule`
- 订阅整个集合：使用 `ListRule`

## Go 端发送消息

```go
// 发送给特定客户端
app.SubscriptionsBroker().Send(clientId, &subscriptions.Message{
    Name: "custom_event",
    Data: []byte(`{"key": "value"}`),
})

// 广播给所有客户端
for client := range app.SubscriptionsBroker().Clients() {
    client.Send(&subscriptions.Message{
        Name: "broadcast",
        Data: []byte(`{"message": "hello"}`),
    })
}
```

## 事件类型

| 事件 | 描述 |
|------|------|
| `create` | 记录创建 |
| `update` | 记录更新 |
| `delete` | 记录删除 |
