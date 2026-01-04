# TOF 认证插件

`tofauth` 是 PocketBase 的腾讯 TOF (Tencent Open Framework) 网关认证插件，允许企业用户通过 TOF 统一身份认证登录系统。

## 快速开始

### 1. 设置环境变量

```bash
export TOF_APP_KEY=your-app-key      # 太湖应用 Key
export TOF_APP_TOKEN=your-app-token  # 太湖应用 Token
```

### 2. 注册插件

```go
import (
    "github.com/pocketbase/pocketbase/plugins/tofauth"
)

func main() {
    app := pocketbase.New()

    // 注册 TOF 认证插件
    // 自动从环境变量读取 TOF_APP_KEY 和 TOF_APP_TOKEN
    // 如果 TOF_APP_TOKEN 未设置，插件将静默跳过
    tofauth.MustRegister(app, tofauth.Config{})

    app.Start()
}
```

### 3. 启动服务

```bash
TOF_APP_KEY=your-key TOF_APP_TOKEN=your-token ./pocketbase serve
```

## API 接口

### 认证接口

```
GET /api/collections/{collection}/auth-with-tof
```

通过 TOF 网关认证后获取 PocketBase 用户 token。

**请求 Headers**（由 TOF 网关自动注入）：
- `x-tai-identity`: JWE 加密的身份信息
- `timestamp`: 时间戳
- `signature`: 网关签名
- `x-rio-seq`: 请求序列号

**响应**（与 PocketBase 标准认证响应一致）：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "record": {
    "id": "abc123",
    "email": "username@tencent.com",
    "name": "username",
    "verified": true,
    ...
  },
  "meta": {
    "tofIdentity": {
      "loginname": "username",
      "staffid": 12345,
      "expiration": "2026-01-04T12:00:00Z"
    }
  }
}
```

**行为**：
- 如果用户不存在，自动创建新用户（`_superusers` 集合除外）
- 新用户的邮箱格式为 `{loginname}@tencent.com`
- 新用户自动标记为已验证（`verified: true`）

### 登出接口

```
GET /api/tof/logout?url={redirect_url}&appkey={optional_appkey}
```

重定向到 TOF 登出页面。

**参数**：
- `url`（必填）: 登出后的重定向地址
- `appkey`（可选）: 覆盖默认的 AppKey

### 重定向验证接口

```
GET /api/tof/redirect?url={target_url}
```

验证 TOF 身份后重定向到目标地址。如果验证失败，重定向到 TOF 登录页面。

## 配置选项

```go
tofauth.Config{
    // AppKey 太湖应用 Key（用于登出重定向）
    // 默认从环境变量 TOF_APP_KEY 读取
    AppKey: "",

    // AppToken 太湖应用 Token（用于签名校验和 JWE 解密）
    // 默认从环境变量 TOF_APP_TOKEN 读取
    // 如果为空，插件将静默跳过注册
    AppToken: "",

    // SafeMode 启用安全模式（推荐生产环境启用）
    // 安全模式下只使用 JWE 加密的身份信息，不使用明文 headers
    // 默认: true
    SafeMode: tofauth.Bool(true),

    // CheckTimestamp 是否检查时间戳过期（180秒）
    // 默认: true
    CheckTimestamp: tofauth.Bool(true),

    // RoutePrefix 登出和重定向路由前缀
    // 默认: "/api/tof"
    // 注意：认证路由固定为 /api/collections/{collection}/auth-with-tof
    RoutePrefix: "/api/tof",

    // DevMockUser 开发模式下的模拟用户名
    // 当 TOF headers 缺失时，使用此用户名模拟登录
    // 仅用于本地开发调试，生产环境请勿设置
    // 默认从环境变量 TOF_DEV_MOCK_USER 读取
    DevMockUser: "",
}
```

## 本地开发 Mock 模式

本地开发时，PocketBase 无法被 TOF 网关调用。可以通过设置 `TOF_DEV_MOCK_USER` 环境变量启用模拟模式：

```bash
# 本地开发启动
TOF_APP_KEY=your-key \
TOF_APP_TOKEN=your-token \
TOF_DEV_MOCK_USER=yourname \
./pocketbase serve
```

**Mock 模式行为**：

| 条件 | 行为 |
|------|------|
| 请求包含完整 TOF headers | 正常验证 TOF 身份 |
| 请求缺少 TOF headers + 设置了 `TOF_DEV_MOCK_USER` | 使用模拟身份登录 |
| 请求缺少 TOF headers + 未设置 `TOF_DEV_MOCK_USER` | 返回 401 错误 |

**模拟身份信息**：
```json
{
  "loginname": "{TOF_DEV_MOCK_USER}",
  "staffid": 9999999,
  "expiration": "2099-12-31T23:59:59Z",
  "ticket": "MOCK_TICKET"
}
```

> ⚠️ **安全警告**：生产环境请勿设置 `TOF_DEV_MOCK_USER`，此功能会绕过 TOF 身份验证！

## JS Hooks 集成

在 JS Hooks 中使用 `$tof` 对象进行身份验证：

### 1. 配置 JSVM

```go
import (
    "os"
    "github.com/dop251/goja"
    "github.com/pocketbase/pocketbase/plugins/jsvm"
    "github.com/pocketbase/pocketbase/plugins/tofauth"
)

func main() {
    app := pocketbase.New()

    tofConfig := tofauth.Config{}
    tofauth.MustRegister(app, tofConfig)

    jsvm.MustRegister(app, jsvm.Config{
        OnInit: func(vm *goja.Runtime) {
            if os.Getenv("TOF_APP_TOKEN") != "" {
                tofauth.BindToVMWithConfig(vm, tofConfig)
            }
        },
    })

    app.Start()
}
```

### 2. 在 JS Hooks 中使用

```javascript
// pb_hooks/tof_auth.pb.js

onRecordViewRequest((e) => {
    // 从请求头获取 TOF 参数
    const taiId = e.request.header.get("x-tai-identity");
    const timestamp = e.request.header.get("timestamp");
    const signature = e.request.header.get("signature");
    const seq = e.request.header.get("x-rio-seq");

    // 验证 TOF 身份
    try {
        const identity = $tof.getTofIdentity(taiId, timestamp, signature, seq);
        console.log("User:", identity.loginname, "StaffId:", identity.staffid);
    } catch (err) {
        throw new UnauthorizedError("TOF authentication failed: " + err);
    }

    return e.next();
}, "posts");
```

### TypeScript 类型定义

```typescript
interface TofIdentity {
    loginname: string;   // 登录名（企业微信账号）
    staffid: number;     // 员工 ID
    expiration: string;  // 过期时间（RFC3339 格式）
    ticket?: string;     // 票据（可选）
}

interface Tof {
    getTofIdentity(
        taiId: string,
        timestamp: string,
        signature: string,
        seq: string
    ): TofIdentity;
}

declare var $tof: Tof;
```

## Nginx 配置示例

TOF 网关会自动注入认证 headers，Nginx 只需透传：

```nginx
location /api/ {
    proxy_pass http://localhost:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # TOF headers 由网关自动注入，无需额外配置
}
```

## 安全说明

1. **SafeMode**（默认启用）：只信任 JWE 加密的身份信息，防止伪造明文 headers
2. **CheckTimestamp**（默认启用）：检查请求时间戳，防止重放攻击（180秒有效期）
3. **AppToken 保护**：AppToken 存储在环境变量中，不在请求中传递

## 常见问题

### Q: 如何在不使用 TOF 的环境中运行？

只需不设置 `TOF_APP_TOKEN` 环境变量，插件会自动跳过注册，不影响其他功能。

### Q: 如何自定义用户创建逻辑？

可以使用 `OnRecordCreate` hook 在用户创建时添加自定义逻辑：

```javascript
onRecordCreate((e) => {
    // 检查是否是 TOF 创建的用户
    if (e.record.get("email")?.endsWith("@tencent.com")) {
        // 添加自定义字段
        e.record.set("department", "default");
    }
    return e.next();
}, "users");
```

### Q: 认证失败返回什么错误？

| 错误码 | 说明 |
|--------|------|
| 401 | TOF 参数缺失或签名验证失败 |
| 400 | Collection 不存在或 `_superusers` 用户不存在 |
| 404 | 指定的 Collection 不存在 |
