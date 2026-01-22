# 设置 API

## 列出设置

返回所有可用应用设置的列表。

密钥/密码字段会自动用 `******` 字符脱敏。

只有超级用户可以执行此操作。

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

### API 详情

::: info GET
`/api/settings`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段。 |

**响应**

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
  "message": "请求需要有效的记录授权令牌。",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "已授权的记录不允许执行此操作。",
  "data": {}
}
```
:::

---

## 更新设置

更新应用设置。

只有超级用户可以执行此操作。

### API 详情

::: warning PATCH
`/api/settings`

需要 `Authorization: TOKEN`
:::

---

## 测试 S3 连接

执行 S3 存储连接测试。

只有超级用户可以执行此操作。

### API 详情

::: tip POST
`/api/settings/test/s3`

需要 `Authorization: TOKEN`
:::

---

## 测试邮件

向指定地址发送测试邮件。

只有超级用户可以执行此操作。

### API 详情

::: tip POST
`/api/settings/test/email`

需要 `Authorization: TOKEN`
:::

---

## 生成 Apple 客户端密钥

生成新的 Apple OAuth2 客户端密钥。

只有超级用户可以执行此操作。

### API 详情

::: tip POST
`/api/settings/apple/generate-client-secret`

需要 `Authorization: TOKEN`
:::
