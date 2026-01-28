# 集合操作

集合通常通过仪表板界面管理，但有些情况下你可能想以编程方式创建或编辑集合（通常作为[数据库迁移](/docs/go-migrations)的一部分）。你可以在 [`core.App`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#App) 和 [`core.Collection`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Collection) 中找到所有可用的集合相关操作和方法，以下列出了一些最常用的：

[[toc]]

## 获取集合

### 获取单个集合

*如果找不到集合，所有单个集合检索方法都返回 `nil` 和 `sql.ErrNoRows` 错误。*

```go
collection, err := app.FindCollectionByNameOrId("example")
```

### 获取多个集合

*如果找不到集合，所有多个集合检索方法都返回空切片和 `nil` 错误。*

```go
allCollections, err := app.FindAllCollections()

authAndViewCollections, err := app.FindAllCollections(core.CollectionTypeAuth, core.CollectionTypeView)
```

### 自定义集合查询

除了上述查询辅助方法外，你还可以使用 [`CollectionQuery()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#CollectionQuery) 方法创建自定义集合查询。它返回一个 SELECT DB 构建器，可以与[数据库指南](/docs/go-database)中描述的相同方法一起使用。

```go
import (
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase/core"
)

...

func FindSystemCollections(app core.App) ([]*core.Collection, error) {
    collections := []*core.Collection{}

    err := app.CollectionQuery().
        AndWhere(dbx.HashExp{"system": true}).
        OrderBy("created DESC").
        All(&collections)

    if err != nil {
        return nil, err
    }

    return collections, nil
}
```

## 集合属性

```go
Id      string
Name    string
Type    string // "base", "view", "auth"
System  bool // !防止内部集合如 _superusers 的重命名、删除和规则更改
Fields  core.FieldsList
Indexes types.JSONArray[string]
Created types.DateTime
Updated types.DateTime

// CRUD 规则
ListRule   *string
ViewRule   *string
CreateRule *string
UpdateRule *string
DeleteRule *string

// "view" 类型特定选项
// (参见 https://github.com/pocketbase/pocketbase/blob/master/core/collection_model_view_options.go)
ViewQuery string

// "auth" 类型特定选项
// (参见 https://github.com/pocketbase/pocketbase/blob/master/core/collection_model_auth_options.go)
AuthRule                   *string
ManageRule                 *string
AuthAlert                  core.AuthAlertConfig
OAuth2                     core.OAuth2Config
PasswordAuth               core.PasswordAuthConfig
MFA                        core.MFAConfig
OTP                        core.OTPConfig
AuthToken                  core.TokenConfig
PasswordResetToken         core.TokenConfig
EmailChangeToken           core.TokenConfig
VerificationToken          core.TokenConfig
FileToken                  core.TokenConfig
VerificationTemplate       core.EmailTemplate
ResetPasswordTemplate      core.EmailTemplate
ConfirmEmailChangeTemplate core.EmailTemplate
```

## 字段定义

- [`core.BoolField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BoolField)
- [`core.NumberField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#NumberField)
- [`core.TextField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#TextField)
- [`core.EmailField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#EmailField)
- [`core.URLField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#URLField)
- [`core.EditorField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#EditorField)
- [`core.DateField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#DateField)
- [`core.AutodateField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#AutodateField)
- [`core.SelectField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#SelectField)
- [`core.FileField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#FileField)
- [`core.RelationField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#RelationField)
- [`core.JSONField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#JSONField)
- [`core.GeoPointField`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#GeoPointField)

## 创建新集合

```go
import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

...

// core.NewAuthCollection("example")
// core.NewViewCollection("example")
collection := core.NewBaseCollection("example")

// 设置规则
collection.ViewRule = types.Pointer("@request.auth.id != ''")
collection.CreateRule = types.Pointer("@request.auth.id != '' && @request.body.user = @request.auth.id")
collection.UpdateRule = types.Pointer(`
    @request.auth.id != '' &&
    user = @request.auth.id &&
    (@request.body.user:isset = false || @request.body.user = @request.auth.id)
`)

// 添加文本字段
collection.Fields.Add(&core.TextField{
    Name:     "title",
    Required: true,
    Max:      100,
})

// 添加关联字段
usersCollection, err := app.FindCollectionByNameOrId("users")
if err != nil {
    return err
}
collection.Fields.Add(&core.RelationField{
    Name:          "user",
    Required:      true,
    Max:           100,
    CascadeDelete: true,
    CollectionId:  usersCollection.Id,
})

// 添加自动日期/时间戳字段（created/updated）
collection.Fields.Add(&core.AutodateField{
    Name:     "created",
    OnCreate: true,
})
collection.Fields.Add(&core.AutodateField{
    Name:     "updated",
    OnCreate: true,
    OnUpdate: true,
})

// 或: collection.Indexes = []string{"CREATE UNIQUE INDEX idx_example_user ON example (user)"}
collection.AddIndex("idx_example_user", true, "user", "")

// 验证并持久化
// (使用 SaveNoValidate 跳过字段验证)
err = app.Save(collection)
if err != nil {
    return err
}
```

## 更新现有集合

```go
import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

...

collection, err := app.FindCollectionByNameOrId("example")
if err != nil {
    return err
}

// 更改规则
collection.DeleteRule = types.Pointer("@request.auth.id != ''")

// 添加新编辑器字段
collection.Fields.Add(&core.EditorField{
    Name:     "description",
    Required: true,
})

// 更改现有字段
// (返回指针，允许直接修改而无需重新插入)
titleField := collection.Fields.GetByName("title").(*core.TextField)
titleField.Min = 10

// 或: collection.Indexes = append(collection.Indexes, "CREATE INDEX idx_example_title ON example (title)")
collection.AddIndex("idx_example_title", false, "title", "")

// 验证并持久化
// (使用 SaveNoValidate 跳过字段验证)
err = app.Save(collection)
if err != nil {
    return err
}
```

## 删除集合

```go
collection, err := app.FindCollectionByNameOrId("example")
if err != nil {
    return err
}

err = app.Delete(collection)
if err != nil {
    return err
}
```
