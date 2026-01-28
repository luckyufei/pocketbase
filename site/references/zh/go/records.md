# 记录操作

使用 PocketBase 作为框架时最常见的任务可能是查询和处理集合记录。

你可以在 [`core.Record`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record) 中找到所有支持的 Record 模型方法的详细文档，以下是一些最常用方法的示例。

## 设置字段值

```go
// 设置单个记录字段的值
// （也支持字段类型特定的修饰符）
record.Set("title", "example")
record.Set("users+", "6jyr1y02438et52") // 追加到现有值

// 从数据映射填充记录
// （为映射的每个条目调用 Set）
record.Load(data)
```

## 获取字段值

```go
// 获取单个记录字段值
// （也支持字段特定的修饰符）
record.Get("someField")            // -> any（不进行类型转换）
record.GetBool("someField")        // -> 转换为 bool
record.GetString("someField")      // -> 转换为 string
record.GetInt("someField")         // -> 转换为 int
record.GetFloat("someField")       // -> 转换为 float64
record.GetDateTime("someField")    // -> 转换为 types.DateTime
record.GetStringSlice("someField") // -> 转换为 []string

// 获取新上传的文件
// （例如，在保存前检查和修改文件）
record.GetUnsavedFiles("someFileField")

// 将单个 "json" 字段值解组到提供的结果中
record.UnmarshalJSONField("someJSONField", &result)

// 获取单个或多个展开的数据
record.ExpandedOne("author")     // -> nil|*core.Record
record.ExpandedAll("categories") // -> []*core.Record

// 将所有公共安全记录字段导出为 map[string]any
// （注意："json" 类型字段值导出为 types.JSONRaw 字节切片）
record.PublicExport()
```

## 认证访问器

```go
record.IsSuperuser() // record.Collection().Name == "_superusers" 的别名

record.Email()         // record.Get("email") 的别名
record.SetEmail(email) // record.Set("email", email) 的别名

record.Verified()         // record.Get("verified") 的别名
record.SetVerified(false) // record.Set("verified", false) 的别名

record.TokenKey()        // record.Get("tokenKey") 的别名
record.SetTokenKey(key)  // record.Set("tokenKey", key) 的别名
record.RefreshTokenKey() // record.Set("tokenKey:autogenerate", "") 的别名

record.ValidatePassword(pass)
record.SetPassword(pass)   // record.Set("password", pass) 的别名
record.SetRandomPassword() // 设置加密随机的 30 字符字符串作为密码
```

## 副本

```go
// 返回当前记录模型的浅拷贝，填充其原始数据库数据状态，
// 其他一切重置为默认值
// （通常用于比较旧值和新值）
record.Original()

// 返回当前记录模型的浅拷贝，填充其最新数据状态，
// 其他一切重置为默认值
// （即没有展开、没有自定义字段，使用默认可见性标志）
record.Fresh()

// 返回当前记录模型的浅拷贝，
// 填充所有集合和自定义字段数据、展开和可见性标志
record.Clone()
```

## 隐藏/取消隐藏字段

集合字段可以从仪表板标记为"隐藏"，以防止普通用户访问字段值。

Record 模型提供了使用 [`record.Hide(fieldNames...)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record.Hide) 和 [`record.Unhide(fieldNames...)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record.Unhide) 方法进一步控制字段序列化可见性的选项。

通常 `Hide/Unhide` 方法与 `OnRecordEnrich` 钩子结合使用，该钩子在每次记录丰富时调用（列表、查看、创建、更新、实时变更等）。例如：

```go
app.OnRecordEnrich("articles").BindFunc(func(e *core.RecordEnrichEvent) error {
    // 根据当前认证用户是否具有特定"角色"（或任何其他字段约束）
    // 动态显示/隐藏记录字段
    if e.RequestInfo.Auth == nil ||
        (!e.RequestInfo.Auth.IsSuperuser() && e.RequestInfo.Auth.GetString("role") != "staff") {
        e.Record.Hide("someStaffOnlyField")
    }

    return e.Next()
})
```

::: info
对于不属于记录集合模式的自定义字段，需要显式调用 `record.WithCustomData(true)` 以允许它们在公开序列化中出现。
:::

## 获取记录

### 获取单条记录

*如果找不到记录，所有单条记录检索方法都返回 `nil` 和 `sql.ErrNoRows` 错误。*

```go
// 通过 id 获取单条 "articles" 记录
record, err := app.FindRecordById("articles", "RECORD_ID")

// 通过单个键值对获取单条 "articles" 记录
record, err := app.FindFirstRecordByData("articles", "slug", "test")

// 通过字符串过滤表达式获取单条 "articles" 记录
// （注意！使用 "{:placeholder}" 安全绑定不受信任的用户输入参数）
record, err := app.FindFirstRecordByFilter(
    "articles",
    "status = 'public' && category = {:category}",
    dbx.Params{ "category": "news" },
)
```

### 获取多条记录

*如果找不到记录，所有多条记录检索方法都返回空切片和 `nil` 错误。*

```go
// 通过 id 获取多条 "articles" 记录
records, err := app.FindRecordsByIds("articles", []string{"RECORD_ID1", "RECORD_ID2"})

// 使用可选的 dbx 表达式获取集合中 "articles" 记录的总数
totalPending, err := app.CountRecords("articles", dbx.HashExp{"status": "pending"})

// 使用可选的 dbx 表达式获取多条 "articles" 记录
records, err := app.FindAllRecords("articles",
    dbx.NewExp("LOWER(username) = {:username}", dbx.Params{"username": "John.Doe"}),
    dbx.HashExp{"status": "pending"},
)

// 通过字符串过滤表达式获取多条分页的 "articles" 记录
// （注意！使用 "{:placeholder}" 安全绑定不受信任的用户输入参数）
records, err := app.FindRecordsByFilter(
    "articles",                                    // 集合
    "status = 'public' && category = {:category}", // 过滤器
    "-published",                                   // 排序
    10,                                            // 限制
    0,                                             // 偏移
    dbx.Params{ "category": "news" },              // 可选过滤器参数
)
```

### 获取认证记录

```go
// 通过邮箱获取单条认证记录
user, err := app.FindAuthRecordByEmail("users", "test@example.com")

// 通过 JWT 获取单条认证记录
// （你也可以指定可选的接受令牌类型列表）
user, err := app.FindAuthRecordByToken("YOUR_TOKEN", core.TokenTypeAuth)
```

### 自定义记录查询

除了上述查询辅助方法外，你还可以使用 [`RecordQuery(collection)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#RecordQuery) 方法创建自定义 Record 查询。它返回一个 SELECT DB 构建器，可以与[数据库指南](/docs/go-database)中描述的相同方法一起使用。

```go
import (
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase/core"
)

...

func FindActiveArticles(app core.App) ([]*core.Record, error) {
    records := []*core.Record{}

    err := app.RecordQuery("articles").
        AndWhere(dbx.HashExp{"status": "active"}).
        OrderBy("published DESC").
        Limit(10).
        All(&records)

    if err != nil {
        return nil, err
    }

    return records, nil
}
```

## 创建新记录

### 编程方式创建新记录

```go
import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/filesystem"
)

...

collection, err := app.FindCollectionByNameOrId("articles")
if err != nil {
    return err
}

record := core.NewRecord(collection)

record.Set("title", "Lorem ipsum")
record.Set("active", true)

// 字段类型特定的修饰符也可以使用
record.Set("slug:autogenerate", "post-")

// 新文件必须是一个或多个 *filesystem.File 值的切片
//
// 注意1: 参见 https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#File 中的所有工厂方法
// 注意2: 从请求事件读取文件也可以使用 e.FindUploadedFiles("fileKey")
f1, _ := filesystem.NewFileFromPath("/local/path/to/file1.txt")
f2, _ := filesystem.NewFileFromBytes([]byte{"test content"}, "file2.txt")
f3, _ := filesystem.NewFileFromURL(context.Background(), "https://example.com/file3.pdf")
record.Set("documents", []*filesystem.File{f1, f2, f3})

// 验证并持久化
// （使用 SaveNoValidate 跳过字段验证）
err = app.Save(record);
if err != nil {
    return err
}
```

### 拦截创建请求

```go
import (
    "github.com/pocketbase/pocketbase/core"
)

...

app.OnRecordCreateRequest("articles").BindFunc(func(e *core.RecordRequestEvent) error {
    // 对超级用户忽略
    if e.HasSuperuserAuth() {
        return e.Next()
    }

    // 覆盖提交的 "status" 字段值
    e.Record.Set("status", "pending")

    // 或者你也可以通过返回错误来阻止创建事件
    status := e.Record.GetString("status")
    if (status != "pending" &&
        // 访客或非编辑者
        (e.Auth == nil || e.Auth.GetString("role") != "editor")) {
        return e.BadRequestError("Only editors can set a status different from pending", nil)
    }

    return e.Next()
})
```

## 更新现有记录

### 编程方式更新现有记录

```go
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

record.Set("title", "Lorem ipsum")

// 通过指定文件名删除现有记录文件
record.Set("documents-", []string{"file1_abc123.txt", "file3_abc123.txt"})

// 向已上传列表追加一个或多个新文件
//
// 注意1: 参见 https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#File 中的所有工厂方法
// 注意2: 从请求事件读取文件也可以使用 e.FindUploadedFiles("fileKey")
f1, _ := filesystem.NewFileFromPath("/local/path/to/file1.txt")
f2, _ := filesystem.NewFileFromBytes([]byte{"test content"}, "file2.txt")
f3, _ := filesystem.NewFileFromURL(context.Background(), "https://example.com/file3.pdf")
record.Set("documents+", []*filesystem.File{f1, f2, f3})

// 验证并持久化
// （使用 SaveNoValidate 跳过字段验证）
err = app.Save(record);
if err != nil {
    return err
}
```

### 拦截更新请求

```go
import (
    "github.com/pocketbase/pocketbase/core"
)

...

app.OnRecordUpdateRequest("articles").Add(func(e *core.RecordRequestEvent) error {
    // 对超级用户忽略
    if e.HasSuperuserAuth() {
        return e.Next()
    }

    // 覆盖提交的 "status" 字段值
    e.Record.Set("status", "pending")

    // 或者你也可以通过返回错误来阻止更新事件
    status := e.Record.GetString("status")
    if (status != "pending" &&
        // 访客或非编辑者
        (e.Auth == nil || e.Auth.GetString("role") != "editor")) {
        return e.BadRequestError("Only editors can set a status different from pending", nil)
    }

    return e.Next()
})
```

## 删除记录

```go
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

err = app.Delete(record)
if err != nil {
    return err
}
```

## 事务

::: info
你可以使用 `app.RunInTransaction(func(txApp) error{...})` 在事务中执行查询。

嵌套 `RunInTransaction` 调用是安全的，因为嵌套调用将在与父调用相同的事务中执行。

在事务函数内部，始终使用 `txApp` 而不是原始的 `app` 实例，以确保所有更改都反映在事务中。

最后返回 `nil` 以提交，或返回任何错误以回滚。
:::

```go
import (
    "github.com/pocketbase/pocketbase/core"
)

...

titles := []string{"title1", "title2", "title3"}

collection, err := app.FindCollectionByNameOrId("articles")
if err != nil {
    return err
}

// 为每个标题创建新记录
app.RunInTransaction(func(txApp core.App) error {
    for _, title := range titles {
        record := core.NewRecord(collection)
        record.Set("title", title)

        if err := txApp.Save(record); err != nil {
            return err
        }
    }

    return nil
})
```

## 编程方式展开关联

要编程方式展开记录关联，你可以使用 [`app.ExpandRecord(record, expands, optFetchFunc)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.ExpandRecord) 用于单条记录，或 [`app.ExpandRecords(records, expands, optFetchFunc)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.ExpandRecords) 用于多条记录。

加载后，你可以通过 [`record.ExpandedOne(relName)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record.ExpandedOne) 或 [`record.ExpandedAll(relName)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record.ExpandedAll) 方法访问展开的关联。

例如：

```go
record, err := app.FindFirstRecordByData("articles", "slug", "lorem-ipsum")
if err != nil {
    return err
}

// 展开 "author" 和 "categories" 关联
errs := app.ExpandRecord(record, []string{"author", "categories"}, nil)
if len(errs) > 0 {
    return fmt.Errorf("failed to expand: %v", errs)
}

// 打印展开的记录
log.Println(record.ExpandedOne("author"))
log.Println(record.ExpandedAll("categories"))
```

## 检查记录是否可访问

要检查自定义客户端请求或用户是否可以访问单条记录，你可以使用 [`app.CanAccessRecord(record, requestInfo, rule)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.CanAccessRecord) 方法。

下面是一个创建自定义路由来检索单篇文章并检查请求是否满足记录集合的查看 API 规则的示例：

```go
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/articles/{slug}", func(e *core.RequestEvent) error {
            slug := e.Request.PathValue("slug")

            record, err := e.App.FindFirstRecordByData("articles", "slug", slug)
            if err != nil {
                return e.NotFoundError("Missing or invalid slug", err)
            }

            info, err := e.RequestInfo()
            if err != nil {
                return e.BadRequestError("Failed to retrieve request info", err)
            }

            canAccess, err := e.App.CanAccessRecord(record, info, record.Collection().ViewRule)
            if !canAccess {
                return e.ForbiddenError("", err)
            }

            return e.JSON(http.StatusOK, record)
        })

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 生成和验证令牌

PocketBase Web API 是完全无状态的（即传统意义上没有会话），如果提交的请求包含有效的 `Authorization: TOKEN` 头，则认为认证记录已认证 *（另请参阅[内置认证中间件](/docs/go-routing/#builtin-middlewares)和[从路由获取当前认证状态](/docs/go-routing/#retrieving-the-current-auth-state)）*。

如果你想手动发行和验证记录 JWT（认证、验证、密码重置等），你可以使用记录令牌类型特定的方法：

```go
token, err := record.NewAuthToken()

token, err := record.NewVerificationToken()

token, err := record.NewPasswordResetToken()

token, err := record.NewEmailChangeToken(newEmail)

token, err := record.NewFileToken() // 用于受保护的文件

token, err := record.NewStaticAuthToken(optCustomDuration) // 不可续期的认证令牌
```

每种令牌类型都有自己的密钥，令牌持续时间通过其类型相关的集合认证选项管理（*唯一的例外是 `NewStaticAuthToken`*）。

要验证记录令牌，你可以使用 [`app.FindAuthRecordByToken`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.FindAuthRecordByToken) 方法。仅当令牌未过期且其签名有效时，才返回令牌相关的认证记录。

以下是如何验证认证令牌的示例：

```go
record, err := app.FindAuthRecordByToken("YOUR_TOKEN", core.TokenTypeAuth)
```
