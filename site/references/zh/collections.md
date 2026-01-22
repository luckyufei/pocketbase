# 数据集合

[[toc]]

## 概述

**数据集合（Collections）** 用于存储你的应用数据。底层由普通的 SQLite 表支持，这些表根据集合的**名称**和**字段**（列）自动生成。

集合中的单个条目称为**记录（Record）**（SQL 表中的一行）。

你可以通过管理后台、使用 [客户端 SDK](/zh/how-to-use) 的 Web API（*仅限超级用户*）或通过 [Go](/zh/go/migrations)/[JavaScript](/zh/js/migrations) 迁移以编程方式管理**集合**。

同样，你可以通过管理后台、使用 [客户端 SDK](/zh/how-to-use) 的 Web API 或通过 [Go](/zh/go/records)/[JavaScript](/zh/js/records) 记录操作以编程方式管理**记录**。

以下是管理后台中集合编辑面板的截图：

![集合面板截图](/images/screenshots/collection-panel.png)

目前有 3 种集合类型：**Base（基础）**、**View（视图）** 和 **Auth（认证）**。

### Base 集合

**Base 集合**是默认的集合类型，可用于存储任何应用数据（文章、产品、帖子等）。

### View 集合

**View 集合**是只读集合类型，数据通过普通 SQL `SELECT` 语句填充，允许用户执行聚合或其他自定义查询。

例如，以下查询将创建一个包含 3 个 *posts* 字段的只读集合 - *id*、*name* 和 *totalComments*：

```sql
SELECT
    posts.id,
    posts.name,
    count(comments.id) as totalComments
FROM posts
LEFT JOIN comments on comments.postId = posts.id
GROUP BY posts.id
```

::: info
View 集合不会接收实时事件，因为它们没有创建/更新/删除操作。
:::

### Auth 集合

**Auth 集合**包含 **Base 集合**的所有功能，但还有一些额外的特殊字段来帮助你管理应用用户，并提供各种认证选项。

每个 Auth 集合都有以下特殊系统字段：`email`、`emailVisibility`、`verified`、`password` 和 `tokenKey`。

这些字段不能重命名或删除，但可以使用特定的字段选项进行配置。例如，你可以设置用户邮箱为必填或可选。

你可以创建任意数量的 Auth 集合（users、managers、staffs、members、clients 等），每个集合都有自己的字段集、独立的登录和记录管理端点。

#### 访问控制

你可以构建各种不同的访问控制：

- **角色（分组）** - 例如，你可以在 Auth 集合中添加一个 "role" `select` 字段，选项为："employee" 和 "staff"。然后在其他集合中定义如下规则以仅允许 "staff"：`@request.auth.role = "staff"`

- **关联（所有权）** - 假设你有 2 个集合 - "posts" base 集合和 "users" auth 集合。在 "posts" 集合中创建指向 "users" 集合的 "author" `relation` 字段。要仅允许记录的 "author" 访问，可以使用如下规则：`@request.auth.id != "" && author = @request.auth.id`

- **托管** - 除了默认的 "List"、"View"、"Create"、"Update"、"Delete" API 规则外，Auth 集合还有一个特殊的 "Manage" API 规则，可用于允许一个用户完全管理另一个用户的数据。

- **混合** - 你可以根据独特的用例构建混合方法。多个规则可以用括号 `()` 分组，并用 `&&`（AND）和 `||`（OR）运算符组合：`@request.auth.id != "" && (@request.auth.role = "staff" || author = @request.auth.id)`

## 字段

::: info
所有集合字段（*除了 `JSONField`*）都是**非空的，使用零值默认**作为缺失时的回退值（text 为空字符串，number 为 0，等等）。

所有字段特定的修饰符都支持在 Web API 和通过记录 Get/Set 方法中使用。
:::

<Accordion title="BoolField">

BoolField 定义 `bool` 类型字段，用于存储单个 `false`（默认）或 `true` 值。

</Accordion>

<Accordion title="NumberField">

NumberField 定义 `number` 类型字段，用于存储数字/float64 值：`0`（默认）、`2`、`-1`、`1.5`。

以下额外的设置修饰符可用：

- `fieldName+` 将数字添加到现有记录值
- `fieldName-` 从现有记录值中减去数字

</Accordion>

<Accordion title="TextField">

TextField 定义 `text` 类型字段，用于存储字符串值：`""`（默认）、`"example"`。

以下额外的设置修饰符可用：

- `fieldName:autogenerate` 如果设置了 `AutogeneratePattern` 字段选项，则自动生成字段值。例如，提交：`{"slug:autogenerate":"abc-"}` 将生成 `"abc-[random]"` 的 `slug` 字段值。

</Accordion>

<Accordion title="EmailField">

EmailField 定义 `email` 类型字段，用于存储单个邮箱地址字符串：`""`（默认）、`"john@example.com"`。

</Accordion>

<Accordion title="URLField">

URLField 定义 `url` 类型字段，用于存储单个 URL 字符串值：`""`（默认）、`"https://example.com"`。

</Accordion>

<Accordion title="EditorField">

EditorField 定义 `editor` 类型字段，用于存储 HTML 格式的文本：`""`（默认）、`<p>example</p>`。

</Accordion>

<Accordion title="DateField">

DateField 定义 `date` 类型字段，用于存储单个日期时间字符串值：`""`（默认）、`"2022-01-01 00:00:00.000Z"`。

目前所有 PocketBase 日期都遵循 RFC3399 格式 `Y-m-d H:i:s.uZ`（例如 `2024-11-10 18:45:27.123Z`）。

日期作为字符串进行比较，这意味着在使用过滤器与日期字段时，你需要指定完整的日期时间字符串格式。例如，要定位单个日期（如 2024 年 11 月 19 日），可以使用类似：
```
created >= '2024-11-19 00:00:00.000Z' && created <= '2024-11-19 23:59:59.999Z'
```

</Accordion>

<Accordion title="AutodateField">

AutodateField 定义 `autodate` 类型字段，类似于 DateField，但其值在记录创建/更新时自动设置。

此字段通常用于定义时间戳字段，如 "created" 和 "updated"。

</Accordion>

<Accordion title="SelectField">

SelectField 定义 `select` 类型字段，用于从预定义列表中存储单个或多个字符串值。

通常用于处理枚举类值，如 `pending/public/private` 状态、简单的 `client/staff/manager/admin` 角色等。

对于**单选** `select`（*`MaxSelect` 选项 <= 1*），字段值是字符串：`""`、`"optionA"`。

对于**多选** `select`（*`MaxSelect` 选项 >= 2*），字段值是数组：`[]`、`["optionA", "optionB"]`。

以下额外的设置修饰符可用：

- `fieldName+` 将一个或多个值追加到现有值
- `+fieldName` 将一个或多个值前置到现有值
- `fieldName-` 从现有值中减去/移除一个或多个值

例如：`{"permissions+": "optionA", "roles-": ["staff", "editor"]}`

</Accordion>

<Accordion title="FileField">

FileField 定义 `file` 类型字段，用于管理记录文件。

PocketBase 在数据库中只存储文件名。文件本身存储在本地磁盘或 S3 中，取决于你的应用存储设置。

对于**单个** `file`（*`MaxSelect` 选项 <= 1*），存储值是字符串：`""`、`"file1_Ab24ZjL.png"`。

对于**多个** `file`（*`MaxSelect` 选项 >= 2*），存储值是数组：`[]`、`["file1_Ab24ZjL.png", "file2_Frq24ZjL.txt"]`。

以下额外的设置修饰符可用：

- `fieldName+` 将一个或多个文件追加到现有字段值
- `+fieldName` 将一个或多个文件前置到现有字段值
- `fieldName-` 从现有字段值中删除一个或多个文件

例如：`{"documents+": new File(...), "documents-": ["file1_Ab24ZjL.txt", "file2_Frq24ZjL.txt"]}`

你可以在 [文件上传和处理](/zh/files-handling) 指南中找到更详细的信息。

</Accordion>

<Accordion title="RelationField">

RelationField 定义 `relation` 类型字段，用于存储单个或多个集合记录引用。

对于**单个** `relation`（*`MaxSelect` 选项 <= 1*），字段值是字符串：`""`、`"RECORD_ID"`。

对于**多个** `relation`（*`MaxSelect` 选项 >= 2*），字段值是数组：`[]`、`["RECORD_ID1", "RECORD_ID2"]`。

以下额外的设置修饰符可用：

- `fieldName+` 将一个或多个 ID 追加到现有值
- `+fieldName` 将一个或多个 ID 前置到现有值
- `fieldName-` 从现有值中减去/移除一个或多个 ID

例如：`{"users+": "USER_ID", "categories-": ["CAT_ID1", "CAT_ID2"]}`

</Accordion>

<Accordion title="JSONField">

JSONField 定义 `json` 类型字段，用于存储任何序列化的 JSON 值，包括 `null`（默认）。

</Accordion>

<Accordion title="GeoPoint">

GeoPoint 定义 `geoPoint` 类型字段，用于存储地理坐标（经度、纬度）作为序列化的 JSON 对象。例如：`{"lon":12.34,"lat":56.78}`。

`geoPoint` 的默认/零值是 "Null Island"，即 `{"lon":0,"lat":0}`。

<CodeTabs :tabs="['Go', 'JavaScript']">

<template #go>

```go
// 设置 types.GeoPoint
record.Set("address", types.GeoPoint{Lon:12.34, Lat:45.67})

// 设置 map[string]any
record.Set("address", map[string]any{"lon":12.34, "lat":45.67})

// 获取字段值作为 types.GeoPoint 结构体
address := record.GetGeoPoint("address")
```

</template>

<template #js>

```javascript
record.set("address", {"lon":12.34, "lat":45.67})

const address = record.get("address")
```

</template>

</CodeTabs>

</Accordion>
