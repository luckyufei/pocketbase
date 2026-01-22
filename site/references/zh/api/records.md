# 记录 API

## CRUD 操作

### 列出/搜索记录

返回分页的记录列表，支持排序和过滤。

根据集合的 `listRule` 值，此操作的访问可能已被限制。

::: tip
你可以在 "管理后台 > Collections > API Preview" 中找到单个生成的记录 API 文档。
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 获取分页记录列表
const resultList = await pb.collection('posts').getList(1, 50, {
    filter: 'created >= "2022-01-01 00:00:00" && someField1 != someField2',
});

// 也可以通过 getFullList 一次获取所有记录
const records = await pb.collection('posts').getFullList({
    sort: '-created',
});

// 或只获取匹配指定过滤条件的第一条记录
const record = await pb.collection('posts').getFirstListItem('someField="test"', {
    expand: 'relField1,relField2.subRelField',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// 获取分页记录列表
final resultList = await pb.collection('posts').getList(
  page: 1,
  perPage: 50,
  filter: 'created >= "2022-01-01 00:00:00" && someField1 != someField2',
);

// 也可以通过 getFullList 一次获取所有记录
final records = await pb.collection('posts').getFullList(sort: '-created');

// 或只获取匹配指定过滤条件的第一条记录
final record = await pb.collection('posts').getFirstListItem(
  'someField="test"',
  expand: 'relField1,relField2.subRelField',
);
```

</template>
</CodeTabs>

#### API 详情

::: info GET
`/api/collections/{collectionIdOrName}/records`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 记录所属集合的 ID 或名称。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| page | Number | 分页列表的页码（即偏移量）（默认为 1）。 |
| perPage | Number | 每页返回的最大记录数（默认为 30）。 |
| sort | String | 指定 ORDER BY 字段。在属性前添加 `-` / `+`（默认）表示降序/升序。示例：`?sort=-created,id` |
| filter | String | 用于过滤/搜索返回记录列表的过滤表达式。示例：`?filter=(title~'abc' && created>'2022-01-01')` |
| expand | String | 自动展开记录关联。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段。 |
| skipTotal | Boolean | 如果设为 true，将跳过总数查询，响应中 totalItems 和 totalPages 将为 -1。 |

<FilterSyntax />

**响应**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 100,
  "totalItems": 2,
  "totalPages": 1,
  "items": [
    {
      "id": "ae40239d2bc4477",
      "collectionId": "a98f514eb05f454",
      "collectionName": "posts",
      "updated": "2022-06-25 11:03:50.052",
      "created": "2022-06-25 11:03:35.163",
      "title": "test1"
    },
    {
      "id": "d08dfc4f4d84419",
      "collectionId": "a98f514eb05f454",
      "collectionName": "posts",
      "updated": "2022-06-25 11:03:45.876",
      "created": "2022-06-25 11:03:45.876",
      "title": "test2"
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

```json [403]
{
  "status": 403,
  "message": "只有超级用户可以按 '@collection.*' 过滤",
  "data": {}
}
```
:::

---

### 查看记录

根据 ID 返回单个集合记录。

根据集合的 `viewRule` 值，此操作的访问可能已被限制。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const record = await pb.collection('posts').getOne('RECORD_ID', {
    expand: 'relField1,relField2.subRelField',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final record = await pb.collection('posts').getOne('RECORD_ID',
  expand: 'relField1,relField2.subRelField',
);
```

</template>
</CodeTabs>

#### API 详情

::: info GET
`/api/collections/{collectionIdOrName}/records/{recordId}`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 记录所属集合的 ID 或名称。 |
| recordId | String | 要查看的记录 ID。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| expand | String | 自动展开记录关联。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段。 |

**响应**

::: code-group
```json [200]
{
  "id": "ae40239d2bc4477",
  "collectionId": "a98f514eb05f454",
  "collectionName": "posts",
  "updated": "2022-06-25 11:03:50.052",
  "created": "2022-06-25 11:03:35.163",
  "title": "test1"
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

### 创建记录

创建新的集合记录。

根据集合的 `createRule` 值，此操作的访问可能已被限制。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const record = await pb.collection('demo').create({
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final record = await pb.collection('demo').create(body: {
    'title': 'Lorem ipsum',
});
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/records`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 记录所属集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| id | String | 可选。15 字符的字符串作为记录 ID。如果未设置，将自动生成。 |
| *Schema 字段* | | 集合 schema 中的任何字段。 |
| password | String | auth 记录必需。Auth 记录密码。 |
| passwordConfirm | String | auth 记录必需。Auth 记录密码确认。 |

::: tip
请求体参数可以作为 JSON 或 multipart/form-data 发送。文件上传仅支持 multipart/form-data。
:::

**响应**

::: code-group
```json [200]
{
  "collectionId": "a98f514eb05f454",
  "collectionName": "demo",
  "id": "ae40239d2bc4477",
  "updated": "2022-06-25 11:03:50.052",
  "created": "2022-06-25 11:03:35.163",
  "title": "Lorem ipsum"
}
```

```json [400]
{
  "status": 400,
  "message": "创建记录失败。",
  "data": {
    "title": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
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

### 更新记录

更新现有的集合记录。

根据集合的 `updateRule` 值，此操作的访问可能已被限制。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const record = await pb.collection('demo').update('YOUR_RECORD_ID', {
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final record = await pb.collection('demo').update('YOUR_RECORD_ID', body: {
    'title': 'Lorem ipsum',
});
```

</template>
</CodeTabs>

#### API 详情

::: warning PATCH
`/api/collections/{collectionIdOrName}/records/{recordId}`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 记录所属集合的 ID 或名称。 |
| recordId | String | 要更新的记录 ID。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| *Schema 字段* | | 集合 schema 中的任何字段。 |
| oldPassword | String | 可选。旧的 auth 记录密码。仅在更改记录密码时必需。 |
| password | String | 可选。新的 auth 记录密码。 |
| passwordConfirm | String | 可选。新的 auth 记录密码确认。 |

**响应**

::: code-group
```json [200]
{
  "collectionId": "a98f514eb05f454",
  "collectionName": "demo",
  "id": "ae40239d2bc4477",
  "updated": "2022-06-25 11:03:50.052",
  "created": "2022-06-25 11:03:35.163",
  "title": "Lorem ipsum"
}
```

```json [400]
{
  "status": 400,
  "message": "创建记录失败。",
  "data": {
    "title": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
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

### 删除记录

根据 ID 删除单个集合记录。

根据集合的 `deleteRule` 值，此操作的访问可能已被限制。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

</template>
</CodeTabs>

#### API 详情

::: danger DELETE
`/api/collections/{collectionIdOrName}/records/{recordId}`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 记录所属集合的 ID 或名称。 |
| recordId | String | 要删除的记录 ID。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "删除记录失败。请确保该记录不是必需关联引用的一部分。",
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

## Auth 记录操作

关于 auth 记录的特定操作（认证、验证、密码重置等），请参阅[身份认证](/zh/authentication)文档。

---

### TOF 认证

通过 TOF（Tencent Open Framework）网关认证单个 auth 集合记录。

此端点仅在服务器上注册了 `tofauth` 插件时可用。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 使用 TOF 认证（需要 TOF 网关头）
const authData = await pb.collection('users').authWithTof({
    taiIdentity: 'x-tai-identity-value',
    timestamp: 'timestamp-value',
    signature: 'signature-value',
    seq: 'x-rio-seq-value',
});

console.log(authData.token);
console.log(authData.record);
console.log(authData.meta.tofIdentity);
```

</template>
</CodeTabs>

#### API 详情

::: info GET
`/api/collections/{collectionIdOrName}/auth-with-tof`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求头**

| 头 | 类型 | 描述 |
|--------|------|-------------|
| x-tai-identity | String | TOF 身份令牌（JWE 加密）。 |
| timestamp | String | 请求时间戳。 |
| signature | String | 请求签名。 |
| x-rio-seq | String | 请求序列号。 |

**响应**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "8171022dc95a4ed",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "username@tencent.com",
    "name": "username",
    "verified": true,
    "created": "2024-01-01 00:00:00.000Z",
    "updated": "2024-01-01 00:00:00.000Z"
  },
  "meta": {
    "tofIdentity": {
      "loginName": "username",
      "staffId": 12345,
      "expiration": "2024-01-01T12:00:00Z",
      "ticket": "TOF_TICKET"
    }
  }
}
```

```json [400]
{
  "status": 400,
  "message": "HTTP 头中缺少 TOF 参数",
  "data": {}
}
```

```json [401]
{
  "status": 401,
  "message": "TOF 身份验证失败：...",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "集合 'xxx' 未找到",
  "data": {}
}
```
:::
