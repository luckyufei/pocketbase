# Secrets Plugin

系统级密钥管理插件，提供加密存储和 HTTP API 用于管理敏感配置（如 API Keys、数据库密码等）。

## 功能特性

- 🔐 AES-256-GCM 加密存储
- 🌍 环境隔离（global、dev、staging、prod 等）
- 🔑 使用 `PB_MASTER_KEY` 环境变量作为加密密钥
- 🛡️ HTTP API 仅限 Superuser 访问
- 📝 支持掩码显示（列表时不暴露原值）

## 快速开始

### 1. 配置 Master Key

```bash
# 生成 32 字节（64 字符 hex）的随机密钥
openssl rand -hex 32

# 设置环境变量
export PB_MASTER_KEY="your-64-character-hex-string"
```

### 2. 注册插件

```go
package main

import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/secrets"
)

func main() {
    app := pocketbase.New()
    
    // 使用默认配置注册 secrets 插件
    secrets.MustRegister(app, secrets.DefaultConfig())
    
    app.Start()
}
```

### 3. 使用 API

```bash
# 创建 Secret（需要 Superuser Token）
curl -X POST http://localhost:8090/api/secrets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"key": "OPENAI_API_KEY", "value": "sk-xxx", "description": "OpenAI API Key"}'

# 列出所有 Secrets（掩码显示）
curl http://localhost:8090/api/secrets \
  -H "Authorization: Bearer <token>"

# 获取 Secret（解密后的明文）
curl http://localhost:8090/api/secrets/OPENAI_API_KEY \
  -H "Authorization: Bearer <token>"

# 删除 Secret
curl -X DELETE http://localhost:8090/api/secrets/OPENAI_API_KEY \
  -H "Authorization: Bearer <token>"
```

## 配置选项

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
| `PB_MASTER_KEY` | 加密密钥（必需） | 64 字符 hex |
| `PB_SECRETS_DEFAULT_ENV` | 默认环境 | `prod` |
| `PB_SECRETS_MAX_KEY_LENGTH` | Key 最大长度 | `512` |
| `PB_SECRETS_MAX_VALUE_SIZE` | Value 最大大小 | `8192` |
| `PB_SECRETS_HTTP_ENABLED` | 是否启用 HTTP API | `true` |
| `PB_SECRETS_ENV_ISOLATION` | 是否启用环境隔离 | `true` |

## Programmatic API

```go
// 获取 Store 实例
store := secrets.GetStore(app)

// 设置 Secret
err := store.Set("API_KEY", "secret-value", secrets.WithDescription("API Key"))

// 获取 Secret
value, err := store.Get("API_KEY")

// 获取 Secret（带默认值）
value := store.GetWithDefault("API_KEY", "default-value")

// 获取指定环境的 Secret
value, err := store.GetForEnv("API_KEY", "prod")

// 检查是否存在
exists, err := store.Exists("API_KEY")

// 删除 Secret
err := store.Delete("API_KEY")

// 列出所有 Secrets
list, err := store.List()
```

## 与 Layer 1 CryptoProvider 的关系

Secrets Plugin 是 3 层加密架构中的 **Layer 3**：

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: CryptoProvider (core/crypto.go)                    │
│   - AES-256-GCM 加密引擎                                     │
│   - 被 SecretField 和 Secrets Plugin 共享                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: SecretField (core/field_secret.go)                 │
│   - 用户级加密字段                                            │
│   - 直接使用 app.Crypto()                                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Secrets Plugin (plugins/secrets/)                  │
│   - 系统级密钥存储                                            │
│   - _secrets 表存储                                          │
│   - HTTP API + Programmatic API                             │
└─────────────────────────────────────────────────────────────┘
```

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

## HTTP API 参考

### POST /api/secrets

创建或更新 Secret。

**请求体**:
```json
{
    "key": "API_KEY",
    "value": "secret-value",
    "env": "global",
    "description": "Optional description"
}
```

### GET /api/secrets

列出所有 Secrets（值显示掩码）。

**响应**:
```json
{
    "items": [
        {
            "id": "xxx",
            "key": "API_KEY",
            "masked_value": "U2FsdG***",
            "env": "global",
            "description": "...",
            "created": "2024-01-01T00:00:00Z",
            "updated": "2024-01-01T00:00:00Z"
        }
    ],
    "total": 1
}
```

### GET /api/secrets/{key}

获取 Secret（解密后的明文）。

**响应**:
```json
{
    "key": "API_KEY",
    "value": "secret-value"
}
```

### PUT /api/secrets/{key}

更新 Secret。

**请求体**:
```json
{
    "value": "new-secret-value",
    "description": "Updated description"
}
```

### DELETE /api/secrets/{key}

删除 Secret。

**响应**: `204 No Content`

## 安全注意事项

1. **Master Key 安全**: `PB_MASTER_KEY` 应该使用密钥管理服务（如 HashiCorp Vault、AWS KMS）安全存储
2. **API 访问控制**: 所有 API 端点都需要 Superuser 权限
3. **掩码显示**: 列表接口不会返回明文值
4. **内存安全**: 加密后会安全擦除内存中的敏感数据
