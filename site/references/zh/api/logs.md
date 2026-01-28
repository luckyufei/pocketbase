# 日志 API

## 列出日志

返回分页的日志列表。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const pageResult = await pb.logs.getList(1, 20, {
    filter: 'data.status >= 400'
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final pageResult = await pb.logs.getList(
    page: 1,
    perPage: 20,
    filter: 'data.status >= 400',
);
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/logs`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| page | Number | 分页列表的页码（即偏移量）（默认为 1）。 |
| perPage | Number | 每页返回的最大日志数（默认为 30）。 |
| sort | String | 指定 ORDER BY 字段。在属性前添加 `-` / `+`（默认）表示降序/升序。支持的字段：`@random`、`rowid`、`id`、`created`、`updated`、`level`、`message` 以及任何 `data.*` 属性。 |
| filter | String | 用于过滤/搜索返回日志列表的过滤表达式。支持的字段：`id`、`created`、`updated`、`level`、`message` 以及任何 `data.*` 属性。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

<FilterSyntax />

**响应**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 20,
  "totalItems": 2,
  "items": [
    {
      "id": "ai5z3aoed6809au",
      "created": "2024-10-27 09:28:19.524Z",
      "data": {
        "auth": "_superusers",
        "execTime": 2.392327,
        "method": "GET",
        "referer": "http://localhost:8090/_/",
        "remoteIP": "127.0.0.1",
        "status": 200,
        "type": "request",
        "url": "/api/collections/...",
        "userAgent": "Mozilla/5.0 ...",
        "userIP": "127.0.0.1"
      },
      "message": "GET /api/collections/...",
      "level": 0
    }
  ]
}
```

```json [400]
{
  "status": 400,
  "message": "处理请求时出错。无效的过滤器。",
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
  "message": "已授权的记录不允许执行此操作。",
  "data": {}
}
```
:::

---

## 查看日志

根据 ID 返回单个日志。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const log = await pb.logs.getOne('LOG_ID');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final log = await pb.logs.getOne('LOG_ID');
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/logs/{logId}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| logId | String | 要查看的日志 ID。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "id": "ai5z3aoed6809au",
  "created": "2024-10-27 09:28:19.524Z",
  "data": {
    "auth": "_superusers",
    "execTime": 2.392327,
    "method": "GET",
    "referer": "http://localhost:8090/_/",
    "remoteIP": "127.0.0.1",
    "status": 200,
    "type": "request",
    "url": "/api/collections/...",
    "userAgent": "Mozilla/5.0 ...",
    "userIP": "127.0.0.1"
  },
  "message": "GET /api/collections/...",
  "level": 0
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

```json [404]
{
  "status": 404,
  "message": "请求的资源未找到。",
  "data": {}
}
```
:::

---

## 日志统计

返回按小时聚合的日志统计信息。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 获取状态码 >= 400（错误）的日志统计
const stats = await pb.logs.getStats({
    filter: 'data.status >= 400'
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 获取状态码 >= 400（错误）的日志统计
final stats = await pb.logs.getStats(
    filter: 'data.status >= 400',
);
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/logs/stats`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| filter | String | 用于过滤/搜索日志的过滤表达式，例如：<br><br>`?filter=(data.url~'test.com' && level>0)`<br><br>**支持的日志过滤字段：**<br>`rowid`、`id`、`created`、`updated`、`level`、`message` 以及任何 `data.*` 属性。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

<FilterSyntax />

**响应**

::: code-group
```json [200]
[
  {
    "total": 4,
    "date": "2024-10-27 09:00:00.000Z"
  },
  {
    "total": 12,
    "date": "2024-10-27 10:00:00.000Z"
  },
  {
    "total": 8,
    "date": "2024-10-27 11:00:00.000Z"
  }
]
```

```json [400]
{
  "status": 400,
  "message": "处理请求时出错。无效的过滤器。",
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
