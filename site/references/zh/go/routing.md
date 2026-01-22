# 路由

PocketBase 路由建立在标准 Go `net/http.ServeMux` 之上。可以通过 `app.OnServe()` 钩子访问路由器，允许你注册自定义端点和中间件。

## 路由

### 注册新路由

每个路由都有一个路径、处理函数，以及最终附加的中间件。例如：

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 注册 "GET /hello/{name}" 路由（允许所有人访问）
    se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
        name := e.Request.PathValue("name")

        return e.String(http.StatusOK, "Hello " + name)
    })

    // 注册 "POST /api/myapp/settings" 路由（仅允许已认证用户）
    se.Router.POST("/api/myapp/settings", func(e *core.RequestEvent) error {
        // 执行某些操作...
        return e.JSON(http.StatusOK, map[string]bool{"success": true})
    }).Bind(apis.RequireAuth())

    return se.Next()
})
```

有几种可用的路由注册方法：

```go
se.Router.GET(path, action)
se.Router.POST(path, action)
se.Router.PUT(path, action)
se.Router.PATCH(path, action)
se.Router.DELETE(path, action)

// 如果你想处理任何 HTTP 方法，只需定义路径（例如 "/example"）
// 或者如果你想指定自定义方法，将其作为前缀添加到路径（例如 "TRACE /example"）
se.Router.Any(pattern, action)
```

### 路由组

路由器还支持为共享相同基础路径和中间件的路由创建组：

```go
g := se.Router.Group("/api/myapp")

// 组中间件
g.Bind(apis.RequireAuth())

// 组路由
g.GET("", action1)
g.GET("/example/{id}", action2)
g.PATCH("/example/{id}", action3).BindFunc(
    /* 自定义路由特定中间件函数 */
)

// 嵌套组
sub := g.Group("/sub")
sub.GET("/sub1", action4)
```

这注册了：
- GET /api/myapp -> action1
- GET /api/myapp/example/{id} -> action2
- PATCH /api/myapp/example/{id} -> action3
- GET /api/myapp/example/sub/sub1 -> action4

### 路径参数

路由路径可以包含 `{paramName}` 格式的参数。你也可以使用 `{paramName...}` 格式指定针对多个路径段的参数。

::: info
如果你的路由路径以 `/api/` 开头，考虑将其与你的唯一应用名称组合，如 `/api/myapp/...`，以避免与系统路由冲突。
:::

示例：

```go
// 匹配 "GET example.com/index.html"
se.Router.GET("example.com/index.html")

// 匹配 "GET /index.html"（对于任何主机）
se.Router.GET("/index.html")

// 匹配 "GET /static/"、"GET /static/a/b/c" 等
se.Router.GET("/static/")

// 匹配 "GET /static/"、"GET /static/a/b/c" 等
// （与上面类似，但使用命名通配符参数）
se.Router.GET("/static/{path...}")

// 仅匹配 "GET /static/"（如果未注册 "/static"，将 301 重定向）
se.Router.GET("/static/{$}")

// 匹配 "GET /customers/john"、"GET /customers/jane" 等
se.Router.GET("/customers/{name}")
```

### 读取路径参数

```go
id := e.Request.PathValue("id")
```

### 获取当前认证状态

可以通过 `RequestEvent.Auth` 字段访问（或设置）请求的认证状态：

```go
authRecord := e.Auth

isGuest := e.Auth == nil

// 等同于 "e.Auth != nil && e.Auth.IsSuperuser()"
isSuperuser := e.HasSuperuserAuth()
```

## 响应辅助函数

```go
// 发送带有 JSON 主体的响应
e.JSON(status, data)

// 发送带有字符串主体的响应
e.String(status, str)

// 发送带有 HTML 主体的响应
e.HTML(status, html)

// 发送带有文件主体的响应
e.FileFS(fsys, filename)

// 重定向到 URL
e.Redirect(status, url)

// 发送无内容的响应
e.NoContent(status)
```

## 中间件

你可以使用 `Bind()` 和 `BindFunc()` 方法将中间件绑定到路由和组。

### 内置中间件

PocketBase 提供了几个内置中间件：

```go
// 要求请求具有有效的认证记录
apis.RequireAuth()

// 要求请求具有有效的超级用户认证
apis.RequireSuperuserAuth()

// 要求请求具有有效的超级用户或所有者认证
apis.RequireSuperuserOrOwnerAuth(ownerIdPathParam)

// 为响应启用 GZIP 压缩
apis.Gzip()

// 为请求设置活动日志记录器
apis.ActivityLogger(app)
```

### 自定义中间件

```go
se.Router.GET("/hello", action).BindFunc(func(e *core.RequestEvent) error {
    // 前置逻辑
    
    err := e.Next()
    
    // 后置逻辑
    
    return err
})
```
