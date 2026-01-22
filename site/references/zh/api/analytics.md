# 分析 API

PocketBase 包含内置的分析系统，用于跟踪页面浏览量、访客和用户行为。分析 API 提供收集事件和查询统计的端点。

## 收集事件

从客户端接收分析事件。此端点是公开的，不需要认证。

### API 详情

::: info POST
`/api/analytics/events`

公开端点（无需认证）
:::

**请求体**

```json
{
  "events": [
    {
      "type": "pageview",
      "path": "/docs/introduction",
      "referrer": "https://google.com",
      "timestamp": 1705000000000
    }
  ]
}
```

**事件字段**

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| type | String | 事件类型：`pageview`、`event` 等。 |
| path | String | 正在查看的页面路径。 |
| referrer | String | 来源 URL（可选）。 |
| timestamp | Number | 事件时间戳（毫秒）（可选，默认为服务器时间）。 |

**响应**

::: code-group
```json [200]
{
  "accepted": 1
}
```

```json [400]
{
  "status": 400,
  "message": "无效的事件数据",
  "data": {}
}
```
:::

---

## 获取统计

返回日期范围内的聚合分析统计。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/stats`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| range | String | 日期范围：`today`、`7d`（默认）、`30d` 或 `90d`。 |

**响应**

::: code-group
```json [200]
{
  "summary": {
    "totalPV": 15420,
    "totalUV": 3280,
    "bounceRate": 0,
    "avgDur": 0
  },
  "daily": [
    {
      "date": "2025-01-15",
      "pv": 2150,
      "uv": 480
    },
    {
      "date": "2025-01-16",
      "pv": 2380,
      "uv": 520
    }
  ],
  "startDate": "2025-01-10",
  "endDate": "2025-01-16"
}
```

```json [404]
{
  "status": 404,
  "message": "分析已禁用",
  "data": {}
}
```
:::

---

## 热门页面

返回日期范围内访问量最高的页面。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/top-pages`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| range | String | 日期范围：`today`、`7d`（默认）、`30d` 或 `90d`。 |
| limit | Number | 最大结果数（默认 10，最大 100）。 |

**响应**

::: code-group
```json [200]
{
  "pages": [
    {
      "path": "/docs/introduction",
      "pv": 3250,
      "visitors": 1200
    },
    {
      "path": "/docs/collections",
      "pv": 2180,
      "visitors": 890
    }
  ],
  "startDate": "2025-01-10",
  "endDate": "2025-01-16"
}
```
:::

---

## 热门来源

返回日期范围内的热门流量来源（referrer）。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/top-sources`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| range | String | 日期范围：`today`、`7d`（默认）、`30d` 或 `90d`。 |
| limit | Number | 最大结果数（默认 10，最大 100）。 |

**响应**

::: code-group
```json [200]
{
  "sources": [
    {
      "source": "google.com",
      "visitors": 850
    },
    {
      "source": "github.com",
      "visitors": 420
    },
    {
      "source": "(direct)",
      "visitors": 380
    }
  ],
  "startDate": "2025-01-10",
  "endDate": "2025-01-16"
}
```
:::

---

## 设备统计

返回日期范围内的浏览器和操作系统分布。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/devices`

需要 `Authorization: TOKEN`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| range | String | 日期范围：`today`、`7d`（默认）、`30d` 或 `90d`。 |

**响应**

::: code-group
```json [200]
{
  "browsers": [
    {
      "name": "Chrome",
      "visitors": 1850
    },
    {
      "name": "Safari",
      "visitors": 720
    },
    {
      "name": "Firefox",
      "visitors": 380
    }
  ],
  "os": [
    {
      "name": "macOS",
      "visitors": 1200
    },
    {
      "name": "Windows",
      "visitors": 980
    },
    {
      "name": "iOS",
      "visitors": 650
    }
  ],
  "startDate": "2025-01-10",
  "endDate": "2025-01-16"
}
```
:::

---

## 分析配置

返回当前分析配置。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/config`

需要 `Authorization: TOKEN`
:::

**响应**

::: code-group
```json [200]
{
  "enabled": true,
  "retention": 90,
  "flushInterval": 60,
  "hasS3": false
}
```
:::

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| enabled | Boolean | 分析是否启用。 |
| retention | Number | 数据保留期（天）。 |
| flushInterval | Number | 刷新间隔（秒）。 |
| hasS3 | Boolean | 是否配置了 S3 存储用于原始日志。 |

---

## 原始日志

列出可供下载的原始日志日期。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/raw-logs`

需要 `Authorization: TOKEN`
:::

**响应**

::: code-group
```json [200]
{
  "dates": [
    "2025-01-15",
    "2025-01-14",
    "2025-01-13"
  ]
}
```
:::

---

## 下载原始日志

下载特定日期的原始分析日志。

只有超级用户可以执行此操作。

### API 详情

::: info GET
`/api/analytics/raw-logs/{date}`

需要 `Authorization: TOKEN`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| date | String | 日期格式为 YYYY-MM-DD。 |

**响应**

返回 Parquet 文件下载或重定向到 S3 预签名 URL。
