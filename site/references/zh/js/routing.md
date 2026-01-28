# 路由

你可以使用顶层函数 [`routerAdd()`](/jsvm/functions/routerAdd.html) 和 [`routerUse()`](/jsvm/functions/routerUse.html) 注册自定义路由和中间件。

## 路由

### 注册新路由

每个路由都有路径、处理函数以及最终附加的中间件。例如：

```javascript
// 注册 "GET /hello/{name}" 路由（允许所有人访问）
routerAdd("GET", "/hello/{name}", (e) => {
    let name = e.request.pathValue("name")

    return e.json(200, { "message": "Hello " + name })
})

// 注册 "POST /api/myapp/settings" 路由（仅允许已认证用户访问）
routerAdd("POST", "/api/myapp/settings", (e) => {
    // 执行某些操作 ...
    return e.json(200, {"success": true})
}, $apis.requireAuth())
```

### 路径参数和匹配规则

由于 PocketBase 路由基于 Go 标准路由器 mux，我们遵循相同的模式匹配规则。以下是简要概述，更多详情请参阅 [`net/http.ServeMux`](https://pkg.go.dev/net/http#ServeMux)。

一般来说，路由模式看起来像 `[METHOD ][HOST]/[PATH]`。

路由路径可以包含 `{paramName}` 格式的参数。你也可以使用 `{paramName...}` 格式来指定匹配多个路径段的参数。

**以尾随斜杠 `/` 结尾的模式充当匿名通配符，匹配以定义路由开头的任何请求。** 如果你想有尾随斜杠但表示 URL 的结尾，则需要使用特殊的 `{$}` 参数结束路径。

::: info
如果你的路由路径以 `/api/` 开头，建议将其与你的唯一应用名称组合，如 `/api/myapp/...`，以避免与系统路由冲突。
:::

以下是一些示例：

```javascript
// 匹配 "GET example.com/index.html"
routerAdd("GET", "example.com/index.html", ...)

// 匹配 "GET /index.html"（任何主机）
routerAdd("GET", "/index.html", ...)

// 匹配 "GET /static/"、"GET /static/a/b/c" 等
routerAdd("GET", "/static/", ...)

// 匹配 "GET /static/"、"GET /static/a/b/c" 等
// （与上面类似，但使用命名通配符参数）
routerAdd("GET", "/static/{path...}", ...)

// 仅匹配 "GET /static/"（如果未注册 "/static"，则 301 重定向）
routerAdd("GET", "/static/{$}", ...)

// 匹配 "GET /customers/john"、"GET /customers/jane" 等
routerAdd("GET", "/customers/{name}", ...)
```

---

*在以下示例中，`e` 通常是 [`core.RequestEvent`](/jsvm/interfaces/core.RequestEvent.html) 值。*

---

### 读取路径参数

```javascript
let id = e.request.pathValue("id")
```

### 获取当前认证状态

请求认证状态可以通过 `RequestEvent.auth` 字段访问（或设置）。

```javascript
let authRecord = e.auth

let isGuest = !e.auth

// 等同于 "e.auth?.isSuperuser()"
let isSuperuser = e.hasSuperuserAuth()
```

或者你也可以从汇总的请求信息实例访问请求数据 *（通常用于像 `onRecordEnrich` 这样没有直接访问请求的钩子中）*。

```javascript
let info = e.requestInfo()

let authRecord = info.auth

let isGuest = !info.auth

// 等同于 "info.auth?.isSuperuser()"
let isSuperuser = info.hasSuperuserAuth()
```

### 读取查询参数

```javascript
// 获取 "search" 查询参数的第一个值
let search = e.request.url.query().get("search")

// 或通过解析后的请求信息
let search = e.requestInfo().query["search"]

// 处理数组查询参数（例如 search=123&search=456）
let query = JSON.parse(toString(e.request.url.query())) || {};
let arr = query.search; // ["123", "456"]
```

### 读取请求头

```javascript
let token = e.request.header.get("Some-Header")

// 或通过解析后的请求信息
// （头值总是按 @request.headers.* API 规则格式规范化）
let token = e.requestInfo().headers["some_header"]
```

### 写入响应头

```javascript
e.response.header().set("Some-Header", "123")
```

### 获取上传的文件

```javascript
// 获取上传的文件并将找到的 multipart 数据解析为可直接使用的 []*filesystem.File
let files = e.findUploadedFiles("document")

// 或获取原始的单个 multipart/form-data 文件和头
let [mf, mh] = e.request.formFile("document")
```

### 读取请求体

请求体参数可以通过 [`e.bindBody`](/jsvm/interfaces/core.RequestEvent.html#bindBody) 或解析后的请求信息读取。

```javascript
// 获取整个原始请求体作为字符串
console.log(toString(e.request.body))

// 通过解析后的请求对象读取请求体字段
let body = e.requestInfo().body
console.log(body.title)

// 或将请求体字段读取/扫描到类型化对象中
const data = new DynamicModel({
    // 描述要读取的字段（也用作初始值）
    someTextField:   "",
    someIntValue:    0,
    someFloatValue:  -0,
    someBoolField:   false,
    someArrayField:  [],
    someObjectField: {}, // 对象属性可通过 .get(key) 访问
})
e.bindBody(data)
console.log(data.sometextField)
```

### 写入响应体

```javascript
// 发送带有 JSON 请求体的响应
// （如果设置了 "fields" 查询参数，它还提供通用的响应字段选择器/过滤器）
e.json(200, {"name": "John"})

// 发送带有字符串请求体的响应
e.string(200, "Lorem ipsum...")

// 发送带有 HTML 请求体的响应
// （也请查看"渲染模板"部分）
e.html(200, "<h1>Hello!</h1>")

// 重定向
e.redirect(307, "https://example.com")

// 发送无请求体的响应
e.noContent(204)

// 服务单个文件
e.fileFS($os.dirFS("..."), "example.txt")

// 流式传输指定的读取器
e.stream(200, "application/octet-stream", reader)

// 发送带有 blob（字节数组）请求体的响应
e.blob(200, "application/octet-stream", [ ... ])
```

### 读取客户端 IP

```javascript
// 最后连接到服务器的客户端 IP。
// 返回的 IP 是安全的，始终可以信任。
// 当位于反向代理（如 nginx）后面时，此方法返回代理的 IP。
// (/jsvm/interfaces/core.RequestEvent.html#remoteIP)
let ip = e.remoteIP()

// 基于配置的 Settings.trustedProxy 头的客户端"真实" IP。
// 如果未设置此类头，则回退到 e.remoteIP()。
// (/jsvm/interfaces/core.RequestEvent.html#realIP)
let ip = e.realIP()
```

### 请求存储

`core.RequestEvent` 带有一个本地存储，你可以用它在[中间件](#中间件)和路由操作之间共享自定义数据。

```javascript
// 在请求期间存储
e.set("someKey", 123)

// 稍后获取
let val = e.get("someKey") // 123
```

## 中间件

中间件允许检查、拦截和过滤路由请求。

中间件可以注册到单个路由（通过在处理程序后传递它们）和全局（通常使用 `routerUse(middleware)`）。

### 注册中间件

以下是全局中间件的最小示例：

```javascript
// 注册全局中间件
routerUse((e) => {
    if (e.request.header.get("Something") == "") {
        throw new BadRequestError("Something 头值缺失！")
    }

    return e.next()
})
```

中间件可以注册为简单函数（`function(e){}`），或者如果你想指定自定义优先级和 ID，可以注册为 [`Middleware`](/jsvm/classes/Middleware.html) 类实例。

以下是一个稍微高级的示例，展示了所有选项和执行顺序：

```javascript
// 附加全局中间件
routerUse((e) => {
    console.log(1)
    return e.next()
})

// 附加带有自定义优先级的全局中间件
routerUse(new Middleware((e) => {
  console.log(2)
  return e.next()
}, -1))

// 附加中间件到单个路由
//
// "GET /hello" 应该打印顺序：2,1,3,4
routerAdd("GET", "/hello", (e) => {
    console.log(4)
    return e.string(200, "Hello!")
}, (e) => {
    console.log(3)
    return e.next()
})
```

### 内置中间件

全局 [`$apis.*`](/jsvm/modules/_apis.html) 对象暴露了几个你可以在应用中使用的中间件。

```javascript
// 要求请求客户端未认证（即访客）。
$apis.requireGuestOnly()

// 要求请求客户端已认证
// （可选地指定允许的认证集合名称列表，默认为任意）。
$apis.requireAuth(optCollectionNames...)

// 要求请求客户端以超级用户身份认证
// （这是 $apis.requireAuth("_superusers") 的别名）。
$apis.requireSuperuserAuth()

// 要求请求客户端以超级用户身份认证或
// 常规认证记录的 id 匹配指定的路由参数（默认为 "id"）。
$apis.requireSuperuserOrOwnerAuth(ownerIdParam)

// 更改全局 32MB 默认请求体大小限制（设置为 0 表示无限制）。
// 请注意，系统记录路由根据其集合字段类型有动态请求体大小限制。
$apis.bodyLimit(limitBytes)

// 使用 Gzip 压缩方案压缩 HTTP 响应。
$apis.gzip()

// 指示活动记录器仅记录失败/返回错误的请求。
$apis.skipSuccessActivityLog()
```

### 默认全局注册的中间件

以下列表主要对可能想要在默认全局中间件优先级之前/之后插入自己的自定义中间件的用户有用，例如：在速率限制器之前使用 `-1001` 注册自定义认证加载器，以便可以根据加载的认证状态正确应用速率限制。

所有 PocketBase 应用都默认注册了以下内部中间件（*按优先级排序*）：

- **WWW 重定向** (id: pbWWWRedirect, priority: -99999)
  - *如果请求主机与证书主机策略中的某个值匹配，则执行 www -> 非 www 重定向。*

- **CORS** (id: pbCors, priority: -1041)
  - *默认允许所有来源（PocketBase 是无状态的，不依赖 cookie），但可以通过 `--origins` 标志配置。*

- **活动记录器** (id: pbActivityLogger, priority: -1040)
  - *将请求信息保存到日志辅助数据库。*

- **自动 panic 恢复** (id: pbPanicRecover, priority: -1030)
  - *默认 panic 恢复处理程序。*

- **认证令牌加载器** (id: pbLoadAuthToken, priority: -1020)
  - *从 `Authorization` 头加载认证令牌并将相关认证记录填充到请求事件中（即 `e.auth`）。*

- **安全响应头** (id: pbSecurityHeaders, priority: -1010)
  - *向响应添加默认的常见安全头（`X-XSS-Protection`、`X-Content-Type-Options`、`X-Frame-Options`）（可以被其他中间件或路由操作覆盖）。*

- **速率限制** (id: pbRateLimit, priority: -1000)
  - *根据配置的应用设置限制客户端请求速率（如果未启用速率限制选项则不执行任何操作）。*

- **请求体限制** (id: pbBodyLimit, priority: -990)
  - *对所有自定义路由应用默认最大约 32MB 请求体限制（系统记录路由根据其集合字段类型有动态请求体大小限制）。可以通过简单地重新绑定 `$apis.bodyLimit(limitBytes)` 中间件在组/路由级别覆盖。*

## 错误响应

PocketBase 有一个全局错误处理程序，从路由或中间件返回或抛出的每个 `Error` 默认都会被安全地转换为通用 API 错误，以避免意外泄露敏感信息（原始错误只在 *Dashboard > Logs* 或 `--dev` 模式下可见）。

为了更容易返回格式化的 JSON 错误响应，PocketBase 提供了 `ApiError` 构造函数，可以直接实例化或使用内置工厂。`ApiError.data` 只有在是 `ValidationError` 项的映射时才会在响应中返回。

```javascript
// 使用自定义状态码和验证数据错误构造 ApiError
throw new ApiError(500, "出错了", {
    "title": new ValidationError("invalid_title", "无效或缺少标题"),
})

// 如果消息为空字符串，将设置默认消息
throw new BadRequestError(optMessage, optData)      // 400 ApiError
throw new UnauthorizedError(optMessage, optData)    // 401 ApiError
throw new ForbiddenError(optMessage, optData)       // 403 ApiError
throw new NotFoundError(optMessage, optData)        // 404 ApiError
throw new TooManyrequestsError(optMessage, optData) // 429 ApiError
throw new InternalServerError(optMessage, optData)  // 500 ApiError
```

## 辅助工具

### 提供静态目录

[`$apis.static()`](/jsvm/functions/_apis.static.html) 从 `fs.FS` 实例提供静态目录内容。

期望路由有一个 `{path...}` 通配符参数。

```javascript
// 从提供的目录提供静态文件（如果存在）
routerAdd("GET", "/{path...}", $apis.static($os.dirFS("/path/to/public"), false))
```

### 认证响应

[`$apis.recordAuthResponse()`](/jsvm/functions/_apis.recordAuthResponse.html) 将标准化的 JSON 记录认证响应（即令牌 + 记录数据）写入指定的请求体。可用作自定义认证路由的返回结果。

```javascript
routerAdd("POST", "/phone-login", (e) => {
    const data = new DynamicModel({
        phone:    "",
        password: "",
    })
    e.bindBody(data)

    let record = e.app.findFirstRecordByData("users", "phone", data.phone)
    if !record.validatePassword(data.password) {
        // 返回通用 400 错误作为基本的枚举保护
        throw new BadRequestError("凭据无效")
    }

    return $apis.recordAuthResponse(e, record, "phone")
})
```

### 丰富记录

[`$apis.enrichRecord()`](/jsvm/functions/_apis.enrichRecord.html) 和 [`$apis.enrichRecords()`](/jsvm/functions/_apis.enrichRecords.html) 辅助函数解析请求上下文并通过以下方式丰富提供的记录：

- 展开关系（如果设置了 `defaultExpands` 和/或 `?expand` 查询参数）
- 确保认证记录及其展开的认证关系的电子邮件仅对当前登录的超级用户、记录所有者或具有管理权限的记录可见

这些辅助函数还负责触发 `onRecordEnrich` 钩子事件。

```javascript
routerAdd("GET", "/custom-article", (e) => {
    let records = e.app.findRecordsByFilter("article", "status = 'active'", "-created", 40, 0)

    // 使用 "categories" 关系作为默认展开来丰富记录
    $apis.enrichRecords(e, records, "categories")

    return e.json(200, records)
})
```

## 使用 SDK 向自定义路由发送请求

官方 PocketBase SDK 暴露了内部 `send()` 方法，可用于向你的自定义路由发送请求。

::: code-group
```javascript [JavaScript]
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.send("/hello", {
    // 其他选项请查看
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
