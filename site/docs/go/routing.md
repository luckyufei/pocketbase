# Routing

PocketBase routing is built on top of the standard Go `net/http.ServeMux`. The router can be accessed via the `app.OnServe()` hook allowing you to register custom endpoints and middlewares.

## Routes

### Registering new routes

Every route has a path, handler function and eventually middlewares attached to it. For example:

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // register "GET /hello/{name}" route (allowed for everyone)
    se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
        name := e.Request.PathValue("name")

        return e.String(http.StatusOK, "Hello " + name)
    })

    // register "POST /api/myapp/settings" route (allowed only for authenticated users)
    se.Router.POST("/api/myapp/settings", func(e *core.RequestEvent) error {
        // do something ...
        return e.JSON(http.StatusOK, map[string]bool{"success": true})
    }).Bind(apis.RequireAuth())

    return se.Next()
})
```

There are several routes registration methods available:

```go
se.Router.GET(path, action)
se.Router.POST(path, action)
se.Router.PUT(path, action)
se.Router.PATCH(path, action)
se.Router.DELETE(path, action)

// If you want to handle any HTTP method define only a path (e.g. "/example")
// OR if you want to specify a custom one add it as prefix to the path (e.g. "TRACE /example")
se.Router.Any(pattern, action)
```

### Route groups

The router also supports creating groups for routes that share the same base path and middlewares:

```go
g := se.Router.Group("/api/myapp")

// group middleware
g.Bind(apis.RequireAuth())

// group routes
g.GET("", action1)
g.GET("/example/{id}", action2)
g.PATCH("/example/{id}", action3).BindFunc(
    /* custom route specific middleware func */
)

// nested group
sub := g.Group("/sub")
sub.GET("/sub1", action4)
```

This registers:
- GET /api/myapp -> action1
- GET /api/myapp/example/{id} -> action2
- PATCH /api/myapp/example/{id} -> action3
- GET /api/myapp/example/sub/sub1 -> action4

### Path parameters

Route paths can include parameters in the format `{paramName}`. You can also use `{paramName...}` format to specify a parameter that targets more than one path segment.

::: info
If your route path starts with `/api/` consider combining it with your unique app name like `/api/myapp/...` to avoid collisions with system routes.
:::

Examples:

```go
// match "GET example.com/index.html"
se.Router.GET("example.com/index.html")

// match "GET /index.html" (for any host)
se.Router.GET("/index.html")

// match "GET /static/", "GET /static/a/b/c", etc.
se.Router.GET("/static/")

// match "GET /static/", "GET /static/a/b/c", etc.
// (similar to the above but with a named wildcard parameter)
se.Router.GET("/static/{path...}")

// match only "GET /static/" (if no "/static" is registered, it is 301 redirected)
se.Router.GET("/static/{$}")

// match "GET /customers/john", "GET /customers/jane", etc.
se.Router.GET("/customers/{name}")
```

### Reading path parameters

```go
id := e.Request.PathValue("id")
```

### Retrieving the current auth state

The request auth state can be accessed (or set) via the `RequestEvent.Auth` field:

```go
authRecord := e.Auth

isGuest := e.Auth == nil

// the same as "e.Auth != nil && e.Auth.IsSuperuser()"
isSuperuser := e.HasSuperuserAuth()
```

## Response helpers

```go
// send response with JSON body
e.JSON(status, data)

// send response with string body
e.String(status, str)

// send response with HTML body
e.HTML(status, html)

// send response with file body
e.FileFS(fsys, filename)

// redirect to a URL
e.Redirect(status, url)

// send response with no content
e.NoContent(status)
```

## Middlewares

You can bind middlewares to routes and groups using `Bind()` and `BindFunc()` methods.

### Built-in middlewares

PocketBase provides several built-in middlewares:

```go
// Requires the request to have a valid auth record
apis.RequireAuth()

// Requires the request to have a valid superuser auth
apis.RequireSuperuserAuth()

// Requires the request to have a valid superuser OR owner auth
apis.RequireSuperuserOrOwnerAuth(ownerIdPathParam)

// Enables GZIP compression for the response
apis.Gzip()

// Sets the activity logger for the request
apis.ActivityLogger(app)
```

### Custom middleware

```go
se.Router.GET("/hello", action).BindFunc(func(e *core.RequestEvent) error {
    // before logic
    
    err := e.Next()
    
    // after logic
    
    return err
})
```
