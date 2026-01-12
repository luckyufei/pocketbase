# Gateway (Proxy)

## 概述

反向代理网关，支持最长前缀匹配、热重载、请求头注入。

## 配置结构

```go
type ProxyConfig struct {
    ID         string
    Path       string            // 匹配路径，如 "/-/openai"
    Upstream   string            // 上游服务地址
    StripPath  bool              // 是否移除匹配前缀
    AccessRule string            // 访问规则
    Headers    map[string]string // 注入的请求头
    Timeout    int               // 超时时间（秒）
    Active     bool              // 是否启用
}
```

## 使用示例

```go
pm := app.ProxyManager()

// 加载配置
pm.LoadProxies()

// 热重载
pm.Reload()

// 匹配代理
proxy := pm.MatchProxy("/api/openai/chat")
```

## 路由

代理请求通过 `/-/*` 路径访问：

```
GET/POST/PUT/PATCH/DELETE /-/{path...}
```

## 配置示例

```json
{
    "id": "openai-proxy",
    "path": "/-/openai",
    "upstream": "https://api.openai.com",
    "stripPath": true,
    "headers": {
        "Authorization": "Bearer {{secrets.OPENAI_API_KEY}}"
    },
    "timeout": 60,
    "active": true
}
```

## 请求流程

```
客户端请求: GET /-/openai/v1/chat/completions
    ↓
匹配代理: path = "/-/openai"
    ↓
移除前缀: /v1/chat/completions (stripPath=true)
    ↓
注入请求头: Authorization: Bearer sk-xxx
    ↓
转发到上游: https://api.openai.com/v1/chat/completions
```

## 访问规则

使用与 API Rules 相同的过滤器语法：

```javascript
// 仅认证用户
@request.auth.id != ""

// 仅特定角色
@request.auth.role = "admin"

// 空字符串 = 公开访问
""
```
