# API 规则与过滤器

[[toc]]

## API 规则

**API 规则**是你的集合访问控制和数据过滤器。

每个集合有 **5 条规则**，对应特定的 API 操作：

- `listRule`
- `viewRule`
- `createRule`
- `updateRule`
- `deleteRule`

Auth 集合还有一个额外的 `options.manageRule`，用于允许一个用户（甚至可以来自不同集合）能够完全管理另一个用户的数据（如更改他们的邮箱、密码等）。

每条规则可以设置为：

- **"locked"** - 即 `null`，表示该操作只能由授权的超级用户执行（**这是默认设置**）
- **空字符串** - 任何人都可以执行该操作（超级用户、已授权用户和访客）
- **非空字符串** - 只有满足规则过滤表达式的用户（无论是否授权）才能执行此操作

::: info
**PocketBase API 规则同时也作为记录过滤器！**

换句话说，你可以例如只允许列出集合中"active"的记录，使用简单的过滤表达式如：`status = "active"`（其中 "status" 是你集合中定义的字段）。

因此，如果请求不满足 `listRule`，API 将返回 200 空项响应，不满足 `createRule` 返回 400，不满足 `viewRule`、`updateRule` 和 `deleteRule` 返回 404。

如果规则被"锁定"（即仅超级用户）且请求客户端不是超级用户，所有规则都将返回 403。

当操作由授权的超级用户执行时，API 规则会被忽略（**超级用户可以访问一切**）！
:::

## 过滤器语法

你可以在集合 API 规则选项卡中找到可用字段的信息：

![集合 API 规则过滤器截图](/images/screenshots/collection-rules.png)

有自动完成功能帮助你输入规则过滤表达式，但通常你可以访问 **3 组字段**：

### 你的集合 Schema 字段

这包括所有嵌套的关联字段，例如 `someRelField.status != "pending"`

### @request.*

用于访问当前请求数据，如查询参数、正文/表单字段、已授权用户状态等。

- `@request.context` - 规则使用的上下文（例如 `@request.context != "oauth2"`）
  - 支持的上下文值：`default`、`oauth2`、`otp`、`password`、`realtime`、`protectedFile`
- `@request.method` - HTTP 请求方法（例如 `@request.method = "GET"`）
- `@request.headers.*` - 请求头作为字符串值（例如 `@request.headers.x_token = "test"`）
  - 注意：所有头键都标准化为小写，"-" 替换为 "_"
- `@request.query.*` - 请求查询参数作为字符串值（例如 `@request.query.page = "1"`）
- `@request.auth.*` - 当前已认证模型（例如 `@request.auth.id != ""`）
- `@request.body.*` - 提交的正文参数（例如 `@request.body.title != ""`）
  - 注意：上传的文件不是 `@request.body` 的一部分

### @collection.*

此过滤器可用于定位与当前集合不直接相关但共享公共字段值的其他集合：

```
@collection.news.categoryId ?= categoryId && @collection.news.author ?= @request.auth.id
```

如果你想基于不同条件多次连接同一集合，可以通过在集合名称后附加 `:alias` 后缀来定义别名：

```
@request.auth.id != "" &&
@collection.courseRegistrations.user ?= id &&
@collection.courseRegistrations:auth.user ?= @request.auth.id &&
@collection.courseRegistrations.courseGroup ?= @collection.courseRegistrations:auth.courseGroup
```

## 过滤器运算符

<FilterSyntax />

## 特殊标识符和修饰符

### @ 宏

以下日期时间宏可用，可作为过滤表达式的一部分：

```
// 所有宏都基于 UTC
@now        - 当前日期时间字符串
@second     - @now 的秒数 (0-59)
@minute     - @now 的分钟数 (0-59)
@hour       - @now 的小时数 (0-23)
@weekday    - @now 的星期数 (0-6)
@day        - @now 的日数
@month      - @now 的月数
@year       - @now 的年数
@yesterday  - 相对于 @now 的昨天日期时间字符串
@tomorrow   - 相对于 @now 的明天日期时间字符串
@todayStart - 当天开始的日期时间字符串
@todayEnd   - 当天结束的日期时间字符串
@monthStart - 当月开始的日期时间字符串
@monthEnd   - 当月结束的日期时间字符串
@yearStart  - 当年开始的日期时间字符串
@yearEnd    - 当年结束的日期时间字符串
```

例如：`@request.body.publicDate >= @now`

### :isset 修饰符

`:isset` 字段修饰符仅适用于 `@request.*` 字段，可用于检查客户端是否随请求提交了特定数据：

```
@request.body.role:isset = false
```

### :length 修饰符

`:length` 字段修饰符可用于检查数组字段（多个 `file`、`select`、`relation`）中的项目数量：

```
// 检查提交的示例数据：{"someSelectField": ["val1", "val2"]}
@request.body.someSelectField:length > 1

// 检查现有记录字段长度
someRelationField:length = 2
```

### :each 修饰符

`:each` 字段修饰符仅适用于多选 `select`、`file` 和 `relation` 类型字段。可用于对字段数组中的每个项目应用条件：

```
// 检查所有提交的选择选项是否包含 "create" 文本
@request.body.someSelectField:each ~ "create"

// 检查所有现有的 someSelectField 是否有 "pb_" 前缀
someSelectField:each ~ "pb_%"
```

### :lower 修饰符

`:lower` 字段修饰符可用于执行小写字符串比较：

```
// 检查提交的小写 body "title" 字段是否等于 "test"
@request.body.title:lower = "test"

// 匹配小写 "title" 等于 "test" 的现有记录
title:lower ~ "test"
```

### geoDistance(lonA, latA, lonB, latB)

`geoDistance(lonA, latA, lonB, latB)` 函数可用于计算两个地理点之间的 Haversine 距离（以公里为单位）：

```
// 距离我的位置不到 25 公里的办公室
geoDistance(address.lon, address.lat, 23.32, 42.69) < 25
```

## 示例

- 仅允许已注册用户：
  ```
  @request.auth.id != ""
  ```

- 仅允许已注册用户，并返回 "active" 或 "pending" 状态的记录：
  ```
  @request.auth.id != "" && (status = "active" || status = "pending")
  ```

- 仅允许在 *allowed_users* 多关联字段值中列出的已注册用户：
  ```
  @request.auth.id != "" && allowed_users.id ?= @request.auth.id
  ```

- 允许任何人访问，仅返回 *title* 字段值以 "Lorem" 开头的记录：
  ```
  title ~ "Lorem%"
  ```
