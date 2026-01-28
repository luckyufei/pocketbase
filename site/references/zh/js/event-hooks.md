# 事件钩子

你可以通过暴露的 JavaScript 应用事件钩子，使用自定义服务端代码扩展 PocketBase 的默认行为。

在处理函数中抛出错误或不调用 `e.next()` 会停止钩子执行链。

::: info
所有钩子处理函数都遵循相同的 `function(e){}` 签名，期望用户调用 `e.next()` 以继续执行链。
:::

[[toc]]

## 应用钩子

### onBootstrap

`onBootstrap` 钩子在初始化主要应用资源（数据库、应用设置等）时触发。
注意：在调用 `e.next()` 之前尝试访问数据库将导致错误。

```javascript
onBootstrap((e) => {
    e.next()

    // e.app
})
```

### onSettingsReload

`onSettingsReload` 钩子在每次 `$app.settings()` 被新状态替换时触发。

在 `e.next()` 之后调用 `e.app.settings()` 将返回新状态。

```javascript
onSettingsReload((e) => {
    e.next()

    // e.app.settings()
})
```

### onBackupCreate

`onBackupCreate` 在每次 `$app.createBackup` 调用时触发。

```javascript
onBackupCreate((e) => {
    // e.app
    // e.name    - 要创建的备份名称
    // e.exclude - 从备份中排除的 pb_data 目录条目列表
})
```

### onBackupRestore

`onBackupRestore` 在应用备份恢复之前触发（即在 `$app.restoreBackup` 调用时）。

```javascript
onBackupRestore((e) => {
    // e.app
    // e.name    - 要恢复的备份名称
    // e.exclude - 从备份中排除的目录条目列表
})
```

### onTerminate

`onTerminate` 钩子在应用正在终止时触发（例如收到 `SIGTERM` 信号）。
注意：应用可能会在不等待钩子完成的情况下突然终止。

```javascript
onTerminate((e) => {
    // e.app
    // e.isRestart
})
```

## 邮件钩子

### onMailerSend

`onMailerSend` 钩子在每次使用 `$app.newMailClient()` 实例发送新邮件时触发。

它允许拦截邮件消息或使用自定义邮件客户端。

```javascript
onMailerSend((e) => {
    // e.app
    // e.mailer
    // e.message

    // 例如：更改邮件主题
    e.message.subject = "new subject"

    e.next()
})
```

### onMailerRecordAuthAlertSend

`onMailerRecordAuthAlertSend` 钩子在发送新设备登录认证警报邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```javascript
onMailerRecordAuthAlertSend((e) => {
    // e.app
    // e.mailer
    // e.message
    // e.record
    // e.meta.info

    // 例如：更改邮件主题
    e.message.subject = "new subject"

    e.next()
}, "users")
```

### onMailerRecordPasswordResetSend

`onMailerRecordPasswordResetSend` 钩子在向认证记录发送密码重置邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```javascript
onMailerRecordPasswordResetSend((e) => {
    // e.app
    // e.mailer
    // e.message
    // e.record
    // e.meta.token

    // 例如：更改邮件主题
    e.message.subject = "new subject"

    e.next()
}, "users")
```

### onMailerRecordVerificationSend

`onMailerRecordVerificationSend` 钩子在向认证记录发送验证邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```javascript
onMailerRecordVerificationSend((e) => {
    // e.app
    // e.mailer
    // e.message
    // e.record
    // e.meta.token

    // 例如：更改邮件主题
    e.message.subject = "new subject"

    e.next()
}, "users")
```

### onMailerRecordEmailChangeSend

`onMailerRecordEmailChangeSend` 钩子在向认证记录发送确认新邮箱地址邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```javascript
onMailerRecordEmailChangeSend((e) => {
    // e.app
    // e.mailer
    // e.message
    // e.record
    // e.meta.token
    // e.meta.newEmail

    // 例如：更改邮件主题
    e.message.subject = "new subject"

    e.next()
}, "users")
```

### onMailerRecordOTPSend

`onMailerRecordOTPSend` 钩子在向认证记录发送 OTP 邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```javascript
onMailerRecordOTPSend((e) => {
    // e.app
    // e.mailer
    // e.message
    // e.record
    // e.meta.otpId
    // e.meta.password

    // 例如：更改邮件主题
    e.message.subject = "new subject"

    e.next()
}, "users")
```

## 实时钩子

### onRealtimeConnectRequest

`onRealtimeConnectRequest` 钩子在建立 SSE 客户端连接时触发。

`e.next()` 之后的任何执行都发生在客户端断开连接之后。

```javascript
onRealtimeConnectRequest((e) => {
    // e.app
    // e.client
    // e.idleTimeout
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

### onRealtimeSubscribeRequest

`onRealtimeSubscribeRequest` 钩子在更新客户端订阅时触发，允许你进一步验证和修改提交的更改。

```javascript
onRealtimeSubscribeRequest((e) => {
    // e.app
    // e.client
    // e.subscriptions
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

### onRealtimeMessageSend

`onRealtimeMessageSend` 钩子在向客户端发送 SSE 消息时触发。

```javascript
onRealtimeMessageSend((e) => {
    // e.app
    // e.client
    // e.message
    // 以及所有原始连接的 RequestEvent 字段...

    e.next()
})
```

## 记录模型钩子

::: info
这些是较低级别的 Record 模型钩子，可以从任何地方触发（自定义控制台命令、计划的 cron 任务、调用 `e.save(record)` 时等），因此它们无法访问请求上下文！

如果你想拦截内置的 Web API 并访问其请求体、查询参数、请求头或请求认证状态，请使用专门的 [记录 `*Request` 钩子](#请求钩子)。
:::

### onRecordEnrich

`onRecordEnrich` 在每次记录被丰富时触发 - 作为内置 Record 响应的一部分、在实时消息序列化期间或调用 `apis.enrichRecord` 时。

它可用于例如仅针对特定请求信息动态隐藏或添加计算的临时 Record 模型属性。

```javascript
onRecordEnrich((e) => {
    // 隐藏一个或多个字段
    e.record.hide("role")

    // 为已注册用户添加新的自定义字段
    if (e.requestInfo.auth?.collection()?.name == "users") {
        e.record.withCustomData(true) // 出于安全考虑，自定义属性需要显式启用
        e.record.set("computedScore", e.record.get("score") * e.requestInfo.auth.get("base"))
    }

    e.next()
}, "posts")
```

### onRecordValidate

`onRecordValidate` 是 `onModelValidate` 的 Record 代理模型钩子。

`onRecordValidate` 在每次验证 Record 时调用，例如由 `$app.validate()` 或 `$app.save()` 触发。

```javascript
// 对每条记录触发
onRecordValidate((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordValidate((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

### 记录模型创建钩子

#### onRecordCreate

`onRecordCreate` 是 `onModelCreate` 的 Record 代理模型钩子。

`onRecordCreate` 在每次创建新 Record 时触发，例如由 `$app.save()` 触发。

`e.next()` 之前的操作在 Record 验证和 INSERT DB 语句之前执行。

`e.next()` 之后的操作在 Record 验证和 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onRecordAfterCreateSuccess` 或 `onRecordAfterCreateError` 钩子。
:::

```javascript
// 对每条记录触发
onRecordCreate((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordCreate((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordCreateExecute

`onRecordCreateExecute` 是 `onModelCreateExecute` 的 Record 代理模型钩子。

`onRecordCreateExecute` 在 Record 验证成功后、模型 INSERT DB 语句执行之前触发。

通常作为 `$app.save()` 的一部分触发，触发顺序如下：
<br>
`onRecordCreate`
<br>
<span class="txt-mono">&nbsp;-> </span>`onRecordValidate`（使用 `$app.saveNoValidate()` 时跳过）
<br>
<span class="txt-mono">&nbsp;-> </span>`onRecordCreateExecute`

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onRecordAfterCreateSuccess` 或 `onRecordAfterCreateError` 钩子。
:::

```javascript
// 对每条记录触发
onRecordCreateExecute((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordCreateExecute((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordAfterCreateSuccess

`onRecordAfterCreateSuccess` 是 `onModelAfterCreateSuccess` 的 Record 代理模型钩子。

`onRecordAfterCreateSuccess` 在每次成功将 Record 持久化到数据库后触发。

::: warning
注意：当 Record 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```javascript
// 对每条记录触发
onRecordAfterCreateSuccess((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordAfterCreateSuccess((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordAfterCreateError

`onRecordAfterCreateError` 是 `onModelAfterCreateError` 的 Record 代理模型钩子。

`onRecordAfterCreateError` 在每次 Record 数据库创建持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.save()` 失败时
- **延迟** 在事务回滚时
:::

```javascript
// 对每条记录触发
onRecordAfterCreateError((e) => {
    // e.app
    // e.record
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordAfterCreateError((e) => {
    // e.app
    // e.record
    // e.error

    e.next()
}, "users", "articles")
```

### 记录模型更新钩子

#### onRecordUpdate

`onRecordUpdate` 是 `onModelUpdate` 的 Record 代理模型钩子。

`onRecordUpdate` 在每次更新 Record 时触发，例如由 `$app.save()` 触发。

`e.next()` 之前的操作在 Record 验证和 UPDATE DB 语句之前执行。

`e.next()` 之后的操作在 Record 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onRecordAfterUpdateSuccess` 或 `onRecordAfterUpdateError` 钩子。
:::

```javascript
// 对每条记录触发
onRecordUpdate((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordUpdate((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordUpdateExecute

`onRecordUpdateExecute` 是 `onModelUpdateExecute` 的 Record 代理模型钩子。

`onRecordUpdateExecute` 在 Record 验证成功后、模型 UPDATE DB 语句执行之前触发。

通常作为 `$app.save()` 的一部分触发，触发顺序如下：
<br>
`onRecordUpdate`
<br>
<span class="txt-mono">&nbsp;-> </span>`onRecordValidate`（使用 `$app.saveNoValidate()` 时跳过）
<br>
<span class="txt-mono">&nbsp;-> </span>`onRecordUpdateExecute`

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onRecordAfterUpdateSuccess` 或 `onRecordAfterUpdateError` 钩子。
:::

```javascript
// 对每条记录触发
onRecordUpdateExecute((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordUpdateExecute((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordAfterUpdateSuccess

`onRecordAfterUpdateSuccess` 是 `onModelAfterUpdateSuccess` 的 Record 代理模型钩子。

`onRecordAfterUpdateSuccess` 在每次成功将 Record 更新持久化到数据库后触发。

::: warning
注意：当 Record 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```javascript
// 对每条记录触发
onRecordAfterUpdateSuccess((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordAfterUpdateSuccess((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordAfterUpdateError

`onRecordAfterUpdateError` 是 `onModelAfterUpdateError` 的 Record 代理模型钩子。

`onRecordAfterUpdateError` 在每次 Record 数据库更新持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.save()` 失败时
- **延迟** 在事务回滚时
:::

```javascript
// 对每条记录触发
onRecordAfterUpdateError((e) => {
    // e.app
    // e.record
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordAfterUpdateError((e) => {
    // e.app
    // e.record
    // e.error

    e.next()
}, "users", "articles")
```

### 记录模型删除钩子

#### onRecordDelete

`onRecordDelete` 是 `onModelDelete` 的 Record 代理模型钩子。

`onRecordDelete` 在每次删除 Record 时触发，例如由 `$app.delete()` 触发。

`e.next()` 之前的操作在 Record 验证和 UPDATE DB 语句之前执行。

`e.next()` 之后的操作在 Record 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Record 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `onRecordAfterDeleteSuccess` 或 `onRecordAfterDeleteError` 钩子。
:::

```javascript
// 对每条记录触发
onRecordDelete((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordDelete((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordDeleteExecute

`onRecordDeleteExecute` 是 `onModelDeleteExecute` 的 Record 代理模型钩子。

`onRecordDeleteExecute` 在内部删除检查之后、Record 模型 DELETE DB 语句执行之前触发。

通常作为 `$app.delete()` 的一部分触发，触发顺序如下：
<br>
`onRecordDelete`
<br>
<span class="txt-mono">&nbsp;-> </span>内部删除检查
<br>
<span class="txt-mono">&nbsp;-> </span>`onRecordDeleteExecute`

::: warning
注意：成功执行并不保证 Record 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onRecordAfterDeleteSuccess` 或 `onRecordAfterDeleteError` 钩子。
:::

```javascript
// 对每条记录触发
onRecordDeleteExecute((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordDeleteExecute((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordAfterDeleteSuccess

`onRecordAfterDeleteSuccess` 是 `onModelAfterDeleteSuccess` 的 Record 代理模型钩子。

`onRecordAfterDeleteSuccess` 在每次成功将 Record 从数据库删除后触发。

::: warning
注意：当 Record 作为事务的一部分删除时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```javascript
// 对每条记录触发
onRecordAfterDeleteSuccess((e) => {
    // e.app
    // e.record

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordAfterDeleteSuccess((e) => {
    // e.app
    // e.record

    e.next()
}, "users", "articles")
```

#### onRecordAfterDeleteError

`onRecordAfterDeleteError` 是 `onModelAfterDeleteError` 的 Record 代理模型钩子。

`onRecordAfterDeleteError` 在每次 Record 数据库删除持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.delete()` 失败时
- **延迟** 在事务回滚时
:::

```javascript
// 对每条记录触发
onRecordAfterDeleteError((e) => {
    // e.app
    // e.record
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 记录触发
onRecordAfterDeleteError((e) => {
    // e.app
    // e.record
    // e.error

    e.next()
}, "users", "articles")
```

## 集合模型钩子

::: info
这些是较低级别的 Collection 模型钩子，可以从任何地方触发（自定义控制台命令、计划的 cron 任务、调用 `e.save(collection)` 时等），因此它们无法访问请求上下文！

如果你想拦截内置的 Web API 并访问其请求体、查询参数、请求头或请求认证状态，请使用专门的 [Collection `*Request` 钩子](#集合请求钩子)。
:::

### onCollectionValidate

`onCollectionValidate` 是 `onModelValidate` 的 Collection 代理模型钩子。

`onCollectionValidate` 在每次验证 Collection 时调用，例如由 `$app.validate()` 或 `$app.save()` 触发。

```javascript
// 对每个集合触发
onCollectionValidate((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionValidate((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

### 集合模型创建钩子

#### onCollectionCreate

`onCollectionCreate` 是 `onModelCreate` 的 Collection 代理模型钩子。

`onCollectionCreate` 在每次创建新 Collection 时触发，例如由 `$app.save()` 触发。

`e.next()` 之前的操作在 Collection 验证和 INSERT DB 语句之前执行。

`e.next()` 之后的操作在 Collection 验证和 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onCollectionAfterCreateSuccess` 或 `onCollectionAfterCreateError` 钩子。
:::

```javascript
// 对每个集合触发
onCollectionCreate((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionCreate((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionCreateExecute

`onCollectionCreateExecute` 是 `onModelCreateExecute` 的 Collection 代理模型钩子。

`onCollectionCreateExecute` 在 Collection 验证成功后、模型 INSERT DB 语句执行之前触发。

通常作为 `$app.save()` 的一部分触发，触发顺序如下：
<br>
`onCollectionCreate`
<br>
<span class="txt-mono">&nbsp;-> </span>`onCollectionValidate`（使用 `$app.saveNoValidate()` 时跳过）
<br>
<span class="txt-mono">&nbsp;-> </span>`onCollectionCreateExecute`

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onCollectionAfterCreateSuccess` 或 `onCollectionAfterCreateError` 钩子。
:::

```javascript
// 对每个集合触发
onCollectionCreateExecute((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionCreateExecute((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionAfterCreateSuccess

`onCollectionAfterCreateSuccess` 是 `onModelAfterCreateSuccess` 的 Collection 代理模型钩子。

`onCollectionAfterCreateSuccess` 在每次成功将 Collection 持久化到数据库后触发。

::: warning
注意：当 Collection 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```javascript
// 对每个集合触发
onCollectionAfterCreateSuccess((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionAfterCreateSuccess((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionAfterCreateError

`onCollectionAfterCreateError` 是 `onModelAfterCreateError` 的 Collection 代理模型钩子。

`onCollectionAfterCreateError` 在每次 Collection 数据库创建持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.save()` 失败时
- **延迟** 在事务回滚时
:::

```javascript
// 对每个集合触发
onCollectionAfterCreateError((e) => {
    // e.app
    // e.collection
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionAfterCreateError((e) => {
    // e.app
    // e.collection
    // e.error

    e.next()
}, "users", "articles")
```

### 集合模型更新钩子

#### onCollectionUpdate

`onCollectionUpdate` 是 `onModelUpdate` 的 Collection 代理模型钩子。

`onCollectionUpdate` 在每次更新 Collection 时触发，例如由 `$app.save()` 触发。

`e.next()` 之前的操作在 Collection 验证和 UPDATE DB 语句之前执行。

`e.next()` 之后的操作在 Collection 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onCollectionAfterUpdateSuccess` 或 `onCollectionAfterUpdateError` 钩子。
:::

```javascript
// 对每个集合触发
onCollectionUpdate((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionUpdate((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionUpdateExecute

`onCollectionUpdateExecute` 是 `onModelUpdateExecute` 的 Collection 代理模型钩子。

`onCollectionUpdateExecute` 在 Collection 验证成功后、模型 UPDATE DB 语句执行之前触发。

通常作为 `$app.save()` 的一部分触发，触发顺序如下：
<br>
`onCollectionUpdate`
<br>
<span class="txt-mono">&nbsp;-> </span>`onCollectionValidate`（使用 `$app.saveNoValidate()` 时跳过）
<br>
<span class="txt-mono">&nbsp;-> </span>`onCollectionUpdateExecute`

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onCollectionAfterUpdateSuccess` 或 `onCollectionAfterUpdateError` 钩子。
:::

```javascript
// 对每个集合触发
onCollectionUpdateExecute((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionUpdateExecute((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionAfterUpdateSuccess

`onCollectionAfterUpdateSuccess` 是 `onModelAfterUpdateSuccess` 的 Collection 代理模型钩子。

`onCollectionAfterUpdateSuccess` 在每次成功将 Collection 更新持久化到数据库后触发。

::: warning
注意：当 Collection 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```javascript
// 对每个集合触发
onCollectionAfterUpdateSuccess((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionAfterUpdateSuccess((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionAfterUpdateError

`onCollectionAfterUpdateError` 是 `onModelAfterUpdateError` 的 Collection 代理模型钩子。

`onCollectionAfterUpdateError` 在每次 Collection 数据库更新持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.save()` 失败时
- **延迟** 在事务回滚时
:::

```javascript
// 对每个集合触发
onCollectionAfterUpdateError((e) => {
    // e.app
    // e.collection
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionAfterUpdateError((e) => {
    // e.app
    // e.collection
    // e.error

    e.next()
}, "users", "articles")
```

### 集合模型删除钩子

#### onCollectionDelete

`onCollectionDelete` 是 `onModelDelete` 的 Collection 代理模型钩子。

`onCollectionDelete` 在每次删除 Collection 时触发，例如由 `$app.delete()` 触发。

`e.next()` 之前的操作在 Collection 验证和 UPDATE DB 语句之前执行。

`e.next()` 之后的操作在 Collection 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Collection 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `onCollectionAfterDeleteSuccess` 或 `onCollectionAfterDeleteError` 钩子。
:::

```javascript
// 对每个集合触发
onCollectionDelete((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionDelete((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionDeleteExecute

`onCollectionDeleteExecute` 是 `onModelDeleteExecute` 的 Collection 代理模型钩子。

`onCollectionDeleteExecute` 在内部删除检查之后、Collection 模型 DELETE DB 语句执行之前触发。

通常作为 `$app.delete()` 的一部分触发，触发顺序如下：
<br>
`onCollectionDelete`
<br>
<span class="txt-mono">&nbsp;-> </span>内部删除检查
<br>
<span class="txt-mono">&nbsp;-> </span>`onCollectionDeleteExecute`

::: warning
注意：成功执行并不保证 Collection 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onCollectionAfterDeleteSuccess` 或 `onCollectionAfterDeleteError` 钩子。
:::

```javascript
// 对每个集合触发
onCollectionDeleteExecute((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionDeleteExecute((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionAfterDeleteSuccess

`onCollectionAfterDeleteSuccess` 是 `onModelAfterDeleteSuccess` 的 Collection 代理模型钩子。

`onCollectionAfterDeleteSuccess` 在每次成功将 Collection 从数据库删除后触发。

::: warning
注意：当 Collection 作为事务的一部分删除时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```javascript
// 对每个集合触发
onCollectionAfterDeleteSuccess((e) => {
    // e.app
    // e.collection

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionAfterDeleteSuccess((e) => {
    // e.app
    // e.collection

    e.next()
}, "users", "articles")
```

#### onCollectionAfterDeleteError

`onCollectionAfterDeleteError` 是 `onModelAfterDeleteError` 的 Collection 代理模型钩子。

`onCollectionAfterDeleteError` 在每次 Collection 数据库删除持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.delete()` 失败时
- **延迟** 在事务回滚时
:::

```javascript
// 对每个集合触发
onCollectionAfterDeleteError((e) => {
    // e.app
    // e.collection
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onCollectionAfterDeleteError((e) => {
    // e.app
    // e.collection
    // e.error

    e.next()
}, "users", "articles")
```

## 请求钩子

::: info
请求钩子仅在访问相应的 API 请求端点时触发。
:::

### 记录 CRUD 请求钩子

#### onRecordsListRequest

`onRecordsListRequest` 钩子在每次 API 记录列表请求时触发。可用于在返回给客户端之前验证或修改响应。

::: warning
注意：如果你想隐藏现有字段或添加新的计算 Record 字段，建议使用 [`onRecordEnrich`](#onrecordenrich) 钩子，因为它更不容易出错，并且会被所有内置 Record 响应触发（包括发送实时 Record 事件时）。
:::

```javascript
// 对每个集合触发
onRecordsListRequest((e) => {
    // e.app
    // e.collection
    // e.records
    // e.result
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onRecordsListRequest((e) => {
    // e.app
    // e.collection
    // e.records
    // e.result
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "articles")
```

#### onRecordViewRequest

`onRecordViewRequest` 钩子在每次 API 记录查看请求时触发。可用于在返回给客户端之前验证或修改响应。

::: warning
注意：如果你想隐藏现有字段或添加新的计算 Record 字段，建议使用 [`onRecordEnrich`](#onrecordenrich) 钩子，因为它更不容易出错，并且会被所有内置 Record 响应触发（包括发送实时 Record 事件时）。
:::

```javascript
// 对每个集合触发
onRecordViewRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onRecordViewRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "articles")
```

#### onRecordCreateRequest

`onRecordCreateRequest` 钩子在每次 API 记录创建请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
// 对每个集合触发
onRecordCreateRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onRecordCreateRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "articles")
```

#### onRecordUpdateRequest

`onRecordUpdateRequest` 钩子在每次 API 记录更新请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
// 对每个集合触发
onRecordUpdateRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onRecordUpdateRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "articles")
```

#### onRecordDeleteRequest

`onRecordDeleteRequest` 钩子在每次 API 记录删除请求时触发。

可用于额外验证请求数据或实现完全不同的删除行为。

```javascript
// 对每个集合触发
onRecordDeleteRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "articles" 集合触发
onRecordDeleteRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "articles")
```

### 记录认证请求钩子

#### onRecordAuthRequest

`onRecordAuthRequest` 钩子在每次成功的 API 记录认证请求（登录、令牌刷新等）时触发。可用于额外验证或修改认证记录数据和令牌。

```javascript
// 对每个认证集合触发
onRecordAuthRequest((e) => {
    // e.app
    // e.record
    // e.token
    // e.meta
    // e.authMethod
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordAuthRequest((e) => {
    // e.app
    // e.record
    // e.token
    // e.meta
    // e.authMethod
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordAuthRefreshRequest

`onRecordAuthRefreshRequest` 钩子在每次记录认证刷新 API 请求时触发（在生成新认证令牌之前）。

可用于额外验证请求数据或实现完全不同的认证刷新行为。

```javascript
// 对每个认证集合触发
onRecordAuthRefreshRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordAuthRefreshRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordAuthWithPasswordRequest

`onRecordAuthWithPasswordRequest` 钩子在每次记录密码认证 API 请求时触发。

如果未找到匹配的身份，`e.record` 可能为 `null`，允许你手动定位不同的 Record 模型（通过重新分配 `e.record`）。

```javascript
// 对每个认证集合触发
onRecordAuthWithPasswordRequest((e) => {
    // e.app
    // e.collection
    // e.record（可能为 null）
    // e.identity
    // e.identityField
    // e.password
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordAuthWithPasswordRequest((e) => {
    // e.app
    // e.collection
    // e.record（可能为 null）
    // e.identity
    // e.identityField
    // e.password
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordAuthWithOAuth2Request

`onRecordAuthWithOAuth2Request` 钩子在每次记录 OAuth2 登录/注册 API 请求时触发（令牌交换之后，链接到外部提供者之前）。

如果未设置 `e.record`，则 OAuth2 请求将尝试创建新的认证记录。要分配或链接不同的现有记录模型，可以更改 `e.record` 字段。

```javascript
// 对每个认证集合触发
onRecordAuthWithOAuth2Request((e) => {
    // e.app
    // e.collection
    // e.providerName
    // e.providerClient
    // e.record（可能为 null）
    // e.oauth2User
    // e.createData
    // e.isNewRecord
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordAuthWithOAuth2Request((e) => {
    // e.app
    // e.collection
    // e.providerName
    // e.providerClient
    // e.record（可能为 null）
    // e.oauth2User
    // e.createData
    // e.isNewRecord
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordRequestPasswordResetRequest

`onRecordRequestPasswordResetRequest` 钩子在每次记录请求密码重置 API 请求时触发。

可用于额外验证请求数据或实现完全不同的密码重置行为。

```javascript
// 对每个认证集合触发
onRecordRequestPasswordResetRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordRequestPasswordResetRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordConfirmPasswordResetRequest

`onRecordConfirmPasswordResetRequest` 钩子在每次记录确认密码重置 API 请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
// 对每个认证集合触发
onRecordConfirmPasswordResetRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordConfirmPasswordResetRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordRequestVerificationRequest

`onRecordRequestVerificationRequest` 钩子在每次记录请求验证 API 请求时触发。

可用于额外验证加载的请求数据或实现完全不同的验证行为。

```javascript
// 对每个认证集合触发
onRecordRequestVerificationRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordRequestVerificationRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordConfirmVerificationRequest

`onRecordConfirmVerificationRequest` 钩子在每次记录确认验证 API 请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
// 对每个认证集合触发
onRecordConfirmVerificationRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordConfirmVerificationRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordRequestEmailChangeRequest

`onRecordRequestEmailChangeRequest` 钩子在每次记录请求邮箱更改 API 请求时触发。

可用于额外验证请求数据或实现完全不同的请求邮箱更改行为。

```javascript
// 对每个认证集合触发
onRecordRequestEmailChangeRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.newEmail
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordRequestEmailChangeRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.newEmail
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordConfirmEmailChangeRequest

`onRecordConfirmEmailChangeRequest` 钩子在每次记录确认邮箱更改 API 请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
// 对每个认证集合触发
onRecordConfirmEmailChangeRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.newEmail
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordConfirmEmailChangeRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.newEmail
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordRequestOTPRequest

`onRecordRequestOTPRequest` 钩子在每次记录请求 OTP API 请求时触发。

如果未找到请求邮箱对应的用户，`e.record` 可能为 `null`，允许你手动创建新的 Record 或定位不同的 Record 模型（通过重新分配 `e.record`）。

```javascript
// 对每个认证集合触发
onRecordRequestOTPRequest((e) => {
    // e.app
    // e.collection
    // e.record（可能为 null）
    // e.password
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordRequestOTPRequest((e) => {
    // e.app
    // e.collection
    // e.record（可能为 null）
    // e.password
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

#### onRecordAuthWithOTPRequest

`onRecordAuthWithOTPRequest` 钩子在每次记录 OTP 认证 API 请求时触发。

```javascript
// 对每个认证集合触发
onRecordAuthWithOTPRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.otp
    // 以及所有 RequestEvent 字段...

    e.next()
})

// 仅对 "users" 和 "managers" 认证集合触发
onRecordAuthWithOTPRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.otp
    // 以及所有 RequestEvent 字段...

    e.next()
}, "users", "managers")
```

### 其他请求钩子

#### onBatchRequest

`onBatchRequest` 钩子在每次 API 批量请求时触发。

可用于额外验证或修改提交的批量请求。

此钩子还会触发相应的 `onRecordCreateRequest`、`onRecordUpdateRequest`、`onRecordDeleteRequest` 钩子，其中 `e.app` 是批量事务应用。

```javascript
onBatchRequest((e) => {
    // e.app
    // e.batch
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onFileDownloadRequest

`onFileDownloadRequest` 钩子在每次 API 文件下载请求之前触发。

可用于在返回给客户端之前验证或修改文件响应。

```javascript
onFileDownloadRequest((e) => {
    // e.app
    // e.collection
    // e.record
    // e.fileField
    // e.servedPath
    // e.servedName
    // 以及所有 RequestEvent 字段...

    e.next()
}, "posts")
```

#### onFileTokenRequest

`onFileTokenRequest` 钩子在每次认证文件令牌 API 请求时触发。

```javascript
// 对每个认证模型触发
onFileTokenRequest((e) => {
    // e.app
    // e.record
    // e.token
    // 以及所有 RequestEvent 字段...

    e.next();
})

// 仅对 "users" 触发
onFileTokenRequest((e) => {
    // e.app
    // e.record
    // e.token
    // 以及所有 RequestEvent 字段...

    e.next();
}, "users")
```

#### onCollectionsListRequest

`onCollectionsListRequest` 钩子在每次 API 集合列表请求时触发。

可用于在返回给客户端之前验证或修改响应。

```javascript
onCollectionsListRequest((e) => {
    // e.app
    // e.collections
    // e.result
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onCollectionViewRequest

`onCollectionViewRequest` 钩子在每次 API 集合查看请求时触发。

可用于在返回给客户端之前验证或修改响应。

```javascript
onCollectionViewRequest((e) => {
    // e.app
    // e.collection
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onCollectionCreateRequest

`onCollectionCreateRequest` 钩子在每次 API 集合创建请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
onCollectionCreateRequest((e) => {
    // e.app
    // e.collection
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onCollectionUpdateRequest

`onCollectionUpdateRequest` 钩子在每次 API 集合更新请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
onCollectionUpdateRequest((e) => {
    // e.app
    // e.collection
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onCollectionDeleteRequest

`onCollectionDeleteRequest` 钩子在每次 API 集合删除请求时触发。

可用于额外验证请求数据或实现完全不同的删除行为。

```javascript
onCollectionDeleteRequest((e) => {
    // e.app
    // e.collection
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onCollectionsImportRequest

`onCollectionsImportRequest` 钩子在每次 API 集合导入请求时触发。

可用于额外验证导入的集合或实现完全不同的导入行为。

```javascript
onCollectionsImportRequest((e) => {
    // e.app
    // e.collections
    // e.deleteMissing
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onSettingsListRequest

`onSettingsListRequest` 钩子在每次 API 设置列表请求时触发。

可用于在返回给客户端之前验证或修改响应。

```javascript
onSettingsListRequest((e) => {
    // e.app
    // e.settings
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

#### onSettingsUpdateRequest

`onSettingsUpdateRequest` 钩子在每次 API 设置更新请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```javascript
onSettingsUpdateRequest((e) => {
    // e.app
    // e.oldSettings
    // e.newSettings
    // 以及所有 RequestEvent 字段...

    e.next()
})
```

## 基础模型钩子

::: info
Model 钩子为所有实现 Model DB 接口的 PocketBase 结构体触发 - Record、Collection、Log 等。

为方便起见，如果你想仅监听 Record 或 Collection DB 模型事件而无需手动进行类型断言，可以使用 [`onRecord*`](#记录模型钩子) 和 [`onCollection*`](#集合模型钩子) 代理钩子。
:::

### onModelValidate

`onModelValidate` 在每次验证 Model 时调用，例如由 `$app.validate()` 或 `$app.save()` 触发。

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelValidate((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelValidate((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelCreate

`onModelCreate` 在每次创建新 Model 时触发，例如由 `$app.save()` 触发。

`e.next()` 之前的操作在 Model 验证和 INSERT DB 语句之前执行。

`e.next()` 之后的操作在 Model 验证和 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onModelAfterCreateSuccess` 或 `onModelAfterCreateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelCreate((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelCreate((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelCreateExecute

`onModelCreateExecute` 在 Model 验证成功后、模型 INSERT DB 语句执行之前触发。

`e.next()` 之前的操作在 INSERT DB 语句之前执行。

`e.next()` 之后的操作在 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onModelAfterCreateSuccess` 或 `onModelAfterCreateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelCreateExecute((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelCreateExecute((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelAfterCreateSuccess

`onModelAfterCreateSuccess` 在每次成功将 Model 持久化到数据库后触发。

::: warning
注意：当 Model 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelAfterCreateSuccess((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelAfterCreateSuccess((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelAfterCreateError

`onModelAfterCreateError` 在每次 Model 数据库创建持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.save()` 失败时
- **延迟** 在事务回滚时
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelAfterCreateError((e) => {
    // e.app
    // e.model
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelAfterCreateError((e) => {
    // e.app
    // e.model
    // e.error

    e.next()
}, "users", "articles")
```

### onModelUpdate

`onModelUpdate` 在每次更新 Model 时触发，例如由 `$app.save()` 触发。

`e.next()` 之前的操作在 Model 验证和 UPDATE DB 语句之前执行。

`e.next()` 之后的操作在 Model 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onModelAfterUpdateSuccess` 或 `onModelAfterUpdateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelUpdate((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelUpdate((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelUpdateExecute

`onModelUpdateExecute` 在 Model 验证成功后、模型 UPDATE DB 语句执行之前触发。

通常作为 `$app.save()` 的一部分触发，触发顺序如下：
- `onModelUpdate`
- `onModelValidate`（使用 `$app.saveNoValidate()` 时跳过）
- `onModelUpdateExecute`

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onModelAfterUpdateSuccess` 或 `onModelAfterUpdateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelUpdateExecute((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelUpdateExecute((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelAfterUpdateSuccess

`onModelAfterUpdateSuccess` 在每次成功将 Model 更新持久化到数据库后触发。

::: warning
注意：当 Model 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelAfterUpdateSuccess((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelAfterUpdateSuccess((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelAfterUpdateError

`onModelAfterUpdateError` 在每次 Model 数据库更新持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.save()` 失败时
- **延迟** 在事务回滚时
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelAfterUpdateError((e) => {
    // e.app
    // e.model
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelAfterUpdateError((e) => {
    // e.app
    // e.model
    // e.error

    e.next()
}, "users", "articles")
```

### onModelDelete

`onModelDelete` 在每次删除 Model 时触发，例如由 `$app.delete()` 触发。

`e.next()` 之前的操作在 Model 验证和 DELETE DB 语句之前执行。

`e.next()` 之后的操作在 Model 验证和 DELETE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onModelAfterDeleteSuccess` 或 `onModelAfterDeleteError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelDelete((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelDelete((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelDeleteExecute

`onModelDeleteExecute` 在内部删除检查之后、Model 模型 DELETE DB 语句执行之前触发。

通常作为 `$app.delete()` 的一部分触发，触发顺序如下：
- `onModelDelete`
- → 内部删除检查
- `onModelDeleteExecute`

::: warning
注意：成功执行并不保证 Model 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `onModelAfterDeleteSuccess` 或 `onModelAfterDeleteError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelDeleteExecute((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelDeleteExecute((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelAfterDeleteSuccess

`onModelAfterDeleteSuccess` 在每次成功将 Model 从数据库删除后触发。

::: warning
注意：当 Model 作为事务的一部分删除时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelAfterDeleteSuccess((e) => {
    // e.app
    // e.model

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelAfterDeleteSuccess((e) => {
    // e.app
    // e.model

    e.next()
}, "users", "articles")
```

### onModelAfterDeleteError

`onModelAfterDeleteError` 在每次 Model 数据库删除持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `$app.delete()` 失败时
- **延迟** 在事务回滚时
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `onRecord*` 和 `onCollection*` 代理钩子。**

```javascript
// 对每个模型触发
onModelAfterDeleteError((e) => {
    // e.app
    // e.model
    // e.error

    e.next()
})

// 仅对 "users" 和 "articles" 模型触发
onModelAfterDeleteError((e) => {
    // e.app
    // e.model
    // e.error

    e.next()
}, "users", "articles")
```
