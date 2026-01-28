# 健康检查 API

## 健康检查

返回服务器的健康状态。

此端点通常被负载均衡器、监控工具或容器编排器（如 Kubernetes）用于检查服务器是否正在运行且健康。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 无需认证
const health = await pb.health.check();

console.log(health.status);    // 200
console.log(health.message);   // "API is healthy."
console.log(health.data);      // { canBackup: true/false }
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// 无需认证
final health = await pb.health.check();

print(health.status);    // 200
print(health.message);   // "API is healthy."
print(health.data);      // { canBackup: true/false }
```

</template>
</CodeTabs>

### API 详情

::: info GET/HEAD
`/api/health`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应字段**

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| status | Number | HTTP 状态码（健康时为 200）。 |
| message | String | 健康状态消息。 |
| data.canBackup | Boolean | 服务器是否可以执行备份操作（如果正在进行备份则为 false）。 |

**响应**

::: code-group
```json [200]
{
  "status": 200,
  "message": "API is healthy.",
  "data": {
    "canBackup": true
  }
}
```
:::

::: tip
可以使用 `HEAD` 方法进行轻量级健康检查，无需响应体开销。
:::
