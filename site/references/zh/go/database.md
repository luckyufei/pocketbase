# 数据库

`core.App` 是与数据库交互的主要接口。

`App.DB()` 返回一个 `dbx.Builder`，可以运行各种 SQL 语句，包括原始查询。

下面列出了大多数常见的数据库操作，但你可以在 [dbx 包 godoc](https://pkg.go.dev/github.com/pocketbase/dbx) 中找到更多信息。

::: info
有关如何以编程方式操作 Record 和 Collection 模型的更多详情和示例，你还可以查看[集合操作](/zh/go/collections)和[记录操作](/zh/go/records)部分。
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

为防止 SQL 注入攻击，你应该对来自用户输入的任何表达式值使用命名参数：

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
    Id   string `db:"id"`
    Name string `db:"name"`
}{}

err := app.DB().
    Select("id", "name").
    From("users").
    Where(dbx.HashExp{"status": true}).
    OrderBy("created DESC").
    Limit(100).
    All(&users)
```

## 事务

```go
app.RunInTransaction(func(txApp core.App) error {
    // 对事务中的所有数据库操作使用 txApp.DB()
    
    // 返回 nil 提交事务，或返回错误回滚事务
    return nil
})
```

::: warning
在事务内部时，始终使用 `txApp`（事务应用）而不是主 `app`，以避免死锁。
:::
