# 渲染模板

PocketBase 提供模板渲染功能，用于生成 HTML 内容。

## 基本用法

```go
html, err := app.RenderTemplate("emails/welcome.html", map[string]any{
    "name": "John",
    "link": "https://example.com/verify",
})
```

## 模板位置

默认情况下，模板从 `pb_public` 目录加载。你可以将它们组织在子目录中：

```
pb_public/
    templates/
        emails/
            welcome.html
            reset-password.html
        pages/
            landing.html
```

## 模板语法

PocketBase 使用 Go 的 `html/template` 包。以下是一个示例模板：

```html
<!DOCTYPE html>
<html>
<head>
    <title>欢迎</title>
</head>
<body>
    <h1>你好，{{.name}}！</h1>
    <p>点击<a href="{{.link}}">这里</a>验证你的邮箱。</p>
    
    {{if .showFooter}}
    <footer>
        <p>感谢加入！</p>
    </footer>
    {{end}}
</body>
</html>
```

## 在路由中使用

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.GET("/welcome", func(e *core.RequestEvent) error {
        html, err := e.App.RenderTemplate("templates/pages/welcome.html", map[string]any{
            "title": "Welcome",
            "user":  e.Auth,
        })
        if err != nil {
            return err
        }
        
        return e.HTML(http.StatusOK, html)
    })
    
    return se.Next()
})
```

## 自定义模板函数

你可以注册自定义模板函数：

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // 向模板添加自定义函数
    // 这需要扩展模板引擎
    return e.Next()
})
```

## 最佳实践

1. **转义用户输入** - 始终转义用户提供的数据以防止 XSS 攻击。

2. **使用局部模板** - 将大型模板分解为更小、可重用的局部模板。

3. **缓存模板** - 默认情况下模板会被缓存以提高性能。

4. **验证数据** - 在渲染之前验证模板数据。
