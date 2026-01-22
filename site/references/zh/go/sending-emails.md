# 发送邮件

PocketBase 提供辅助函数，通过配置的 SMTP 服务器发送邮件。

## 基本用法

```go
message := &mailer.Message{
    From: mail.Address{
        Name:    "Support",
        Address: "support@example.com",
    },
    To:      []mail.Address{{Address: "user@example.com"}},
    Subject: "Hello",
    HTML:    "<p>Hello World!</p>",
    Text:    "Hello World!",
}

if err := app.NewMailClient().Send(message); err != nil {
    return err
}
```

## 使用模板

你可以使用 Go 模板作为邮件内容：

```go
html, err := app.NewMailClient().RenderTemplate("emails/welcome.html", map[string]any{
    "name": "John",
    "link": "https://example.com/verify",
})
if err != nil {
    return err
}

message := &mailer.Message{
    From:    mail.Address{Address: "support@example.com"},
    To:      []mail.Address{{Address: "user@example.com"}},
    Subject: "Welcome!",
    HTML:    html,
}

return app.NewMailClient().Send(message)
```

## 附件

```go
message := &mailer.Message{
    From:    mail.Address{Address: "support@example.com"},
    To:      []mail.Address{{Address: "user@example.com"}},
    Subject: "Report",
    HTML:    "<p>Please find the report attached.</p>",
    Attachments: map[string]io.Reader{
        "report.pdf": bytes.NewReader(pdfData),
    },
}

return app.NewMailClient().Send(message)
```

## SMTP 配置

SMTP 设置可以从仪表板的"设置 > 邮件设置"中配置，或以编程方式配置：

```go
settings := app.Settings()
settings.SMTP.Enabled = true
settings.SMTP.Host = "smtp.example.com"
settings.SMTP.Port = 587
settings.SMTP.Username = "user"
settings.SMTP.Password = "pass"
settings.SMTP.TLS = true

if err := app.Save(settings); err != nil {
    return err
}
```
