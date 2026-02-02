# Gateway Plugin

API Gateway 插件，支持代理转发 LLM API（OpenAI、Claude 等）和本地 Sidecar 服务。

## 特性

- **统一代理架构** - 使用 `httputil.ReverseProxy` 统一本地和远程代理
- **协议归一化** - "暴力归一化" 策略解决 Body Size Mismatch 问题
- **SSE 流式支持** - 100ms FlushInterval 支持实时流式响应
- **结构化错误** - JSON 格式错误响应，便于前端处理
- **Hot Reload** - 配置变更自动生效，无需重启

### Gateway Hardening (v0.20+)

生产级增强功能：

- **精细化超时控制** - DialTimeout, ResponseHeaderTimeout, IdleConnTimeout
- **优化连接池** - MaxIdleConns=1000, MaxIdleConnsPerHost=100
- **并发限制** - 基于 semaphore 的流量控制，保护脆弱后端
- **熔断器** - 三态熔断 (Closed/Open/HalfOpen)，自动故障隔离
- **内存池** - sync.Pool 复用 Buffer，减少 GC 压力
- **Prometheus 指标** - `/api/gateway/metrics` 端点

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
    Disabled      bool            // 禁用插件（默认 false）
    EnableMetrics bool            // 启用 Prometheus 指标（默认 false）
    TransportConfig *TransportConfig // 自定义 Transport 配置
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
| **maxConcurrent** | int | 最大并发数（0=不限制）|
| **circuitBreaker** | json | 熔断器配置 |
| **timeoutConfig** | json | 精细超时配置 |

### Gateway Hardening 配置示例

```json
{
  "maxConcurrent": 10,
  "circuitBreaker": {
    "enabled": true,
    "failure_threshold": 5,
    "recovery_timeout": 30,
    "half_open_requests": 1
  },
  "timeoutConfig": {
    "dial": 2,
    "response_header": 30,
    "idle": 90
  }
}
```

#### 并发限制 (maxConcurrent)

保护处理能力有限的后端服务（如 Python Sidecar）：

- `maxConcurrent: 0` - 不限制（默认）
- `maxConcurrent: 10` - 最多 10 个并发请求
- 超限请求返回 `429 Too Many Requests` + `Retry-After` 头

#### 熔断器 (circuitBreaker)

自动故障隔离，防止级联失败：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| enabled | false | 是否启用 |
| failure_threshold | 5 | 连续失败多少次触发熔断 |
| recovery_timeout | 30 | 熔断后多少秒尝试恢复 |
| half_open_requests | 1 | HalfOpen 状态允许通过的请求数 |

**状态机：**
```
Closed → (N次失败) → Open → (超时) → HalfOpen → (成功) → Closed
                                   → (失败) → Open
```

#### 超时配置 (timeoutConfig)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| dial | 2 | 建连超时（秒）|
| response_header | 30 | 首字节超时（秒），0=不限制 |
| idle | 90 | 空闲连接超时（秒）|

**AI 场景推荐**：设置 `response_header: 0` 禁用首字节超时，因为 LLM 推理可能需要较长时间。

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

全局共享的 HardenedTransport（优化后）：

```go
transport := &http.Transport{
    Proxy:                 http.ProxyFromEnvironment,
    ForceAttemptHTTP2:     true,
    MaxIdleConns:          1000,  // 总连接池 (原 100)
    MaxIdleConnsPerHost:   100,   // 单上游连接池 (原 2)
    IdleConnTimeout:       90 * time.Second,
    TLSHandshakeTimeout:   5 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
    DialContext: (&net.Dialer{
        Timeout:   2 * time.Second,  // 建连超时
        KeepAlive: 30 * time.Second, // TCP KeepAlive
    }).DialContext,
}
```

### 连接池优化说明

| 配置 | 原值 | 优化后 | 说明 |
|------|------|--------|------|
| MaxIdleConns | 100 | 1000 | 支持更多并发连接 |
| MaxIdleConnsPerHost | 2 | 100 | **关键**：Go 默认只有 2，严重限制复用 |

连接复用率测试结果：100 个请求仅创建 1 个连接，复用率 **99%+**。

## Prometheus 指标

访问 `/api/gateway/metrics`（需要 superuser 权限）：

```prometheus
# HELP gateway_requests_total Total number of requests
# TYPE gateway_requests_total counter
gateway_requests_total{proxy="openai",status="200"} 1523
gateway_requests_total{proxy="openai",status="429"} 12
gateway_requests_total{proxy="openai",status="503"} 3

# HELP gateway_latency_seconds Request latency histogram
# TYPE gateway_latency_seconds histogram
gateway_latency_seconds_bucket{proxy="openai",le="0.01"} 500
gateway_latency_seconds_bucket{proxy="openai",le="0.05"} 1200
gateway_latency_seconds_bucket{proxy="openai",le="0.1"} 1450
gateway_latency_seconds_bucket{proxy="openai",le="+Inf"} 1523
gateway_latency_seconds_sum{proxy="openai"} 45.23
gateway_latency_seconds_count{proxy="openai"} 1523

# HELP gateway_active_connections Current active connections
# TYPE gateway_active_connections gauge
gateway_active_connections{proxy="openai"} 5

# HELP gateway_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)
# TYPE gateway_circuit_breaker_state gauge
gateway_circuit_breaker_state{proxy="openai"} 0
```

### Grafana Dashboard

推荐面板：

1. **QPS** - `rate(gateway_requests_total[1m])`
2. **Error Rate** - `rate(gateway_requests_total{status=~"5.."}[1m]) / rate(gateway_requests_total[1m])`
3. **P99 Latency** - `histogram_quantile(0.99, rate(gateway_latency_seconds_bucket[5m]))`
4. **Active Connections** - `gateway_active_connections`
5. **Circuit State** - `gateway_circuit_breaker_state`

## 性能调优指南

### 场景 1：高并发 API 代理

```json
{
  "maxConcurrent": 0,
  "timeoutConfig": {
    "dial": 2,
    "response_header": 30,
    "idle": 90
  }
}
```

- 不限制并发（由连接池自动调节）
- 标准超时配置

### 场景 2：保护脆弱后端（Python Sidecar）

```json
{
  "maxConcurrent": 5,
  "circuitBreaker": {
    "enabled": true,
    "failure_threshold": 3,
    "recovery_timeout": 30
  }
}
```

- 限制并发为 5（匹配 Python 进程数）
- 启用熔断保护

### 场景 3：AI 长推理

```json
{
  "maxConcurrent": 10,
  "timeoutConfig": {
    "dial": 2,
    "response_header": 0,
    "idle": 90
  }
}
```

- 禁用首字节超时（`response_header: 0`）
- 适度限制并发（AI 服务资源有限）

## License

同 PocketBase 主项目。
