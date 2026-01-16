# Rendering Templates

PocketBase provides template rendering capabilities for generating HTML content.

## Basic usage

```go
html, err := app.RenderTemplate("emails/welcome.html", map[string]any{
    "name": "John",
    "link": "https://example.com/verify",
})
```

## Template location

Templates are loaded from the `pb_public` directory by default. You can organize them in subdirectories:

```
pb_public/
    templates/
        emails/
            welcome.html
            reset-password.html
        pages/
            landing.html
```

## Template syntax

PocketBase uses Go's `html/template` package. Here's an example template:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Welcome</title>
</head>
<body>
    <h1>Hello, {{.name}}!</h1>
    <p>Click <a href="{{.link}}">here</a> to verify your email.</p>
    
    {{if .showFooter}}
    <footer>
        <p>Thanks for joining!</p>
    </footer>
    {{end}}
</body>
</html>
```

## Using in routes

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

## Custom template functions

You can register custom template functions:

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // Add custom functions to templates
    // This requires extending the template engine
    return e.Next()
})
```

## Best practices

1. **Escape user input** - Always escape user-provided data to prevent XSS attacks.

2. **Use partials** - Break large templates into smaller, reusable partials.

3. **Cache templates** - Templates are cached by default for performance.

4. **Validate data** - Validate template data before rendering.
