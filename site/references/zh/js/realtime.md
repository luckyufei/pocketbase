# 实时消息

默认情况下，PocketBase 只为记录的创建/更新/删除操作（*以及 OAuth2 认证重定向*）发送实时事件，但你可以通过 [`$app.subscriptionsBroker()`](/jsvm/functions/_app.subscriptionsBroker.html) 实例自由地向已连接的客户端发送自定义实时消息。

[`$app.subscriptionsBroker().clients()`](/jsvm/interfaces/subscriptions.Broker.html#clients) 返回所有已连接的 [`subscriptions.Client`](/jsvm/interfaces/subscriptions.Client.html)，按其唯一连接 ID 索引。

与客户端关联的当前认证记录可以通过 `client.get("auth")` 访问。

::: info
注意，单个已认证用户可能有多个活跃的实时连接（即多个客户端）。例如，当在不同的标签页、浏览器、设备等中打开同一应用时，就会发生这种情况。
:::

下面是一个最小代码示例，向所有订阅了 "example" 主题的客户端发送 JSON 数据：

```javascript
const message = new SubscriptionMessage({
    name: "example",
    data: JSON.stringify({ ... }),
});

// 获取所有客户端（按客户端 ID 索引的映射）
const clients = $app.subscriptionsBroker().clients()

for (let clientId in clients) {
    if (clients[clientId].hasSubscription("example")) {
        clients[clientId].send(message)
    }
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
