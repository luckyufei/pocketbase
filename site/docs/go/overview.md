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

## Plugin Imports

When using PocketBase as a library, plugins are **not automatically imported**. The minimal example above provides only the core REST API and Admin UI functionality. To get features equivalent to the prebuilt PocketBase binary, you need to explicitly import and register the plugins you want to use.

### Available Plugins

| Plugin | Import Path | Purpose |
|--------|-------------|---------|
| **jsvm** | `github.com/pocketbase/pocketbase/plugins/jsvm` | JavaScript/TypeScript runtime for hooks and migrations |
| **migratecmd** | `github.com/pocketbase/pocketbase/plugins/migratecmd` | CLI migration commands and auto-migration support |
| **tofauth** | `github.com/pocketbase/pocketbase/plugins/tofauth` | Tencent Open Framework authentication |
| **ghupdate** | `github.com/pocketbase/pocketbase/plugins/ghupdate` | GitHub-based self-update functionality |

### System Migrations

Additionally, you need to import the system migrations to create built-in system tables:

```go
import _ "github.com/pocketbase/pocketbase/migrations"
```

This creates system tables like `_jobs`, `_secrets`, `_kv`, etc.

### Full-Featured Example

Here's an example that includes the most commonly used plugins:

```go
package main

import (
    "log"
    "os"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    
    // Plugin imports
    "github.com/pocketbase/pocketbase/plugins/jsvm"
    "github.com/pocketbase/pocketbase/plugins/migratecmd"
    "github.com/pocketbase/pocketbase/plugins/tofauth"
    
    // System migrations (creates _jobs, _secrets, _kv tables)
    _ "github.com/pocketbase/pocketbase/migrations"
)

func main() {
    app := pocketbase.New()

    // Register JavaScript VM plugin
    jsvm.MustRegister(app, jsvm.Config{
        MigrationsDir: "./pb_migrations",
        HooksDir:      "./pb_hooks",
    })

    // Register migration commands
    migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
        TemplateLang: migratecmd.TemplateLangJS,
        Automigrate:  true,
    })

    // Register TOF authentication (if configured)
    if os.Getenv("TOF_APP_TOKEN") != "" {
        tofauth.MustRegister(app, tofauth.Config{
            SafeMode:       tofauth.Bool(true),
            CheckTimestamp: tofauth.Bool(true),
        })
    }

    // Your custom routes
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/hello", func(re *core.RequestEvent) error {
            return re.String(200, "Hello world!")
        })
        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Plugin Selection Guide

Choose plugins based on your needs:

- **Minimal setup**: No additional imports (just core PocketBase)
- **JavaScript development**: Import `jsvm` + `migrations`
- **Full CLI experience**: Import `jsvm` + `migratecmd` + `migrations`
- **Enterprise auth**: Add `tofauth` for Tencent SSO integration
- **Auto-updates**: Add `ghupdate` for GitHub-based updates

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
