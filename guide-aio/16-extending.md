# 扩展开发

## Go 扩展

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 注册路由
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
            name := e.Request.PathValue("name")
            return e.String(200, "Hello "+name)
        })
        return se.Next()
    })

    // 注册钩子
    app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
        if !e.HasSuperuserAuth() {
            e.Record.Set("status", "pending")
        }
        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## JavaScript 扩展

```javascript
// pb_hooks/main.pb.js

// 注册路由
routerAdd("GET", "/hello/{name}", (e) => {
    let name = e.request.pathValue("name")
    return e.json(200, { message: "Hello " + name })
})

// 注册钩子
onRecordAfterUpdateSuccess((e) => {
    console.log("user updated...", e.record.get("email"))
    e.next()
}, "users")
```

## 路由与中间件

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 基本路由
    se.Router.GET("/hello/{name}", handler)

    // 带中间件
    se.Router.POST("/api/myapp/settings", handler).Bind(apis.RequireAuth())

    // 路由组
    g := se.Router.Group("/api/myapp")
    g.Bind(apis.RequireAuth())
    g.GET("/items", listItems)
    g.POST("/items", createItem)

    return se.Next()
})
```

## 内置中间件

| 中间件 | 描述 |
|--------|------|
| `RequireAuth()` | 要求认证用户 |
| `RequireSuperuserAuth()` | 要求超级用户 |
| `RequireSuperuserOrOwnerAuth(ownerIdParam)` | 超级用户或资源所有者 |
| `RequireGuestOnly()` | 仅允许未认证用户 |
| `Gzip()` | Gzip 压缩 |
| `BodyLimit(limit)` | 请求体大小限制 |

## 响应方法

```go
func handler(e *core.RequestEvent) error {
    // JSON 响应
    return e.JSON(200, map[string]any{"key": "value"})
    
    // 字符串响应
    return e.String(200, "Hello")
    
    // HTML 响应
    return e.HTML(200, "<h1>Hello</h1>")
    
    // 文件响应
    return e.FileFS(os.DirFS("./public"), "index.html")
    
    // 重定向
    return e.Redirect(302, "/new-path")
    
    // 无内容
    return e.NoContent(204)
}
```

## 请求信息

```go
func handler(e *core.RequestEvent) error {
    // 路径参数
    name := e.Request.PathValue("name")
    
    // 查询参数
    page := e.Request.URL.Query().Get("page")
    
    // 请求体
    var data MyStruct
    e.BindBody(&data)
    
    // 认证信息
    if e.Auth != nil {
        userId := e.Auth.Id
    }
    
    return e.JSON(200, data)
}
```
