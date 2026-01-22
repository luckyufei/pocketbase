# 集合 API

## 列出集合

返回分页的集合列表。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 获取分页集合列表
const pageResult = await pb.collections.getList(1, 100, {
    filter: 'created >= "2022-01-01 00:00:00"',
});

// 也可以通过 getFullList 一次获取所有集合
const collections = await pb.collections.getFullList({ sort: '-created' });

// 或只获取匹配指定过滤条件的第一个集合
const collection = await pb.collections.getFirstListItem('type="auth"');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 获取分页集合列表
final pageResult = await pb.collections.getList(
    page: 1,
    perPage: 100,
    filter: 'created >= "2022-01-01 00:00:00"',
);

// 也可以通过 getFullList 一次获取所有集合
final collections = await pb.collections.getFullList(sort: '-created');

// 或只获取匹配指定过滤条件的第一个集合
final collection = await pb.collections.getFirstListItem('type="auth"');
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/collections`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| page | Number | 分页列表的页码（即偏移量）（默认为 1）。 |
| perPage | Number | 每页返回的最大集合数（默认为 30）。 |
| sort | String | 指定 ORDER BY 字段。在属性前添加 `-` / `+`（默认）表示降序/升序。支持的字段：`@random`、`id`、`created`、`updated`、`name`、`type`、`system` |
| filter | String | 用于过滤/搜索返回集合列表的过滤表达式。支持的字段：`id`、`created`、`updated`、`name`、`type`、`system` |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段。 |
| skipTotal | Boolean | 如果设为 true，将跳过总数查询。 |

<FilterSyntax />

**响应**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 2,
  "totalItems": 10,
  "totalPages": 5,
  "items": [
    {
      "id": "_pbc_344172009",
      "listRule": null,
      "viewRule": null,
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "name": "users",
      "type": "auth",
      "fields": [...],
      "indexes": [...],
      "system": false
    },
    {
      "id": "_pbc_2287844090",
      "name": "posts",
      "type": "base",
      "fields": [...],
      "indexes": [],
      "system": false
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
  "message": "只有超级用户可以执行此操作。",
  "data": {}
}
```
:::

---

## 查看集合

根据 ID 或名称返回单个集合。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/collections/{collectionIdOrName}`

需要 `Authorization: TOKEN`
:::

---

## 创建集合

创建新的集合。

只有超级用户可以执行此操作。

### API 详情

::: tip POST
`/api/collections`

需要 `Authorization: TOKEN`
:::

---

## 更新集合

更新现有集合。

只有超级用户可以执行此操作。

### API 详情

::: warning PATCH
`/api/collections/{collectionIdOrName}`

需要 `Authorization: TOKEN`
:::

---

## 删除集合

根据 ID 或名称删除单个集合。

只有超级用户可以执行此操作。

### API 详情

::: danger DELETE
`/api/collections/{collectionIdOrName}`

需要 `Authorization: TOKEN`
:::

---

## 清空集合

删除与指定集合关联的所有记录。

只有超级用户可以执行此操作。

### API 详情

::: danger DELETE
`/api/collections/{collectionIdOrName}/truncate`

需要 `Authorization: TOKEN`
:::

---

## 导入集合

批量导入提供的集合配置。

只有超级用户可以执行此操作。

### API 详情

::: tip PUT
`/api/collections/import`

需要 `Authorization: TOKEN`
:::

---

## 获取脚手架

返回所有可用集合类型及其默认字段脚手架的列表。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/collections/meta/scaffolds`

需要 `Authorization: TOKEN`
:::
