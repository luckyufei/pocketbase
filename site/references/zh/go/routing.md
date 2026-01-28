# 路由

PocketBase 路由建立在标准 Go [`net/http.ServeMux`](https://pkg.go.dev/net/http#ServeMux) 之上。可以通过 `app.OnServe()` 钩子访问路由器，允许你注册自定义端点和中间件。

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

有几种可用的路由注册方法，最常见的是：

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

路由器还支持为共享相同基础路径和中间件的路由创建组。例如：

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

此示例注册了以下端点（全部需要已认证用户访问）：
- GET /api/myapp -> action1
- GET /api/myapp/example/{id} -> action2
- PATCH /api/myapp/example/{id} -> action3
- GET /api/myapp/example/sub/sub1 -> action4

每个路由器组和路由都可以通过 `Bind/BindFunc` 方法以类似于常规应用钩子的方式定义[中间件](#中间件)，允许你执行各种前置或后置操作（例如检查请求头、自定义访问检查等）。

### 路径参数和匹配规则

因为 PocketBase 路由基于 Go 标准路由器 mux，我们遵循相同的模式匹配规则。以下是简短概述，更多详情请参阅 [`net/http.ServeMux`](https://pkg.go.dev/net/http#ServeMux)。

通常，路由模式看起来像 `[METHOD ][HOST]/[PATH]`（*使用指定的 `GET()`、`POST()` 等方法时，METHOD 前缀会自动添加*）。

路由路径可以包含 `{paramName}` 格式的参数。你也可以使用 `{paramName...}` 格式指定针对多个路径段的参数。

**以斜杠 `/` 结尾的模式充当匿名通配符，匹配任何以定义的路由开始的请求。** 如果你想有尾斜杠但要指示 URL 的结束，你需要用特殊的 `{$}` 参数结束路径。

::: info
如果你的路由路径以 `/api/` 开头，考虑将其与你的唯一应用名称组合，如 `/api/myapp/...`，以避免与系统路由冲突。
:::

以下是一些示例：

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

---

*在以下示例中，`e` 通常是 [`*core.RequestEvent`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#RequestEvent) 值。*

---

### 读取路径参数

```go
id := e.Request.PathValue("id")
```

### 获取当前认证状态

可以通过 `RequestEvent.Auth` 字段访问（或设置）请求的认证状态。

```go
authRecord := e.Auth

isGuest := e.Auth == nil

// 等同于 "e.Auth != nil && e.Auth.IsSuperuser()"
isSuperuser := e.HasSuperuserAuth()
```

或者，你也可以从汇总的请求信息实例访问请求数据（*通常用于像 `OnRecordEnrich` 这样的钩子中，无法直接访问请求*）。

```go
info, err := e.RequestInfo()

authRecord := info.Auth

isGuest := info.Auth == nil

// 等同于 "info.Auth != nil && info.Auth.IsSuperuser()"
isSuperuser := info.HasSuperuserAuth()
```

### 读取查询参数

```go
// 获取 "search" 查询参数的第一个值
search := e.Request.URL.Query().Get("search")

// 或通过解析的请求信息
info, err := e.RequestInfo()
search := info.Query["search"]

// 对于数组查询参数（例如 search=123&search=456）
arr := e.Request.URL.Query()["search"] // []string{"123", "456"}
```

### 读取请求头

```go
token := e.Request.Header.Get("Some-Header")

// 或通过解析的请求信息
// （头值始终按照 @request.headers.* API 规则格式进行规范化）
info, err := e.RequestInfo()
token := info.Headers["some_header"]
```

### 写入响应头

```go
e.Response.Header().Set("Some-Header", "123")
```

### 获取上传的文件

```go
// 获取上传的文件并将找到的 multipart 数据解析为可用的 []*filesystem.File
files, err := e.FindUploadedFiles("document")

// 或获取原始的单个 multipart/form-data 文件和头
mf, mh, err := e.Request.FormFile("document")
```

### 读取请求体

请求体参数可以通过 [`e.BindBody`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#Event.BindBody) 读取，或者通过解析的请求信息（*需要手动类型断言*）。

`e.BindBody` 参数必须是指向结构体或 `map[string]any` 的指针。支持以下结构体标签（*具体的绑定规则和使用哪个取决于请求的 Content-Type*）：

- `json`（json 主体）- 使用内置的 Go JSON 包进行反序列化。
- `xml`（xml 主体）- 使用内置的 Go XML 包进行反序列化。
- `form`（表单数据）- 使用自定义的 [`router.UnmarshalRequestData`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#UnmarshalRequestData) 方法。

**注意！绑定结构体时，确保它们没有不应该被绑定的公共字段，建议这些字段不导出或定义一个只包含安全可绑定字段的单独结构体。**

```go
// 将请求体字段读取/扫描到类型化结构体
data := struct {
    // 不导出以防止绑定
    somethingPrivate string

    Title       string `json:"title" form:"title"`
    Description string `json:"description" form:"description"`
    Active      bool   `json:"active" form:"active"`
}{}
if err := e.BindBody(&data); err != nil {
    return e.BadRequestError("读取请求数据失败", err)
}

// 或者，通过解析的请求信息读取主体
info, err := e.RequestInfo()
title, ok := info.Body["title"].(string)
```

### 写入响应体

*有关所有支持的方法，请参阅 [`router.Event`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#Event)。*

```go
// 发送带有 JSON 主体的响应
// （如果设置了 "fields" 查询参数，它还提供通用的响应字段选择器/过滤器）
e.JSON(http.StatusOK, map[string]any{"name": "John"})

// 发送带有字符串主体的响应
e.String(http.StatusOK, "Lorem ipsum...")

// 发送带有 HTML 主体的响应
// （另请参阅"渲染模板"部分）
e.HTML(http.StatusOK, "<h1>Hello!</h1>")

// 重定向
e.Redirect(http.StatusTemporaryRedirect, "https://example.com")

// 发送无主体的响应
e.NoContent(http.StatusNoContent)

// 提供单个文件
e.FileFS(os.DirFS("..."), "example.txt")

// 流式传输指定的 reader
e.Stream(http.StatusOK, "application/octet-stream", reader)

// 发送带有 blob（字节切片）主体的响应
e.Blob(http.StatusOK, "application/octet-stream", []byte{ ... })
```

### 读取客户端 IP

```go
// 最后连接到你服务器的客户端 IP。
// 返回的 IP 是安全的，可以始终信任。
// 在反向代理（如 nginx）后面时，此方法返回代理的 IP。
// https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#Event.RemoteIP
ip := e.RemoteIP()

// 基于配置的 Settings.TrustedProxy 头的客户端"真实"IP。
// 如果没有设置这些头，则回退到 e.RemoteIP()。
// https://pkg.go.dev/github.com/pocketbase/pocketbase/core#RequestEvent.RealIP
ip := e.RealIP()
```

### 请求存储

`core.RequestEvent` 带有一个本地存储，你可以使用它在[中间件](#中间件)和路由操作之间共享自定义数据。

```go
// 在请求期间存储
e.Set("someKey", 123)

// 稍后检索
val := e.Get("someKey").(int) // 123
```

## 中间件

### 注册中间件

中间件允许检查、拦截和过滤路由请求。

所有中间件函数与路由操作共享相同的签名（即 `func(e *core.RequestEvent) error`），但期望用户在想要继续执行链时调用 `e.Next()`。

中间件可以在*全局*、*组*和*路由*级别使用 `Bind` 和 `BindFunc` 方法注册。

以下是全局中间件的最小示例：

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 注册全局中间件
    se.Router.BindFunc(func(e *core.RequestEvent) error {
        if e.Request.Header.Get("Something") == "" {
            return e.BadRequestError("缺少 Something 头值！", nil)
        }
        return e.Next()
    })

    return se.Next()
})
```

[`RouterGroup.Bind(middlewares...)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#RouterGroup.Bind) / [`Route.Bind(middlewares...)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#Route.Bind) 注册一个或多个中间件处理器。与其他应用钩子类似，中间件处理器有 3 个字段：

- `Id`（*可选*）- 中间件的名称（可用作 `Unbind` 的参数）
- `Priority`（*可选*）- 中间件的执行顺序（如果为空，则回退到代码中的注册顺序）
- `Func`（*必需*）- 中间件处理函数

通常你不需要指定中间件的 `Id` 或 `Priority`，为方便起见，你可以直接使用 [`RouterGroup.BindFunc(funcs...)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#RouterGroup.BindFunc) / [`Route.BindFunc(funcs...)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#Route.BindFunc)。

以下是一个稍微高级的示例，展示所有选项和执行顺序（*2,0,1,3,4*）：

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 附加全局中间件
    se.Router.BindFunc(func(e *core.RequestEvent) error {
        println(0)
        return e.Next()
    })

    g := se.Router.Group("/sub")

    // 附加组中间件
    g.BindFunc(func(e *core.RequestEvent) error {
        println(1)
        return e.Next()
    })

    // 附加带有 id 和自定义优先级的组中间件
    g.Bind(&hook.Handler[*core.RequestEvent]{
        Id: "something",
        Func: func(e *core.RequestEvent) error {
            println(2)
            return e.Next()
        },
        Priority: -1,
    })

    // 附加中间件到单个路由
    //
    // "GET /sub/hello" 应该打印顺序：2,0,1,3,4
    g.GET("/hello", func(e *core.RequestEvent) error {
        println(4)
        return e.String(200, "Hello!")
    }).BindFunc(func(e *core.RequestEvent) error {
        println(3)
        return e.Next()
    })

    return se.Next()
})
```

### 移除中间件

要从特定组或路由的执行链中移除已注册的中间件，你可以使用 `Unbind(id)` 方法。

注意，只有具有非空 `Id` 的中间件才能被移除。

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 全局中间件
    se.Router.Bind(&hook.Handler[*core.RequestEvent]{
        Id: "test",
        Func: func(e *core.RequestEvent) error {
            // ...
            return e.Next()
        },
    })

    // "GET /A" 调用 "test" 中间件
    se.Router.GET("/A", func(e *core.RequestEvent) error {
        return e.String(200, "A")
    })

    // "GET /B" 不调用 "test" 中间件
    se.Router.GET("/B", func(e *core.RequestEvent) error {
        return e.String(200, "B")
    }).Unbind("test")

    return se.Next()
})
```

### 内置中间件

[`apis`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis) 包公开了几个可以作为应用程序一部分使用的中间件。

```go
// 要求请求客户端未认证（即访客）。
// 示例：Route.Bind(apis.RequireGuestOnly())
apis.RequireGuestOnly()

// 要求请求客户端已认证
// （可选地指定允许的认证集合名称列表，默认为任意）。
// 示例：Route.Bind(apis.RequireAuth())
apis.RequireAuth(optCollectionNames...)

// 要求请求客户端以超级用户身份认证
// （这是 apis.RequireAuth(core.CollectionNameSuperusers) 的别名）。
// 示例：Route.Bind(apis.RequireSuperuserAuth())
apis.RequireSuperuserAuth()

// 要求请求客户端以超级用户身份认证或
// 以 id 匹配指定路由参数的普通认证记录身份认证（默认为 "id"）。
// 示例：Route.Bind(apis.RequireSuperuserOrOwnerAuth(""))
apis.RequireSuperuserOrOwnerAuth(ownerIdParam)

// 更改全局默认的 32MB 请求体大小限制（设置为 0 表示无限制）。
// 注意，系统记录路由根据其集合字段类型有动态的体大小限制。
// 示例：Route.Bind(apis.BodyLimit(10 << 20))
apis.BodyLimit(limitBytes)

// 使用 Gzip 压缩方案压缩 HTTP 响应。
// 示例：Route.Bind(apis.Gzip())
apis.Gzip()

// 指示活动日志记录器仅记录失败/返回错误的请求。
// 示例：Route.Bind(apis.SkipSuccessActivityLog())
apis.SkipSuccessActivityLog()
```

### 默认全局注册的中间件

以下列表主要用于可能想要在默认全局中间件优先级之前/之后插入自己的自定义中间件的用户，例如：在速率限制器之前注册自定义认证加载器，使用 `apis.DefaultRateLimitMiddlewarePriority - 1`，以便可以根据加载的认证状态正确应用速率限制。

所有 PocketBase 应用程序默认注册了以下内部中间件（*按优先级排序*）：

- **WWW 重定向** (`apis.DefaultWWWRedirectMiddlewareId`, `apis.DefaultWWWRedirectMiddlewarePriority`)
  - *如果请求主机与证书主机策略中的值之一匹配，则执行 www -> 非 www 重定向。*

- **CORS** (`apis.DefaultCorsMiddlewareId`, `apis.DefaultCorsMiddlewarePriority`)
  - *默认允许所有来源（PocketBase 是无状态的，不依赖 cookies），可以使用 `--origins` 标志配置，但对于更高级的自定义，也可以通过绑定 `apis.CORS(config)` 中间件或在其位置注册你自己的自定义中间件来完全替换。*

- **活动日志记录器** (`apis.DefaultActivityLoggerMiddlewareId`, `apis.DefaultActivityLoggerMiddlewarePriority`)
  - *将请求信息保存到日志辅助数据库中。*

- **自动 panic 恢复** (`apis.DefaultPanicRecoverMiddlewareId`, `apis.DefaultPanicRecoverMiddlewarePriority`)
  - *默认的 panic 恢复处理器。*

- **认证令牌加载器** (`apis.DefaultLoadAuthTokenMiddlewareId`, `apis.DefaultLoadAuthTokenMiddlewarePriority`)
  - *从 `Authorization` 头加载认证令牌，并将相关的认证记录填充到请求事件中（即 `e.Auth`）。*

- **安全响应头** (`apis.DefaultSecurityHeadersMiddlewareId`, `apis.DefaultSecurityHeadersMiddlewarePriority`)
  - *向响应添加默认的常见安全头（`X-XSS-Protection`、`X-Content-Type-Options`、`X-Frame-Options`）（可以被其他中间件或从路由操作内部覆盖）。*

- **速率限制** (`apis.DefaultRateLimitMiddlewareId`, `apis.DefaultRateLimitMiddlewarePriority`)
  - *根据配置的应用设置对客户端请求进行速率限制（如果未启用速率限制选项，则不执行任何操作）。*

- **请求体限制** (`apis.DefaultBodyLimitMiddlewareId`, `apis.DefaultBodyLimitMiddlewarePriority`)
  - *为所有自定义路由应用默认的最大约 32MB 请求体限制（系统记录路由根据其集合字段类型有动态的体大小限制）。可以通过简单地重新绑定 `apis.BodyLimit(limitBytes)` 中间件在组/路由级别覆盖。*

## 错误响应

PocketBase 有一个全局错误处理器，路由或中间件返回的每个错误默认都会安全地转换为通用的 `ApiError`，以避免意外泄露敏感信息（原始的原始错误消息仅在 *Dashboard > Logs* 中可见或在 `--dev` 模式下）。

为了更容易返回格式化的 JSON 错误响应，请求事件提供了几个 `ApiError` 方法。注意，`ApiError.RawData()` 仅在它是 `router.SafeErrorItem`/`validation.Error` 项的映射时才会在响应中返回。

```go
import validation "github.com/go-ozzo/ozzo-validation/v4"

se.Router.GET("/example", func(e *core.RequestEvent) error {
    ...

    // 使用自定义状态码和验证数据错误构造 ApiError
    return e.Error(500, "出了点问题", map[string]validation.Error{
        "title": validation.NewError("invalid_title", "标题无效或缺失"),
    })

    // 如果消息是空字符串，将设置默认值
    return e.BadRequestError(optMessage, optData)      // 400 ApiError
    return e.UnauthorizedError(optMessage, optData)    // 401 ApiError
    return e.ForbiddenError(optMessage, optData)       // 403 ApiError
    return e.NotFoundError(optMessage, optData)        // 404 ApiError
    return e.TooManyRequestsError(optMessage, optData) // 429 ApiError
    return e.InternalServerError(optMessage, optData)  // 500 ApiError
})
```

这不太常见，但如果你想在请求相关处理器之外返回 `ApiError`，你可以使用以下 `apis.*` 工厂函数：

```go
import (
    validation "github.com/go-ozzo/ozzo-validation/v4"
    "github.com/pocketbase/pocketbase/apis"
)


app.OnRecordCreate().BindFunc(func(e *core.RecordEvent) error {
    ...

    // 使用自定义状态码和验证数据错误构造 ApiError
    return apis.NewApiError(500, "出了点问题", map[string]validation.Error{
        "title": validation.NewError("invalid_title", "标题无效或缺失"),
    })

    // 如果消息是空字符串，将设置默认值
    return apis.NewBadRequestError(optMessage, optData)      // 400 ApiError
    return apis.NewUnauthorizedError(optMessage, optData)    // 401 ApiError
    return apis.NewForbiddenError(optMessage, optData)       // 403 ApiError
    return apis.NewNotFoundError(optMessage, optData)        // 404 ApiError
    return apis.NewTooManyRequestsError(optMessage, optData) // 429 ApiError
    return apis.NewInternalServerError(optMessage, optData)  // 500 ApiError
})
```

## 辅助函数

### 提供静态目录

[`apis.Static()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis#Static) 从 `fs.FS` 实例提供静态目录内容。

期望路由具有 `{path...}` 通配符参数。

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 从提供的目录提供静态文件（如果存在）
    se.Router.GET("/{path...}", apis.Static(os.DirFS("/path/to/public"), false))

    return se.Next()
})
```

### 认证响应

[`apis.RecordAuthResponse()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis#RecordAuthResponse) 将标准化的 JSON 记录认证响应（即令牌 + 记录数据）写入指定的请求体。可用作自定义认证路由的返回结果。

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.POST("/phone-login", func(e *core.RequestEvent) error {
        data := struct {
            Phone    string `json:"phone" form:"phone"`
            Password string `json:"password" form:"password"`
        }{}
        if err := e.BindBody(&data); err != nil {
            return e.BadRequestError("读取请求数据失败", err)
        }

        record, err := e.App.FindFirstRecordByData("users", "phone", data.Phone)
        if err != nil || !record.ValidatePassword(data.Password) {
            // 返回通用 400 错误作为基本的枚举保护
            return e.BadRequestError("凭据无效", err)
        }

        return apis.RecordAuthResponse(e, record, "phone", nil)
    })

    return se.Next()
})
```

### 丰富记录

[`apis.EnrichRecord()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis#EnrichRecord) 和 [`apis.EnrichRecords()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis#EnrichRecords) 辅助函数解析请求上下文并通过以下方式丰富提供的记录：

- 展开关系（如果设置了 `defaultExpands` 和/或 `?expand` 查询参数）
- 确保认证记录及其展开的认证关系的电子邮件仅对当前登录的超级用户、记录所有者或具有管理访问权限的记录可见

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.GET("/custom-article", func(e *core.RequestEvent) error {
        records, err := e.App.FindRecordsByFilter("article", "status = 'active'", "-created", 40, 0)
        if err != nil {
            return e.NotFoundError("没有活跃的文章", err)
        }

        // 使用 "categories" 关系作为默认展开来丰富记录
        err = apis.EnrichRecords(e, records, "categories")
        if err != nil {
            return err
        }

        return e.JSON(http.StatusOK, records)
    })

    return se.Next()
})
```

### Go http.Handler 包装器

如果你想注册标准的 Go `http.Handler` 函数和中间件，你可以使用 [`apis.WrapStdHandler(handler)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis#WrapStdHandler) 和 [`apis.WrapStdMiddleware(func)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/apis#WrapStdMiddleware) 函数。

## 使用 SDK 向自定义路由发送请求

官方 PocketBase SDK 公开了内部的 `send()` 方法，可用于向你的自定义路由发送请求。

::: code-group
```javascript [JavaScript]
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.send("/hello", {
    // 有关其他选项，请查看
    // https://developer.mozilla.org/en-US/docs/Web/API/fetch#options
    query: { "abc": 123 },
});
```

```dart [Dart]
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.send("/hello", query: { "abc": 123 })
```
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

### 读取查询参数

```go
// 获取单个查询参数值
search := e.Request.URL.Query().Get("search")

// 获取查询参数的所有值
tags := e.Request.URL.Query()["tags"] // []string
```

### 读取请求头

```go
contentType := e.Request.Header.Get("Content-Type")
authorization := e.Request.Header.Get("Authorization")
```

### 读取请求体

你可以使用 `BindBody` 读取请求体并绑定到结构体：

```go
se.Router.POST("/api/myapp/data", func(e *core.RequestEvent) error {
    data := struct {
        Title   string `json:"title" form:"title"`
        Content string `json:"content" form:"content"`
    }{}

    if err := e.BindBody(&data); err != nil {
        return e.BadRequestError("解析请求体失败。", err)
    }

    // 使用 data.Title, data.Content ...
    
    return e.JSON(http.StatusOK, data)
})
```

### 获取当前认证状态

可以通过 `RequestEvent.Auth` 字段访问（或设置）请求的认证状态：

```go
authRecord := e.Auth

isGuest := e.Auth == nil

// 等同于 "e.Auth != nil && e.Auth.IsSuperuser()"
isSuperuser := e.HasSuperuserAuth()
```

### 获取客户端 IP 地址

```go
// 直接连接 IP
remoteIP := e.RemoteIP()

// 真实客户端 IP（尊重信任代理头）
realIP := e.RealIP()
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

## 错误处理

PocketBase 会自动将错误转换为安全的 JSON API 响应。在开发模式或日志中，会显示原始错误详情。

```go
// 错误请求 (400)
return e.BadRequestError("无效的输入", nil)

// 未授权 (401)
return e.UnauthorizedError("需要认证", nil)

// 禁止访问 (403)
return e.ForbiddenError("拒绝访问", nil)

// 未找到 (404)
return e.NotFoundError("资源未找到", nil)

// 内部服务器错误 (500)
return e.InternalServerError("发生了错误", nil)
```

### 自定义验证错误

```go
return e.Error(400, "验证失败", map[string]validation.Error{
    "title": validation.NewError("invalid_title", "标题是必填项"),
    "email": validation.NewError("invalid_email", "邮箱格式无效"),
})
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

// 限制请求体大小
apis.BodyLimit(maxBytes)

// 从文件系统提供静态文件
apis.Static(fsys, indexFallback)
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

### 全局中间件

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 为所有路由注册全局中间件
    se.Router.BindFunc(func(e *core.RequestEvent) error {
        // 记录所有请求
        fmt.Printf("%s %s\n", e.Request.Method, e.Request.URL.Path)
        return e.Next()
    })

    return se.Next()
})
```

### 移除中间件

只有使用 ID 注册的中间件才能被移除：

```go
// 使用 ID 注册中间件
se.Router.Bind(&hook.Handler{
    Id: "myMiddleware",
    Func: func(e *core.RequestEvent) error {
        // ...
        return e.Next()
    },
})

// 从特定路由移除中间件
route.Unbind("myMiddleware")
```

## 辅助工具

### 提供静态文件

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 从目录提供静态文件
    se.Router.GET("/static/{path...}", apis.Static(os.DirFS("/path/to/public"), false))

    return se.Next()
})
```

### 认证响应辅助函数

生成带有令牌的标准认证响应：

```go
// 认证成功后
apis.RecordAuthResponse(e, authRecord, "password", nil)
```

### 丰富记录

应用展开关系并遵守 API 规则可见性：

```go
// 在返回给客户端之前丰富记录
if err := apis.EnrichRecords(e, records, "user", "comments"); err != nil {
    return err
}
return e.JSON(http.StatusOK, records)
```
