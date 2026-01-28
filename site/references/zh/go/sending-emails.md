# 发送邮件

PocketBase 通过 `app.NewMailClient()` 工厂提供了一个简单的邮件发送抽象。

根据你配置的邮件设置（*Dashboard > Settings > Mail settings*），它将使用 `sendmail` 命令或 SMTP 客户端。

[[toc]]

## 发送自定义邮件

你可以在应用的任何地方（钩子、中间件、路由等）使用 `app.NewMailClient().Send(message)` 发送自定义邮件。以下是用户注册后发送自定义邮件的示例：

```go
// main.go
package main

import (
    "log"
    "net/mail"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/mailer"
)

func main() {
    app := pocketbase.New()

    app.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        message := &mailer.Message{
            From: mail.Address{
                Address: e.App.Settings().Meta.SenderAddress,
                Name:    e.App.Settings().Meta.SenderName,
            },
            To:      []mail.Address{{Address: e.Record.Email()}},
            Subject: "YOUR_SUBJECT...",
            HTML:    "YOUR_HTML_BODY...",
            // 也支持 bcc、cc、附件和自定义头...
        }

        return e.App.NewMailClient().Send(message)
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 覆盖系统邮件

如果你想覆盖默认的系统邮件（忘记密码、验证等），可以在 *Dashboard > Collections > Edit collection > Options* 中调整默认模板。

或者，你也可以通过绑定到[邮件钩子](/docs/go-event-hooks/#mailer-hooks)之一来应用单独的更改。以下是使用 `OnMailerRecordPasswordResetSend` 钩子将记录字段值追加到主题的示例：

```go
// main.go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordPasswordResetSend("users").BindFunc(func(e *core.MailerRecordEvent) error {
        // 修改主题
        e.Message.Subject += (" " + e.Record.GetString("name"))

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```
