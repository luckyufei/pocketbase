# Traces API

PocketBase includes built-in distributed tracing support for monitoring and debugging request flows. The Traces API allows superusers to query, filter, and analyze trace data.

## List traces

Returns a paginated list of trace spans.

Only superusers can perform this action.

### API details

::: info GET
`/api/traces`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| page | Number | The page (aka. offset) of the paginated list (default to 1). |
| limit | Number | The max returned spans per page (default to 50). |
| offset | Number | The offset for pagination (default to 0). |
| trace_id | String | Filter by specific trace ID. |
| span_id | String | Filter by specific span ID. |
| operation | String | Filter by operation name (e.g., "HTTP GET /api/collections"). |
| status | String | Filter by status: `OK` or `ERROR`. |
| start_time | Number | Filter spans with start time >= value (Unix microseconds). |
| end_time | Number | Filter spans with start time <= value (Unix microseconds). |
| root_only | Boolean | If `true`, only return root spans (spans without parent). |
| attr.* | String | Filter by span attributes (e.g., `attr.http.method=GET`). |

**Responses**

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
  "message": "Only superusers can access trace data",
  "data": {}
}
```
:::

---

## Get trace

Returns all spans belonging to a specific trace.

Only superusers can perform this action.

### API details

::: info GET
`/api/traces/{traceId}`

Requires `Authorization: TOKEN`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| traceId | String | The trace ID to retrieve. |

**Responses**

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
  "message": "Trace not found",
  "data": {}
}
```
:::

---

## Trace stats

Returns aggregated statistics for traces within a time range.

Only superusers can perform this action.

### API details

::: info GET
`/api/traces/stats`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| start_time | Number | Filter stats from this time (Unix microseconds). |
| end_time | Number | Filter stats until this time (Unix microseconds). |

**Responses**

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

## Span structure

Each span contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| trace_id | String | Unique identifier for the entire trace. |
| span_id | String | Unique identifier for this span. |
| parent_span_id | String | Parent span ID (empty for root spans). |
| operation | String | Name of the operation (e.g., "HTTP GET /api/users"). |
| status | String | Status code: `OK` or `ERROR`. |
| start_time | Number | Start time in Unix microseconds. |
| end_time | Number | End time in Unix microseconds. |
| duration_us | Number | Duration in microseconds. |
| attributes | Object | Key-value pairs of span attributes. |

### Common attributes

| Attribute | Description |
|-----------|-------------|
| http.method | HTTP method (GET, POST, etc.). |
| http.status_code | HTTP response status code. |
| http.url | Request URL path. |
| db.statement | Database query statement. |
| db.operation | Database operation type (SELECT, INSERT, etc.). |
| error.message | Error message (when status is ERROR). |
