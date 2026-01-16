# Analytics API

PocketBase includes a built-in analytics system for tracking page views, visitors, and user behavior. The Analytics API provides endpoints for collecting events and querying statistics.

## Collect events

Receives analytics events from clients. This endpoint is public and does not require authentication.

### API details

::: info POST
`/api/analytics/events`

Public endpoint (no authentication required)
:::

**Request body**

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

**Event fields**

| Field | Type | Description |
|-------|------|-------------|
| type | String | Event type: `pageview`, `event`, etc. |
| path | String | Page path being viewed. |
| referrer | String | Referrer URL (optional). |
| timestamp | Number | Event timestamp in milliseconds (optional, defaults to server time). |

**Responses**

::: code-group
```json [200]
{
  "accepted": 1
}
```

```json [400]
{
  "status": 400,
  "message": "Invalid event data",
  "data": {}
}
```
:::

---

## Get stats

Returns aggregated analytics statistics for a date range.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/stats`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| range | String | Date range: `today`, `7d` (default), `30d`, or `90d`. |

**Responses**

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
  "message": "Analytics is disabled",
  "data": {}
}
```
:::

---

## Top pages

Returns the most visited pages within a date range.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/top-pages`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| range | String | Date range: `today`, `7d` (default), `30d`, or `90d`. |
| limit | Number | Maximum number of results (default 10, max 100). |

**Responses**

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

## Top sources

Returns the top traffic sources (referrers) within a date range.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/top-sources`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| range | String | Date range: `today`, `7d` (default), `30d`, or `90d`. |
| limit | Number | Maximum number of results (default 10, max 100). |

**Responses**

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

## Device stats

Returns browser and operating system distribution within a date range.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/devices`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| range | String | Date range: `today`, `7d` (default), `30d`, or `90d`. |

**Responses**

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

## Analytics config

Returns the current analytics configuration.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/config`

Requires `Authorization: TOKEN`
:::

**Responses**

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

| Field | Type | Description |
|-------|------|-------------|
| enabled | Boolean | Whether analytics is enabled. |
| retention | Number | Data retention period in days. |
| flushInterval | Number | Flush interval in seconds. |
| hasS3 | Boolean | Whether S3 storage is configured for raw logs. |

---

## Raw logs

List available raw log dates for download.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/raw-logs`

Requires `Authorization: TOKEN`
:::

**Responses**

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

## Download raw log

Download raw analytics log for a specific date.

Only superusers can perform this action.

### API details

::: info GET
`/api/analytics/raw-logs/{date}`

Requires `Authorization: TOKEN`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| date | String | Date in YYYY-MM-DD format. |

**Responses**

Returns a Parquet file download or redirects to S3 presigned URL.
