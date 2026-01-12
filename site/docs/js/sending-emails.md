# Sending Emails (JavaScript)

PocketBase provides helpers for sending emails through the configured SMTP server.

## Basic usage

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

## Using templates

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

## Sending to multiple recipients

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

## Error handling

```javascript
try {
    $app.newMailClient().send(message)
    console.log("Email sent successfully")
} catch (err) {
    console.error("Failed to send email:", err.message)
}
```
