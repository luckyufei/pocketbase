# Secrets 密钥管理

PocketBase 提供了安全的密钥管理功能，用于存储 API 密钥、数据库密码等敏感信息。所有密钥使用 AES-256-GCM 加密存储。

## 功能特性

- **AES-256-GCM 加密** - 行业标准加密算法
- **环境隔离** - 支持按环境（dev/staging/prod）管理密钥
- **Fallback 机制** - 指定环境不存在时自动回退到 global
- **掩码显示** - 列表 API 不暴露明文
- **RESTful API** - 完整的 CRUD 接口
- **双数据库兼容** - 同时支持 SQLite 和 PostgreSQL

## 启用 Secrets

Secrets 功能需要设置 Master Key 才能启用：

```bash
# 方式 1：环境变量
export PB_MASTER_KEY="your-32-byte-master-key-here!!"
./pocketbase serve

# 方式 2：命令行参数
./pocketbase serve --masterKey="your-32-byte-master-key-here!!"
```

::: danger 重要
Master Key 必须是 32 字节（256 位），用于派生加密密钥。请妥善保管，丢失将无法解密已存储的密钥。
:::

## 快速开始

### Go SDK

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        secrets := app.Secrets()

        // 检查功能是否启用
        if !secrets.IsEnabled() {
            log.Println("Secrets 功能未启用，请设置 PB_MASTER_KEY")
            return se.Next()
        }

        // 存储密钥
        err := secrets.Set("STRIPE_API_KEY", "sk_live_xxx", 
            core.WithDescription("Stripe 生产环境密钥"))
        if err != nil {
            log.Printf("存储失败: %v", err)
        }

        // 读取密钥
        apiKey, err := secrets.Get("STRIPE_API_KEY")
        if err != nil {
            log.Printf("读取失败: %v", err)
        } else {
            log.Printf("API Key: %s", apiKey)
        }

        // 带默认值读取
        dbPassword := secrets.GetWithDefault("DB_PASSWORD", "default_password")

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 环境隔离

```go
// 存储到指定环境
secrets.Set("API_KEY", "dev_key", core.WithEnv("dev"))
secrets.Set("API_KEY", "prod_key", core.WithEnv("prod"))
secrets.Set("API_KEY", "global_key")  // 默认存储到 "global"

// 读取指定环境（带 fallback）
key, _ := secrets.GetForEnv("API_KEY", "prod")  // 返回 "prod_key"
key, _ := secrets.GetForEnv("API_KEY", "test")  // 返回 "global_key"（fallback）
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

## 配置参数

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `SecretMaxKeyLength` | 256 | Key 最大长度 |
| `SecretMaxValueSize` | 4 KB | Value 最大大小 |
| `SecretDefaultEnv` | "global" | 默认环境 |

## 错误处理

| 错误 | 说明 |
|------|------|
| `ErrSecretsDisabled` | Secrets 功能未启用（未设置 Master Key） |
| `ErrSecretNotFound` | 密钥不存在 |
| `ErrSecretKeyEmpty` | Key 为空 |
| `ErrSecretKeyTooLong` | Key 超过 256 字符 |
| `ErrSecretValueTooLarge` | Value 超过 4KB |

## UI 管理

在 PocketBase Admin UI 中，访问 **Settings → Secrets** 可以：

- 查看所有密钥（掩码显示）
- 创建新密钥
- 更新密钥值和描述
- 删除密钥
- 按环境筛选

## 安全最佳实践

### 1. Master Key 管理

```bash
# 生成安全的 Master Key
openssl rand -base64 32 | tr -d '\n' | head -c 32

# 不要将 Master Key 提交到代码仓库
# 使用环境变量或密钥管理服务
```

### 2. 访问控制

Secrets API 仅限超级用户访问，确保：
- 使用强密码保护超级用户账户
- 启用双因素认证（如果可用）
- 定期轮换超级用户密码

### 3. 密钥轮换

```go
// 定期更新密钥
secrets.Set("API_KEY", newKey, core.WithDescription("2025-01 轮换"))

// 旧密钥会被自动覆盖（UPSERT）
```

### 4. 环境隔离

```go
// 开发环境使用测试密钥
secrets.Set("STRIPE_KEY", "sk_test_xxx", core.WithEnv("dev"))

// 生产环境使用真实密钥
secrets.Set("STRIPE_KEY", "sk_live_xxx", core.WithEnv("prod"))
```

## 加密细节

- **算法**: AES-256-GCM
- **密钥派生**: PBKDF2 (SHA-256, 100,000 iterations)
- **Nonce**: 12 字节随机数
- **存储格式**: Base64 编码的 `nonce + ciphertext + tag`

## 数据库兼容性

Secrets 模块完全兼容 SQLite 和 PostgreSQL：

| 功能 | SQLite | PostgreSQL |
|------|--------|------------|
| 时间函数 | `datetime('now')` | `NOW()` |
| UPSERT | `ON CONFLICT DO UPDATE` | `ON CONFLICT DO UPDATE` |
| 唯一约束 | `UNIQUE(key, env)` | `UNIQUE(key, env)` |

无需修改代码，系统会自动适配不同数据库。
