# Native Gateway 使用指南

## 概述

Native Gateway 是 PocketBase 内置的 API 网关功能，允许你将外部 API 请求代理到上游服务，同时复用 PocketBase 的认证和权限系统。

### 核心特性

- **零配置部署**: 无需额外的 Nginx/Traefik，单二进制即可运行
- **统一认证**: 复用 PocketBase 的用户认证和 Rule Engine
- **密钥保护**: 敏感 API Key 存储在服务端，前端无法获取
- **请求头注入**: 支持动态注入环境变量、用户信息到上游请求
- **Hot Reload**: 配置变更即时生效，无需重启服务
- **开发代理模式**: 支持代理到 Vite 等前端开发服务器

---

## 快速开始

### 1. 创建代理配置

在 Admin UI 中，导航到 `_proxies` 系统 Collection，创建新记录：

| 字段 | 值 | 说明 |
|------|-----|------|
| `path` | `/-/openai` | 代理路径前缀 |
| `upstream` | `https://api.openai.com` | 上游服务地址 |
| `strip_path` | `true` | 移除匹配的路径前缀 |
| `access_rule` | `@request.auth.id != ''` | 需要登录用户 |
| `headers` | `{"Authorization": "Bearer {env.OPENAI_API_KEY}"}` | 注入 API Key |
| `timeout` | `60` | 超时时间（秒） |
| `active` | `true` | 启用代理 |

### 2. 设置环境变量

```bash
export OPENAI_API_KEY="sk-your-api-key"
```

### 3. 启动服务

```bash
./pocketbase serve
```

### 4. 发送请求

```bash
# 前端请求（需要携带 PocketBase 认证 Token）
curl -X POST http://localhost:8090/-/openai/v1/chat/completions \
  -H "Authorization: Bearer <pb_auth_token>" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

请求会被代理到 `https://api.openai.com/v1/chat/completions`，并自动注入 `Authorization: Bearer sk-your-api-key` 请求头。

---

## 配置详解

### `_proxies` Collection 字段

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `path` | Text | ✅ | - | 代理路径前缀，必须以 `/` 开头 |
| `upstream` | URL | ✅ | - | 上游服务 URL |
| `strip_path` | Bool | ❌ | `true` | 是否移除匹配的路径前缀 |
| `access_rule` | Text | ❌ | `""` | 访问控制规则 |
| `headers` | JSON | ❌ | `{}` | 注入的请求头模板 |
| `timeout` | Number | ❌ | `30` | 请求超时时间（秒） |
| `active` | Bool | ❌ | `true` | 是否启用 |

### 路径规则

#### 推荐路径前缀

建议使用 `/-/` 前缀，这是专门为网关保留的命名空间：

```
/-/openai      → https://api.openai.com
/-/stripe      → https://api.stripe.com
/-/internal    → http://internal-service:3000
```

#### 禁止的路径

以下路径被保留，不能用于代理：

- `/api/*` - PocketBase API 路由
- `/_/*` - Admin UI 路由

#### 自定义路径

也可以使用自定义路径（需要确保不与现有路由冲突）：

```
/webhooks/stripe  → https://api.stripe.com
/v1/chat          → https://api.openai.com
```

### `strip_path` 行为

| `strip_path` | 请求路径 | 代理路径 | 上游 URL |
|--------------|----------|----------|----------|
| `true` | `/-/openai/v1/chat` | `/-/openai` | `https://api.openai.com/v1/chat` |
| `false` | `/-/openai/v1/chat` | `/-/openai` | `https://api.openai.com/-/openai/v1/chat` |

---

## 访问控制

### 规则语法

`access_rule` 使用与 PocketBase Collection Rules 相同的语法：

| 规则 | 效果 |
|------|------|
| `""` (空) | 仅 Superuser 可访问 |
| `"true"` | 公开访问（无需认证） |
| `@request.auth.id != ''` | 需要任意登录用户 |
| `@request.auth.verified = true` | 需要已验证邮箱的用户 |
| `@request.auth.role = 'admin'` | 需要特定角色（自定义字段） |

### 示例配置

#### 1. 仅管理员访问

```json
{
  "path": "/-/admin-api",
  "upstream": "https://internal-admin.example.com",
  "access_rule": ""
}
```

#### 2. 公开 API（无需认证）

```json
{
  "path": "/-/public",
  "upstream": "https://public-api.example.com",
  "access_rule": "true"
}
```

#### 3. 登录用户访问

```json
{
  "path": "/-/openai",
  "upstream": "https://api.openai.com",
  "access_rule": "@request.auth.id != ''"
}
```

#### 4. VIP 用户访问

```json
{
  "path": "/-/premium",
  "upstream": "https://premium-api.example.com",
  "access_rule": "@request.auth.subscription = 'premium'"
}
```

---

## 请求头注入

### 模板语法

`headers` 字段支持以下模板变量：

| 语法 | 说明 | 示例 |
|------|------|------|
| `{env.VAR_NAME}` | 环境变量 | `{env.API_KEY}` |
| `@request.auth.id` | 当前用户 ID | - |
| `@request.auth.email` | 当前用户邮箱 | - |
| `@request.auth.<field>` | 用户记录的任意字段 | `@request.auth.name` |
| 静态值 | 直接使用 | `application/json` |

### 示例配置

#### 1. 注入 API Key

```json
{
  "headers": {
    "Authorization": "Bearer {env.OPENAI_API_KEY}"
  }
}
```

#### 2. 注入用户信息

```json
{
  "headers": {
    "X-User-Id": "@request.auth.id",
    "X-User-Email": "@request.auth.email",
    "X-User-Name": "@request.auth.name"
  }
}
```

#### 3. 混合使用

```json
{
  "headers": {
    "Authorization": "Bearer {env.API_KEY}",
    "X-Request-User": "@request.auth.id",
    "X-Custom-Header": "static-value"
  }
}
```

### 自动添加的请求头

网关会自动添加以下标准代理请求头：

| 请求头 | 值 |
|--------|-----|
| `X-Forwarded-For` | 客户端 IP |
| `X-Forwarded-Host` | 原始 Host |
| `X-Forwarded-Proto` | 原始协议 (http/https) |

---

## 开发代理模式

### 用途

在开发环境中，将未匹配的请求代理到前端开发服务器（如 Vite、Webpack Dev Server）。

### 启动命令

```bash
./pocketbase serve --dev-proxy="http://localhost:5173"
```

### 工作原理

1. 请求 `/api/*` → PocketBase API
2. 请求 `/_/*` → Admin UI
3. 请求 `/-/*` → 配置的代理规则
4. 其他请求 → 开发代理（Vite）

### 典型开发流程

```bash
# 终端 1: 启动 Vite
cd frontend && npm run dev

# 终端 2: 启动 PocketBase
./pocketbase serve --dev-proxy="http://localhost:5173"
```

访问 `http://localhost:8090`：
- `/` → Vite 开发服务器
- `/api/collections/users/records` → PocketBase API
- `/-/openai/v1/chat` → OpenAI API（通过代理）

---

## 常见用例

### 1. OpenAI API 代理

保护 API Key，限制用户访问：

```json
{
  "path": "/-/openai",
  "upstream": "https://api.openai.com",
  "strip_path": true,
  "access_rule": "@request.auth.id != ''",
  "headers": {
    "Authorization": "Bearer {env.OPENAI_API_KEY}"
  },
  "timeout": 120,
  "active": true
}
```

前端调用：

```javascript
const response = await pb.send('/-/openai/v1/chat/completions', {
  method: 'POST',
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});
```

### 2. Stripe Webhook 接收

接收 Stripe 回调并转发到内部服务：

```json
{
  "path": "/webhooks/stripe",
  "upstream": "http://payment-service:3000/stripe",
  "strip_path": true,
  "access_rule": "true",
  "headers": {
    "X-Internal-Secret": "{env.INTERNAL_SECRET}"
  },
  "timeout": 30,
  "active": true
}
```

### 3. 微服务聚合

将多个内部服务暴露为统一 API：

```json
// 用户服务
{
  "path": "/-/users",
  "upstream": "http://user-service:3001",
  "access_rule": "@request.auth.id != ''"
}

// 订单服务
{
  "path": "/-/orders",
  "upstream": "http://order-service:3002",
  "access_rule": "@request.auth.id != ''"
}

// 支付服务
{
  "path": "/-/payments",
  "upstream": "http://payment-service:3003",
  "access_rule": "@request.auth.role = 'admin'"
}
```

### 4. 第三方 API 缓存代理

代理并记录第三方 API 调用：

```json
{
  "path": "/-/weather",
  "upstream": "https://api.openweathermap.org/data/2.5",
  "strip_path": true,
  "access_rule": "true",
  "headers": {
    "X-Request-Source": "pocketbase-gateway"
  },
  "timeout": 10,
  "active": true
}
```

---

## 故障排查

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `404 Not Found` | 路径未匹配或代理未启用 | 检查 `path` 和 `active` 字段 |
| `401 Unauthorized` | 未提供认证 Token | 在请求头中添加 `Authorization` |
| `403 Forbidden` | 用户不满足 `access_rule` | 检查用户权限和规则配置 |
| `502 Bad Gateway` | 上游服务不可达 | 检查 `upstream` URL 和网络连接 |
| `504 Gateway Timeout` | 上游响应超时 | 增加 `timeout` 值 |

### 调试日志

启用 Debug 日志查看代理请求详情：

```bash
./pocketbase serve --debug
```

日志输出示例：

```
DEBUG proxy request method=POST path=/-/openai/v1/chat proxy_path=/-/openai upstream=https://api.openai.com status=200 duration_ms=1234
```

### 验证配置

使用 curl 测试代理：

```bash
# 测试公开代理
curl -v http://localhost:8090/-/public/test

# 测试需要认证的代理
curl -v http://localhost:8090/-/openai/v1/models \
  -H "Authorization: Bearer <pb_auth_token>"
```

---

## 最佳实践

### 安全建议

1. **最小权限原则**: 使用最严格的 `access_rule`
2. **敏感 Key 使用环境变量**: 不要硬编码在 `headers` 中
3. **设置合理超时**: 避免长时间占用连接
4. **禁用未使用的代理**: 设置 `active=false`

### 性能优化

1. **使用 `strip_path=true`**: 减少上游 URL 长度
2. **合理设置 `timeout`**: 根据上游服务响应时间调整
3. **避免过多代理规则**: 每个请求都会遍历规则表

### 命名规范

```
/-/openai      ✅ 推荐：使用 /-/ 前缀
/-/stripe      ✅ 推荐：服务名简洁明了
/api/proxy     ❌ 禁止：与 PocketBase API 冲突
/_/custom      ❌ 禁止：与 Admin UI 冲突
```

---

## API 参考

### 代理请求

所有 HTTP 方法（GET, POST, PUT, DELETE 等）都会被代理到上游服务。

### 请求头透传

以下请求头会被透传到上游：

- `Content-Type`
- `Accept`
- `User-Agent`
- 所有自定义请求头

### 响应透传

上游服务的响应会原样返回给客户端，包括：

- 状态码
- 响应头
- 响应体（支持 Streaming）

---

## 版本兼容性

| PocketBase 版本 | Native Gateway |
|-----------------|----------------|
| v0.23.0+ | ✅ 支持 |
| v0.22.x | ❌ 不支持 |
