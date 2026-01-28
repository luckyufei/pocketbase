# 数据迁移

[[toc]]

PocketBase 内置了数据库和数据迁移工具，允许你对数据库结构进行版本控制、以编程方式创建集合、初始化默认设置等。

由于迁移是常规的 Go 函数，除了应用架构更改外，它们还可以用于调整现有数据以适应新架构，或运行任何只想执行一次的应用程序特定逻辑。

而且，由于是 `.go` 文件，迁移会无缝嵌入到最终的可执行文件中。

## 快速设置

### 0. 注册 migrate 命令

你可以在 `migratecmd` 子包中找到所有可用的配置选项。

预构建的可执行文件默认启用 `migrate` 命令，但当你使用 Go 扩展 PocketBase 时，需要手动启用：

```go
// main.go
package main

import (
    "log"
    "os"
    "strings"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/migratecmd"

    // 当你在 "migrations" 目录中至少有一个 .go 迁移文件时取消注释
    // _ "yourpackage/migrations"
)

func main() {
    app := pocketbase.New()

    // 简单检查是否使用 "go run" 执行
    isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())

    migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
        // 在管理界面更改集合时自动创建迁移文件
        // (isGoRun 检查是为了仅在开发期间启用)
        Automigrate: isGoRun,
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

上面的示例还展示了 `Automigrate` 配置选项，启用后会在管理界面中进行集合更改时自动为你创建 Go 迁移文件。

### 1. 创建新迁移

要创建新的空白迁移，可以运行 `migrate create`：

```bash
# 由于 "create" 命令只在开发期间有意义，
# 期望用户在应用工作目录中使用 "go run ..."

[root@dev app]$ go run . migrate create "your_new_migration"
```

```go
// migrations/1655834400_your_new_migration.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // 添加升级查询...

        return nil
    }, func(app core.App) error {
        // 添加降级查询...

        return nil
    })
}
```

上面将在默认命令 `migrations` 目录中创建一个新的空白迁移文件。

每个迁移文件应该有一个 `m.Register(upFunc, downFunc)` 调用。

在迁移文件中，你应该在 `upFunc` 回调中编写"升级"代码。
`downFunc` 是可选的，应该包含撤销 `upFunc` 所做更改的"降级"操作。
两个回调都接受一个事务性的 `core.App` 实例。

::: tip
你可以查阅[数据库指南](/docs/go-database/)、[集合操作](/docs/go-collections/)和[记录操作](/docs/go-records/)了解更多与数据库交互的详细信息。你还可以在本指南下方找到[一些示例](#示例)。
:::

### 2. 加载迁移

要让应用程序感知已注册的迁移，你需要在 `main` 包文件之一中导入上述 `migrations` 包：

```go
package main

import _ "yourpackage/migrations"

// ...
```

### 3. 运行迁移

新的未应用迁移会在应用服务器启动时自动执行，即 `serve` 时。

或者，你也可以通过运行 `migrate up` 手动应用新迁移。
要撤销最后应用的迁移，可以运行 `migrate down [number]`。

::: info
手动应用或撤销迁移时，需要重启 `serve` 进程以刷新其缓存的集合状态。
:::

## 集合快照

`migrate collections` 命令会生成当前集合配置的完整快照，无需手动输入。与 `migrate create` 命令类似，这将在 `migrations` 目录中生成一个新的迁移文件。

```bash
# 由于 "collections" 命令只在开发期间有意义，
# 期望用户在应用工作目录中使用 "go run"

[root@dev app]$ go run . migrate collections
```

默认情况下，集合快照以 **extend** 模式导入，这意味着快照中不存在的集合和字段将被保留。如果你希望快照删除缺失的集合和字段，可以编辑生成的文件并将 `ImportCollectionsByMarshaledJSON` 方法的最后一个参数更改为 `true`。

## 迁移历史

所有已应用的迁移文件名都存储在内部的 `_migrations` 表中。

在本地开发中，你可能经常会进行各种集合更改来测试不同的方法。
当启用 `Automigrate` 时，这可能导致迁移历史中包含不必要的中间步骤，这些在最终的迁移历史中可能不需要。

为了避免混乱并防止在生产环境中应用这些中间步骤，你可以手动删除（或合并）不必要的迁移文件，然后运行以下命令更新本地迁移历史：

```bash
[root@dev app]$ go run . migrate history-sync
```

上述命令将从 `_migrations` 表中删除任何没有关联迁移文件的条目。

## 示例

### 执行原始 SQL 语句

```go
// migrations/1687801090_set_pending_status.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

// 为所有空状态的文章设置默认的 "pending" 状态
func init() {
    m.Register(func(app core.App) error {
        _, err := app.DB().NewQuery("UPDATE articles SET status = 'pending' WHERE status = ''").Execute()
        return err
    }, nil)
}
```

### 初始化默认应用设置

```go
// migrations/1687801090_initial_settings.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        settings := app.Settings()

        settings.Meta.AppName = "test"
        settings.Meta.AppURL = "https://example.com"
        settings.Logs.MaxDays = 2
        settings.Logs.LogAuthId = true
        settings.Logs.LogIP = false

        return app.Save(settings)
    }, nil)
}
```

### 创建初始超级用户

有关所有支持的记录方法，请参阅[记录操作](/docs/go-records/)。

::: tip
你也可以使用 `./pocketbase superuser create EMAIL PASS` 命令。
:::

```go
// migrations/1687801090_initial_superuser.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
        if err != nil {
            return err
        }

        record := core.NewRecord(superusers)
        record.Set("email", "test@example.com")
        record.Set("password", "1234567890")

        return app.Save(record)
    }, func(app core.App) error { // 可选的撤销操作
        record, _ := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test@example.com")
        if record == nil {
            return nil // 已删除
        }
        return app.Delete(record)
    })
}
```

### 创建新的认证记录

```go
// migrations/1687801090_new_users_record.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
    "github.com/pocketbase/pocketbase/tools/security"
)

func init() {
    m.Register(func(app core.App) error {
        collection, err := app.FindCollectionByNameOrId("users")
        if err != nil {
            return err
        }

        record := core.NewRecord(collection)
        record.Set("username", "u_"+security.RandomStringWithAlphabet(5, "123456789"))
        record.Set("password", "1234567890")
        record.Set("name", "John Doe")
        record.Set("email", "test@example.com")

        return app.Save(record)
    }, func(app core.App) error { // 可选的撤销操作
        record, _ := app.FindAuthRecordByEmail("users", "test@example.com")
        if record == nil {
            return nil // 已删除
        }
        return app.Delete(record)
    })
}
```

### 以编程方式创建集合

有关所有支持的集合方法，请参阅[集合操作](/docs/go-collections/)。

```go
// migrations/1687801090_create_clients.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // 使用默认系统字段和选项初始化一个新的 auth 集合
        collection := core.NewAuthCollection("clients")

        // 限制记录所有者的列表和查看规则
        collection.ListRule = types.Pointer("id = @request.auth.id")
        collection.ViewRule = types.Pointer("id = @request.auth.id")

        // 添加除默认字段之外的额外字段
        collection.Fields.Add(
            &core.TextField{
                Name:     "company",
                Required: true,
                Max:      100,
            },
            &core.URLField{
                Name:        "website",
                Presentable: true,
            },
        )

        // 禁用密码认证并仅启用 OTP
        collection.PasswordAuth.Enabled = false
        collection.OTP.Enabled = true

        // 添加索引
        collection.AddIndex("idx_clients_company", false, "company", "")

        return app.Save(collection)
    }, func(app core.App) error { // 可选的撤销操作
        collection, err := app.FindCollectionByNameOrId("clients")
        if err != nil {
            return err
        }
        return app.Delete(collection)
    })
}
```

## 最佳实践

1. **始终测试迁移** - 在应用到生产环境之前，在开发环境中测试升级和降级迁移。

2. **保持迁移小巧** - 每个迁移应该只做一件事。这使它们更容易理解和撤销。

3. **使用 down 函数** - 尽可能提供 down 函数以允许撤销更改。

4. **版本控制** - 将迁移文件提交到你的版本控制系统。

5. **不要修改旧迁移** - 创建新迁移而不是修改已经应用的现有迁移。

6. **使用 history-sync** - 在部署到生产环境之前清理不必要的中间迁移。
