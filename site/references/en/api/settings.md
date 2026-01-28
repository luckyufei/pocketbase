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
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

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

Bulk updates application settings and returns the updated settings list.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

const settings = await pb.settings.update({
    meta: {
        appName: 'YOUR_APP',
        appUrl: 'http://127.0.0.1:8090',
    },
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

final settings = await pb.settings.update(body: {
    'meta': {
        'appName': 'YOUR_APP',
        'appUrl': 'http://127.0.0.1:8090',
    },
});
```

</template>
</CodeTabs>

### API details

::: warning PATCH
`/api/settings`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.: `?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>- `:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Body parameters**

All parameters are optional. Only the provided ones will be updated.

**meta** - Application meta data (name, url, support email, etc.).

| Param | Type | Description |
|-------|------|-------------|
| <prop required>appName</prop> | String | The app name. |
| <prop required>appUrl</prop> | String | The app public absolute url. |
| <prop>hideControls</prop> | Boolean | Hides the collection create and update controls from the Dashboard.<br>Useful to prevent making accidental schema changes when in production environment. |
| <prop required>senderName</prop> | String | Transactional mails sender name. |
| <prop required>senderAddress</prop> | String | Transactional mails sender address. |

**smtp** - SMTP mail server settings.

| Param | Type | Description |
|-------|------|-------------|
| <prop>enabled</prop> | Boolean | Enable or disable the SMTP server. |
| <prop>host</prop> | String | SMTP server host. |
| <prop>port</prop> | Number | SMTP server port. |
| <prop>username</prop> | String | SMTP server username. |
| <prop>password</prop> | String | SMTP server password. |
| <prop>authMethod</prop> | String | SMTP auth method (PLAIN, LOGIN, CRAM-MD5). |
| <prop>tls</prop> | Boolean | Enable or disable TLS encryption. |
| <prop>localName</prop> | String | Optional domain name for the HELO/EHLO command. |

**s3** - S3 compatible storage settings (used for the collection files).

| Param | Type | Description |
|-------|------|-------------|
| <prop>enabled</prop> | Boolean | Enable or disable the S3 storage. |
| <prop>bucket</prop> | String | S3 storage bucket. |
| <prop>region</prop> | String | S3 storage region. |
| <prop>endpoint</prop> | String | S3 storage endpoint. |
| <prop>accessKey</prop> | String | S3 storage access key. |
| <prop>secret</prop> | String | S3 storage secret. |
| <prop>forcePathStyle</prop> | Boolean | Force S3 path style addressing. |

**backups** - Backups settings.

| Param | Type | Description |
|-------|------|-------------|
| <prop>cron</prop> | String | Cron expression for automatic backups. |
| <prop>cronMaxKeep</prop> | Number | Max number of auto created backup files to keep. |
| <prop>s3</prop> | Object | S3 compatible storage for the backups (has the same fields as the `s3` settings group). |

**logs** - App logger settings.

| Param | Type | Description |
|-------|------|-------------|
| <prop>maxDays</prop> | Number | Max retention period. Set to 0 for no logs. |
| <prop>minLevel</prop> | Number | Specifies the minimum log persistent level.<br>The default log levels are:<ul><li>-4: DEBUG</li><li>0: INFO</li><li>4: WARN</li><li>8: ERROR</li></ul> |
| <prop>logIP</prop> | Boolean | If enabled includes the client IP in the activity request logs. |
| <prop>logAuthId</prop> | Boolean | If enabled includes the authenticated record id in the activity request logs. |

**batch**
**batch** - Batch API settings.

| Param | Type | Description |
|-------|------|-------------|
| <prop>enabled</prop> | Boolean | Enable or disable the Batch Web API. |
| <prop>maxRequests</prop> | Number | Max allowed batch requests. |
| <prop>timeout</prop> | Number | Max batch request timeout (in seconds). |
| <prop>maxBodySize</prop> | Number | Max batch request body size (in bytes). |

**rateLimits** - Rate limiter settings.

| Param | Type | Description |
|-------|------|-------------|
| <prop>enabled</prop> | Boolean | Enable or disable the rate limiter. |
| <prop>rules</prop> | Array | Rate limit rules with `label`, `maxRequests`, `duration`. |

**trustedProxy** - Trusted proxy headers settings.

| Param | Type | Description |
|-------|------|-------------|
| <prop>headers</prop> | Array | List of explicit trusted header(s) to check for. |
| <prop>useLeftmostIP</prop> | Boolean | Specifies to use the left-mostish IP from the trusted headers. |

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
    "rules": [],
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

```json [400]
{
  "status": 400,
  "message": "Failed to update settings.",
  "data": {
    "meta.appUrl": {
      "code": "validation_required",
      "message": "Missing required value."
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

## Test S3 connection

Performs a S3 storage connection test.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Test the main storage S3 connection
await pb.settings.testS3('storage');

// Test the backups S3 connection
await pb.settings.testS3('backups');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// Test the main storage S3 connection
await pb.settings.testS3('storage');

// Test the backups S3 connection
await pb.settings.testS3('backups');
```

</template>
</CodeTabs>

### API details

::: tip POST
`/api/settings/test/s3`

Requires `Authorization: TOKEN`
:::

**Body parameters**

| Param | Type | Description |
|-------|------|-------------|
| filesystem | String | **Required.** Filesystem to test: `storage` or `backups`. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Failed to establish S3 connection.",
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

## Test email

Sends a test email to the specified address.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.testEmail('recipient@example.com', 'verification');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.testEmail('recipient@example.com', 'verification');
```

</template>
</CodeTabs>

### API details

::: tip POST
`/api/settings/test/email`

Requires `Authorization: TOKEN`
:::

**Body parameters**

| Param | Type | Description |
|-------|------|-------------|
| email | String | **Required.** Email address to receive the test email. |
| template | String | **Required.** Template type: `verification`, `password-reset`, or `email-change`. |
| collection | String | Auth collection name or ID (default: `_superusers`). |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Failed to send the test email.",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "Missing required value."
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

## Generate Apple client secret

Generates a new Apple OAuth2 client secret for "Sign in with Apple".

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const result = await pb.settings.generateAppleClientSecret(
    'com.example.app',     // clientId - Service ID
    'XXXXXXXXXX',          // teamId - 10 character Team ID
    'XXXXXXXXXX',          // keyId - 10 character Key ID
    '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----', // privateKey
    15552000               // duration in seconds (max ~6 months)
);

console.log(result.secret);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final result = await pb.settings.generateAppleClientSecret(
    'com.example.app',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    15552000,
);

print(result.secret);
```

</template>
</CodeTabs>

### API details

::: tip POST
`/api/settings/apple/generate-client-secret`

Requires `Authorization: TOKEN`
:::

**Body parameters**

| Param | Type | Description |
|-------|------|-------------|
| clientId | String | **Required.** Apple Service ID (app identifier). |
| teamId | String | **Required.** 10-character Apple Team ID. |
| keyId | String | **Required.** 10-character Key ID. |
| privateKey | String | **Required.** Private key content (PEM format). |
| duration | Number | **Required.** JWT validity duration in seconds (max 15777000 ≈ 6 months). |

**Responses**

::: code-group
```json [200]
{
  "secret": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

```json [400]
{
  "status": 400,
  "message": "Failed to generate the client secret.",
  "data": {
    "clientId": {
      "code": "validation_required",
      "message": "Missing required value."
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
