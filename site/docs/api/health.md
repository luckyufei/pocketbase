# Health API

## Health check

Returns the health status of the server.

### API details

::: info GET/HEAD
`/api/health`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response. |

**Responses**

::: code-group
```json [200]
{
  "status": 200,
  "message": "API is healthy.",
  "data": {
    "canBackup": false
  }
}
```
:::
