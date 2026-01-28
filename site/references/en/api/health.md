# Health API

## Health check

Returns the health status of the server.

This endpoint is typically used by load balancers, monitoring tools, or container orchestrators (like Kubernetes) to check if the server is running and healthy.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// No authentication required
const health = await pb.health.check();

console.log(health.status);    // 200
console.log(health.message);   // "API is healthy."
console.log(health.data);      // { canBackup: true/false }
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// No authentication required
final health = await pb.health.check();

print(health.status);    // 200
print(health.message);   // "API is healthy."
print(health.data);      // { canBackup: true/false }
```

</template>
</CodeTabs>

### API details

::: info GET/HEAD
`/api/health`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Response fields**

| Field | Type | Description |
|-------|------|-------------|
| status | Number | HTTP status code (200 if healthy). |
| message | String | Health status message. |
| data.canBackup | Boolean | Whether the server can perform a backup operation (false if backup is in progress). |

**Responses**

::: code-group
```json [200]
{
  "status": 200,
  "message": "API is healthy.",
  "data": {
    "canBackup": true
  }
}
```
:::

::: tip
The `HEAD` method can be used for lightweight health checks without response body overhead.
:::
