# 追踪 API

PocketBase 包含内置的分布式追踪支持，用于监控和调试请求流程。追踪 API 允许超级用户查询、过滤和分析追踪数据。

## 列出追踪

返回分页的追踪 span 列表。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/traces`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| page | Number | 分页列表的页码（即偏移量）（默认为 1）。 |
| limit | Number | 每页返回的最大 span 数（默认为 50）。 |
| offset | Number | 分页偏移量（默认为 0）。 |
| trace_id | String | 按特定 trace ID 过滤。 |
| span_id | String | 按特定 span ID 过滤。 |
| operation | String | 按操作名称过滤（如 "HTTP GET /api/collections"）。 |
| status | String | 按状态过滤：`OK` 或 `ERROR`。 |
| start_time | Number | 过滤 start time >= 该值的 span（Unix 微秒）。 |
| end_time | Number | 过滤 start time <= 该值的 span（Unix 微秒）。 |
| root_only | Boolean | 如果为 `true`，仅返回根 span（没有父级的 span）。 |
| attr.* | String | 按 span 属性过滤（如 `attr.http.method=GET`）。 |

**响应**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 50,
  "totalItems": 1250,
  "totalPages": 25,
  "items": [
    {
      "trace_id": "abc123def456",
      "span_id": "span001",
      "parent_span_id": "",
      "operation": "HTTP GET /api/collections",
      "status": "OK",
      "start_time": 1705000000000000,
      "end_time": 1705000000050000,
      "duration_us": 50000,
      "attributes": {
        "http.method": "GET",
        "http.status_code": 200,
        "http.url": "/api/collections"
      }
    }
  ]
}
```

```json [403]
{
  "status": 403,
  "message": "只有超级用户可以访问追踪数据",
  "data": {}
}
```
:::

---

## 获取追踪

返回属于特定追踪的所有 span。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/traces/{traceId}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| traceId | String | 要获取的 trace ID。 |

**响应**

::: code-group
```json [200]
{
  "trace_id": "abc123def456",
  "spans": [
    {
      "trace_id": "abc123def456",
      "span_id": "span001",
      "parent_span_id": "",
      "operation": "HTTP GET /api/collections",
      "status": "OK",
      "start_time": 1705000000000000,
      "end_time": 1705000000050000,
      "duration_us": 50000,
      "attributes": {}
    },
    {
      "trace_id": "abc123def456",
      "span_id": "span002",
      "parent_span_id": "span001",
      "operation": "DB Query",
      "status": "OK",
      "start_time": 1705000000010000,
      "end_time": 1705000000040000,
      "duration_us": 30000,
      "attributes": {
        "db.statement": "SELECT * FROM _collections"
      }
    }
  ]
}
```

```json [404]
{
  "status": 404,
  "message": "追踪未找到",
  "data": {}
}
```
:::

---

## 追踪统计

返回时间范围内追踪的聚合统计信息。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/traces/stats`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| start_time | Number | 从此时间开始过滤统计（Unix 微秒）。 |
| end_time | Number | 到此时间结束过滤统计（Unix 微秒）。 |

**响应**

::: code-group
```json [200]
{
  "total_traces": 1250,
  "total_spans": 8500,
  "error_count": 15,
  "avg_duration_us": 45000,
  "p50_duration_us": 30000,
  "p95_duration_us": 120000,
  "p99_duration_us": 250000
}
```
:::

---

## Span 结构

每个 span 包含以下字段：

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| trace_id | String | 整个追踪的唯一标识符。 |
| span_id | String | 此 span 的唯一标识符。 |
| parent_span_id | String | 父 span ID（根 span 为空）。 |
| operation | String | 操作名称（如 "HTTP GET /api/users"）。 |
| status | String | 状态码：`OK` 或 `ERROR`。 |
| start_time | Number | 开始时间（Unix 微秒）。 |
| end_time | Number | 结束时间（Unix 微秒）。 |
| duration_us | Number | 持续时间（微秒）。 |
| attributes | Object | span 属性的键值对。 |

### 常见属性

| 属性 | 描述 |
|-----------|-------------|
| http.method | HTTP 方法（GET、POST 等）。 |
| http.status_code | HTTP 响应状态码。 |
| http.url | 请求 URL 路径。 |
| db.statement | 数据库查询语句。 |
| db.operation | 数据库操作类型（SELECT、INSERT 等）。 |
| error.message | 错误消息（当状态为 ERROR 时）。 |
