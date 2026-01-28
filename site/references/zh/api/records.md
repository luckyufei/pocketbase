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

...

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

...

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
| sort | String | 指定 *ORDER BY* 字段。在属性前添加 `-` / `+`（默认）表示降序/升序，例如：`// 按 created 降序和按 id 升序`<br>`?sort=-created,id`<br><br>**支持的记录排序字段：**<br>`@random`、`@rowid`、`id`，**以及任何其他集合字段**。 |
| filter | String | 用于过滤/搜索返回记录列表的过滤表达式（除了集合的 `listRule` 之外），例如：<br>`?filter=(title~'abc' && created>'2022-01-01')`<br><br>**支持的记录过滤字段：**<br>`id`，**+ 集合 schema 中的任何字段**。 |
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |
| skipTotal | Boolean | 如果设置，将跳过总数查询，响应字段 `totalItems` 和 `totalPages` 将为 `-1` 值。<br>当不需要总计数或使用基于游标的分页时，这可以大大加快搜索查询速度。<br>出于优化目的，`getFirstListItem()` 和 `getFullList()` SDK 方法默认设置此参数。 |

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

...

const record = await pb.collection('posts').getOne('RECORD_ID', {
    expand: 'relField1,relField2.subRelField',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

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

...

const record = await pb.collection('demo').create({
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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

...

const record = await pb.collection('demo').update('YOUR_RECORD_ID', {
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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

...

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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

### 批量创建/更新/更新插入/删除记录

在单个事务请求中批量创建/更新/更新插入/删除记录。

::: warning
批量 Web API 必须在管理后台的设置 > 应用程序中显式启用和配置。
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const batch = pb.createBatch();

batch.collection('example1').create({ ... });
batch.collection('example2').update('RECORD_ID', { ... });
batch.collection('example3').delete('RECORD_ID');
batch.collection('example4').upsert({ ... });

const result = await batch.send();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final batch = pb.createBatch();

batch.collection('example1').create(body: { ... });
batch.collection('example2').update('RECORD_ID', body: { ... });
batch.collection('example3').delete('RECORD_ID');
batch.collection('example4').upsert(body: { ... });

final result = await batch.send();
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/batch`
:::

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| requests | Array\<Request\> | 必需。要处理的请求列表。 |

每个请求元素包含：`url path`、`method`、`headers`、`body`。

支持的操作：
- 创建：`POST /api/collections/{collection}/records`
- 更新：`PATCH /api/collections/{collection}/records/{id}`
- 更新插入：`PUT /api/collections/{collection}/records`（body 必须包含 `id`）
- 删除：`DELETE /api/collections/{collection}/records/{id}`

::: tip
使用 `multipart/form-data` 时，常规字段应在 `@jsonPayload` 中序列化，文件键需遵循 `requests.N.fileField` 格式。
:::

**响应**

::: code-group
```json [200]
[
  {
    "status": 200,
    "body": { "id": "...", ... }
  },
  {
    "status": 200,
    "body": { "id": "...", ... }
  },
  ...
]
```

```json [400]
{
  "status": 400,
  "message": "批量事务失败。",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "不允许批量请求。",
  "data": {}
}
```
:::

---

## Auth 记录操作

### 列出认证方法

返回允许的集合认证方法的公开列表。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const result = await pb.collection('users').listAuthMethods();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final result = await pb.collection('users').listAuthMethods();
```

</template>
</CodeTabs>

#### API 详情

::: info GET
`/api/collections/{collectionIdOrName}/auth-methods`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "password": {
    "enabled": true,
    "identityFields": ["email"]
  },
  "oauth2": {
    "enabled": true,
    "providers": [
      {
        "name": "github",
        "displayName": "GitHub",
        "state": "nT7SLxzXKAVMeRQJtxSYj9kvnJAvGk",
        "authURL": "https://github.com/login/oauth/authorize?client_id=test&code_challenge=...",
        "codeVerifier": "PwBG5OKR2IyQ7siLrrcgWHFwLLLAeUrz7PS1nY4AneG",
        "codeChallenge": "fcf8WAhNI6uCLJYgJubLyWXHvfs8xghoLe3zksBvxjE",
        "codeChallengeMethod": "S256"
      }
    ]
  },
  "mfa": {
    "enabled": false,
    "duration": 0
  },
  "otp": {
    "enabled": false,
    "duration": 0
  }
}
```
:::

---

### 密码认证

通过身份标识（用户名/邮箱）和密码认证单个 auth 集合记录。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authWithPassword(
    'YOUR_USERNAME_OR_EMAIL',
    'YOUR_PASSWORD',
);

// 也可以从 authStore 访问认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "登出"
pb.authStore.clear();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final authData = await pb.collection('users').authWithPassword(
    'YOUR_USERNAME_OR_EMAIL',
    'YOUR_PASSWORD',
);

print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

pb.authStore.clear();
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/auth-with-password`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| identity | String | 必需。auth 记录的用户名或邮箱地址。 |
| password | String | 必需。auth 记录的密码。 |
| identityField | String | 可选。指定用于认证的身份字段名称（适用于电话号码或任何其他自定义唯一字段）。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  }
}
```

```json [400]
{
  "status": 400,
  "message": "认证失败。",
  "data": {
    "identity": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### OAuth2 认证

通过 OAuth2 提供商进行认证，返回新的认证令牌和记录数据。

此操作通常应在提供商登录页面重定向后立即调用。

您也可以查看 [OAuth2 Web 集成示例](/zh/authentication.html#oauth2-认证)。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authWithOAuth2Code(
    'google',
    'CODE',
    'VERIFIER',
    'REDIRECT_URL',
    // OAuth2 注册时用于账户的可选数据
    {
        'name': 'test',
    },
);

// 也可以从 authStore 访问认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "登出"
pb.authStore.clear();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final authData = await pb.collection('users').authWithOAuth2Code(
    'google',
    'CODE',
    'VERIFIER',
    'REDIRECT_URL',
    createData: {
        'name': 'test',
    },
);

print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

pb.authStore.clear();
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/auth-with-oauth2`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| provider | String | 必需。OAuth2 客户端提供商名称（例如 "google"）。 |
| code | String | 必需。初始 OAuth2 请求返回的授权码。 |
| codeVerifier | String | 必需。作为 code_challenge 的一部分发送的代码验证器。 |
| redirectUrl | String | 必需。初始 OAuth2 请求中发送的重定向 URL。 |
| createData | Object | 可选。OAuth2 注册时创建新 auth 记录使用的可选数据（仅支持 JSON）。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  },
  "meta": {
    "id": "...",
    "name": "...",
    "username": "...",
    "email": "...",
    "avatarURL": "...",
    "accessToken": "...",
    "refreshToken": "...",
    "rawUser": {...},
    "isNew": false
  }
}
```

```json [400]
{
  "status": 400,
  "message": "提交表单时发生错误。",
  "data": {
    "provider": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### OTP 认证

通过一次性密码 (OTP) 认证单个 auth 记录。

请注意，当请求 OTP 时，即使提供的邮箱对应的用户不存在，我们也会返回 `otpId`，这是一种基本的枚举保护措施。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// 发送 OTP 邮件
const req = await pb.collection('users').requestOTP('test@example.com');

// ... 显示界面/弹窗以输入邮件中的密码 ...

// 使用请求的 OTP id 和邮件中的密码进行认证
const authData = await pb.collection('users').authWithOTP(req.otpId, "YOUR_OTP");

// 也可以从 authStore 访问认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "登出"
pb.authStore.clear();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

// 发送 OTP 邮件
final req = await pb.collection('users').requestOTP('test@example.com');

// ...

final authData = await pb.collection('users').authWithOTP(req.otpId, "YOUR_OTP");

// ...

pb.authStore.clear();
```

</template>
</CodeTabs>

#### API 详情

**1. 请求 OTP**

::: tip POST
`/api/collections/{collectionIdOrName}/request-otp`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| email | String | 必需。发送 OTP 的 auth 记录邮箱地址。 |

**响应**

::: code-group
```json [200]
{
  "otpId": "..."
}
```
:::

**2. OTP 认证**

::: tip POST
`/api/collections/{collectionIdOrName}/auth-with-otp`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| otpId | String | 必需。OTP 请求的 id。 |
| password | String | 必需。一次性密码。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  }
}
```
:::

---

### 刷新认证

为已认证的 auth 记录返回新的认证响应（令牌和用户数据）。

此方法通常在页面/界面重新加载/刷新时调用，以确保 `pb.authStore` 中的数据仍然有效和最新。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authRefresh();

// 也可以从 authStore 访问刷新后的认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final authData = await pb.collection('users').authRefresh();

print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/auth-refresh`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  }
}
```

```json [401]
{
  "status": 401,
  "message": "请求需要设置有效的记录授权令牌。",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "已授权的记录模型不允许执行此操作。",
  "data": {}
}
```
:::

---

### 请求验证

发送 auth 记录邮箱验证请求。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestVerification('test@example.com');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestVerification('test@example.com');
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/request-verification`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| email | String | 必需。发送验证请求的 auth 记录邮箱地址。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "验证提交数据时发生错误。",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### 确认验证

确认 auth 记录邮箱验证请求。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmVerification('VERIFICATION_TOKEN');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmVerification('VERIFICATION_TOKEN');
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/confirm-verification`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| token | String | 必需。验证令牌。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "验证提交数据时发生错误。",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### 请求密码重置

发送 auth 记录密码重置邮件请求。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestPasswordReset('test@example.com');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestPasswordReset('test@example.com');
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/request-password-reset`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| email | String | 必需。发送密码重置请求的 auth 记录邮箱地址。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "验证提交数据时发生错误。",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### 确认密码重置

确认 auth 记录密码重置请求。

成功重置密码后，该记录之前签发的所有令牌将自动失效。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmPasswordReset(
    'RESET_TOKEN',
    'NEW_PASSWORD',
    'NEW_PASSWORD_CONFIRM',
);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmPasswordReset(
    'RESET_TOKEN',
    'NEW_PASSWORD',
    'NEW_PASSWORD_CONFIRM',
);
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/confirm-password-reset`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| token | String | 必需。密码重置令牌。 |
| password | String | 必需。新的 auth 记录密码。 |
| passwordConfirm | String | 必需。新的 auth 记录密码确认。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "验证提交数据时发生错误。",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### 请求邮箱更改

发送 auth 记录邮箱更改请求。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

await pb.collection('users').requestEmailChange('new@example.com');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

await pb.collection('users').requestEmailChange('new@example.com');
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/request-email-change`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求头参数**

| 头 | 类型 | 描述 |
|--------|------|-------------|
| Authorization | String | 必需。记录认证令牌。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| newEmail | String | 必需。发送更改邮箱请求的新邮箱地址。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "验证提交数据时发生错误。",
  "data": {
    "newEmail": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```

```json [401]
{
  "status": 401,
  "message": "请求需要设置有效的记录授权令牌。",
  "data": {}
}
```
:::

---

### 确认邮箱更改

确认 auth 记录的新邮箱地址。

成功更改邮箱后，该记录之前签发的所有令牌将自动失效。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmEmailChange('EMAIL_CHANGE_TOKEN', 'YOUR_PASSWORD');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmEmailChange('EMAIL_CHANGE_TOKEN', 'YOUR_PASSWORD');
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/confirm-email-change`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| token | String | 必需。邮箱更改令牌。 |
| password | String | 必需。确认邮箱更改的 auth 记录密码。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "验证提交数据时发生错误。",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "缺少必填值。"
    }
  }
}
```
:::

---

### 模拟

允许你通过生成**不可刷新的**认证令牌来以不同用户身份进行认证。

此操作需要超级用户权限。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// 以超级用户身份认证
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// 模拟（自定义令牌持续时间是可选的，以秒为单位）
const impersonateClient = pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// 记录模拟令牌和用户数据
console.log(impersonateClient.authStore.token);
console.log(impersonateClient.authStore.record);

// 以被模拟用户发送请求
impersonateClient.collection("example").getFullList();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

// 以超级用户身份认证
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// 模拟
final impersonateClient = pb.collection("users").impersonate("USER_RECORD_ID", 3600)

print(impersonateClient.authStore.token);
print(impersonateClient.authStore.record);

impersonateClient.collection("example").getFullList();
```

</template>
</CodeTabs>

#### API 详情

::: tip POST
`/api/collections/{collectionIdOrName}/impersonate/{id}`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | auth 集合的 ID 或名称。 |
| id | String | 要模拟的 auth 记录 ID。 |

**请求头参数**

| 头 | 类型 | 描述 |
|--------|------|-------------|
| Authorization | String | 必需。超级用户认证令牌。 |

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| duration | Number | 可选。令牌持续时间的自定义 `exp` JWT 声明（以秒为单位）。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| expand | String | 自动展开记录关联。例如：<br>`?expand=relField1,relField2.subRelField`<br>支持最多 6 层深度的嵌套关联展开。<br>展开的关联将附加到记录的 `expand` 属性下（例如 `"expand": {"relField1": {...}, ...}`）。<br>只有请求用户有权限**查看**的关联才会被展开。 |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {...}
}
```

```json [401]
{
  "status": 401,
  "message": "请求需要设置有效的记录授权令牌。",
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
