# Settings API

## List settings

Returns a list with all available application settings.

Secret/password fields are automatically redacted with `******` characters.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const settings = await pb.settings.getAll();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final settings = await pb.settings.getAll();
```

</template>
</CodeTabs>

### API details

::: info GET
`/api/settings`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response. |

**Responses**

::: code-group
```json [200]
{
  "smtp": {
    "enabled": false,
    "port": 587,
    "host": "smtp.example.com",
    "username": "",
    "authMethod": "",
    "tls": true,
    "localName": ""
  },
  "backups": {
    "cron": "0 0 * * *",
    "cronMaxKeep": 3,
    "s3": {
      "enabled": false,
      "bucket": "",
      "region": "",
      "endpoint": "",
      "accessKey": "",
      "forcePathStyle": false
    }
  },
  "s3": {
    "enabled": false,
    "bucket": "",
    "region": "",
    "endpoint": "",
    "accessKey": "",
    "forcePathStyle": false
  },
  "meta": {
    "appName": "Acme",
    "appURL": "https://example.com",
    "senderName": "Support",
    "senderAddress": "support@example.com",
    "hideControls": false
  },
  "rateLimits": {
    "rules": [...],
    "enabled": false
  },
  "trustedProxy": {
    "headers": [],
    "useLeftmostIP": false
  },
  "batch": {
    "enabled": true,
    "maxRequests": 50,
    "timeout": 3,
    "maxBodySize": 0
  },
  "logs": {
    "maxDays": 7,
    "minLevel": 0,
    "logIP": true,
    "logAuthId": false
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
  "message": "The authorized record is not allowed to perform this action.",
  "data": {}
}
```
:::

---

## Update settings

Updates the application settings.

Only superusers can perform this action.

### API details

::: warning PATCH
`/api/settings`

Requires `Authorization: TOKEN`
:::

---

## Test S3 connection

Performs a S3 storage connection test.

Only superusers can perform this action.

### API details

::: tip POST
`/api/settings/test/s3`

Requires `Authorization: TOKEN`
:::

---

## Test email

Sends a test email to the specified address.

Only superusers can perform this action.

### API details

::: tip POST
`/api/settings/test/email`

Requires `Authorization: TOKEN`
:::

---

## Generate Apple client secret

Generates a new Apple OAuth2 client secret.

Only superusers can perform this action.

### API details

::: tip POST
`/api/settings/apple/generate-client-secret`

Requires `Authorization: TOKEN`
:::
