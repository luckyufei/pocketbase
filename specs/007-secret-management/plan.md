# Implementation Plan: PocketBase Secret Management (`_secrets`)

**Branch**: `007-secret-management` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-secret-management/spec.md`

## Summary

为 PocketBase 新增原生密钥管理功能，通过 `_secrets` 系统表实现企业级密钥托管。采用 **Envelope Encryption (信封加密)** 的简化变体：Master Key 存储于环境变量（永不落盘），数据使用 AES-256-GCM 加密存储。核心能力包括：加密存储、环境隔离、WASM Host Function 集成、Admin UI 安全交互。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `crypto/aes` (AES 加密)
- `crypto/cipher` (GCM 模式)
- `crypto/rand` (随机 Nonce 生成)
- `encoding/base64` (密文编码)

**Storage**: PostgreSQL `_secrets` 表  
**Testing**: Go test (unit + integration)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Backend (PocketBase 核心扩展)  
**Security Goals**: 数据库落盘数据为加密密文，Master Key 永不落盘  
**Constraints**: Secret Value 最大 4KB，仅 Superuser 可管理

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | Secret 功能编译进主二进制，无外部 Vault 依赖 |
| Zero External Dependencies | ✅ PASS | 使用 Go 标准库 crypto 包 |
| Anti-Stupidity | ✅ PASS | 消除硬编码和 .env 文件管理负担 |
| Data Locality | ✅ PASS | 数据存储在同一个 PG 实例，备份策略统一 |
| Fail Safe | ✅ PASS | 缺少 Master Key 时 Secrets 功能不可用，服务正常启动 |

## Project Structure

### Documentation (this feature)

```text
specs/007-secret-management/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── secrets_crypto.go        # AES-256-GCM 加密/解密实现
├── secrets_crypto_test.go   # 加密单元测试
├── secrets_store.go         # SecretsStore 核心接口和实现
├── secrets_store_test.go    # 存储单元测试
├── secrets_settings.go      # Master Key 配置和验证
└── secrets_benchmark_test.go # 性能基准测试

apis/
├── secrets_routes.go        # HTTP API 路由注册
├── secrets_routes_test.go   # HTTP API 测试
└── secrets_auth.go          # Secrets API 访问控制（仅 Superuser）

plugins/wasm/
└── host_secrets.go          # WASM Host Function: pb_secret_get

migrations/
└── 1736500000_create_secrets.go  # _secrets 系统表迁移

ui/src/
├── components/secrets/
│   ├── SecretsList.svelte       # Secrets 列表页
│   ├── SecretForm.svelte        # Secret 创建/编辑表单
│   └── SecretMaskedValue.svelte # 掩码值显示组件
└── pages/
    └── secrets/
        └── Index.svelte         # Secrets 管理页面
```

**Structure Decision**: 遵循现有 PocketBase 代码结构，Secrets 相关代码放入 `core/` 目录，HTTP API 放入 `apis/` 目录，WASM Host Function 放入 `plugins/wasm/` 目录。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        PocketBase                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     Admin UI Layer                      ││
│  │  Secrets List | Create Form | Masked Display            ││
│  │  (Password Input | No Reveal | Overwrite Only)          ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                     HTTP API Layer                      ││
│  │  POST /api/secrets | GET /api/secrets/:key              ││
│  │  (Superuser Only Authentication)                        ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                    SecretsStore API                     ││
│  │  Get(key) | Set(key, value) | Delete(key) | List()     ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                    Crypto Engine                        ││
│  │  ┌─────────────────────┐  ┌─────────────────────────┐  ││
│  │  │   Master Key (KEK)  │  │   AES-256-GCM           │  ││
│  │  │   (From Env Var)    │  │   (Encrypt/Decrypt)     │  ││
│  │  │                     │  │                         │  ││
│  │  │   • PB_MASTER_KEY   │  │   • Random Nonce        │  ││
│  │  │   • 32 bytes hex    │  │   • Authenticated       │  ││
│  │  │   • Never on disk   │  │   • Base64 encoded      │  ││
│  │  └─────────────────────┘  └─────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                   Storage Layer                         ││
│  │  PostgreSQL _secrets Table                              ││
│  │  key | value (encrypted) | env | description | dates   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  WASM Runtime Plane                     ││
│  │  ┌─────────────────────┐  ┌─────────────────────────┐  ││
│  │  │   JS/TS Code        │  │   Host Function         │  ││
│  │  │   pb.secrets.get()  │──▶   pb_secret_get()       │  ││
│  │  │                     │  │   (Decrypt & Return)    │  ││
│  │  └─────────────────────┘  └─────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Encryption Strategy

### Envelope Encryption (信封加密) 简化变体

```
┌─────────────────────────────────────────────────────────────┐
│                    Encryption Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Master Key (KEK - Key Encryption Key)                  │
│     ┌─────────────────────────────────────────────────────┐│
│     │  Source: OS Environment Variable PB_MASTER_KEY      ││
│     │  Format: 64 hex characters (32 bytes)               ││
│     │  Example: a1b2c3d4...64chars...                     ││
│     │  Storage: NEVER written to disk                     ││
│     └─────────────────────────────────────────────────────┘│
│                             │                               │
│                             ▼                               │
│  2. Data Encryption (AES-256-GCM)                          │
│     ┌─────────────────────────────────────────────────────┐│
│     │  Algorithm: AES-256-GCM (Galois/Counter Mode)       ││
│     │  Key: Master Key (32 bytes)                         ││
│     │  Nonce: Random 12 bytes (per encryption)            ││
│     │  Auth: GCM provides authenticated encryption        ││
│     └─────────────────────────────────────────────────────┘│
│                             │                               │
│                             ▼                               │
│  3. Storage Format                                         │
│     ┌─────────────────────────────────────────────────────┐│
│     │  Format: Base64( Nonce[12] || Ciphertext || Tag )   ││
│     │  Nonce: First 12 bytes                              ││
│     │  Ciphertext: Encrypted plaintext                    ││
│     │  Tag: GCM authentication tag (16 bytes, appended)   ││
│     └─────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Write Path (Set Secret)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Admin   │────▶│ Crypto  │────▶│ Encode  │────▶│ Postgres│
│ UI/API  │     │ Engine  │     │ Base64  │     │ _secrets│
└─────────┘     └────┬────┘     └────┬────┘     └────┬────┘
                     │               │               │
                     ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ AES-GCM  │    │ Nonce +  │    │  UPSERT  │
              │ Encrypt  │    │ Ciphertext│    │  Record  │
              └──────────┘    └──────────┘    └──────────┘
```

1. Admin UI/API 接收明文 Secret
2. Crypto Engine 使用 Master Key 进行 AES-256-GCM 加密
3. 生成随机 Nonce，与密文拼接后 Base64 编码
4. 存储到 PostgreSQL `_secrets` 表

### Read Path (Get Secret)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ WASM/   │────▶│ Postgres│────▶│ Decode  │────▶│ Crypto  │
│ API     │     │ _secrets│     │ Base64  │     │ Engine  │
└─────────┘     └────┬────┘     └────┬────┘     └────┬────┘
                     │               │               │
                     ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  SELECT  │    │ Extract  │    │ AES-GCM  │
              │  Record  │    │ Nonce    │    │ Decrypt  │
              └──────────┘    └──────────┘    └──────────┘
                                                   │
                                                   ▼
                                            ┌──────────┐
                                            │ Plaintext│
                                            │ (Memory) │
                                            └──────────┘
```

1. 从 PostgreSQL 读取加密记录
2. Base64 解码，提取 Nonce 和 Ciphertext
3. Crypto Engine 使用 Master Key 解密
4. 返回明文（仅存在于内存中）
5. **安全清除**: 解密完成后立即擦除临时 buffer

## Key Design Decisions

### 1. Master Key 存储方式

**Decision**: 使用环境变量 `PB_MASTER_KEY`

**Rationale**:
- 环境变量不写入磁盘，重启后需重新配置
- 符合 12-Factor App 原则
- 与 Kubernetes Secrets、Docker Secrets 兼容
- 简单直接，无需额外密钥管理系统

**Trade-off**: 运维需确保环境变量安全

### 2. 加密算法选择

**Decision**: AES-256-GCM

**Alternatives Considered**:
- AES-256-CBC: 需要单独的 HMAC，实现复杂
- ChaCha20-Poly1305: 性能更好，但 AES 有硬件加速

**Rationale**:
- GCM 模式提供认证加密（Authenticated Encryption）
- 检测密文篡改
- Go 标准库原生支持
- 广泛使用，经过验证

### 3. Nonce 管理策略

**Decision**: 每次加密随机生成 12 字节 Nonce

**Rationale**:
- 随机 Nonce 避免重复风险
- 12 字节是 GCM 推荐长度
- Nonce 与密文一起存储，无需单独管理

### 4. Admin UI 安全策略

**Decision**: 禁止查看完整 Secret 值

**Rationale**:
- 防止背后有人窥屏
- 如果忘记 Key，去服务商重新生成
- 安全大于便利

### 5. 启动时 Master Key 检查

**Decision**: 缺少 Master Key 时服务正常启动，但 Secrets 功能不可用

**Rationale**:
- 密钥管理是可选功能，不应阻塞服务启动
- 用户可能不需要 Secrets 功能
- 尝试使用 Secrets 时给出明确错误提示
- Admin UI 显示配置引导信息

## Database Schema

```sql
-- _secrets 系统表
CREATE TABLE _secrets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT NOT NULL,
    value TEXT NOT NULL,  -- Base64(Nonce || Ciphertext)
    env TEXT NOT NULL DEFAULT 'global' CHECK (env IN ('global', 'dev', 'prod')),
    description TEXT,
    created TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE (key, env)
);

-- 索引
CREATE INDEX idx_secrets_key ON _secrets (key);
CREATE INDEX idx_secrets_env ON _secrets (env);
```

## API Design

### Core Interface

```go
type SecretsStore interface {
    // Get 获取解密后的 Secret 值
    // 如果 Key 不存在，返回 ErrSecretNotFound
    Get(key string) (string, error)
    
    // GetWithDefault 获取 Secret，不存在时返回默认值
    GetWithDefault(key string, defaultValue string) string
    
    // GetForEnv 获取指定环境的 Secret
    // 优先级: env > global
    GetForEnv(key string, env string) (string, error)
    
    // Set 创建或更新 Secret（加密存储）
    Set(key string, value string, opts ...SecretOption) error
    
    // Delete 删除 Secret
    Delete(key string) error
    
    // List 列出所有 Secrets（值显示掩码）
    List() ([]SecretInfo, error)
    
    // Exists 检查 Secret 是否存在
    Exists(key string) (bool, error)
}

type SecretOption func(*secretOptions)

func WithEnv(env string) SecretOption
func WithDescription(desc string) SecretOption

type SecretInfo struct {
    Key         string    `json:"key"`
    MaskedValue string    `json:"value"`  // 掩码显示
    Env         string    `json:"env"`
    Description string    `json:"description"`
    Created     time.Time `json:"created"`
    Updated     time.Time `json:"updated"`
}
```

### Usage Example

```go
// 获取 Secrets 存储实例
secrets := app.Secrets()

// 基础操作
err := secrets.Set("OPENAI_API_KEY", "sk-xxx")
value, err := secrets.Get("OPENAI_API_KEY")  // "sk-xxx"

// 带默认值
endpoint := secrets.GetWithDefault("API_ENDPOINT", "https://default.com")

// 环境隔离
secrets.Set("OPENAI_API_KEY", "sk-dev", WithEnv("dev"))
secrets.Set("OPENAI_API_KEY", "sk-prod", WithEnv("prod"))
value, _ := secrets.GetForEnv("OPENAI_API_KEY", "prod")  // "sk-prod"

// 列出所有 Secrets
list, _ := secrets.List()
// [{ Key: "OPENAI_API_KEY", MaskedValue: "sk-***", Env: "prod", ... }]
```

## HTTP API Design

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/secrets` | 创建 Secret | Superuser |
| GET | `/api/secrets` | 列出所有 Secrets（掩码） | Superuser |
| GET | `/api/secrets/:key` | 获取 Secret 值（解密） | Superuser |
| PUT | `/api/secrets/:key` | 更新 Secret 值 | Superuser |
| DELETE | `/api/secrets/:key` | 删除 Secret | Superuser |

### Request/Response Examples

```bash
# Create Secret
POST /api/secrets
Content-Type: application/json
Authorization: Bearer <superuser_token>

{
  "key": "OPENAI_API_KEY",
  "value": "sk-proj-xxx",
  "env": "prod",
  "description": "Production OpenAI Key"
}

# Response
{
  "id": "abc123",
  "key": "OPENAI_API_KEY",
  "env": "prod",
  "description": "Production OpenAI Key",
  "created": "2026-01-08T10:00:00Z",
  "updated": "2026-01-08T10:00:00Z"
}

# Get Secret
GET /api/secrets/OPENAI_API_KEY?env=prod
Authorization: Bearer <superuser_token>

# Response
{
  "key": "OPENAI_API_KEY",
  "value": "sk-proj-xxx",  // 解密后的值
  "env": "prod"
}

# List Secrets
GET /api/secrets
Authorization: Bearer <superuser_token>

# Response
{
  "items": [
    {
      "key": "OPENAI_API_KEY",
      "value": "sk-proj-***",  // 掩码显示
      "env": "prod",
      "description": "Production OpenAI Key",
      "created": "2026-01-08T10:00:00Z",
      "updated": "2026-01-08T10:00:00Z"
    }
  ]
}
```

## WASM Host Function Design

```go
// Host Function: pb_secret_get
// 注册到 WASM Runtime
func registerSecretHostFunctions(runtime wazero.Runtime, app *App) {
    runtime.NewHostModuleBuilder("pb").
        NewFunctionBuilder().
        WithFunc(func(ctx context.Context, m api.Module, keyPtr, keyLen uint32) uint64 {
            // 1. 从 WASM 内存读取 key
            key := readStringFromWasm(m, keyPtr, keyLen)
            
            // 2. 调用 SecretsStore 获取解密值
            value, err := app.Secrets().Get(key)
            if err != nil {
                return encodeError(err)
            }
            
            // 3. 将明文写入 WASM 线性内存
            resultPtr := writeStringToWasm(m, value)
            
            // 4. 安全清除 Go 侧的临时 buffer
            secureZero([]byte(value))
            
            return resultPtr
        }).
        Export("pb_secret_get")
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Master Key 泄露 | Low | Critical | 环境变量隔离，文档强调安全 |
| Master Key 丢失 | Medium | High | 明确文档说明不可恢复，建议备份 |
| 密文被篡改 | Low | Medium | GCM 认证加密检测篡改 |
| 日志泄露 Secret | Medium | High | 日志过滤器，文档警告 |
| WASM 内存泄露 | Low | Medium | 明文仅在 WASM 内存，函数结束后释放 |

## Security Boundaries

### NO Logging (日志清洗)

```go
// 日志过滤器示例
func sanitizeLog(message string) string {
    // 检测并替换可能的 Secret 值
    for _, pattern := range sensitivePatterns {
        message = pattern.ReplaceAllString(message, "[REDACTED]")
    }
    return message
}
```

### Size Limit

- Secret Value 最大 4KB
- 超过限制返回 `ErrValueTooLarge`
- 大文件应使用 File Storage

### Master Key Safety

- 启动时检查 `PB_MASTER_KEY` 环境变量
- 长度必须为 64 hex 字符（32 字节）
- 缺少或格式错误时拒绝启动

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| crypto/aes | stdlib | AES 加密 |
| crypto/cipher | stdlib | GCM 模式 |
| crypto/rand | stdlib | 随机 Nonce |
| encoding/base64 | stdlib | 密文编码 |

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| core/base.go | App 结构体集成 |
| core/db_connect.go | PostgreSQL 连接 |
| migrations/ | 系统表迁移 |
| plugins/wasm/ | Host Function 注册 |

## Testing Strategy

### Unit Tests
- 加密/解密正确性测试
- Nonce 唯一性测试
- 边界条件测试（空值、大值、特殊字符）
- Master Key 验证测试

### Integration Tests
- 完整 CRUD 流程测试
- 环境隔离测试
- WASM Host Function 调用测试
- HTTP API 端点测试

### Security Tests
- 密文格式验证
- 篡改检测测试
- 权限控制测试
- 日志过滤测试

### Benchmark Tests
- 加密/解密延迟基准
- 并发读写吞吐量
