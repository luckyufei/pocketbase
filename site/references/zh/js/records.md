# 记录操作

扩展 PocketBase 时最常见的任务可能是查询和处理集合记录。

你可以在 [`core.Record`](/jsvm/interfaces/core.Record.html) 类型接口中找到所有支持的 Record 模型方法的详细文档，以下是一些最常用方法的示例。

## 设置字段值

```javascript
// 设置单个记录字段的值
// （也支持字段类型特定的修饰符）
record.set("title", "example")
record.set("users+", "6jyr1y02438et52") // 追加到现有值

// 从数据映射填充记录
// （对映射的每个条目调用 set()）
record.load(data)
```

## 获取字段值

```javascript
// 获取单个记录字段值
// （也支持字段特定的修饰符）
record.get("someField")            // -> any（无类型转换）
record.getBool("someField")        // -> 转换为 bool
record.getString("someField")      // -> 转换为 string
record.getInt("someField")         // -> 转换为 int
record.getFloat("someField")       // -> 转换为 float64
record.getDateTime("someField")    // -> 转换为 types.DateTime
record.getStringSlice("someField") // -> 转换为 []string

// 获取新上传的文件
// （例如用于在保存前检查和修改文件）
record.getUnsavedFiles("someFileField")

// 将单个 json 字段值反序列化到提供的结果中
let result = new DynamicModel({ ... })
record.unmarshalJSONField("someJsonField", result)

// 获取单个或多个展开的数据
record.expandedOne("author")     // -> 作为 null|Record
record.expandedAll("categories") // -> 作为 []Record

// 将所有公开安全的记录字段导出为普通对象
// （注意："json" 类型字段值导出为原始字节数组）
record.publicExport()
```

## 认证访问器

```javascript
record.isSuperuser() // record.collection().name == "_superusers" 的别名

record.email()         // record.get("email") 的别名
record.setEmail(email) // record.set("email", email) 的别名

record.verified()         // record.get("verified") 的别名
record.setVerified(false) // record.set("verified", false) 的别名

record.tokenKey()        // record.get("tokenKey") 的别名
record.setTokenKey(key)  // record.set("tokenKey", key) 的别名
record.refreshTokenKey() // record.set("tokenKey:autogenerate", "") 的别名

record.validatePassword(pass)
record.setPassword(pass)   // record.set("password", pass) 的别名
record.setRandomPassword() // 设置加密随机的 30 字符字符串作为密码
```

## 副本

```javascript
// 返回当前记录模型的浅拷贝，填充其原始数据库数据状态，
// 其他所有内容重置为默认值
// （通常用于比较新旧字段值）
record.original()

// 返回当前记录模型的浅拷贝，填充其最新数据状态，
// 其他所有内容重置为默认值
// （即无展开、无自定义字段，使用默认可见性标志）
record.fresh()

// 返回当前记录模型的浅拷贝，填充其所有集合和自定义字段数据、
// 展开和可见性标志
record.clone()
```

## 隐藏/取消隐藏字段

集合字段可以在仪表板中标记为"隐藏"以防止普通用户访问字段值。

Record 模型提供了一个选项，除了"隐藏"字段选项外，还可以使用 [`record.hide(fieldNames...)`](/jsvm/interfaces/core.Record.html#hide) 和 [`record.unhide(fieldNames...)`](/jsvm/interfaces/core.Record.html#unhide) 方法进一步控制字段序列化的可见性。

通常 `hide/unhide` 方法与 `onRecordEnrich` 钩子结合使用，该钩子在每次记录丰富时调用（列表、查看、创建、更新、实时变更等）。例如：

```javascript
onRecordEnrich((e) => {
    // 根据当前认证用户是否具有特定"角色"（或任何其他字段约束）
    // 动态显示/隐藏记录字段
    if (
        !e.requestInfo.auth ||
        (!e.requestInfo.auth.isSuperuser() && e.requestInfo.auth.get("role") != "staff")
    ) {
        e.record.hide("someStaffOnlyField")
    }

    e.next()
}, "articles")
```

::: info
对于不属于记录集合模式的自定义字段，需要显式调用 `record.withCustomData(true)` 以允许它们在公开序列化中出现。
:::

## 获取记录

### 获取单条记录

如果找不到记录，所有单条记录检索方法都会抛出错误。

```javascript
// 通过 id 获取单条 "articles" 记录
let record = $app.findRecordById("articles", "RECORD_ID")

// 通过单个键值对获取单条 "articles" 记录
let record = $app.findFirstRecordByData("articles", "slug", "test")

// 通过字符串过滤表达式获取单条 "articles" 记录
// （注意！使用 "{:placeholder}" 安全绑定不受信任的用户输入参数）
let record = $app.findFirstRecordByFilter(
    "articles",
    "status = 'public' && category = {:category}",
    { "category": "news" },
)
```

### 获取多条记录

如果找不到记录，所有多条记录检索方法都返回空数组。

```javascript
// 通过 id 获取多条 "articles" 记录
let records = $app.findRecordsByIds("articles", ["RECORD_ID1", "RECORD_ID2"])

// 使用可选的 dbx 表达式获取集合中 "articles" 记录的总数
let totalPending = $app.countRecords("articles", $dbx.hashExp({"status": "pending"}))

// 使用可选的 dbx 表达式获取多条 "articles" 记录
let records = $app.findAllRecords("articles",
    $dbx.exp("LOWER(username) = {:username}", {"username": "John.Doe"}),
    $dbx.hashExp({"status": "pending"}),
)

// 通过字符串过滤表达式获取多条分页的 "articles" 记录
// （注意！使用 "{:placeholder}" 安全绑定不受信任的用户输入参数）
let records = $app.findRecordsByFilter(
    "articles",                                    // 集合
    "status = 'public' && category = {:category}", // 过滤器
    "-published",                                   // 排序
    10,                                            // 限制
    0,                                             // 偏移
    { "category": "news" },                        // 可选过滤器参数
)
```

### 获取认证记录

```javascript
// 通过邮箱获取单条认证记录
let user = $app.findAuthRecordByEmail("users", "test@example.com")

// 通过 JWT 获取单条认证记录
// （你也可以指定可选的接受令牌类型列表）
let user = $app.findAuthRecordByToken("YOUR_TOKEN", "auth")
```

### 自定义记录查询

除了上述查询辅助方法外，你还可以使用 [`$app.recordQuery(collection)`](/jsvm/functions/_app.recordQuery.html) 方法创建自定义 Record 查询。它返回一个 SELECT DB 构建器，可以与[数据库指南](/docs/js-database)中描述的相同方法一起使用。

```javascript
function findTopArticle() {
    let record = new Record();

    $app.recordQuery("articles")
        .andWhere($dbx.hashExp({ "status": "active" }))
        .orderBy("rank ASC")
        .limit(1)
        .one(record)

    return record
}

let article = findTopArticle()
```

要使用 `all()` 执行器检索**多个** Record 模型，你可以使用 `arrayOf(new Record)` 创建一个数组占位符来填充解析的 DB 结果。

```javascript
// 下面的代码等同于
// $app.findRecordsByFilter("articles", "status = 'active'", '-published', 10)
// 但允许更高级的用例和过滤（聚合、子查询等）
function findLatestArticles() {
    let records = arrayOf(new Record);

    $app.recordQuery("articles")
        .andWhere($dbx.hashExp({ "status": "active" }))
        .orderBy("published DESC")
        .limit(10)
        .all(records)

    return records
}

let articles = findLatestArticles()
```

## 创建新记录

### 编程方式创建新记录

```javascript
let collection = $app.findCollectionByNameOrId("articles")

let record = new Record(collection)

record.set("title", "Lorem ipsum")
record.set("active", true)

// 字段类型特定的修饰符也可以使用
record.set("slug:autogenerate", "post-")

// 新文件必须是一个或多个 filesystem.File 值的切片
//
// 注意1: 查看 /jsvm/modules/_filesystem.html 中的所有工厂方法
// 注意2: 从请求事件读取文件也可以使用 e.findUploadedFiles("fileKey")
let f1 = $filesystem.fileFromPath("/local/path/to/file1.txt")
let f2 = $filesystem.fileFromBytes("test content", "file2.txt")
let f3 = $filesystem.fileFromURL("https://example.com/file3.pdf")
record.set("documents", [f1, f2, f3])

// 验证并持久化
// （使用 saveNoValidate 跳过字段验证）
$app.save(record);
```

### 拦截创建请求

```javascript
onRecordCreateRequest((e) => {
    // 对超级用户忽略
    if (e.hasSuperuserAuth()) {
        return e.next()
    }

    // 覆盖提交的 "status" 字段值
    e.record.set("status", "pending")

    // 或者你也可以通过返回错误来阻止创建事件
    let status = e.record.get("status")
    if (
        status != "pending" &&
        // 访客或非编辑者
        (!e.auth || e.auth.get("role") != "editor")
    ) {
        throw new BadRequestError("只有编辑者可以设置非 pending 的状态")
    }

    e.next()
}, "articles")
```

## 更新现有记录

### 编程方式更新现有记录

```javascript
let record = $app.findRecordById("articles", "RECORD_ID")

record.set("title", "Lorem ipsum")

// 通过指定文件名删除现有记录文件
record.set("documents-", ["file1_abc123.txt", "file3_abc123.txt"])

// 向已上传列表追加一个或多个新文件
//
// 注意1: 查看 /jsvm/modules/_filesystem.html 中的所有工厂方法
// 注意2: 从请求事件读取文件也可以使用 e.findUploadedFiles("fileKey")
let f1 = $filesystem.fileFromPath("/local/path/to/file1.txt")
let f2 = $filesystem.fileFromBytes("test content", "file2.txt")
let f3 = $filesystem.fileFromURL("https://example.com/file3.pdf")
record.set("documents+", [f1, f2, f3])

// 验证并持久化
// （使用 saveNoValidate 跳过字段验证）
$app.save(record);
```

### 拦截更新请求

```javascript
onRecordUpdateRequest((e) => {
    // 对超级用户忽略
    if (e.hasSuperuserAuth()) {
        return e.next()
    }

    // 覆盖提交的 "status" 字段值
    e.record.set("status", "pending")

    // 或者你也可以通过返回错误来阻止更新事件
    let status = e.record.get("status")
    if (
        status != "pending" &&
        // 访客或非编辑者
        (!e.auth || e.auth.get("role") != "editor")
    ) {
        throw new BadRequestError("只有编辑者可以设置非 pending 的状态")
    }

    e.next()
}, "articles")
```

## 删除记录

```javascript
let record = $app.findRecordById("articles", "RECORD_ID")

$app.delete(record)
```

## 事务

::: info
你可以使用 `$app.runInTransaction((txApp) => {...})` 在事务中执行查询。

嵌套 `runInTransaction` 调用是安全的，因为嵌套调用将在与父调用相同的事务中执行。

在事务函数内部，始终使用 `txApp` 而不是原始的 `$app` 实例，以确保所有更改都反映在事务中。

最后返回空或 `null` 以提交，或抛出错误以回滚。
:::

```javascript
let titles = ["title1", "title2", "title3"]

let collection = $app.findCollectionByNameOrId("articles")

$app.runInTransaction((txApp) => {
    // 为每个标题创建新记录
    for (let title of titles) {
        let record = new Record(collection)

        record.set("title", title)

        txApp.save(record)
    }
})
```

## 编程方式展开关联

要编程方式展开记录关联，你可以使用 [`$app.expandRecord(record, expands, customFetchFunc)`](/jsvm/functions/_app.expandRecord.html) 用于单条记录，或 [`$app.expandRecords(records, expands, customFetchFunc)`](/jsvm/functions/_app.expandRecords.html) 用于多条记录。

加载后，你可以通过 [`record.expandedOne(relName)`](/jsvm/interfaces/core.Record.html#expandedOne) 或 [`record.expandedAll(relName)`](/jsvm/interfaces/core.Record.html#expandedAll) 方法访问展开的关联。

例如：

```javascript
let record = $app.findFirstRecordByData("articles", "slug", "lorem-ipsum")

// 展开 "author" 和 "categories" 关联
$app.expandRecord(record, ["author", "categories"], null)

// 打印展开的记录
console.log(record.expandedOne("author"))
console.log(record.expandedAll("categories"))
```

## 检查记录是否可访问

要检查自定义客户端请求或用户是否可以访问单条记录，你可以使用 [`$app.canAccessRecord(record, requestInfo, rule)`](/jsvm/functions/_app.canAccessRecord.html) 方法。

下面是一个创建自定义路由来检索单篇文章并检查请求是否满足记录集合的查看 API 规则的示例：

```javascript
routerAdd("GET", "/articles/{slug}", (e) => {
    let slug = e.request.pathValue("slug")

    let record = e.app.findFirstRecordByData("articles", "slug", slug)

    let canAccess = e.app.canAccessRecord(record, e.requestInfo(), record.collection().viewRule)
    if (!canAccess) {
        throw new ForbiddenError()
    }

    return e.json(200, record)
})
```

## 生成和验证令牌

PocketBase Web API 是完全无状态的（即传统意义上没有会话），如果提交的请求包含有效的 `Authorization: TOKEN` 头，则认为认证记录已认证 *（另请参阅[内置认证中间件](/docs/js-routing/#builtin-middlewares)和[从路由获取当前认证状态](/docs/js-routing/#retrieving-the-current-auth-state)）*。

如果你想手动发行和验证记录 JWT（认证、验证、密码重置等），你可以使用记录令牌类型特定的方法：

```javascript
let token = record.newAuthToken()

let token = record.newVerificationToken()

let token = record.newPasswordResetToken()

let token = record.newEmailChangeToken(newEmail)

let token = record.newFileToken() // 用于受保护的文件

let token = record.newStaticAuthToken(optCustomDuration) // 不可续期的认证令牌
```

每种令牌类型都有自己的密钥，令牌持续时间通过其类型相关的集合认证选项管理（*唯一的例外是 `newStaticAuthToken`*）。

要验证记录令牌，你可以使用 [`$app.findAuthRecordByToken`](/jsvm/functions/_app.findAuthRecordByToken.html) 方法。仅当令牌未过期且其签名有效时，才返回令牌相关的认证记录。

以下是如何验证认证令牌的示例：

```javascript
let record = $app.findAuthRecordByToken("YOUR_TOKEN", "auth")
```
