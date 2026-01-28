# 迁移

PocketBase 自带内置的数据库和数据迁移工具，允许你对数据库结构进行版本控制、以编程方式创建集合、初始化默认设置和/或运行任何只需要执行一次的操作。

用户定义的迁移位于 `pb_migrations` 目录（可以使用 `--migrationsDir` 标志更改），其中每个未应用的迁移将在 `serve`（或 `migrate up`）时自动在事务中执行。

生成的迁移可以安全地提交到版本控制，并可以与其他团队成员共享。

## 自动迁移

预构建的可执行文件默认启用 `--automigrate` 标志，这意味着从仪表盘（或 Web API）进行的每次集合配置更改都会自动为你生成相关的迁移文件。

## 创建迁移

要创建新的空白迁移，你可以运行 `migrate create`。

```
[root@dev app]$ ./pocketbase migrate create "your_new_migration"
```

```javascript
// pb_migrations/1687801097_your_new_migration.js
migrate((app) => {
    // 添加升级查询...
}, (app) => {
    // 添加降级查询...
})
```

**新迁移会在 `serve` 时自动应用。**

你也可以选择通过运行 `migrate up` 手动应用新迁移。

要回滚最后应用的迁移，可以运行 `migrate down [number]`。

::: tip
手动应用或回滚迁移时，需要重启 `serve` 进程，以便它可以刷新其缓存的集合状态。
:::

### 迁移文件

每个迁移文件应该有一个 `migrate(upFunc, downFunc)` 调用。

在迁移文件中，你应该在 `upFunc` 回调中编写"升级"代码。`downFunc` 是可选的，它应该包含"降级"操作以撤销 `upFunc` 所做的更改。

两个回调都接受一个事务性的 `app` 实例。

## 集合快照

`migrate collections` 命令会生成当前集合配置的完整快照，无需手动输入。类似于 `migrate create` 命令，这将在 `pb_migrations` 目录中生成一个新的迁移文件。

```
[root@dev app]$ ./pocketbase migrate collections
```

默认情况下，集合快照以*扩展*模式导入，这意味着快照中不存在的集合和字段会被保留。如果你希望快照*删除*缺失的集合和字段，可以编辑生成的文件并将 `importCollections` 的最后一个参数改为 `true`。

## 迁移历史

所有已应用的迁移文件名都存储在内部 `_migrations` 表中。

在本地开发过程中，你可能经常会进行各种集合更改来测试不同的方法。当启用 `--automigrate`（*这是默认设置*）时，这可能会导致迁移历史中包含不必要的中间步骤，这些步骤可能不是最终迁移历史中想要的。

**为避免混乱并防止在生产环境中应用中间步骤，你可以手动删除（或合并）不必要的迁移文件，然后通过运行以下命令更新本地迁移历史：**

```
[root@dev app]$ ./pocketbase migrate history-sync
```

上述命令将从 `_migrations` 表中删除任何没有关联迁移文件的条目。

## 示例

### 执行原始 SQL 语句

```javascript
// pb_migrations/1687801090_set_pending_status.js

migrate((app) => {
    app.db().newQuery("UPDATE articles SET status = 'pending' WHERE status = ''").execute()
})
```

### 初始化默认应用设置

```javascript
// pb_migrations/1687801090_initial_settings.js

migrate((app) => {
    let settings = app.settings()

    // 有关所有可用的设置字段，你可以查看
    // /jsvm/interfaces/core.Settings.html
    settings.meta.appName = "test"
    settings.meta.appURL = "https://example.com"
    settings.logs.maxDays = 2
    settings.logs.logAuthId = true
    settings.logs.logIP = false

    app.save(settings)
})
```

### 创建初始超级用户

*有关所有支持的记录方法，你可以参考[记录操作](/docs/js-records)*。

```javascript
// pb_migrations/1687801090_initial_superuser.js

migrate((app) => {
    let superusers = app.findCollectionByNameOrId("_superusers")

    let record = new Record(superusers)

    // 注意：这些值最终可以通过 $os.getenv(key) 加载
    // 或从特殊的本地配置文件加载
    record.set("email", "test@example.com")
    record.set("password", "1234567890")

    app.save(record)
}, (app) => { // 可选的回滚操作
    try {
        let record = app.findAuthRecordByEmail("_superusers", "test@example.com")
        app.delete(record)
    } catch {
        // 静默错误（可能已经被删除）
    }
})
```

### 以编程方式创建集合

*有关所有支持的集合方法，你可以参考[集合操作](/docs/js-collections)*。

```javascript
// migrations/1687801090_create_clients_collection.js

migrate((app) => {
    // 缺失的默认选项、系统字段（如 id、email 等）会自动初始化
    // 并与提供的配置合并
    let collection = new Collection({
        type:     "auth",
        name:     "clients",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        fields: [
            {
                type:     "text",
                name:     "company",
                required: true,
                max:      100,
            },
            {
                name:        "url",
                type:        "url",
                presentable: true,
            },
        ],
        passwordAuth: {
            enabled: false,
        },
        otp: {
            enabled: true,
        },
        indexes: [
            "CREATE INDEX idx_clients_company ON clients (company)"
        ],
    })

    app.save(collection)
}, (app) => {
    let collection = app.findCollectionByNameOrId("clients")
    app.delete(collection)
})
```
