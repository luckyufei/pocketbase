# 健康检查 API

## 健康检查

返回服务器的健康状态。

### API 详情

::: info GET/HEAD
`/api/health`
:::

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| fields | String | 逗号分隔的字符串，指定 JSON 响应中要返回的字段。 |

**响应**

::: code-group
```json [200]
{
  "status": 200,
  "message": "API 运行正常。",
  "data": {
    "canBackup": false
  }
}
```
:::
