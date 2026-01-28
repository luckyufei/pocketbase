# 备份 API

## 列出备份

返回所有可用备份文件的列表。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const backups = await pb.backups.getFullList();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final backups = await pb.backups.getFullList();
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/backups`
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
    "key": "pb_backup_20230519162514.zip",
    "modified": "2023-05-19 16:25:57.542Z",
    "size": 251316185
  },
  {
    "key": "pb_backup_20230518162514.zip",
    "modified": "2023-05-18 16:25:57.542Z",
    "size": 251314010
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

## 创建备份

创建新的备份。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.create('my_backup.zip');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.create('my_backup.zip');
```

</template>
</CodeTabs>

### API 详情

::: tip POST
`/api/backups`

需要 `Authorization: TOKEN`
:::

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| name | String | 可选。要创建的备份文件的基本名称。<br>必须符合 `[a-z0-9_-].zip` 格式。<br>如果未设置，将自动生成。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "请稍后重试 - 另一个备份/恢复进程已经启动。",
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

## 上传备份

上传备份文件。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 上传备份文件
await pb.backups.upload({ file: new Blob([...]) });
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 上传备份文件
await pb.backups.upload(file);
```

</template>
</CodeTabs>

### API 详情

::: tip POST
`/api/backups/upload`

需要 `Authorization: TOKEN`
:::

**请求体参数**

必须以 `multipart/form-data` 格式发送。

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| file | File | **必填。** 要上传的备份文件。必须是有效的 zip 文件（`application/zip`）。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "上传备份失败。",
  "data": {
    "file": {
      "code": "validation_invalid_mime_type",
      "message": "文件必须是 zip 压缩包。"
    }
  }
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

## 删除备份

根据键值删除单个备份文件。

只有超级用户可以执行此操作。

::: warning
如果备份当前正在创建或恢复中，删除操作将失败。
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.delete('pb_backup_20230519162514.zip');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.delete('pb_backup_20230519162514.zip');
```

</template>
</CodeTabs>

### API 详情

::: danger DELETE
`/api/backups/{key}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| key | String | 要删除的备份文件名/键值。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "请稍后重试 - 另一个备份/恢复进程已在运行。",
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

```json [404]
{
  "status": 404,
  "message": "请求的资源未找到。",
  "data": {}
}
```
:::

---

## 恢复备份

从备份文件恢复应用。

这将重启当前运行的 PocketBase 进程。

只有超级用户可以执行此操作。

::: warning
- 备份和恢复操作不能同时运行。
- 此操作将重启服务器。
- 所有当前数据将被备份数据替换。
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.restore('pb_backup_20230519162514.zip');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.restore('pb_backup_20230519162514.zip');
```

</template>
</CodeTabs>

### API 详情

::: tip POST
`/api/backups/{key}/restore`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| key | String | 要恢复的备份文件名/键值。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "请稍后重试 - 另一个备份/恢复进程已在运行。",
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

```json [404]
{
  "status": 404,
  "message": "请求的资源未找到。",
  "data": {}
}
```
:::

---

## 下载备份

下载单个备份文件。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 首先获取文件令牌
const token = await pb.files.getToken();

// 然后获取下载 URL
const url = pb.backups.getDownloadUrl(token, 'pb_backup_20230519162514.zip');

// 使用该 URL 下载文件
console.log(url);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 首先获取文件令牌
final token = await pb.files.getToken();

// 然后获取下载 URL
final url = pb.backups.getDownloadUrl(token, 'pb_backup_20230519162514.zip');

print(url);
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/backups/{key}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| key | String | 要下载的备份文件名/键值。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| token | String | 用于授权的超级用户文件令牌。 |

**响应**

::: code-group
```text [200]
[备份文件流]
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

```json [404]
{
  "status": 404,
  "message": "请求的资源未找到。",
  "data": {}
}
```
:::
