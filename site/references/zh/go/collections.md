# 集合操作

本页描述如何在 Go 中以编程方式操作集合。

## 获取集合

```go
// 通过名称或 ID 查找集合
collection, err := app.FindCollectionByNameOrId("posts")

// 查找所有集合
collections, err := app.FindAllCollections()

// 按类型查找集合
authCollections, err := app.FindAllCollections("auth")
baseCollections, err := app.FindAllCollections("base")
viewCollections, err := app.FindAllCollections("view")
```

## 创建集合

```go
collection := core.NewBaseCollection("posts")

// 添加字段
collection.Fields.Add(&core.TextField{
    Name:     "title",
    Required: true,
    Max:      100,
})

collection.Fields.Add(&core.EditorField{
    Name: "content",
})

// 设置规则
collection.ListRule = types.Pointer("")  // 所有人都可以列出
collection.ViewRule = types.Pointer("")  // 所有人都可以查看
collection.CreateRule = types.Pointer("@request.auth.id != ''") // 仅已认证用户
collection.UpdateRule = types.Pointer("@request.auth.id = author.id") // 仅作者
collection.DeleteRule = nil // 仅超级用户

if err := app.Save(collection); err != nil {
    return err
}
```

## 创建认证集合

```go
collection := core.NewAuthCollection("users")

// 添加自定义字段
collection.Fields.Add(&core.TextField{
    Name: "name",
    Max:  100,
})

collection.Fields.Add(&core.FileField{
    Name:      "avatar",
    MaxSelect: 1,
    MaxSize:   5 * 1024 * 1024, // 5MB
    MimeTypes: []string{"image/jpeg", "image/png"},
})

if err := app.Save(collection); err != nil {
    return err
}
```

## 更新集合

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

// 更新规则
collection.ListRule = types.Pointer("status = 'published'")

// 添加新字段
collection.Fields.Add(&core.BoolField{
    Name: "featured",
})

if err := app.Save(collection); err != nil {
    return err
}
```

## 删除集合

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

if err := app.Delete(collection); err != nil {
    return err
}
```

## 字段类型

PocketBase 支持以下字段类型：

- `TextField` - 纯文本
- `EditorField` - 富文本编辑器
- `NumberField` - 数值
- `BoolField` - 布尔值（true/false）
- `EmailField` - 电子邮件地址
- `URLField` - URL
- `DateField` - 日期和时间
- `SelectField` - 单选或多选
- `FileField` - 文件上传
- `RelationField` - 与其他集合的关联
- `JSONField` - JSON 数据
- `AutodateField` - 自动生成的时间戳

每种字段类型都有自己的选项集。详情请参阅 [PocketBase Go 文档](https://pkg.go.dev/github.com/pocketbase/pocketbase/core)。
