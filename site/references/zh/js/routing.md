# 路由（JavaScript）

你可以使用 `routerAdd` 函数在 JavaScript 中注册自定义路由。

## 注册路由

```javascript
// 简单 GET 路由
routerAdd("GET", "/hello", (e) => {
    return e.string(200, "Hello World!")
})

// 带路径参数的路由
routerAdd("GET", "/hello/{name}", (e) => {
    const name = e.request.pathValue("name")
    return e.string(200, `Hello ${name}!`)
})

// 返回 JSON 的 POST 路由
routerAdd("POST", "/api/myapp/data", (e) => {
    return e.json(200, { success: true, message: "Data received" })
})
```

## HTTP 方法

```javascript
routerAdd("GET", "/path", handler)
routerAdd("POST", "/path", handler)
routerAdd("PUT", "/path", handler)
routerAdd("PATCH", "/path", handler)
routerAdd("DELETE", "/path", handler)
```

## 路径参数

```javascript
routerAdd("GET", "/users/{id}", (e) => {
    const id = e.request.pathValue("id")
    return e.json(200, { userId: id })
})

// 通配符参数
routerAdd("GET", "/files/{path...}", (e) => {
    const path = e.request.pathValue("path")
    return e.string(200, `File path: ${path}`)
})
```

## 请求数据

```javascript
routerAdd("POST", "/api/myapp/submit", (e) => {
    // 获取 JSON 主体
    const data = e.requestInfo().body
    
    // 获取查询参数
    const query = e.request.url.query()
    const page = query.get("page")
    
    // 获取请求头
    const authHeader = e.request.header.get("Authorization")
    
    return e.json(200, { received: data })
})
```

## 响应辅助函数

```javascript
// JSON 响应
e.json(200, { key: "value" })

// 字符串响应
e.string(200, "Hello")

// HTML 响应
e.html(200, "<h1>Hello</h1>")

// 无内容
e.noContent(204)

// 重定向
e.redirect(302, "/new-location")
```

## 中间件

```javascript
// 带认证中间件的路由
routerAdd("GET", "/api/myapp/protected", (e) => {
    return e.json(200, { user: e.auth.id })
}, $apis.requireAuth())

// 需要超级用户的路由
routerAdd("GET", "/api/myapp/admin", (e) => {
    return e.json(200, { admin: true })
}, $apis.requireSuperuserAuth())
```

## 错误处理

```javascript
routerAdd("GET", "/api/myapp/data", (e) => {
    try {
        // 你的逻辑
        return e.json(200, { success: true })
    } catch (err) {
        return e.json(500, { error: err.message })
    }
})

// 使用内置错误类型
routerAdd("GET", "/api/myapp/item/{id}", (e) => {
    const id = e.request.pathValue("id")
    
    const record = $app.findRecordById("items", id)
    if (!record) {
        throw new NotFoundError("Item not found")
    }
    
    return e.json(200, record)
})
```
