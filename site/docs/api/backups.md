# Backups API

## List backups

Returns list with all available backup files.

Only superusers can perform this action.

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

### API details

::: info GET
`/api/backups`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response. |

**Responses**

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
  "message": "Failed to load backups filesystem.",
  "data": {}
}
```

```json [401]
{
  "status": 401,
  "message": "The request requires valid record authorization token.",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "Only superusers can perform this action.",
  "data": {}
}
```
:::

---

## Create backup

Creates a new backup.

Only superusers can perform this action.

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

### API details

::: tip POST
`/api/backups`

Requires `Authorization: TOKEN`
:::

---

## Upload backup

Uploads a backup file.

Only superusers can perform this action.

### API details

::: tip POST
`/api/backups/upload`

Requires `Authorization: TOKEN`
:::

---

## Delete backup

Deletes a single backup file by its key.

Only superusers can perform this action.

### API details

::: danger DELETE
`/api/backups/{key}`

Requires `Authorization: TOKEN`
:::

---

## Restore backup

Restores the application from a backup file.

Only superusers can perform this action.

### API details

::: tip POST
`/api/backups/{key}/restore`

Requires `Authorization: TOKEN`
:::

---

## Download backup

Downloads a single backup file.

Only superusers can perform this action.

### API details

::: info GET
`/api/backups/{key}`

Requires `Authorization: TOKEN`
:::
