# 集合操作（JavaScript）

集合通常通过仪表板界面管理，但在某些情况下你可能需要以编程方式创建或编辑集合（通常作为[数据库迁移](/docs/js-migrations)的一部分）。你可以在 [`$app`](/jsvm/modules/_app.html) 和 [`Collection`](/jsvm/classes/Collection.html) 中找到所有可用的集合相关操作和方法，下面列出了一些最常用的：

[[toc]]

## 获取集合

### 获取单个集合

*如果没有找到集合，所有单个集合检索方法都会抛出错误。*

```javascript
let collection = $app.findCollectionByNameOrId("example")
```

### 获取多个集合

*如果没有找到集合，所有多个集合检索方法都会返回空数组。*

```javascript
let allCollections = $app.findAllCollections(/* 可选的类型 */)

// 只获取特定类型
let authAndViewCollections = $app.findAllCollections("auth", "view")
```

### 自定义集合查询

除了上面的查询辅助方法，你还可以使用 [`$app.collectionQuery()`](/jsvm/functions/_app.collectionQuery.html) 方法创建自定义集合查询。它返回一个 SELECT DB 构建器，可以与[数据库指南](/docs/js-database)中描述的相同方法一起使用。

```javascript
let collections = arrayOf(new Collection)

$app.collectionQuery().
    andWhere($dbx.hashExp({"viewRule": null})).
    orderBy("created DESC").
    all(collections)
```

## 字段定义

::: info
所有集合字段*（除了 `JSONField`）*都是非空的，当缺失时使用其各自类型的零值作为后备值。
:::

- [`new BoolField({ ... })`](/jsvm/classes/BoolField.html)
- [`new NumberField({ ... })`](/jsvm/classes/NumberField.html)
- [`new TextField({ ... })`](/jsvm/classes/TextField.html)
- [`new EmailField({ ... })`](/jsvm/classes/EmailField.html)
- [`new URLField({ ... })`](/jsvm/classes/URLField.html)
- [`new EditorField({ ... })`](/jsvm/classes/EditorField.html)
- [`new DateField({ ... })`](/jsvm/classes/DateField.html)
- [`new AutodateField({ ... })`](/jsvm/classes/AutodateField.html)
- [`new SelectField({ ... })`](/jsvm/classes/SelectField.html)
- [`new FileField({ ... })`](/jsvm/classes/FileField.html)
- [`new RelationField({ ... })`](/jsvm/classes/RelationField.html)
- [`new JSONField({ ... })`](/jsvm/classes/JSONField.html)
- [`new GeoPointField({ ... })`](/jsvm/classes/GeoPointField.html)

## 创建新集合

```javascript
// 缺失的默认选项、系统字段如 id、email 等会自动初始化
// 并与提供的配置合并
let collection = new Collection({
    type:       "base", // base | auth | view
    name:       "example",
    listRule:   null,
    viewRule:   "@request.auth.id != ''",
    createRule: "",
    updateRule: "@request.auth.id != ''",
    deleteRule: null,
    fields: [
        {
            name:     "title",
            type:     "text",
            required: true,
            max: 10,
        },
        {
            name:          "user",
            type:          "relation",
            required:      true,
            maxSelect:     1,
            collectionId:  "ae40239d2bc4477",
            cascadeDelete: true,
        },
    ],
    indexes: [
        "CREATE UNIQUE INDEX idx_user ON example (user)"
    ],
})

// 验证并保存
// （使用 saveNoValidate 跳过字段验证）
$app.save(collection)
```

## 更新现有集合

```javascript
let collection = $app.findCollectionByNameOrId("example")

// 更改集合名称
collection.name = "example_update"

// 添加新的编辑器字段
collection.fields.add(new EditorField({
    name:     "description",
    required: true,
}))

// 更改现有字段
// （返回指针，允许直接修改而无需重新插入）
let titleField = collection.fields.getByName("title")
titleField.min = 10

// 或者: collection.indexes.push("CREATE INDEX idx_example_title ON example (title)")
collection.addIndex("idx_example_title", false, "title", "")

// 验证并保存
// （使用 saveNoValidate 跳过字段验证）
$app.save(collection)
```

## 删除集合

```javascript
let collection = $app.findCollectionByNameOrId("example")

$app.delete(collection)
```
