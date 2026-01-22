# 发送邮件（JavaScript）

PocketBase 提供辅助函数，通过配置的 SMTP 服务器发送邮件。

## 基本用法

```javascript
const message = new MailerMessage({
    from: {
        name: "Support",
        address: "support@example.com"
    },
    to: [{ address: "user@example.com" }],
    subject: "Hello",
    html: "<p>Hello World!</p>",
    text: "Hello World!"
})

$app.newMailClient().send(message)
```

## 使用模板

```javascript
const html = $app.newMailClient().renderTemplate("emails/welcome.html", {
    name: "John",
    link: "https://example.com/verify"
})

const message = new MailerMessage({
    from: { address: "support@example.com" },
    to: [{ address: "user@example.com" }],
    subject: "Welcome!",
    html: html
})

$app.newMailClient().send(message)
```

## 发送给多个收件人

```javascript
const message = new MailerMessage({
    from: { address: "newsletter@example.com" },
    to: [
        { address: "user1@example.com" },
        { address: "user2@example.com" }
    ],
    bcc: [
        { address: "admin@example.com" }
    ],
    subject: "Newsletter",
    html: "<p>Monthly update...</p>"
})

$app.newMailClient().send(message)
```

## 错误处理

```javascript
try {
    $app.newMailClient().send(message)
    console.log("Email sent successfully")
} catch (err) {
    console.error("Failed to send email:", err.message)
}
```
