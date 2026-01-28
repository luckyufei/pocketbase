# 实时功能

默认情况下，PocketBase 只为记录的创建/更新/删除操作（*以及 OAuth2 认证重定向*）发送实时事件，但你可以通过 [`app.SubscriptionsBroker()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.SubscriptionsBroker) 实例向已连接的客户端自由发送自定义实时消息。

[`app.SubscriptionsBroker().Clients()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/subscriptions#Broker.Clients) 返回所有已连接的 [`subscriptions.Client`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/subscriptions#Client)，按其唯一连接 ID 索引。

[`app.SubscriptionsBroker().ChunkedClients(size)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/subscriptions#Broker.ChunkedClients) 类似，但将结果作为分块切片返回，允许你将迭代分散到多个 goroutine 中（通常与 [`errgroup`](https://pkg.go.dev/golang.org/x/sync/errgroup) 结合使用）。

与客户端关联的当前认证记录可以通过 `client.Get(apis.RealtimeClientAuthKey)` 访问。

::: info
请注意，单个已认证用户可能有多个活动的实时连接（即多个客户端）。例如，当在不同的标签页、浏览器、设备等中打开相同的应用时可能会发生这种情况。
:::

以下是一个向所有订阅 "example" 主题的客户端发送 JSON 负载的最小代码示例：

```go
func notify(app core.App, subscription string, data any) error {
    rawData, err := json.Marshal(data)
    if err != nil {
        return err
    }

    message := subscriptions.Message{
        Name: subscription,
        Data: rawData,
    }

    group := new(errgroup.Group)

    chunks := app.SubscriptionsBroker().ChunkedClients(300)

    for _, chunk := range chunks {
        group.Go(func() error {
            for _, client := range chunk {
                if !client.HasSubscription(subscription) {
                    continue
                }

                client.Send(message)
            }

            return nil
        })
    }

    return group.Wait()
}

err := notify(app, "example", map[string]any{"test": 123})
if err != nil {
    return err
}
```

在客户端，用户可以通过以下方式监听自定义订阅主题：

::: code-group
```javascript [JavaScript]
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.realtime.subscribe('example', (e) => {
    console.log(e)
})
```

```dart [Dart]
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.realtime.subscribe('example', (e) {
    print(e)
})
```
:::
