# 渲染模板（JavaScript）

PocketBase 提供模板渲染功能，用于生成 HTML 内容。

## 基本用法

```javascript
const html = $app.renderTemplate("templates/welcome.html", {
    name: "John",
    link: "https://example.com/verify"
})
```

## 模板位置

模板从 `pb_public` 目录加载：

```
pb_public/
    templates/
        emails/
            welcome.html
        pages/
            landing.html
```

## 模板语法

模板使用 Go 的 `html/template` 语法：

```html
<!DOCTYPE html>
<html>
<head>
    <title>欢迎</title>
</head>
<body>
    <h1>你好，{{.name}}！</h1>
    <p>点击<a href="{{.link}}">这里</a>继续。</p>
    
    {{if .showFooter}}
    <footer>感谢加入！</footer>
    {{end}}
</body>
</html>
```

## 在路由中使用

```javascript
routerAdd("GET", "/welcome", (e) => {
    const html = $app.renderTemplate("templates/pages/welcome.html", {
        title: "Welcome",
        user: e.auth
    })
    
    return e.html(200, html)
})
```

## 用于邮件

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
