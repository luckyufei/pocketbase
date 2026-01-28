# 集合 API

## 列出集合

返回分页的集合列表。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 获取分页集合列表
const pageResult = await pb.collections.getList(1, 100, {
    filter: 'created >= "2022-01-01 00:00:00"',
});

// 也可以通过 getFullList 一次获取所有集合
const collections = await pb.collections.getFullList({ sort: '-created' });

// 或只获取匹配指定过滤条件的第一个集合
const collection = await pb.collections.getFirstListItem('type="auth"');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 获取分页集合列表
final pageResult = await pb.collections.getList(
    page: 1,
    perPage: 100,
    filter: 'created >= "2022-01-01 00:00:00"',
);

// 也可以通过 getFullList 一次获取所有集合
final collections = await pb.collections.getFullList(sort: '-created');

// 或只获取匹配指定过滤条件的第一个集合
final collection = await pb.collections.getFirstListItem('type="auth"');
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/collections`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| page | Number | 分页列表的页码（即偏移量）（默认为 1）。 |
| perPage | Number | 每页返回的最大集合数（默认为 30）。 |
| sort | String | 指定 ORDER BY 字段。在属性前添加 `-` / `+`（默认）表示降序/升序，例如：<br>`?sort=-created,id`<br><br>**支持的集合排序字段：**<br>`@random`、`id`、`created`、`updated`、`name`、`type`、`system` |
| filter | String | 用于过滤/搜索返回集合列表的过滤表达式，例如：<br>`?filter=(name~'abc' && created>'2022-01-01')`<br><br>**支持的集合过滤字段：**<br>`id`、`created`、`updated`、`name`、`type`、`system` |
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |
| skipTotal | Boolean | 如果设为 true，将跳过总数查询。 |

<FilterSyntax />

**响应**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 2,
  "totalItems": 10,
  "totalPages": 5,
  "items": [
    {
      "id": "_pbc_344172009",
      "listRule": null,
      "viewRule": null,
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "name": "users",
      "type": "auth",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "cost": 0,
          "hidden": true,
          "id": "password901924565",
          "max": 0,
          "min": 8,
          "name": "password",
          "pattern": "",
          "presentable": false,
          "required": true,
          "system": true,
          "type": "password"
        },
        {
          "autogeneratePattern": "[a-zA-Z0-9]{50}",
          "hidden": true,
          "id": "text2504183744",
          "max": 60,
          "min": 30,
          "name": "tokenKey",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "exceptDomains": null,
          "hidden": false,
          "id": "email3885137012",
          "name": "email",
          "onlyDomains": null,
          "presentable": false,
          "required": true,
          "system": true,
          "type": "email"
        },
        {
          "hidden": false,
          "id": "bool1547992806",
          "name": "emailVisibility",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool256245529",
          "name": "verified",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 255,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "file376926767",
          "maxSelect": 1,
          "maxSize": 0,
          "mimeTypes": [
            "image/jpeg",
            "image/png",
            "image/svg+xml",
            "image/gif",
            "image/webp"
          ],
          "name": "avatar",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": null,
          "type": "file"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX `idx_tokenKey__pbc_344172009` ON `users` (`tokenKey`)",
        "CREATE UNIQUE INDEX `idx_email__pbc_344172009` ON `users` (`email`) WHERE `email` != ''"
      ],
      "system": false,
      "authRule": "",
      "manageRule": null,
      "authAlert": {
        "enabled": true,
        "emailTemplate": {
          "subject": "Login from a new location",
          "body": "..."
        }
      },
      "oauth2": {
        "enabled": false,
        "mappedFields": {
          "id": "",
          "name": "name",
          "username": "",
          "avatarURL": "avatar"
        },
        "providers": [
          {
            "pkce": null,
            "name": "google",
            "clientId": "abc",
            "authURL": "",
            "tokenURL": "",
            "userInfoURL": "",
            "displayName": "",
            "extra": null
          }
        ]
      },
      "passwordAuth": {
        "enabled": true,
        "identityFields": ["email"]
      },
      "mfa": {
        "enabled": false,
        "duration": 1800,
        "rule": ""
      },
      "otp": {
        "enabled": false,
        "duration": 180,
        "length": 8,
        "emailTemplate": {
          "subject": "OTP for {APP_NAME}",
          "body": "..."
        }
      },
      "authToken": {
        "duration": 604800
      },
      "passwordResetToken": {
        "duration": 1800
      },
      "emailChangeToken": {
        "duration": 1800
      },
      "verificationToken": {
        "duration": 259200
      },
      "fileToken": {
        "duration": 180
      },
      "verificationTemplate": {
        "subject": "Verify your {APP_NAME} email",
        "body": "..."
      },
      "resetPasswordTemplate": {
        "subject": "Reset your {APP_NAME} password",
        "body": "..."
      },
      "confirmEmailChangeTemplate": {
        "subject": "Confirm your {APP_NAME} new email address",
        "body": "..."
      }
    },
    {
      "id": "_pbc_2287844090",
      "listRule": null,
      "viewRule": null,
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "name": "posts",
      "type": "base",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text724990059",
          "max": 0,
          "min": 0,
          "name": "title",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "indexes": [],
      "system": false
    }
  ]
}
```

```json [400]
{
  "status": 400,
  "message": "处理请求时出错。无效的过滤器。",
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

## 查看集合

根据 ID 或名称返回单个集合。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const collection = await pb.collections.getOne('demo');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final collection = await pb.collections.getOne('demo');
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/collections/{collectionIdOrName}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 要查看的集合的 ID 或名称。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "id": "_pbc_2287844090",
  "name": "posts",
  "type": "base",
  "system": false,
  "fields": [
    {
      "id": "text3208210256",
      "name": "id",
      "type": "text",
      "system": true,
      "required": true,
      "primaryKey": true
    },
    {
      "id": "text724990059",
      "name": "title",
      "type": "text",
      "system": false
    }
  ],
  "indexes": [],
  "listRule": null,
  "viewRule": null,
  "createRule": null,
  "updateRule": null,
  "deleteRule": null
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

```json [404]
{
  "status": 404,
  "message": "请求的资源不存在。",
  "data": {}
}
```
:::

---

## 创建集合

创建新的集合。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 创建基础集合
const base = await pb.collections.create({
    name: 'exampleBase',
    type: 'base',
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            min: 10,
        },
        {
            name: 'status',
            type: 'bool',
        },
    ],
});

// 创建认证集合
const auth = await pb.collections.create({
    name: 'exampleAuth',
    type: 'auth',
    createRule: 'id = @request.auth.id',
    updateRule: 'id = @request.auth.id',
    deleteRule: 'id = @request.auth.id',
    fields: [
        {
            name: 'name',
            type: 'text',
        }
    ],
    passwordAuth: {
        enabled: true,
        identityFields: ['email']
    },
});

// 创建视图集合
const view = await pb.collections.create({
    name: 'exampleView',
    type: 'view',
    listRule: '@request.auth.id != ""',
    viewRule: null,
    // 模式将根据以下查询自动生成
    viewQuery: 'SELECT id, name from posts',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// 创建基础集合
final base = await pb.collections.create(body: {
    'name': 'exampleBase',
    'type': 'base',
    'fields': [
        {
            'name': 'title',
            'type': 'text',
            'required': true,
            'min': 10,
        },
        {
            'name': 'status',
            'type': 'bool',
        },
    ],
});

// 创建认证集合
final auth = await pb.collections.create(body: {
    'name': 'exampleAuth',
    'type': 'auth',
    'createRule': 'id = @request.auth.id',
    'updateRule': 'id = @request.auth.id',
    'deleteRule': 'id = @request.auth.id',
    'fields': [
        {
            'name': 'name',
            'type': 'text',
        }
    ],
    'passwordAuth': {
        'enabled': true,
        'identityFields': ['email']
    },
});

// 创建视图集合
final view = await pb.collections.create(body: {
    'name': 'exampleView',
    'type': 'view',
    'listRule': '@request.auth.id != ""',
    'viewRule': null,
    // 模式将根据以下查询自动生成
    'viewQuery': 'SELECT id, name from posts',
});
```

</template>
</CodeTabs>

### API 详情

::: tip POST
`/api/collections`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**请求体参数**

请求体参数可以作为 *JSON* 或 *multipart/form-data* 发送。

```
{
    // 15 个字符的字符串，用于存储集合 ID。
    // 如果未设置，将自动生成。
    id (optional): string

    // 唯一的集合名称（用作记录表的表名）。
    name (required):  string

    // 集合类型。
    // 如果未设置，集合类型默认为 "base"。
    type (optional): "base" | "view" | "auth"

    // 集合字段列表。
    // 此字段可选，对于 "view" 集合会根据 viewQuery 自动填充。
    fields (required|optional): Array<Field>

    // 集合索引和唯一约束。
    // 注意 "view" 集合不支持索引。
    indexes (optional): Array<string>

    // 将集合标记为 "system" 以防止重命名、删除或修改其 API 规则。
    system (optional): boolean

    // CRUD API 规则
    listRule (optional):   null|string
    viewRule (optional):   null|string
    createRule (optional): null|string
    updateRule (optional): null|string
    deleteRule (optional): null|string

    // -------------------------------------------------------
    // view 选项
    // -------------------------------------------------------

    viewQuery (required):  string

    // -------------------------------------------------------
    // auth 选项
    // -------------------------------------------------------

    // 授予类似管理员权限的 API 规则，允许完全管理认证记录，
    // 例如不需要输入旧密码即可更改密码、直接更新
    // 验证状态或邮箱等。此规则在 createRule 和 updateRule 之外执行。
    manageRule (optional): null|string

    // 可用于指定记录认证后、返回认证令牌响应给客户端之前
    // 应用的额外记录约束的 API 规则。
    //
    // 例如，要只允许已验证的用户，可以设置为 "verified = true"。
    //
    // 设置为空字符串允许任何 Auth 集合记录进行认证。
    //
    // 设置为 null 完全禁止该集合的认证。
    authRule (optional): null|string

    // AuthAlert 定义新设备登录时的认证警报相关选项。
    authAlert (optional): {
        enabled (optional): boolean
        emailTemplate (optional): {
            subject (required): string
            body (required):    string
        }
    }

    // OAuth2 指定是否为集合启用 OAuth2 认证
    // 以及允许哪些 OAuth2 提供商。
    oauth2 (optional): {
        enabled (optional): boolean
        mappedFields (optional): {
            id (optional):        string
            name (optional):      string
            username (optional):  string
            avatarURL (optional): string
        }
        providers (optional): [
            {
                name (required):         string
                clientId (required):     string
                clientSecret (required): string
                authURL (optional):      string
                tokenURL (optional):     string
                userInfoURL (optional):  string
                displayName (optional):  string
                pkce (optional):         null|boolean
                extra (optional):        null|Object<string,any>
            }
        ]
    }

    // PasswordAuth 定义集合密码认证相关选项。
    passwordAuth (optional): {
        enabled (optional):        boolean
        identityFields (required): Array<string>
    }

    // MFA 定义多因素认证 (MFA) 相关选项。
    mfa (optional):{
        enabled (optional):  boolean
        duration (required): number
        rule (optional):     string
    }

    // OTP 定义一次性密码认证 (OTP) 相关选项。
    otp (optional): {
        enabled (optional):  boolean
        duration (required): number
        length (required):   number
        emailTemplate (optional): {
            subject (required): string
            body (required):    string
        }
    }

    // 令牌配置。
    authToken (optional): {
        duration (required): number
        secret (required):   string
    }
    passwordResetToken (optional): {
        duration (required): number
        secret (required):   string
    }
    emailChangeToken (optional): {
        duration (required): number
        secret (required):   string
    }
    verificationToken (optional): {
        duration (required): number
        secret (required):   string
    }
    fileToken (optional): {
        duration (required): number
        secret (required):   string
    }

    // 默认邮件模板。
    verificationTemplate (optional): {
        subject (required): string
        body (required):    string
    }
    resetPasswordTemplate (optional): {
        subject (required): string
        body (required):    string
    }
    confirmEmailChangeTemplate (optional): {
        subject (required): string
        body (required):    string
    }
}
```

**响应**

::: code-group
```json [200]
{
  "id": "_pbc_2287844090",
  "listRule": null,
  "viewRule": null,
  "createRule": null,
  "updateRule": null,
  "deleteRule": null,
  "name": "posts",
  "type": "base",
  "fields": [
    {
      "autogeneratePattern": "[a-z0-9]{15}",
      "hidden": false,
      "id": "text3208210256",
      "max": 15,
      "min": 15,
      "name": "id",
      "pattern": "^[a-z0-9]+$",
      "presentable": false,
      "primaryKey": true,
      "required": true,
      "system": true,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text724990059",
      "max": 0,
      "min": 0,
      "name": "title",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "autodate2990389176",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": false,
      "type": "autodate"
    },
    {
      "hidden": false,
      "id": "autodate3332085495",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }
  ],
  "indexes": [],
  "system": false
}
```

```json [400]
{
  "status": 400,
  "message": "提交表单时发生错误。",
  "data": {
    "title": {
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

## 更新集合

根据 ID 或名称更新单个集合。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

const collection = await pb.collections.update('demo', {
    name: 'new_demo',
    listRule: 'created > "2022-01-01 00:00:00"',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

final collection = await pb.collections.update('demo', body: {
    'name': 'new_demo',
    'listRule': 'created > "2022-01-01 00:00:00"',
});
```

</template>
</CodeTabs>

### API 详情

::: warning PATCH
`/api/collections/{collectionIdOrName}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 要查看的集合的 ID 或名称。 |

**请求体参数**

请求体参数可以作为 *JSON* 或 *multipart/form-data* 发送。

```javascript
{
    // 唯一的集合名称（用作记录表的表名）。
    name (required):  string

    // 集合字段列表。
    // 此字段可选，对于 "view" 集合会根据 viewQuery 自动填充。
    fields (required|optional): Array<Field>

    // 集合索引和唯一约束。
    // 注意 "view" 集合不支持索引。
    indexes (optional): Array<string>

    // 将集合标记为 "system" 以防止重命名、删除或修改其 API 规则。
    system (optional): boolean

    // CRUD API 规则
    listRule (optional):   null|string
    viewRule (optional):   null|string
    createRule (optional): null|string
    updateRule (optional): null|string
    deleteRule (optional): null|string

    // -------------------------------------------------------
    // view 选项
    // -------------------------------------------------------

    viewQuery (required):  string

    // -------------------------------------------------------
    // auth 选项
    // -------------------------------------------------------

    // 授予类似管理员权限的 API 规则，允许完全管理认证记录，
    // 例如不需要输入旧密码即可更改密码、直接更新
    // 验证状态或邮箱等。此规则在 createRule 和 updateRule 之外执行。
    manageRule (optional): null|string

    // 可用于指定记录认证后、返回认证令牌响应给客户端之前
    // 应用的额外记录约束的 API 规则。
    //
    // 例如，要只允许已验证的用户，可以设置为 "verified = true"。
    //
    // 设置为空字符串允许任何 Auth 集合记录进行认证。
    //
    // 设置为 null 完全禁止该集合的认证。
    authRule (optional): null|string

    // AuthAlert 定义新设备登录时的认证警报相关选项。
    authAlert (optional): {
        enabled (optional): boolean
        emailTemplate (optional): {
            subject (required): string
            body (required):    string
        }
    }

    // OAuth2 指定是否为集合启用 OAuth2 认证
    // 以及允许哪些 OAuth2 提供商。
    oauth2 (optional): {
        enabled (optional): boolean
        mappedFields (optional): {
            id (optional):        string
            name (optional):      string
            username (optional):  string
            avatarURL (optional): string
        }
        providers (optional): [
            {
                name (required):         string
                clientId (required):     string
                clientSecret (required): string
                authURL (optional):      string
                tokenURL (optional):     string
                userInfoURL (optional):  string
                displayName (optional):  string
                pkce (optional):         null|boolean
                extra (optional):        null|Object<string,any>
            }
        ]
    }

    // PasswordAuth 定义集合密码认证相关选项。
    passwordAuth (optional): {
        enabled (optional):        boolean
        identityFields (required): Array<string>
    }

    // MFA 定义多因素认证 (MFA) 相关选项。
    mfa (optional):{
        enabled (optional):  boolean
        duration (required): number
        rule (optional):     string
    }

    // OTP 定义一次性密码认证 (OTP) 相关选项。
    otp (optional): {
        enabled (optional):  boolean
        duration (required): number
        length (required):   number
        emailTemplate (optional): {
            subject (required): string
            body (required):    string
        }
    }

    // 令牌配置。
    authToken (optional): {
        duration (required): number
        secret (required):   string
    }
    passwordResetToken (optional): {
        duration (required): number
        secret (required):   string
    }
    emailChangeToken (optional): {
        duration (required): number
        secret (required):   string
    }
    verificationToken (optional): {
        duration (required): number
        secret (required):   string
    }
    fileToken (optional): {
        duration (required): number
        secret (required):   string
    }

    // 默认邮件模板。
    verificationTemplate (optional): {
        subject (required): string
        body (required):    string
    }
    resetPasswordTemplate (optional): {
        subject (required): string
        body (required):    string
    }
    confirmEmailChangeTemplate (optional): {
        subject (required): string
        body (required):    string
    }
}
```

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段（*默认返回所有字段*）。例如：<br>`?fields=*,expand.relField.name`<br><br>`*` 目标是特定深度级别的所有键。<br><br>此外，还支持以下字段修饰符：<br>`:excerpt(maxLength, withEllipsis?)` - 返回字段字符串值的简短纯文本版本。例如：`?fields=*,description:excerpt(200,true)` |

**响应**

::: code-group
```json [200]
{
  "id": "_pbc_2287844090",
  "listRule": null,
  "viewRule": null,
  "createRule": null,
  "updateRule": null,
  "deleteRule": null,
  "name": "posts",
  "type": "base",
  "fields": [
    {
      "autogeneratePattern": "[a-z0-9]{15}",
      "hidden": false,
      "id": "text3208210256",
      "max": 15,
      "min": 15,
      "name": "id",
      "pattern": "^[a-z0-9]+$",
      "presentable": false,
      "primaryKey": true,
      "required": true,
      "system": true,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text724990059",
      "max": 0,
      "min": 0,
      "name": "title",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "autodate2990389176",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": false,
      "type": "autodate"
    },
    {
      "hidden": false,
      "id": "autodate3332085495",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }
  ],
  "indexes": [],
  "system": false
}
```

```json [400]
{
  "status": 400,
  "message": "提交表单时发生错误。",
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
  "message": "已授权的记录不允许执行此操作。",
  "data": {}
}
```
:::

---

## 删除集合

根据 ID 或名称删除单个集合。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.collections.delete('demo');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.collections.delete('demo');
```

</template>
</CodeTabs>

### API 详情

::: danger DELETE
`/api/collections/{collectionIdOrName}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 要删除的集合的 ID 或名称。 |

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "删除集合失败。请确保它没有被其他集合引用。",
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

```json [404]
{
  "status": 404,
  "message": "请求的资源不存在。",
  "data": {}
}
```
:::

---

## 清空集合

删除单个集合的所有记录（包括其相关文件和启用了级联删除的关系）。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.collections.truncate('demo');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.collections.truncate('demo');
```

</template>
</CodeTabs>

### API 详情

::: danger DELETE
`/api/collections/{collectionIdOrName}/truncate`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 要清空的集合的 ID 或名称。 |

**响应**

::: code-group
```json [204]
null
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

```json [404]
{
  "status": 404,
  "message": "请求的资源不存在。",
  "data": {}
}
```
:::

---

## 导入集合

批量导入提供的 *Collections* 配置。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const importData = [
    {
        name: 'collection1',
        schema: [
            {
                name: 'status',
                type: 'bool',
            },
        ],
    },
    {
        name: 'collection2',
        schema: [
            {
                name: 'title',
                type: 'text',
            },
        ],
    },
];

await pb.collections.import(importData, false);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final importData = [
    CollectionModel(
        name: "collection1",
        schema: [
            SchemaField(name: "status", type: "bool"),
        ],
    ),
    CollectionModel(
        name: "collection2",
        schema: [
            SchemaField(name: "title", type: "text"),
        ],
    ),
];

await pb.collections.import(importData, deleteMissing: false);
```

</template>
</CodeTabs>

### API 详情

::: tip PUT
`/api/collections/import`

需要 `Authorization: TOKEN`
:::

**请求体参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collections | Array\<Collection\> | **必填。** 要导入的集合列表（替换和创建）。 |
| deleteMissing | Boolean | 如果为 *true*，所有导入配置中不存在的现有集合和模式字段**将被删除**，包括其相关记录数据（默认为 *false*）。 |

请求体参数可以作为 *JSON* 或 *multipart/form-data* 发送。

**响应**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "提交表单时发生错误。",
  "data": {
    "collections": {
      "code": "collections_import_failure",
      "message": "导入集合配置失败。"
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
  "message": "已授权的记录不允许执行此操作。",
  "data": {}
}
```
:::

---

## 脚手架

返回包含所有集合类型及其默认字段的对象（*主要用于后台管理界面*）。

只有超级用户可以执行此操作。

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const scaffolds = await pb.collections.getScaffolds();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

final scaffolds = await pb.collections.getScaffolds();
```

</template>
</CodeTabs>

### API 详情

::: info GET
`/api/collections/meta/scaffolds`

需要 `Authorization: TOKEN`
:::

**响应**

::: code-group
```json [200]
{
  "auth": {
    "id": "",
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "",
    "type": "auth",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cost": 0,
        "hidden": true,
        "id": "password901924565",
        "max": 0,
        "min": 8,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "[a-zA-Z0-9]{50}",
        "hidden": true,
        "id": "text2504183744",
        "max": 60,
        "min": 30,
        "name": "tokenKey",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "email3885137012",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "bool1547992806",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool256245529",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey_hclGvwhtqG` ON `test` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email_eyxYyd3gp1` ON `test` (`email`) WHERE `email` != ''"
    ],
    "created": "",
    "updated": "",
    "system": false,
    "authRule": "",
    "manageRule": null,
    "authAlert": {
      "enabled": true,
      "emailTemplate": {
        "subject": "Login from a new location",
        "body": "..."
      }
    },
    "oauth2": {
      "providers": [],
      "mappedFields": {
        "id": "",
        "name": "",
        "username": "",
        "avatarURL": ""
      },
      "enabled": false
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": ["email"]
    },
    "mfa": {
      "enabled": false,
      "duration": 1800,
      "rule": ""
    },
    "otp": {
      "enabled": false,
      "duration": 180,
      "length": 8,
      "emailTemplate": {
        "subject": "OTP for {APP_NAME}",
        "body": "..."
      }
    },
    "authToken": {
      "duration": 604800
    },
    "passwordResetToken": {
      "duration": 1800
    },
    "emailChangeToken": {
      "duration": 1800
    },
    "verificationToken": {
      "duration": 259200
    },
    "fileToken": {
      "duration": 180
    },
    "verificationTemplate": {
      "subject": "Verify your {APP_NAME} email",
      "body": "..."
    },
    "resetPasswordTemplate": {
      "subject": "Reset your {APP_NAME} password",
      "body": "..."
    },
    "confirmEmailChangeTemplate": {
      "subject": "Confirm your {APP_NAME} new email address",
      "body": "..."
    }
  },
  "base": {
    "id": "",
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      }
    ],
    "indexes": [],
    "created": "",
    "updated": "",
    "system": false
  },
  "view": {
    "id": "",
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "",
    "type": "view",
    "fields": [],
    "indexes": [],
    "created": "",
    "updated": "",
    "system": false,
    "viewQuery": ""
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

```json [404]
{
  "status": 404,
  "message": "请求的资源不存在。",
  "data": {}
}
```
:::

---

## 字段类型参考

PocketBase 支持以下字段类型：

| 类型 | 描述 |
|------|-------------|
| `text` | 纯文本字段。 |
| `number` | 数字字段（整数或浮点数）。 |
| `bool` | 布尔 true/false 字段。 |
| `email` | 带格式验证的邮箱字段。 |
| `url` | 带格式验证的 URL 字段。 |
| `date` | 日期/日期时间字段。 |
| `select` | 从预定义值中单选或多选。 |
| `file` | 文件上传字段。 |
| `relation` | 与另一个集合记录的关系。 |
| `json` | 用于存储任意 JSON 数据的字段。 |
| `editor` | 富文本编辑器字段（HTML 内容）。 |
| `autodate` | 自动填充的日期字段（如 created、updated）。 |

每种字段类型都有自己的选项集。详细信息请参阅[集合](/zh/collections)文档。
