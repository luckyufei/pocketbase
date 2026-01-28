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

## 自定义 SQLite 驱动

::: info
**一般建议使用内置的 SQLite 设置**，但如果你需要更高级的配置或扩展（如 ICU、FTS5 等），你需要指定自定义驱动/构建。

请注意，PocketBase 默认不需要 CGO，因为它使用纯 Go SQLite 移植 [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite)，但使用自定义 SQLite 驱动时可能不是这样！
:::

PocketBase v0.23+ 添加了支持在应用配置中定义 `DBConnect` 函数，以加载与标准 Go `database/sql` 兼容的自定义 SQLite 构建和驱动。

**`DBConnect` 函数被调用两次** - 第一次用于 `pb_data/data.db`（主数据库文件），第二次用于 `pb_data/auxiliary.db`（用于日志和其他临时系统元信息）。

如果你想有条件地加载自定义驱动并回退到默认处理程序，可以调用 [`core.DefaultDBConnect`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#DefaultDBConnect)。

*附带说明，如果你不打算使用 `core.DefaultDBConnect` 回退作为自定义驱动注册的一部分，可以使用 `go build -tags no_default_driver` 排除默认的纯 Go 驱动，以稍微减少二进制大小（约 4MB）。*

以下是一些常用外部 SQLite 驱动的最小示例：

### github.com/mattn/go-sqlite3

这是一个 CGO 驱动，需要使用 `CGO_ENABLED=1` 构建你的应用程序。

*所有可用选项请参阅 [`github.com/mattn/go-sqlite3`](https://github.com/mattn/go-sqlite3) README。*

```go
package main

import (
    "database/sql"
    "log"

    "github.com/mattn/go-sqlite3"
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase"
)

// 注册一个新的驱动，包含默认的 PRAGMAs，
// 并使用与现有 sqlite3 相同的查询构建器实现
func init() {
    // 为每个新连接初始化默认 PRAGMAs
    sql.Register("pb_sqlite3", &sqlite3.SQLiteDriver{
        ConnectHook: func(conn *sqlite3.SQLiteConn) error {
            _, err := conn.Exec(`
                PRAGMA busy_timeout       = 10000;
                PRAGMA journal_mode       = WAL;
                PRAGMA journal_size_limit = 200000000;
                PRAGMA synchronous        = NORMAL;
                PRAGMA foreign_keys       = ON;
                PRAGMA temp_store         = MEMORY;
                PRAGMA cache_size         = -32000;
            `, nil)
            return err
        },
    })

    dbx.BuilderFuncMap["pb_sqlite3"] = dbx.BuilderFuncMap["sqlite3"]
}

func main() {
    app := pocketbase.NewWithConfig(pocketbase.Config{
        DBConnect: func(dbPath string) (*dbx.DB, error) {
            return dbx.Open("pb_sqlite3", dbPath)
        },
    })

    // 自定义钩子和插件...

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### github.com/ncruces/go-sqlite3

*所有可用选项请参阅 [`github.com/ncruces/go-sqlite3`](https://github.com/ncruces/go-sqlite3) README。*

```go
package main

import (
    "log"

    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase"
    _ "github.com/ncruces/go-sqlite3/driver"
    _ "github.com/ncruces/go-sqlite3/embed"
)

func main() {
    app := pocketbase.NewWithConfig(pocketbase.Config{
        DBConnect: func(dbPath string) (*dbx.DB, error) {
            const pragmas = "?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=journal_size_limit(200000000)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)&_pragma=temp_store(MEMORY)&_pragma=cache_size(-32000)"
            return dbx.Open("sqlite3", "file:"+dbPath+pragmas)
        },
    })

    // 自定义钩子和插件...

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```
