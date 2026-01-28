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
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

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

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.update({
    meta: {
        appName: 'My App',
        appUrl: 'https://example.com',
        senderName: 'Support',
        senderAddress: 'support@example.com',
    },
    smtp: {
        enabled: true,
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        password: 'secret',
        tls: true,
    },
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.update(body: {
    'meta': {
        'appName': 'My App',
        'appUrl': 'https://example.com',
        'senderName': 'Support',
        'senderAddress': 'support@example.com',
    },
});
```

</template>
</CodeTabs>

### API 详情

::: warning PATCH
`/api/settings`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（默认返回所有字段）。例如：`?fields=*,expand.relField.name`<br><br>`*` 指向特定深度层级的所有键。<br><br>此外，还支持以下字段修饰符：<br>- `:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**请求体参数**

所有参数都是可选的。只有提供的参数会被更新。

**meta** - 应用元数据

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| appName | String | 应用名称（显示在邮件等位置）。 |
| appUrl | String | 应用的公开绝对 URL。 |
| senderName | String | 事务性邮件的发件人名称。 |
| senderAddress | String | 事务性邮件的发件人地址。 |
| hideControls | Boolean | 如果为 true，则在仪表板中隐藏集合创建/更新控件。 |

**smtp** - 邮件服务器设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| enabled | Boolean | 是否启用 SMTP。 |
| host | String | SMTP 服务器主机。如果启用则必填。 |
| port | Number | SMTP 服务器端口。如果启用则必填。 |
| username | String | SMTP 认证用户名。 |
| password | String | SMTP 认证密码。 |
| tls | Boolean | 是否使用 TLS 加密。 |
| authMethod | String | 认证方式（PLAIN、LOGIN、CRAM-MD5）。 |
| localName | String | HELO/EHLO 命令的本地主机名。 |

**s3** - S3 文件存储设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| enabled | Boolean | 是否启用 S3 存储。 |
| bucket | String | S3 存储桶名称。如果启用则必填。 |
| region | String | S3 区域。如果启用则必填。 |
| endpoint | String | S3 端点 URL。如果启用则必填。 |
| accessKey | String | S3 访问密钥。如果启用则必填。 |
| secret | String | S3 密钥。如果启用则必填。 |
| forcePathStyle | Boolean | 强制使用路径样式寻址（用于 MinIO 等）。 |

**backups** - 备份设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| cron | String | 自动备份的 Cron 表达式。 |
| cronMaxKeep | Number | 保留的最大备份数量。 |
| s3 | Object | 用于远程存储备份的 S3 配置。 |

**logs** - 日志设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| maxDays | Number | 日志保留天数（0 = 不持久化）。 |
| minLevel | Number | 最低日志级别（-4=DEBUG, 0=INFO, 4=WARN, 8=ERROR）。 |
| logIP | Boolean | 是否记录客户端 IP 地址。 |
| logAuthId | Boolean | 是否记录已认证的记录 ID。 |

**batch** - 批量请求设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| enabled | Boolean | 是否启用批量 API。 |
| maxRequests | Number | 每批次的最大请求数。 |
| timeout | Number | 批量请求超时时间（秒）。 |
| maxBodySize | Number | 最大请求体大小（字节）。 |

**rateLimits** - 速率限制设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| enabled | Boolean | 是否启用速率限制。 |
| rules | Array | 速率限制规则，包含 `label`、`maxRequests`、`duration`。 |

**trustedProxy** - 信任代理设置

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| headers | Array | 信任的代理头列表。 |
| useLeftmostIP | Boolean | 使用代理头中最左边的 IP。 |

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
  "message": "更新设置失败。",
  "data": {
    "meta.appUrl": {
      "code": "validation_required",
      "message": "缺少必填值。"
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

## 测试 S3 连接

执行 S3 存储连接测试。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 测试主存储 S3 连接
await pb.settings.testS3('storage');

// 测试备份 S3 连接
await pb.settings.testS3('backups');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 测试主存储 S3 连接
await pb.settings.testS3('storage');

// 测试备份 S3 连接
await pb.settings.testS3('backups');
```

</template>
</CodeTabs>

### API 详情

::: tip POST
`/api/settings/test/s3`

需要 `Authorization: TOKEN`
:::

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| filesystem | String | **必填。** 要测试的文件系统：`storage` 或 `backups`。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "建立 S3 连接失败。",
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

## 测试邮件

向指定地址发送测试邮件。

只有超级用户可以执行此操作。

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

### API 详情

::: tip POST
`/api/settings/test/email`

需要 `Authorization: TOKEN`
:::

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| email | String | **必填。** 接收测试邮件的邮箱地址。 |
| template | String | **必填。** 模板类型：`verification`、`password-reset` 或 `email-change`。 |
| collection | String | 认证集合名称或 ID（默认：`_superusers`）。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "发送测试邮件失败。",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "缺少必填值。"
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

## 生成 Apple 客户端密钥

生成新的 Apple OAuth2 客户端密钥，用于"使用 Apple 登录"功能。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const result = await pb.settings.generateAppleClientSecret(
    'com.example.app',     // clientId - 服务 ID
    'XXXXXXXXXX',          // teamId - 10 字符的团队 ID
    'XXXXXXXXXX',          // keyId - 10 字符的密钥 ID
    '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----', // privateKey
    15552000               // 有效期（秒，最长约 6 个月）
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

### API 详情

::: tip POST
`/api/settings/apple/generate-client-secret`

需要 `Authorization: TOKEN`
:::

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| clientId | String | **必填。** Apple 服务 ID（应用标识符）。 |
| teamId | String | **必填。** 10 字符的 Apple 团队 ID。 |
| keyId | String | **必填。** 10 字符的密钥 ID。 |
| privateKey | String | **必填。** 私钥内容（PEM 格式）。 |
| duration | Number | **必填。** JWT 有效期（秒，最长 15777000 ≈ 6 个月）。 |

**响应**

::: code-group
```json [200]
{
  "secret": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

```json [400]
{
  "status": 400,
  "message": "生成客户端密钥失败。",
  "data": {
    "clientId": {
      "code": "validation_required",
      "message": "缺少必填值。"
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
