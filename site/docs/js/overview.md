# JavaScript SDK Overview

## Getting started

PocketBase can be extended with JavaScript using the embedded JSVM (JavaScript Virtual Machine). This allows you to write custom business logic without needing to compile Go code.

JavaScript files are placed in the `pb_hooks` directory and are automatically loaded when PocketBase starts.

## Basic structure

Create a JavaScript file in `pb_hooks/`:

```javascript
// pb_hooks/main.pb.js

// Register a custom route
routerAdd("GET", "/hello/{name}", (e) => {
    const name = e.request.pathValue("name")
    return e.string(200, `Hello ${name}!`)
})

// Register an event hook
onRecordCreateRequest((e) => {
    // Custom logic before record creation
    e.next()
}, "posts")
```

## File naming

- Files must have the `.pb.js` extension
- Files are loaded in alphabetical order
- Use prefixes like `01_`, `02_` to control load order

## Hot reload

During development, PocketBase watches for changes in `pb_hooks/` and automatically reloads the JavaScript files.

::: tip
For production, consider using the `--hooksWatch=0` flag to disable file watching and improve performance.
:::

## JavaScript vs Go

| Feature | JavaScript | Go |
|---------|------------|-----|
| Setup | No compilation needed | Requires Go toolchain |
| Performance | Slight overhead | Native performance |
| Libraries | Limited to built-in | Full Go ecosystem |
| Type safety | Runtime checks | Compile-time checks |
| Hot reload | Automatic | Requires restart |

**Choose JavaScript if:**
- You want quick prototyping
- You don't need external Go libraries
- You prefer JavaScript syntax

**Choose Go if:**
- You need maximum performance
- You need external Go libraries
- You want compile-time type safety
