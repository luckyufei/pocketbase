# Crons API

## List cron jobs

Returns list with all registered app level cron jobs.

Only superusers can perform this action.

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

### API details

::: info GET
`/api/crons`
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

## Run cron job

Runs the specified cron job.

Only superusers can perform this action.

### API details

::: tip POST
`/api/crons/{jobId}`

Requires `Authorization: TOKEN`
:::
