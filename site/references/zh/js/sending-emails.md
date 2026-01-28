# 发送邮件

PocketBase 通过 `$app.newMailClient()` 辅助函数提供了一个简单的邮件发送抽象。

根据你配置的邮件设置（*仪表盘 > 设置 > 邮件设置*），它将使用 `sendmail` 命令或 SMTP 客户端。

## 发送自定义邮件

你可以在应用的任何地方（钩子、中间件、路由等）使用 `$app.newMailClient().send(message)` 发送自定义邮件。以下是用户注册后发送自定义邮件的示例：

```javascript
onRecordCreateRequest((e) => {
    e.next()

    const message = new MailerMessage({
        from: {
            address: e.app.settings().meta.senderAddress,
            name:    e.app.settings().meta.senderName,
        },
        to:      [{address: e.record.email()}],
        subject: "YOUR_SUBJECT...",
        html:    "YOUR_HTML_BODY...",
        // 也支持 bcc、cc 和自定义头...
    })

    e.app.newMailClient().send(message)
}, "users")
```

## 覆盖系统邮件

如果你想覆盖默认的系统邮件（忘记密码、验证等），可以在 *仪表盘 > 集合 > 编辑集合 > 选项* 中调整默认模板。

或者，你也可以通过绑定到[邮件钩子](/docs/js-event-hooks/#mailer-hooks)之一来应用单独的更改。以下是使用 `onMailerRecordPasswordResetSend` 钩子将记录字段值追加到主题的示例：

```javascript
onMailerRecordPasswordResetSend((e) => {
    // 修改主题
    e.message.subject += (" " + e.record.get("name"))

    e.next()
})
```
