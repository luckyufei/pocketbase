# Rendering Templates (JavaScript)

PocketBase provides template rendering capabilities for generating HTML content.

## Basic usage

```javascript
const html = $app.renderTemplate("templates/welcome.html", {
    name: "John",
    link: "https://example.com/verify"
})
```

## Template location

Templates are loaded from the `pb_public` directory:

```
pb_public/
    templates/
        emails/
            welcome.html
        pages/
            landing.html
```

## Template syntax

Templates use Go's `html/template` syntax:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Welcome</title>
</head>
<body>
    <h1>Hello, {{.name}}!</h1>
    <p>Click <a href="{{.link}}">here</a> to continue.</p>
    
    {{if .showFooter}}
    <footer>Thanks for joining!</footer>
    {{end}}
</body>
</html>
```

## Using in routes

```javascript
routerAdd("GET", "/welcome", (e) => {
    const html = $app.renderTemplate("templates/pages/welcome.html", {
        title: "Welcome",
        user: e.auth
    })
    
    return e.html(200, html)
})
```

## Using for emails

```javascript
const html = $app.renderTemplate("templates/emails/notification.html", {
    userName: "John",
    message: "You have a new message"
})

const message = new MailerMessage({
    from: { address: "noreply@example.com" },
    to: [{ address: "user@example.com" }],
    subject: "Notification",
    html: html
})

$app.newMailClient().send(message)
```
