# 记录操作

使用 PocketBase 作为框架时，最常见的任务可能是查询和操作集合记录。

你可以在 [`core.Record`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record) 中找到所有支持的 Record 模型方法的详细文档，但以下是一些最常用方法的示例。

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

Record 模型提供了使用 `record.Hide(fieldNames...)` 和 `record.Unhide(fieldNames...)` 方法进一步控制字段序列化可见性的选项。

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

## 获取记录

```go
// 通过 ID 查找单个记录
record, err := app.FindRecordById("posts", "RECORD_ID")

// 通过单个键值对查找单个记录
record, err := app.FindFirstRecordByData("posts", "slug", "example")

// 通过过滤表达式查找单个记录
record, err := app.FindFirstRecordByFilter("posts", "status = 'active' && created > {:date}", dbx.Params{
    "date": "2023-01-01",
})

// 查找多个记录
records, err := app.FindRecordsByFilter("posts", "status = 'active'", "-created", 100, 0)

// 查找集合中的所有记录
records, err := app.FindAllRecords("posts")
```

## 创建记录

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

record := core.NewRecord(collection)
record.Set("title", "Hello World")
record.Set("content", "Lorem ipsum...")

if err := app.Save(record); err != nil {
    return err
}
```

## 更新记录

```go
record, err := app.FindRecordById("posts", "RECORD_ID")
if err != nil {
    return err
}

record.Set("title", "Updated Title")

if err := app.Save(record); err != nil {
    return err
}
```

## 删除记录

```go
record, err := app.FindRecordById("posts", "RECORD_ID")
if err != nil {
    return err
}

if err := app.Delete(record); err != nil {
    return err
}
```
