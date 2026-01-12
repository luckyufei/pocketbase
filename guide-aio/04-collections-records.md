# Collections 与 Records

## 集合类型

| 类型 | 描述 |
|------|------|
| **Base** | 默认类型，存储任何应用数据 |
| **View** | 只读，数据从 SQL SELECT 语句填充 |
| **Auth** | 包含 Base 功能 + 用户认证特殊字段 |

## 字段类型

| 类型 | 描述 | 修饰符 |
|------|------|--------|
| `bool` | 布尔值 | - |
| `number` | 数字 | `+`（加）, `-`（减） |
| `text` | 字符串 | `:autogenerate` |
| `email` | 邮箱 | - |
| `url` | URL | - |
| `editor` | HTML 文本 | - |
| `date` | 日期时间 | 格式：`Y-m-d H:i:s.uZ` |
| `autodate` | 自动日期 | 创建/更新时自动设置 |
| `select` | 预定义选项 | `+`, `-` |
| `file` | 文件 | `+`, `-` |
| `relation` | 关系引用 | `+`, `-` |
| `json` | JSON 数据 | - |
| `geoPoint` | 地理坐标 | - |

## Record 操作（Go）

```go
// 查找
record, _ := app.FindRecordById("articles", "RECORD_ID")
record, _ := app.FindFirstRecordByData("articles", "slug", "test")
record, _ := app.FindFirstRecordByFilter("articles", "status = 'public'")
records, _ := app.FindRecordsByFilter("articles", "status = 'public'", "-created", 10, 0)

// 创建
collection, _ := app.FindCollectionByNameOrId("articles")
record := core.NewRecord(collection)
record.Set("title", "Hello")
record.Set("content", "World")
app.Save(record)

// 更新
record.Set("title", "Updated")
app.Save(record)

// 删除
app.Delete(record)
```

## Record 字段访问

```go
// 获取字段值
record.Get("field")                    // any
record.GetString("field")              // string
record.GetInt("field")                 // int
record.GetBool("field")                // bool
record.GetDateTime("field")            // types.DateTime
record.GetStringSlice("field")         // []string

// 设置字段值
record.Set("field", value)

// 展开关系
record.ExpandedOne("relation_field")   // *Record
record.ExpandedAll("relation_field")   // []*Record
```

## Collection 操作

```go
// 查找
collection, _ := app.FindCollectionByNameOrId("articles")

// 创建
collection := core.NewBaseCollection("articles")
collection.Fields.Add(&core.TextField{Name: "title", Required: true})
collection.Fields.Add(&core.EditorField{Name: "content"})
app.Save(collection)

// 更新
collection.Fields.Add(&core.NumberField{Name: "views"})
app.Save(collection)

// 删除
app.Delete(collection)
```
