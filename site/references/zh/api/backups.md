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
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段。 |

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

---

## 上传备份

上传备份文件。

只有超级用户可以执行此操作。

### API 详情

::: tip POST
`/api/backups/upload`

需要 `Authorization: TOKEN`
:::

---

## 删除备份

根据键值删除单个备份文件。

只有超级用户可以执行此操作。

### API 详情

::: danger DELETE
`/api/backups/{key}`

需要 `Authorization: TOKEN`
:::

---

## 恢复备份

从备份文件恢复应用。

只有超级用户可以执行此操作。

### API 详情

::: tip POST
`/api/backups/{key}/restore`

需要 `Authorization: TOKEN`
:::

---

## 下载备份

下载单个备份文件。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/backups/{key}`

需要 `Authorization: TOKEN`
:::
