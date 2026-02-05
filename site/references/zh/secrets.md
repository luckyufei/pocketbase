# Secrets 密钥管理

PocketBase 提供了安全的密钥管理功能，用于存储 API 密钥、数据库密码等敏感信息。所有密钥使用 AES-256-GCM 加密存储。

## 功能特性

- **AES-256-GCM 加密** - 行业标准加密算法
- **环境隔离** - 支持按环境（dev/staging/prod）管理密钥
- **Fallback 机制** - 指定环境不存在时自动回退到 global
- **掩码显示** - 列表 API 不暴露明文
- **RESTful API** - 完整的 CRUD 接口
- **双数据库兼容** - 同时支持 SQLite 和 PostgreSQL
- **插件架构** - 可选注册，按需启用

## 启用 Secrets

Secrets 功能作为插件提供，需要两个步骤：

### 1. 设置 Master Key

```bash
# 生成安全的 Master Key（64 字符 hex = 32 字节）
openssl rand -hex 32

# 设置环境变量
export PB_MASTER_KEY="your-64-character-hex-string-here"
```

::: danger 重要
Master Key 必须是 64 个十六进制字符（32 字节 / 256 位）。请妥善保管，丢失将无法解密已存储的密钥。
:::

### 2. 注册插件

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/secrets"
)

func main() {
    app := pocketbase.New()
    
    // 注册 secrets 插件
    secrets.MustRegister(app, secrets.DefaultConfig())
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 快速开始

### Go SDK

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/plugins/secrets"
)

func main() {
    app := pocketbase.New()
    
    // 注册 secrets 插件
    secrets.MustRegister(app, secrets.DefaultConfig())

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // 获取 secrets store
        store := secrets.GetStore(app)

        // 检查功能是否启用
        if !store.IsEnabled() {
            log.Println("Secrets 功能未启用，请设置 PB_MASTER_KEY")
            return se.Next()
        }

        // 存储密钥
        err := store.Set("STRIPE_API_KEY", "sk_live_xxx", 
            secrets.WithDescription("Stripe 生产环境密钥"))
        if err != nil {
            log.Printf("存储失败: %v", err)
        }

        // 读取密钥
        apiKey, err := store.Get("STRIPE_API_KEY")
        if err != nil {
            log.Printf("读取失败: %v", err)
        } else {
            log.Printf("API Key: %s", apiKey)
        }

        // 带默认值读取
        dbPassword := store.GetWithDefault("DB_PASSWORD", "default_password")
        log.Printf("DB Password: %s", dbPassword)

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 环境隔离

```go
store := secrets.GetStore(app)

// 存储到指定环境
store.Set("API_KEY", "dev_key", secrets.WithEnv("dev"))
store.Set("API_KEY", "prod_key", secrets.WithEnv("prod"))
store.Set("API_KEY", "global_key")  // 默认存储到 "global"

// 读取指定环境（带 fallback）
key, _ := store.GetForEnv("API_KEY", "prod")  // 返回 "prod_key"
key, _ := store.GetForEnv("API_KEY", "test")  // 返回 "global_key"（fallback）
```

## API 接口

::: warning 注意
所有 Secrets API 都需要超级用户 (Superuser) 权限，且 Secrets 功能必须已启用。
:::

### 创建/更新密钥

```http
POST /api/secrets
Content-Type: application/json

{
    "key": "STRIPE_API_KEY",
    "value": "sk_live_xxx",
    "env": "prod",           // 可选，默认 "global"
    "description": "Stripe 生产环境密钥"  // 可选
}
```

**响应:**
```json
{
    "key": "STRIPE_API_KEY",
    "env": "prod",
    "message": "Secret created successfully"
}
```

### 获取密钥列表

```http
GET /api/secrets
```

**响应:**
```json
{
    "items": [
        {
            "id": "abc123",
            "key": "STRIPE_API_KEY",
            "masked_value": "U2FsdG***",
            "env": "prod",
            "description": "Stripe 生产环境密钥",
            "created": "2025-01-08T10:00:00Z",
            "updated": "2025-01-08T10:00:00Z"
        }
    ],
    "total": 1
}
```

::: info 提示
列表 API 返回掩码值（`masked_value`），不暴露明文。
:::

### 获取密钥明文

```http
GET /api/secrets/{key}
```

**响应:**
```json
{
    "key": "STRIPE_API_KEY",
    "value": "sk_live_xxx"
}
```

### 更新密钥

```http
PUT /api/secrets/{key}
Content-Type: application/json

{
    "value": "sk_live_new_xxx",
    "description": "更新后的描述"
}
```

### 删除密钥

```http
DELETE /api/secrets/{key}
```

**响应:** `204 No Content`

## 配置选项

### 代码配置

```go
secrets.Config{
    // 是否启用环境隔离（默认 true）
    EnableEnvIsolation: true,
    
    // 默认环境（默认 "global"）
    DefaultEnv: "global",
    
    // Key 最大长度（默认 256）
    MaxKeyLength: 256,
    
    // Value 最大大小（默认 4KB）
    MaxValueSize: 4 * 1024,
    
    // 是否启用 HTTP API（默认 true）
    HTTPEnabled: true,
}
```

### 环境变量覆盖

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `PB_MASTER_KEY` | 加密密钥（必需，64 字符 hex） | `0123456789abcdef...` |
| `PB_SECRETS_DEFAULT_ENV` | 默认环境 | `prod` |
| `PB_SECRETS_MAX_KEY_LENGTH` | Key 最大长度 | `512` |
| `PB_SECRETS_MAX_VALUE_SIZE` | Value 最大大小（字节） | `8192` |
| `PB_SECRETS_HTTP_ENABLED` | 是否启用 HTTP API | `true` |
| `PB_SECRETS_ENV_ISOLATION` | 是否启用环境隔离 | `true` |

## 错误处理

| 错误 | 说明 |
|------|------|
| `ErrSecretsNotRegistered` | Secrets 插件未注册 |
| `ErrCryptoNotEnabled` | 加密功能未启用（未设置 Master Key） |
| `ErrSecretNotFound` | 密钥不存在 |
| `ErrSecretKeyEmpty` | Key 为空 |
| `ErrSecretKeyTooLong` | Key 超过最大长度 |
| `ErrSecretValueTooLarge` | Value 超过最大大小 |

## 3 层加密架构

Secrets Plugin 是 PocketBase 3 层加密架构中的 **Layer 3**：

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: plugins/secrets/                                   │
│    系统级密钥管理 (_secrets 表, /api/secrets API)             │
│    使用 Layer 1 的 app.Crypto() 进行加密                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: core/field_secret.go                               │
│    用户级 SecretField（Collection 字段）                      │
│    使用 Layer 1 的 app.Crypto() 进行加密                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: core/crypto.go                                     │
│    CryptoProvider - 共享加密引擎 (AES-256-GCM)               │
│    app.Crypto() - 由 App 接口提供                            │
└─────────────────────────────────────────────────────────────┘
```

### Layer 说明

| Layer | 位置 | 用途 | 访问方式 |
|-------|------|------|----------|
| Layer 1 | `core/crypto.go` | 底层加密引擎 | `app.Crypto()` |
| Layer 2 | `core/field_secret.go` | Collection 加密字段 | Schema 定义 |
| Layer 3 | `plugins/secrets/` | 系统级密钥存储 | `secrets.GetStore(app)` |

## Gateway 集成

Secrets 可与 Gateway 插件配合使用，实现 API 密钥自动注入：

```go
// 在 Gateway 配置中引用 Secret
{
    "headers": {
        "Authorization": "Bearer {secret.OPENAI_API_KEY}"
    }
}
```

Gateway 会自动从 `_secrets` 表中读取加密的 API Key 并注入到请求头。

## 数据库表结构

```sql
CREATE TABLE _secrets (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,          -- AES-256-GCM 加密后的值
    env TEXT NOT NULL DEFAULT 'global',
    description TEXT,
    created TIMESTAMP NOT NULL,
    updated TIMESTAMP NOT NULL,
    UNIQUE(key, env)
);
```

## 安全最佳实践

### 1. Master Key 管理

```bash
# 生成安全的 Master Key
openssl rand -hex 32

# 不要将 Master Key 提交到代码仓库
# 使用环境变量或密钥管理服务（如 HashiCorp Vault、AWS KMS）
```

### 2. 访问控制

Secrets API 仅限超级用户访问，确保：
- 使用强密码保护超级用户账户
- 启用双因素认证（如果可用）
- 定期轮换超级用户密码

### 3. 密钥轮换

```go
store := secrets.GetStore(app)

// 定期更新密钥
store.Set("API_KEY", newKey, secrets.WithDescription("2025-01 轮换"))

// 旧密钥会被自动覆盖（UPSERT）
```

### 4. 环境隔离

```go
store := secrets.GetStore(app)

// 开发环境使用测试密钥
store.Set("STRIPE_KEY", "sk_test_xxx", secrets.WithEnv("dev"))

// 生产环境使用真实密钥
store.Set("STRIPE_KEY", "sk_live_xxx", secrets.WithEnv("prod"))
```

## 加密细节

- **算法**: AES-256-GCM (Galois/Counter Mode)
- **Nonce**: 12 字节随机数（每次加密生成新的）
- **存储格式**: Base64 编码的 `nonce + ciphertext + tag`

## 数据库兼容性

Secrets 模块完全兼容 SQLite 和 PostgreSQL：

| 功能 | SQLite | PostgreSQL |
|------|--------|------------|
| 时间函数 | `datetime('now')` | `NOW()` |
| UPSERT | `ON CONFLICT DO UPDATE` | `ON CONFLICT DO UPDATE` |
| 唯一约束 | `UNIQUE(key, env)` | `UNIQUE(key, env)` |

无需修改代码，系统会自动适配不同数据库。

## 从旧版本迁移

如果你之前使用的是 `app.Secrets()` API（旧版本），请按以下步骤迁移：

### 1. 更新导入

```go
// 旧版本
import "github.com/pocketbase/pocketbase/core"

// 新版本
import "github.com/pocketbase/pocketbase/plugins/secrets"
```

### 2. 注册插件

```go
// 在 app.Start() 之前添加
secrets.MustRegister(app, secrets.DefaultConfig())
```

### 3. 更新 API 调用

```go
// 旧版本
secrets := app.Secrets()
secrets.Set("KEY", "value", core.WithDescription("desc"))

// 新版本
store := secrets.GetStore(app)
store.Set("KEY", "value", secrets.WithDescription("desc"))
```

### 4. 更新 Option 引用

```go
// 旧版本
core.WithDescription("desc")
core.WithEnv("prod")

// 新版本
secrets.WithDescription("desc")
secrets.WithEnv("prod")
```
