# 数据库

[`$app`](https://pocketbase.io/jsvm/modules/_app.html) 是与数据库交互的主要接口。

`$app.db()` 返回一个 `dbx.Builder`，可以运行各种 SQL 语句，包括原始查询。

::: info
有关如何以编程方式与 Record 和 Collection 模型交互的更多详细信息和示例，你还可以查看[集合操作](/docs/js-collections)和[记录操作](/docs/js-records)部分。
:::

## 执行查询

要执行数据库查询，你可以从 `newQuery("...")` 语句开始，然后调用以下方法之一：

### execute()

用于任何不打算获取数据的查询语句：

```javascript
$app.db()
    .newQuery("DELETE FROM articles WHERE status = 'archived'")
    .execute() // 数据库失败时抛出错误
```

### one()

将单行填充到 [`DynamicModel`](/jsvm/classes/DynamicModel.html) 对象中：

```javascript
const result = new DynamicModel({
    // 描述数据的形状（也用作初始值）
    // 键不能以下划线开头，必须是有效的 Go 结构字段名
    "id":         ""     // 如果可空则使用 nullString()
    "status":     false, // 如果可空则使用 nullBool()
    "age":        0,     // 如果可空则使用 nullInt()
    "totalSpent": -0,    // 如果可空则使用 nullFloat()
    "roles":      [],    // 如果可空则使用 nullArray()
    "meta":       {},    // 如果可空则使用 nullObject()
})

$app.db()
    .newQuery("SELECT id, status, age, totalSpent, roles, meta FROM users WHERE id=1")
    .one(result) // 数据库失败或行缺失时抛出错误

console.log(result.id)
```

### all()

将多行填充到对象数组中（注意数组必须使用 `arrayOf` 创建）：

```javascript
const result = arrayOf(new DynamicModel({
    // 描述数据的形状（也用作初始值）
    // 键不能以下划线开头，必须是有效的 Go 结构字段名
    "id":    "",
    "email": "",
}))

$app.db()
    .newQuery("SELECT id, status, age, totalSpent, Roles, meta FROM users LIMIT 100")
    .all(result) // 数据库失败时抛出错误

if (result.length > 0) {
    console.log(result[0].id)
}
```

## 绑定参数

为防止 SQL 注入攻击，你应该对来自用户输入的任何表达式值使用命名参数。这可以通过在 SQL 语句中使用命名 `{:paramName}` 占位符，然后使用 `bind(params)` 为查询定义参数值来实现。例如：

```javascript
const result = arrayOf(new DynamicModel({
    "name":    "",
    "created": "",
}))

$app.db()
    .newQuery("SELECT name, created FROM posts WHERE created >= {:from} and created <= {:to}")
    .bind({
        "from": "2023-06-25 00:00:00.000Z",
        "to":   "2023-06-28 23:59:59.999Z",
    })
    .all(result)

console.log(result.length)
```

## 查询构建器

除了编写纯 SQL，你还可以使用数据库查询构建器以编程方式组合 SQL 语句。

每个 SQL 关键字都有对应的查询构建方法。例如，`SELECT` 对应 `select()`，`FROM` 对应 `from()`，`WHERE` 对应 `where()`，等等。

```javascript
const result = arrayOf(new DynamicModel({
    "id":    "",
    "email": "",
}))

$app.db()
    .select("id", "email")
    .from("users")
    .andWhere($dbx.like("email", "example.com"))
    .limit(100)
    .orderBy("created ASC")
    .all(result)
```

### select()、andSelect()、distinct()

`select(...cols)` 方法初始化一个 `SELECT` 查询构建器。它接受要选择的列名列表。

要向现有的 select 查询添加额外的列，可以调用 `andSelect()`。

要选择唯一的行，可以调用 `distinct(true)`。

```javascript
$app.db()
    .select("id", "avatar as image")
    .andSelect("(firstName || ' ' || lastName) as fullName")
    .distinct(true)
    ...
```

### from()

`from(...tables)` 方法指定从哪些表中选择（纯表名会自动加引号）。

```javascript
$app.db()
    .select("table1.id", "table2.name")
    .from("table1", "table2")
    ...
```

### join()

`join(type, table, on)` 方法指定一个 `JOIN` 子句。它接受 3 个参数：

- `type` - 连接类型字符串，如 `INNER JOIN`、`LEFT JOIN` 等。
- `table` - 要连接的表名
- `on` - 可选的 `dbx.Expression` 作为 `ON` 子句

为方便起见，你还可以使用快捷方式 `innerJoin(table, on)`、`leftJoin(table, on)`、`rightJoin(table, on)` 分别指定 `INNER JOIN`、`LEFT JOIN` 和 `RIGHT JOIN`。

```javascript
$app.db()
    .select("users.*")
    .from("users")
    .innerJoin("profiles", $dbx.exp("profiles.user_id = users.id"))
    .join("FULL OUTER JOIN", "department", $dbx.exp("department.id = {:id}", {id: "someId"}))
    ...
```

### where()、andWhere()、orWhere()

`where(exp)` 方法指定查询的 `WHERE` 条件。

你还可以使用 `andWhere(exp)` 或 `orWhere(exp)` 向现有的 `WHERE` 子句追加一个或多个条件。

每个 where 条件接受一个 `dbx.Expression`（完整列表见下文）。

```javascript
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
$app.db()
    .select("users.*")
    .from("users")
    .where($dbx.exp("id = {:id}", { id: "someId" }))
    .andWhere($dbx.hashExp({ status: "public" }))
    .andWhere($dbx.like("name", "john"))
    .orWhere($dbx.and(
        $dbx.hashExp({
            role:     "manager",
            fullTime: true,
        }),
        $dbx.exp("experience > {:exp}", { exp: 10 })
    ))
    ...
```

以下是可用的 `dbx.Expression` 方法：

#### $dbx.exp(raw, optParams)

使用指定的原始查询片段生成表达式。使用 `optParams` 将参数绑定到表达式。

```javascript
$dbx.exp("status = 'public'")
$dbx.exp("total > {:min} AND total < {:max}", { min: 10, max: 30 })
```

#### $dbx.hashExp(pairs)

从映射生成哈希表达式，其中键是需要根据相应值进行过滤的数据库列名。

```javascript
// slug = "example" AND active IS TRUE AND tags in ("tag1", "tag2", "tag3") AND parent IS NULL
$dbx.hashExp({
    slug:   "example",
    active: true,
    tags:   ["tag1", "tag2", "tag3"],
    parent: null,
})
```

#### $dbx.not(exp)

通过用 `NOT()` 包围来否定单个表达式。

```javascript
// NOT(status = 1)
$dbx.not($dbx.exp("status = 1"))
```

#### $dbx.and(...exps)

通过用 `AND` 连接指定的表达式来创建新表达式。

```javascript
// (status = 1 AND username like "%john%")
$dbx.and($dbx.exp("status = 1"), $dbx.like("username", "john"))
```

#### $dbx.or(...exps)

通过用 `OR` 连接指定的表达式来创建新表达式。

```javascript
// (status = 1 OR username like "%john%")
$dbx.or($dbx.exp("status = 1"), $dbx.like("username", "john"))
```

#### $dbx.in(col, ...values)

为指定的列和允许值列表生成 `IN` 表达式。

```javascript
// status IN ("public", "reviewed")
$dbx.in("status", "public", "reviewed")
```

#### $dbx.notIn(col, ...values)

为指定的列和允许值列表生成 `NOT IN` 表达式。

```javascript
// status NOT IN ("public", "reviewed")
$dbx.notIn("status", "public", "reviewed")
```

#### $dbx.like(col, ...values)

为指定的列和列应该匹配的可能字符串生成 `LIKE` 表达式。如果有多个值，列应该匹配**所有**值。

默认情况下，每个值都会被 *"%"* 包围以启用部分匹配。特殊字符如 *"%"*、*"\\"*、*"_"* 也会被正确转义。你可以调用 `escape(...pairs)` 和/或 `match(left, right)` 来更改默认行为。

```javascript
// name LIKE "%test1%" AND name LIKE "%test2%"
$dbx.like("name", "test1", "test2")

// name LIKE "test1%"
$dbx.like("name", "test1").match(false, true)
```

#### $dbx.notLike(col, ...values)

以与 `like()` 类似的方式生成 `NOT LIKE` 表达式。

```javascript
// name NOT LIKE "%test1%" AND name NOT LIKE "%test2%"
$dbx.notLike("name", "test1", "test2")

// name NOT LIKE "test1%"
$dbx.notLike("name", "test1").match(false, true)
```

#### $dbx.orLike(col, ...values)

这类似于 `like()`，但列必须是提供的值之一，即多个值用 `OR` 而不是 `AND` 连接。

```javascript
// name LIKE "%test1%" OR name LIKE "%test2%"
$dbx.orLike("name", "test1", "test2")

// name LIKE "test1%" OR name LIKE "test2%"
$dbx.orLike("name", "test1", "test2").match(false, true)
```

#### $dbx.orNotLike(col, ...values)

这类似于 `notLike()`，但列不能是提供的值之一，即多个值用 `OR` 而不是 `AND` 连接。

```javascript
// name NOT LIKE "%test1%" OR name NOT LIKE "%test2%"
$dbx.orNotLike("name", "test1", "test2")

// name NOT LIKE "test1%" OR name NOT LIKE "test2%"
$dbx.orNotLike("name", "test1", "test2").match(false, true)
```

#### $dbx.exists(exp)

用 `EXISTS` 前缀指定的表达式（通常是子查询）。

```javascript
// EXISTS (SELECT 1 FROM users WHERE status = 'active')
$dbx.exists(dbx.exp("SELECT 1 FROM users WHERE status = 'active'"))
```

#### $dbx.notExists(exp)

用 `NOT EXISTS` 前缀指定的表达式（通常是子查询）。

```javascript
// NOT EXISTS (SELECT 1 FROM users WHERE status = 'active')
$dbx.notExists(dbx.exp("SELECT 1 FROM users WHERE status = 'active'"))
```

#### $dbx.between(col, from, to)

使用指定的范围生成 `BETWEEN` 表达式。

```javascript
// age BETWEEN 3 and 99
$dbx.between("age", 3, 99)
```

#### $dbx.notBetween(col, from, to)

使用指定的范围生成 `NOT BETWEEN` 表达式。

```javascript
// age NOT BETWEEN 3 and 99
$dbx.notBetween("age", 3, 99)
```

### orderBy()、andOrderBy()

`orderBy(...cols)` 指定查询的 `ORDER BY` 子句。

列名可以包含 *"ASC"* 或 *"DESC"* 来指示其排序方向。

你还可以使用 `andOrderBy(...cols)` 向现有的 `ORDER BY` 子句追加额外的列。

```javascript
$app.db()
    .select("users.*")
    .from("users")
    .orderBy("created ASC", "updated DESC")
    .andOrderBy("title ASC")
    ...
```

### groupBy()、andGroupBy()

`groupBy(...cols)` 指定查询的 `GROUP BY` 子句。

你还可以使用 `andGroupBy(...cols)` 向现有的 `GROUP BY` 子句追加额外的列。

```javascript
$app.db()
    .select("users.*")
    .from("users")
    .groupBy("department", "level")
    ...
```

### having()、andHaving()、orHaving()

`having(exp)` 指定查询的 `HAVING` 子句。

与 `where(exp)` 类似，它接受单个 `dbx.Expression`（所有可用表达式见上文）。

你还可以使用 `andHaving(exp)` 或 `orHaving(exp)` 向现有的 `HAVING` 子句追加一个或多个条件。

```javascript
$app.db()
    .select("users.*")
    .from("users")
    .groupBy("department", "level")
    .having($dbx.exp("sum(level) > {:sum}", { sum: 10 }))
    ...
```

### limit()

`limit(number)` 方法指定查询的 `LIMIT` 子句。

```javascript
$app.db()
    .select("users.*")
    .from("users")
    .limit(30)
    ...
```

### offset()

`offset(number)` 方法指定查询的 `OFFSET` 子句。通常与 `limit(number)` 一起使用。

```javascript
$app.db()
    .select("users.*")
    .from("users")
    .offset(5)
    .limit(30)
    ...
```

## 事务

::: info
你可以使用 `$app.runInTransaction((txApp) => {...})` 在事务中执行查询。

嵌套 `runInTransaction` 调用是安全的，因为嵌套调用将在与父事务相同的事务中执行。

在事务函数内部，始终使用 `txApp` 而不是原始的 `$app` 实例，以确保所有更改都反映在事务中。

在末尾返回空或 `null` 以提交，或抛出错误以回滚。
:::

```javascript
$app.runInTransaction((txApp) => {
    // 更新记录
    const record = txApp.findRecordById("articles", "RECORD_ID")
    record.set("status", "active")
    txApp.save(record)

    // 运行自定义原始查询（不触发事件钩子）
    txApp.db().newQuery("DELETE FROM articles WHERE status = 'pending'").execute()
})
```
