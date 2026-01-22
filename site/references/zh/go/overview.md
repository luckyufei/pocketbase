# Go SDK 概述

## 入门指南

PocketBase 可以作为常规 Go 包使用，它暴露了各种辅助函数和钩子，帮助你实现自己的自定义便携式应用程序。

新的 PocketBase 实例通过 `pocketbase.New()` 或 `pocketbase.NewWithConfig(config)` 创建。

创建后，你可以通过可用的[事件钩子](/zh/go/event-hooks)注册自定义业务逻辑，然后调用 `app.Start()` 启动应用程序。

以下是一个最小示例：

0. [安装 Go 1.23+](https://go.dev/doc/install)

1. 创建一个新的项目目录，并在其中创建 `main.go` 文件。

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
        // 从提供的 public 目录提供静态文件（如果存在）
        se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

2. 初始化依赖，运行 `go mod init myapp && go mod tidy`。
3. 启动应用程序，运行 `go run . serve`。
4. 构建静态链接的可执行文件，运行 `go build`，然后你可以用 `./myapp serve` 启动创建的可执行文件。

## 插件导入

当将 PocketBase 作为库使用时，插件**不会自动导入**。上面的最小示例仅提供核心 REST API 和管理界面功能。要获得与预构建 PocketBase 二进制文件等效的功能，你需要显式导入并注册你想使用的插件。

### 可用插件

| 插件 | 导入路径 | 用途 |
|--------|-------------|---------|
| **jsvm** | `github.com/pocketbase/pocketbase/plugins/jsvm` | 用于钩子和迁移的 JavaScript/TypeScript 运行时 |
| **migratecmd** | `github.com/pocketbase/pocketbase/plugins/migratecmd` | CLI 迁移命令和自动迁移支持 |
| **tofauth** | `github.com/pocketbase/pocketbase/plugins/tofauth` | 腾讯开放框架认证 |
| **ghupdate** | `github.com/pocketbase/pocketbase/plugins/ghupdate` | 基于 GitHub 的自动更新功能 |

### 系统迁移

此外，你需要导入系统迁移以创建内置系统表：

```go
import _ "github.com/pocketbase/pocketbase/migrations"
```

这会创建系统表，如 `_jobs`、`_secrets`、`_kv` 等。

### 完整功能示例

以下是包含最常用插件的示例：

```go
package main

import (
    "log"
    "os"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    
    // 插件导入
    "github.com/pocketbase/pocketbase/plugins/jsvm"
    "github.com/pocketbase/pocketbase/plugins/migratecmd"
    "github.com/pocketbase/pocketbase/plugins/tofauth"
    
    // 系统迁移（创建 _jobs、_secrets、_kv 表）
    _ "github.com/pocketbase/pocketbase/migrations"
)

func main() {
    app := pocketbase.New()

    // 注册 JavaScript VM 插件
    jsvm.MustRegister(app, jsvm.Config{
        MigrationsDir: "./pb_migrations",
        HooksDir:      "./pb_hooks",
    })

    // 注册迁移命令
    migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
        TemplateLang: migratecmd.TemplateLangJS,
        Automigrate:  true,
    })

    // 注册 TOF 认证（如果已配置）
    if os.Getenv("TOF_APP_TOKEN") != "" {
        tofauth.MustRegister(app, tofauth.Config{
            SafeMode:       tofauth.Bool(true),
            CheckTimestamp: tofauth.Bool(true),
        })
    }

    // 你的自定义路由
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

### 插件选择指南

根据你的需求选择插件：

- **最小设置**：无需额外导入（仅核心 PocketBase）
- **JavaScript 开发**：导入 `jsvm` + `migrations`
- **完整 CLI 体验**：导入 `jsvm` + `migratecmd` + `migrations`
- **企业级认证**：添加 `tofauth` 用于腾讯 SSO 集成
- **自动更新**：添加 `ghupdate` 用于基于 GitHub 的更新

## 自定义 SQLite 驱动

::: info
**一般建议使用内置的 SQLite 设置**，但如果你需要更高级的配置或扩展（如 ICU、FTS5 等），你需要指定自定义驱动/构建。

请注意，PocketBase 默认不需要 CGO，因为它使用纯 Go SQLite 移植 [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite)，但使用自定义 SQLite 驱动时可能不是这样！
:::

PocketBase v0.23+ 添加了支持在应用配置中定义 `DBConnect` 函数，以加载与标准 Go `database/sql` 兼容的自定义 SQLite 构建和驱动。

**`DBConnect` 函数被调用两次** - 第一次用于 `pb_data/data.db`（主数据库文件），第二次用于 `pb_data/auxiliary.db`（用于日志和其他临时系统元信息）。

如果你想有条件地加载自定义驱动并回退到默认处理程序，可以调用 `core.DefaultDBConnect`。

::: tip
附带说明，如果你不打算使用 `core.DefaultDBConnect` 回退作为自定义驱动注册的一部分，可以使用 `go build -tags no_default_driver` 排除默认的纯 Go 驱动，以稍微减少二进制大小（约 4MB）。
:::
