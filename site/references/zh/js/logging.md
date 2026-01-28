# 日志（JavaScript）

`$app.logger()` 可用于将任何日志写入数据库，以便稍后可以从 PocketBase *仪表盘 > 日志* 部分进行浏览。

::: info
为了提高性能并最小化热路径上的阻塞，日志会进行防抖和批量写入：

- 在最后一次防抖日志写入后 3 秒
- 当达到批量阈值时（当前为 200 条）
- 在应用终止前尝试保存现有日志队列中的所有内容
:::

[[toc]]

## 日志方法

所有标准的 [`slog.Logger`](/jsvm/interfaces/slog.Logger.html) 方法都可用，以下是一些最常用的方法列表。请注意，属性以键值对参数的形式表示。

### debug(message, attrs...)

```javascript
$app.logger().debug("调试消息！")

$app.logger().debug(
    "带属性的调试消息！",
    "name", "John Doe",
    "id", 123,
)
```

### info(message, attrs...)

```javascript
$app.logger().info("信息消息！")

$app.logger().info(
    "带属性的信息消息！",
    "name", "John Doe",
    "id", 123,
)
```

### warn(message, attrs...)

```javascript
$app.logger().warn("警告消息！")

$app.logger().warn(
    "带属性的警告消息！",
    "name", "John Doe",
    "id", 123,
)
```

### error(message, attrs...)

```javascript
$app.logger().error("错误消息！")

$app.logger().error(
    "带属性的错误消息！",
    "id", 123,
    "error", err,
)
```

### with(attrs...)

`with(attrs...)` 创建一个新的本地日志记录器，它会在每个后续日志中"注入"指定的属性。

```javascript
const l = $app.logger().with("total", 123)

// 结果日志数据为 {"total": 123}
l.info("message A")

// 结果日志数据为 {"total": 123, "name": "john"}
l.info("message B", "name", "john")
```

### withGroup(name)

`withGroup(name)` 创建一个新的本地日志记录器，它将所有日志属性包装在指定的组名下。

```javascript
const l = $app.logger().withGroup("sub")

// 结果日志数据为 {"sub": { "total": 123 }}
l.info("message A", "total", 123)
```

## 日志设置

你可以从日志设置面板控制各种日志设置，如日志保留期限、最小日志级别、请求 IP 记录等：

![日志设置截图](/images/screenshots/logs.png)

## 自定义日志查询

日志通常用于从 UI 进行过滤，但如果你想以编程方式检索和过滤存储的日志，可以使用 [`$app.logQuery()`](/jsvm/functions/_app.logQuery.html) 查询构建器方法。例如：

```javascript
let logs = arrayOf(new DynamicModel({
    id:      "",
    created: "",
    message: "",
    level:   0,
    data:    {},
}))

// 参见 https://pocketbase.io/docs/js-database/#query-builder
$app.logQuery().
    // 只针对 debug 和 info 日志
    andWhere($dbx.in("level", -4, 0)).
    // data 列是序列化的 json 对象，可以是任何内容
    andWhere($dbx.exp("json_extract(data, '$.type') = 'request'")).
    orderBy("created DESC").
    limit(100).
    all(logs)
```

## 拦截日志写入

如果你想在持久化到数据库之前修改日志数据，或将其转发到外部系统，可以通过附加到[基础模型钩子](/docs/js-event-hooks/#base-model-hooks)来监听 `_logs` 表的变化。例如：

```javascript
onModelCreate((e) => {
    // 打印日志模型字段
    console.log(e.model.id)
    console.log(e.model.created)
    console.log(e.model.level)
    console.log(e.model.message)
    console.log(e.model.data)

    e.next()
}, "_logs")
```
