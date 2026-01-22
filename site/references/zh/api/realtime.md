# 实时 API

实时 API 通过 Server-Sent Events (SSE) 实现。通常包含 2 个操作：

1. 建立 SSE 连接
2. 提交客户端订阅

SSE 事件会在记录的**创建**、**更新**和**删除**操作时发送。

::: info
**你可以订阅单个记录或整个集合。**

当订阅**单个记录**时，将使用集合的 **ViewRule** 来确定订阅者是否有权接收事件消息。

当订阅**整个集合**时，将使用集合的 **ListRule** 来确定订阅者是否有权接收事件消息。
:::

## 连接

::: info GET
`/api/realtime`
:::

建立新的 SSE 连接，并立即发送带有创建的客户端 ID 的 `PB_CONNECT` SSE 事件。

::: tip
用户/超级用户授权在第一次[设置订阅](#设置订阅)调用时进行。
:::

如果连接的客户端在 5 分钟内没有收到任何新消息，服务器将发送断开连接信号（这是为了防止遗忘/泄露的连接）。如果客户端仍然活跃（例如浏览器标签仍然打开），连接将自动重新建立。

---

## 设置订阅

::: tip POST
`/api/realtime`
:::

设置新的活跃客户端订阅（并自动取消之前的订阅）。

如果设置了 `Authorization` 头，将使用关联的用户或超级用户授权客户端 SSE 连接。

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| clientId | String | **必需。** SSE 客户端连接的 ID。 |
| subscriptions | Array\<String\> | 可选。要设置的新客户端订阅，格式为：`COLLECTION_ID_OR_NAME` 或 `COLLECTION_ID_OR_NAME/RECORD_ID`。你也可以使用 `options` 查询参数将可选的查询和头参数作为序列化 JSON 附加到单个主题。留空以取消所有订阅。 |

带选项的订阅示例：
```
COLLECTION_ID_OR_NAME/RECORD_ID?options={"query": {"abc": "123"}, "headers": {"x-token": "..."}}
```

::: tip
请求体参数可以作为 JSON 或 multipart/form-data 发送。
:::

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "处理请求时出错。",
  "data": {
    "clientId": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```

```json [403]
{
  "status": 403,
  "message": "当前请求和之前的请求授权不匹配。",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "缺少或无效的客户端 ID。",
  "data": {}
}
```
:::

---

## SDK 用法

所有这些都由 SDK 使用 `subscribe` 和 `unsubscribe` 方法无缝处理：

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// （可选）认证
await pb.collection('users').authWithPassword('test@example.com', '1234567890');

// 订阅集合中任何记录的变更
pb.collection('example').subscribe('*', function (e) {
    console.log(e.action);
    console.log(e.record);
}, { /* 其他选项如 expand、自定义头等 */ });

// 仅订阅指定记录的变更
pb.collection('example').subscribe('RECORD_ID', function (e) {
    console.log(e.action);
    console.log(e.record);
}, { /* 其他选项如 expand、自定义头等 */ });

// 取消订阅
pb.collection('example').unsubscribe('RECORD_ID'); // 移除所有 'RECORD_ID' 订阅
pb.collection('example').unsubscribe('*'); // 移除所有 '*' 主题订阅
pb.collection('example').unsubscribe(); // 移除集合中的所有订阅
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// （可选）认证
await pb.collection('users').authWithPassword('test@example.com', '1234567890');

// 订阅集合中任何记录的变更
pb.collection('example').subscribe('*', (e) {
    print(e.action);
    print(e.record);
}, /* 其他选项如 expand、自定义头等 */);

// 仅订阅指定记录的变更
pb.collection('example').subscribe('RECORD_ID', (e) {
    print(e.action);
    print(e.record);
}, /* 其他选项如 expand、自定义头等 */);

// 取消订阅
pb.collection('example').unsubscribe('RECORD_ID'); // 移除所有 'RECORD_ID' 订阅
pb.collection('example').unsubscribe('*'); // 移除所有 '*' 主题订阅
pb.collection('example').unsubscribe(); // 移除集合中的所有订阅
```

</template>
</CodeTabs>
