# 定时任务 API

## 列出定时任务

返回所有已注册的应用级定时任务列表。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const jobs = await pb.crons.getFullList();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final jobs = await pb.crons.getFullList();
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/crons`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
[
  {
    "id": "__pbDBOptimize__",
    "expression": "0 0 * * *"
  },
  {
    "id": "__pbMFACleanup__",
    "expression": "0 * * * *"
  },
  {
    "id": "__pbOTPCleanup__",
    "expression": "0 * * * *"
  },
  {
    "id": "__pbLogsCleanup__",
    "expression": "0 */6 * * *"
  }
]
```

```json [400]
{
  "status": 400,
  "message": "加载备份文件系统失败。",
  "data": {}
}
```

```json [401]
{
  "status": 401,
  "message": "请求需要有效的记录授权令牌。",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "只有超级用户可以执行此操作。",
  "data": {}
}
```
:::

---

## 运行定时任务

通过 ID 触发单个定时任务。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.crons.run('__pbLogsCleanup__');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.crons.run('__pbLogsCleanup__');
```

</template>
</CodeTabs>

### API 详情

::: tip POST
`/api/crons/{jobId}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| jobId | String | 要运行的定时任务的标识符。 |

**响应**

::: code-group
```json [204]
null
```

```json [401]
{
  "status": 401,
  "message": "请求需要有效的记录授权令牌。",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "只有超级用户可以执行此操作。",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "未找到请求的定时任务。",
  "data": {}
}
```
:::
