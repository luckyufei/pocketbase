# Logs API

## List logs

Returns a paginated logs list.

Only superusers can perform this action.

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

### API details

::: info GET
`/api/logs`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| page | Number | The page (aka. offset) of the paginated list (default to 1). |
| perPage | Number | The max returned logs per page (default to 30). |
| sort | String | Specify the ORDER BY fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order. Supported fields: `@random`, `rowid`, `id`, `created`, `updated`, `level`, `message` and any `data.*` attribute. |
| filter | String | Filter expression to filter/search the returned logs list. Supported fields: `id`, `created`, `updated`, `level`, `message` and any `data.*` attribute. |
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

<FilterSyntax />

**Responses**

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
  "message": "Something went wrong while processing your request. Invalid filter.",
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
  "message": "The authorized record is not allowed to perform this action.",
  "data": {}
}
```
:::

---

## View log

Returns a single log by its ID.

Only superusers can perform this action.

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

### API details

::: info GET
`/api/logs/{logId}`

Requires `Authorization: TOKEN`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| logId | String | ID of the log to view. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

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

## Logs statistics

Returns hourly aggregated logs statistics.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Get stats for logs with status >= 400 (errors)
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

// Get stats for logs with status >= 400 (errors)
final stats = await pb.logs.getStats(
    filter: 'data.status >= 400',
);
```

</template>
</CodeTabs>

### API details

::: info GET
`/api/logs/stats`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| filter | String | Filter expression to filter/search the logs, e.g.:<br><br>`?filter=(data.url~'test.com' && level>0)`<br><br>**Supported log filter fields:**<br>`rowid`, `id`, `created`, `updated`, `level`, `message` and any `data.*` attribute. |
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

<FilterSyntax />

**Responses**

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
  "message": "Something went wrong while processing your request. Invalid filter.",
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
