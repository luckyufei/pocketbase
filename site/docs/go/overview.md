# Go SDK Overview

## Getting started

PocketBase can be used as regular Go package that exposes various helpers and hooks to help you implement your own custom portable application.

A new PocketBase instance is created via `pocketbase.New()` or `pocketbase.NewWithConfig(config)`.

Once created you can register your custom business logic via the available [event hooks](/go/event-hooks) and call `app.Start()` to start the application.

Below is a minimal example:

0. [Install Go 1.23+](https://go.dev/doc/install)

1. Create a new project directory with `main.go` file inside it.

```go
package main

import (
    "log"
    "os"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // serves static files from the provided public dir (if exists)
        se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

2. To init the dependencies, run `go mod init myapp && go mod tidy`.
3. To start the application, run `go run . serve`.
4. To build a statically linked executable, run `go build` and then you can start the created executable with `./myapp serve`.

## Custom SQLite driver

::: info
**The general recommendation is to use the builtin SQLite setup** but if you need more advanced configuration or extensions like ICU, FTS5, etc. you'll have to specify a custom driver/build.

Note that PocketBase by default doesn't require CGO because it uses the pure Go SQLite port [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite), but this may not be the case when using a custom SQLite driver!
:::

PocketBase v0.23+ added support for defining a `DBConnect` function as app configuration to load custom SQLite builds and drivers compatible with the standard Go `database/sql`.

**The `DBConnect` function is called twice** - once for `pb_data/data.db` (the main database file) and second time for `pb_data/auxiliary.db` (used for logs and other ephemeral system meta information).

If you want to load your custom driver conditionally and fallback to the default handler, then you can call `core.DefaultDBConnect`.

::: tip
As a side-note, if you are not planning to use `core.DefaultDBConnect` fallback as part of your custom driver registration you can exclude the default pure Go driver with `go build -tags no_default_driver` to reduce the binary size a little (~4MB).
:::
