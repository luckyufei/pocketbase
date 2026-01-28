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
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

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

**Body parameters**

| Param | Type | Description |
|-------|------|-------------|
| name | String | Optional. The base name of the backup file to create.<br>Must be in the format `[a-z0-9_-].zip`.<br>If not set, it will be auto generated. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Try again later - another backup/restore process has already been started.",
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

## Upload backup

Uploads a backup file.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Upload a backup file
await pb.backups.upload({ file: new Blob([...]) });
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Upload a backup file
await pb.backups.upload(file);
```

</template>
</CodeTabs>

### API details

::: tip POST
`/api/backups/upload`

Requires `Authorization: TOKEN`
:::

**Body parameters**

Must be sent as `multipart/form-data`.

| Param | Type | Description |
|-------|------|-------------|
| file | File | **Required.** The backup file to upload. Must be a valid zip file (`application/zip`). |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Failed to upload the backup.",
  "data": {
    "file": {
      "code": "validation_invalid_mime_type",
      "message": "The file must be a zip archive."
    }
  }
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

## Delete backup

Deletes a single backup file by its key.

Only superusers can perform this action.

::: warning
If the backup is currently being created or restored, the delete operation will fail.
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

### API details

::: danger DELETE
`/api/backups/{key}`

Requires `Authorization: TOKEN`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| key | String | The backup file name/key to delete. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Try again later - another backup/restore process has already been started.",
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

```json [404]
{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```
:::

---

## Restore backup

Restores the application from a backup file.

This will restart the currently running PocketBase process.

Only superusers can perform this action.

::: warning
- Backup and restore operations cannot run concurrently.
- This operation will restart the server.
- All current data will be replaced with the backup data.
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

### API details

::: tip POST
`/api/backups/{key}/restore`

Requires `Authorization: TOKEN`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| key | String | The backup file name/key to restore from. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Try again later - another backup/restore process has already been started.",
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

```json [404]
{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```
:::

---

## Download backup

Downloads a single backup file.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Get a file token first
const token = await pb.files.getToken();

// Then get the download URL
const url = pb.backups.getDownloadUrl(token, 'pb_backup_20230519162514.zip');

// Use the URL to download the file
console.log(url);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Get a file token first
final token = await pb.files.getToken();

// Then get the download URL
final url = pb.backups.getDownloadUrl(token, 'pb_backup_20230519162514.zip');

print(url);
```

</template>
</CodeTabs>

### API details

::: info GET
`/api/backups/{key}`

Requires `Authorization: TOKEN`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| key | String | The backup file name/key to download. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| token | String | Superuser file token for authorization. |

**Responses**

::: code-group
```text [200]
[backup file stream]
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

```json [404]
{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```
:::
