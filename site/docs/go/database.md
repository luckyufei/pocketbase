# Database

`core.App` is the main interface to interact with the database.

`App.DB()` returns a `dbx.Builder` that can run all kinds of SQL statements, including raw queries.

Most of the common DB operations are listed below, but you can find further information in the [dbx package godoc](https://pkg.go.dev/github.com/pocketbase/dbx).

::: info
For more details and examples how to interact with Record and Collection models programmatically you could also check [Collection operations](/go/collections) and [Record operations](/go/records) sections.
:::

## Executing queries

To execute DB queries you can start with the `NewQuery("...")` statement and then call one of:

### Execute()

For any query statement that is not meant to retrieve data:

```go
res, err := app.DB().
    NewQuery("DELETE FROM articles WHERE status = 'archived'").
    Execute()
```

### One()

To populate a single row into a struct:

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

To populate multiple rows into a slice of structs:

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

## Binding parameters

To prevent SQL injection attacks, you should use named parameters for any expression value that comes from user input:

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

## Query builder

Instead of writing plain SQLs, you can also compose SQL statements programmatically using the db query builder.

Every SQL keyword has a corresponding query building method. For example, `SELECT` corresponds to `Select()`, `FROM` corresponds to `From()`, `WHERE` corresponds to `Where()`, and so on.

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

## Transactions

```go
app.RunInTransaction(func(txApp core.App) error {
    // use txApp.DB() for all db operations within the transaction
    
    // return nil to commit or an error to rollback
    return nil
})
```

::: warning
When inside a transaction, always use `txApp` (the transaction app) instead of the main `app` to avoid deadlocks.
:::
