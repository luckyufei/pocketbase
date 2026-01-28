# 数据库

你可以在 [`dbx.Builder`](https://pkg.go.dev/github.com/pocketbase/dbx#Builder) 中找到所有支持的数据库方法的详细文档，但下面是一些最常见操作的示例。

::: info
有关执行记录相关查询，你还可以参考[记录操作](/docs/go-records)部分。
:::

## 执行查询

要执行数据库查询，你可以从 `NewQuery("...")` 语句开始，然后调用以下方法之一：

### Execute()

用于任何不打算获取数据的查询语句：

```go
res, err := app.DB().
    NewQuery("DELETE FROM articles WHERE status = 'archived'").
    Execute()
```

### One()

将单行填充到结构体中：

```go
type User struct {
    Id     string                  `db:"id" json:"id"`
    Status bool                    `db:"status" json:"status"`
    Age    int                     `db:"age" json:"age"`
    Roles  types.JSONArray[string] `db:"roles" json:"roles"`
}

user := User{}

err := app.DB().
    NewQuery("SELECT id, status, age, roles FROM users WHERE id=1").
    One(&user)
```

### All()

将多行填充到结构体切片中：

```go
type User struct {
    Id     string                  `db:"id" json:"id"`
    Status bool                    `db:"status" json:"status"`
    Age    int                     `db:"age" json:"age"`
    Roles  types.JSONArray[string] `db:"roles" json:"roles"`
}

users := []User{}

err := app.DB().
    NewQuery("SELECT id, status, age, roles FROM users LIMIT 100").
    All(&users)
```

## 绑定参数

为防止 SQL 注入攻击，你应该对来自用户输入的任何表达式值使用命名参数。这可以通过在 SQL 语句中使用命名 `{:paramName}` 占位符，然后使用 `Bind(params)` 为查询定义参数值来实现。例如：

```go
type Post struct {
    Name     string         `db:"name" json:"name"`
    Created  types.DateTime `db:"created" json:"created"`
}

posts := []Post{}

err := app.DB().
    NewQuery("SELECT name, created FROM posts WHERE created >= {:from} and created <= {:to}").
    Bind(dbx.Params{
        "from": "2023-06-25 00:00:00.000Z",
        "to":   "2023-06-28 23:59:59.999Z",
    }).
    All(&posts)
```

## 查询构建器

除了编写纯 SQL，你还可以使用数据库查询构建器以编程方式组合 SQL 语句。

每个 SQL 关键字都有对应的查询构建方法。例如，`SELECT` 对应 `Select()`，`FROM` 对应 `From()`，`WHERE` 对应 `Where()`，等等。

```go
users := []struct {
    Id    string `db:"id" json:"id"`
    Email string `db:"email" json:"email"`
}{}

app.DB().
    Select("id", "email").
    From("users").
    AndWhere(dbx.Like("email", "example.com")).
    Limit(100).
    OrderBy("created ASC").
    All(&users)
```

### Select()、AndSelect()、Distinct()

`Select(...cols)` 方法初始化一个 `SELECT` 查询构建器。它接受要选择的列名列表。

要向现有的 select 查询添加额外的列，可以调用 `AndSelect()`。

要选择唯一的行，可以调用 `Distinct(true)`。

```go
app.DB().
    Select("id", "avatar as image").
    AndSelect("(firstName || ' ' || lastName) as fullName").
    Distinct(true)
    ...
```

### From()

`From(...tables)` 方法指定从哪些表中选择（纯表名会自动加引号）。

```go
app.DB().
    Select("table1.id", "table2.name").
    From("table1", "table2")
    ...
```

### Join()

`Join(type, table, on)` 方法指定一个 `JOIN` 子句。它接受 3 个参数：

- `type` - 连接类型字符串，如 `INNER JOIN`、`LEFT JOIN` 等。
- `table` - 要连接的表名
- `on` - 可选的 `dbx.Expression` 作为 `ON` 子句

为方便起见，你还可以使用快捷方式 `InnerJoin(table, on)`、`LeftJoin(table, on)`、`RightJoin(table, on)` 分别指定 `INNER JOIN`、`LEFT JOIN` 和 `RIGHT JOIN`。

```go
app.DB().
    Select("users.*").
    From("users").
    InnerJoin("profiles", dbx.NewExp("profiles.user_id = users.id")).
    Join("FULL OUTER JOIN", "department", dbx.NewExp("department.id = {:id}", dbx.Params{ "id": "someId" }))
    ...
```

### Where()、AndWhere()、OrWhere()

`Where(exp)` 方法指定查询的 `WHERE` 条件。

你还可以使用 `AndWhere(exp)` 或 `OrWhere(exp)` 向现有的 `WHERE` 子句追加一个或多个条件。

每个 where 条件接受一个 `dbx.Expression`（完整列表见下文）。

```go
/*
SELECT users.*
FROM users
WHERE id = "someId" AND
    status = "public" AND
    name like "%john%" OR
    (
        role = "manager" AND
        fullTime IS TRUE AND
        experience > 10
    )
*/
app.DB().
    Select("users.*").
    From("users").
    Where(dbx.NewExp("id = {:id}", dbx.Params{ "id": "someId" })).
    AndWhere(dbx.HashExp{"status": "public"}).
    AndWhere(dbx.Like("name", "john")).
    OrWhere(dbx.And(
        dbx.HashExp{
            "role":     "manager",
            "fullTime": true,
        },
        dbx.NewExp("experience > {:exp}", dbx.Params{ "exp": 10 })
    ))
    ...
```

以下是可用的 `dbx.Expression` 方法：

#### dbx.NewExp(raw, optParams)

使用指定的原始查询片段生成表达式。使用 `optParams` 将 `dbx.Params` 绑定到表达式。

```go
dbx.NewExp("status = 'public'")
dbx.NewExp("total > {:min} AND total < {:max}", dbx.Params{ "min": 10, "max": 30 })
```

#### dbx.HashExp{k:v}

从映射生成哈希表达式，其中键是需要根据相应值进行过滤的数据库列名。

```go
// slug = "example" AND active IS TRUE AND tags in ("tag1", "tag2", "tag3") AND parent IS NULL
dbx.HashExp{
    "slug":   "example",
    "active": true,
    "tags":   []any{"tag1", "tag2", "tag3"},
    "parent": nil,
}
```

#### dbx.Not(exp)

通过用 `NOT()` 包装来否定单个表达式。

```go
// NOT(status = 1)
dbx.Not(dbx.NewExp("status = 1"))
```

#### dbx.And(...exps)

通过用 `AND` 连接指定的表达式来创建新表达式。

```go
// (status = 1 AND username like "%john%")
dbx.And(
    dbx.NewExp("status = 1"),
    dbx.Like("username", "john"),
)
```

#### dbx.Or(...exps)

通过用 `OR` 连接指定的表达式来创建新表达式。

```go
// (status = 1 OR username like "%john%")
dbx.Or(
    dbx.NewExp("status = 1"),
    dbx.Like("username", "john")
)
```

#### dbx.In(col, ...values)

为指定的列和允许值列表生成 `IN` 表达式。

```go
// status IN ("public", "reviewed")
dbx.In("status", "public", "reviewed")
```

#### dbx.NotIn(col, ...values)

为指定的列和允许值列表生成 `NOT IN` 表达式。

```go
// status NOT IN ("public", "reviewed")
dbx.NotIn("status", "public", "reviewed")
```

#### dbx.Like(col, ...values)

为指定的列和列应该匹配的可能字符串生成 `LIKE` 表达式。如果有多个值，列应该匹配**所有**值。

默认情况下，每个值都会被 *"%"* 包围以启用部分匹配。特殊字符如 *"%"*、*"\\"*、*"_"* 也会被正确转义。你可以调用 `Escape(...pairs)` 和/或 `Match(left, right)` 来更改默认行为。

```go
// name LIKE "%test1%" AND name LIKE "%test2%"
dbx.Like("name", "test1", "test2")

// name LIKE "test1%"
dbx.Like("name", "test1").Match(false, true)
```

#### dbx.NotLike(col, ...values)

以与 `Like()` 类似的方式生成 `NOT LIKE` 表达式。

```go
// name NOT LIKE "%test1%" AND name NOT LIKE "%test2%"
dbx.NotLike("name", "test1", "test2")

// name NOT LIKE "test1%"
dbx.NotLike("name", "test1").Match(false, true)
```

#### dbx.OrLike(col, ...values)

这类似于 `Like()`，但列必须是提供的值之一，即多个值用 `OR` 而不是 `AND` 连接。

```go
// name LIKE "%test1%" OR name LIKE "%test2%"
dbx.OrLike("name", "test1", "test2")

// name LIKE "test1%" OR name LIKE "test2%"
dbx.OrLike("name", "test1", "test2").Match(false, true)
```

#### dbx.OrNotLike(col, ...values)

这类似于 `NotLike()`，但列不能是提供的值之一，即多个值用 `OR` 而不是 `AND` 连接。

```go
// name NOT LIKE "%test1%" OR name NOT LIKE "%test2%"
dbx.OrNotLike("name", "test1", "test2")

// name NOT LIKE "test1%" OR name NOT LIKE "test2%"
dbx.OrNotLike("name", "test1", "test2").Match(false, true)
```

#### dbx.Exists(exp)

用 `EXISTS` 前缀指定的表达式（通常是子查询）。

```go
// EXISTS (SELECT 1 FROM users WHERE status = 'active')
dbx.Exists(dbx.NewExp("SELECT 1 FROM users WHERE status = 'active'"))
```

#### dbx.NotExists(exp)

用 `NOT EXISTS` 前缀指定的表达式（通常是子查询）。

```go
// NOT EXISTS (SELECT 1 FROM users WHERE status = 'active')
dbx.NotExists(dbx.NewExp("SELECT 1 FROM users WHERE status = 'active'"))
```

#### dbx.Between(col, from, to)

使用指定的范围生成 `BETWEEN` 表达式。

```go
// age BETWEEN 3 and 99
dbx.Between("age", 3, 99)
```

#### dbx.NotBetween(col, from, to)

使用指定的范围生成 `NOT BETWEEN` 表达式。

```go
// age NOT BETWEEN 3 and 99
dbx.NotBetween("age", 3, 99)
```

### OrderBy()、AndOrderBy()

`OrderBy(...cols)` 指定查询的 `ORDER BY` 子句。

列名可以包含 *"ASC"* 或 *"DESC"* 来指示其排序方向。

你还可以使用 `AndOrderBy(...cols)` 向现有的 `ORDER BY` 子句追加额外的列。

```go
app.DB().
    Select("users.*").
    From("users").
    OrderBy("created ASC", "updated DESC").
    AndOrderBy("title ASC")
    ...
```

### GroupBy()、AndGroupBy()

`GroupBy(...cols)` 指定查询的 `GROUP BY` 子句。

你还可以使用 `AndGroupBy(...cols)` 向现有的 `GROUP BY` 子句追加额外的列。

```go
app.DB().
    Select("users.*").
    From("users").
    GroupBy("department", "level")
    ...
```

### Having()、AndHaving()、OrHaving()

`Having(exp)` 指定查询的 `HAVING` 子句。

与 `Where(exp)` 类似，它接受单个 `dbx.Expression`（所有可用表达式见上文）。

你还可以使用 `AndHaving(exp)` 或 `OrHaving(exp)` 向现有的 `HAVING` 子句追加一个或多个条件。

```go
app.DB().
    Select("users.*").
    From("users").
    GroupBy("department", "level").
    Having(dbx.NewExp("sum(level) > {:sum}", dbx.Params{ sum: 10 }))
    ...
```

### Limit()

`Limit(number)` 方法指定查询的 `LIMIT` 子句。

```go
app.DB().
    Select("users.*").
    From("users").
    Limit(30)
    ...
```

### Offset()

`Offset(number)` 方法指定查询的 `OFFSET` 子句。通常与 `Limit(number)` 一起使用。

```go
app.DB().
    Select("users.*").
    From("users").
    Offset(5).
    Limit(30)
    ...
```

## 事务

::: info
你可以使用 `app.RunInTransaction(func(txApp) error{...})` 在事务中执行查询。

嵌套 `RunInTransaction` 调用是安全的，因为嵌套调用将在与父事务相同的事务中执行。

在事务函数内部，始终使用 `txApp` 而不是原始的 `app` 实例，以确保所有更改都反映在事务中。

在末尾返回 `nil` 以提交，或返回任何错误以回滚。
:::

```go
err := app.RunInTransaction(func(txApp core.App) error {
    // 更新记录
    record, err := txApp.FindRecordById("articles", "RECORD_ID")
    if err != nil {
        return err
    }
    record.Set("status", "active")
    if err := txApp.Save(record); err != nil {
        return err
    }

    // 运行自定义原始查询（不触发事件钩子）
    rawQuery := "DELETE FROM articles WHERE status = 'pending'"
    if _, err := txApp.DB().NewQuery(rawQuery).Execute(); err != nil {
        return err
    }

    return nil
})
```

::: warning
在事务内部时，始终使用 `txApp`（事务应用）而不是主 `app`，以避免死锁。
:::

### 事务示例

```go
err := app.RunInTransaction(func(txApp core.App) error {
    // 1. 查找并更新记录
    record, err := txApp.FindRecordById("articles", "RECORD_ID")
    if err != nil {
        return err // 回滚
    }

    record.Set("status", "published")
    record.Set("publishedAt", time.Now())

    if err := txApp.Save(record); err != nil {
        return err // 回滚
    }

    // 2. 创建日志条目
    log := core.NewRecord(txApp.FindCollectionByNameOrId("logs"))
    log.Set("action", "article_published")
    log.Set("targetId", record.Id)

    if err := txApp.Save(log); err != nil {
        return err // 回滚
    }

    // 3. 执行原始 SQL
    _, err = txApp.DB().NewQuery("UPDATE stats SET count = count + 1 WHERE type = 'articles'").Execute()
    if err != nil {
        return err // 回滚
    }

    return nil // 提交
})

if err != nil {
    fmt.Println("事务失败:", err)
}
```

### 事务最佳实践

1. **保持事务简短** - 避免在事务内执行长时间运行的操作，如 HTTP 请求或发送邮件。

2. **始终使用 txApp** - 在事务回调中使用主 `app` 会导致死锁。

3. **正确处理错误** - 返回任何错误以触发回滚。

```go
// 正确：在事务外准备数据
userData, err := fetchUserDataFromAPI()
if err != nil {
    return err
}

// 然后运行事务
err = app.RunInTransaction(func(txApp core.App) error {
    // 这里只进行数据库操作
    return txApp.Save(record)
})
```
