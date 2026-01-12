# Routing (JavaScript)

You can register custom routes in JavaScript using the `routerAdd` function.

## Registering routes

```javascript
// Simple GET route
routerAdd("GET", "/hello", (e) => {
    return e.string(200, "Hello World!")
})

// Route with path parameter
routerAdd("GET", "/hello/{name}", (e) => {
    const name = e.request.pathValue("name")
    return e.string(200, `Hello ${name}!`)
})

// POST route with JSON response
routerAdd("POST", "/api/myapp/data", (e) => {
    return e.json(200, { success: true, message: "Data received" })
})
```

## HTTP methods

```javascript
routerAdd("GET", "/path", handler)
routerAdd("POST", "/path", handler)
routerAdd("PUT", "/path", handler)
routerAdd("PATCH", "/path", handler)
routerAdd("DELETE", "/path", handler)
```

## Path parameters

```javascript
routerAdd("GET", "/users/{id}", (e) => {
    const id = e.request.pathValue("id")
    return e.json(200, { userId: id })
})

// Wildcard parameter
routerAdd("GET", "/files/{path...}", (e) => {
    const path = e.request.pathValue("path")
    return e.string(200, `File path: ${path}`)
})
```

## Request data

```javascript
routerAdd("POST", "/api/myapp/submit", (e) => {
    // Get JSON body
    const data = e.requestInfo().body
    
    // Get query parameters
    const query = e.request.url.query()
    const page = query.get("page")
    
    // Get headers
    const authHeader = e.request.header.get("Authorization")
    
    return e.json(200, { received: data })
})
```

## Response helpers

```javascript
// JSON response
e.json(200, { key: "value" })

// String response
e.string(200, "Hello")

// HTML response
e.html(200, "<h1>Hello</h1>")

// No content
e.noContent(204)

// Redirect
e.redirect(302, "/new-location")
```

## Middlewares

```javascript
// Route with authentication middleware
routerAdd("GET", "/api/myapp/protected", (e) => {
    return e.json(200, { user: e.auth.id })
}, $apis.requireAuth())

// Route requiring superuser
routerAdd("GET", "/api/myapp/admin", (e) => {
    return e.json(200, { admin: true })
}, $apis.requireSuperuserAuth())
```

## Error handling

```javascript
routerAdd("GET", "/api/myapp/data", (e) => {
    try {
        // your logic
        return e.json(200, { success: true })
    } catch (err) {
        return e.json(500, { error: err.message })
    }
})

// Using built-in error types
routerAdd("GET", "/api/myapp/item/{id}", (e) => {
    const id = e.request.pathValue("id")
    
    const record = $app.findRecordById("items", id)
    if (!record) {
        throw new NotFoundError("Item not found")
    }
    
    return e.json(200, record)
})
```
