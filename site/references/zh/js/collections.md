# 集合操作（JavaScript）

## 获取集合

```javascript
// 通过名称或 ID 查找
const collection = $app.findCollectionByNameOrId("posts")

// 查找所有集合
const collections = $app.findAllCollections()

// 按类型查找
const authCollections = $app.findAllCollections("auth")
const baseCollections = $app.findAllCollections("base")
```

## 创建集合

```javascript
const collection = new Collection()
collection.name = "posts"
collection.type = "base"

// 添加字段
collection.fields.add(new TextField({
    name: "title",
    required: true,
    max: 100
}))

collection.fields.add(new EditorField({
    name: "content"
}))

// 设置规则
collection.listRule = ""  // 所有人都可以列出
collection.viewRule = ""  // 所有人都可以查看
collection.createRule = "@request.auth.id != ''" // 仅已认证用户
collection.updateRule = "@request.auth.id = author.id" // 仅作者
collection.deleteRule = null // 仅超级用户

$app.save(collection)
```

## 创建认证集合

```javascript
const collection = new Collection()
collection.name = "users"
collection.type = "auth"

// 添加自定义字段
collection.fields.add(new TextField({
    name: "name",
    max: 100
}))

collection.fields.add(new FileField({
    name: "avatar",
    maxSelect: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    mimeTypes: ["image/jpeg", "image/png"]
}))

$app.save(collection)
```

## 更新集合

```javascript
const collection = $app.findCollectionByNameOrId("posts")

// 更新规则
collection.listRule = "status = 'published'"

// 添加新字段
collection.fields.add(new BoolField({
    name: "featured"
}))

$app.save(collection)
```

## 删除集合

```javascript
const collection = $app.findCollectionByNameOrId("posts")

$app.delete(collection)
```

## 字段类型

可用的字段类型：

- `TextField` - 纯文本
- `EditorField` - 富文本
- `NumberField` - 数字
- `BoolField` - 布尔值
- `EmailField` - 电子邮件
- `URLField` - URL
- `DateField` - 日期/时间
- `SelectField` - 选择选项
- `FileField` - 文件上传
- `RelationField` - 关联
- `JSONField` - JSON 数据
- `AutodateField` - 自动时间戳
