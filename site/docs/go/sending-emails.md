# Sending Emails

PocketBase provides helpers for sending emails through the configured SMTP server.

## Basic usage

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

## Using templates

You can use Go templates for email content:

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

## Attachments

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

## SMTP configuration

SMTP settings can be configured from the Dashboard under Settings > Mail settings, or programmatically:

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
