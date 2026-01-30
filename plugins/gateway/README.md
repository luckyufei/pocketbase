# Gateway Plugin

API Gateway 插件，支持代理转发 LLM API（OpenAI、Claude 等）和本地 Sidecar 服务。

## 特性

- **统一代理架构** - 使用 `httputil.ReverseProxy` 统一本地和远程代理
- **协议归一化** - "暴力归一化" 策略解决 Body Size Mismatch 问题
- **SSE 流式支持** - 100ms FlushInterval 支持实时流式响应
- **结构化错误** - JSON 格式错误响应，便于前端处理
- **Hot Reload** - 配置变更自动生效，无需重启

## 安装

在 `main.go` 中注册插件：

```go
import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/gateway"
)

func main() {
    app := pocketbase.New()
    
    // 注册 Gateway 插件
    gateway.MustRegister(app, gateway.Config{})
    
    app.Start()
}
```

## 配置

### Config 结构体

```go
type Config struct {
    Disabled bool // 禁用插件（默认 false）
}
```

### 代理配置（_proxies Collection）

| 字段 | 类型 | 说明 |
|------|------|------|
| path | string | 拦截路径，如 `/-/openai` |
| upstream | string | 上游服务地址，如 `https://api.openai.com` |
| stripPath | bool | 是否移除匹配前缀（默认 true） |
| accessRule | string | 访问控制规则 |
| headers | json | 注入的请求头（支持模板） |
| timeout | int | 超时时间（秒，默认 30） |
| active | bool | 是否启用（默认 true） |

### 请求头模板语法

```json
{
  "Authorization": "Bearer {env.OPENAI_API_KEY}",
  "X-User-ID": "@request.auth.id"
}
```

支持的模板变量：
- `{env.VAR_NAME}` - 环境变量
- `{secret.VAR_NAME}` - 从 `_secrets` 表读取
- `@request.auth.field` - 当前认证用户字段

### 访问控制规则

| 规则 | 说明 |
|------|------|
| `""` (空) | 仅 Superuser |
| `"true"` | 公开访问 |
| `"@request.auth.id != ''"` | 需要登录 |

## 使用示例

### 代理 OpenAI API

1. 在 Admin UI 创建 `_proxies` 记录：
   - path: `/-/openai`
   - upstream: `https://api.openai.com`
   - headers: `{"Authorization": "Bearer {env.OPENAI_API_KEY}"}`
   - accessRule: `@request.auth.id != ''`

2. 客户端调用：
   ```bash
   curl -X POST http://localhost:8090/-/openai/v1/chat/completions \
     -H "Authorization: Bearer <user_token>" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4", "messages": [...]}'
   ```

### 代理本地 Sidecar

```
path: /-/local
upstream: http://127.0.0.1:8001
accessRule: true
```

## 协议归一化原理

### 问题背景

直接使用 `httputil.ReverseProxy` 代理 LLM API 时会遇到：
- **Body Size Mismatch** - Go 自动解压导致 Content-Length 不匹配
- **Unexpected EOF** - 流式响应时的异常中断
- **403 Forbidden** - Cloudflare/AWS 校验 Host 头

### 解决方案

"暴力归一化" 策略：

```go
proxy := &httputil.ReverseProxy{
    Director: func(req *http.Request) {
        // 1. 重写 Host 头 - 解决 403
        req.Host = target.Host
        
        // 2. 强制剥离压缩 - 解决 Size Mismatch
        req.Header.Del("Accept-Encoding")
        
        // 3. 清理 hop-by-hop 头
        req.Header.Del("Connection")
        // ...
    },
    FlushInterval: 100 * time.Millisecond, // SSE 优化
}
```

### 代价

- 带宽增加 3-5 倍（不压缩）
- 对 AI 文本流完全可接受（几 KB ~ 几百 KB）

## Observability 限制

**重要**：Gateway 只负责代理转发，**不存储聊天记录**。

聊天记录存储应由：
- **Local Sidecar** - Python 端自己入库
- **Remote LLM** - 前端 UI 异步归档（调用 `/api/chat/save`）

这样保持了网关的极简和高性能。

## 错误响应

所有错误以 JSON 格式返回：

```json
{
  "error": "Upstream Unavailable",
  "details": "connection refused"
}
```

| HTTP Code | Error | 说明 |
|-----------|-------|------|
| 404 | Proxy Not Found | 无匹配的代理配置 |
| 401 | Authentication required | 需要登录 |
| 403 | Access Denied | 无权访问 |
| 502 | Upstream Unavailable | 上游服务不可达 |
| 504 | Gateway Timeout | 请求超时 |

## Transport 配置

全局共享的 HTTP Transport：

```go
transport := &http.Transport{
    Proxy:                 http.ProxyFromEnvironment, // 支持系统代理
    ForceAttemptHTTP2:     true,                      // HTTP/2 优化
    MaxIdleConns:          100,                       // 连接池大小
    IdleConnTimeout:       90 * time.Second,          // 空闲超时
    TLSHandshakeTimeout:   10 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
}
```

## License

同 PocketBase 主项目。
