# Architecture Specification: 密钥管理架构设计

**Feature Branch**: `029-crypto-architecture`  
**Created**: 2026-02-05  
**Status**: Ready for Dev  
**Input**: 架构讨论 - 007-secret-management 与 015-secret-field 的关系分析

## 背景

在实现 007（系统级密钥管理 `_secrets`）和 015（用户级密钥字段 `SecretField`）时，发现两者存在以下关系：

1. **场景互补**：分别服务于系统管理员和普通用户
2. **技术复用**：共享同一套加密引擎
3. **层级不同**：`_secrets` 适合作为可选插件，`SecretField` 适合放在 Core

本 Spec 定义三层架构设计，明确各组件的职责和依赖关系。

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layer 3: Plugin                          │
│                     plugins/secrets/                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • _secrets 系统表 & Migration                              ││
│  │  • HTTP API (/api/secrets)                                  ││
│  │  • Admin UI 集成                                            ││
│  │  • 环境隔离 (dev/prod/global)                               ││
│  │  • JS SDK SecretsService                                    ││
│  │  • pb.secrets.Get("KEY") 便捷方法                           ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                         Layer 2: Core                            │
│                      core/field_secret.go                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • SecretField 类型定义                                     ││
│  │  • record.GetString("secret_field") 自动解密                ││
│  │  • record.Set("secret_field", "value") 自动加密             ││
│  │  • Proxy 模板解析 @request.auth.api_key                     ││
│  │  • 导入/导出处理                                            ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                         Layer 1: Core                            │
│                       core/crypto.go                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • CryptoEngine 接口定义                                    ││
│  │  • AES-256-GCM 加密/解密实现                                ││
│  │  • Master Key 管理 (PB_MASTER_KEY)                          ││
│  │  • Noop 实现 (Master Key 未配置时)                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CryptoEngine 基础设施 (Priority: P1)

作为 PocketBase 开发者，我希望有一个统一的加密引擎接口，以便所有需要加密的组件（SecretField、_secrets 插件等）复用同一套实现。

**Why this priority**: CryptoEngine 是整个密钥管理体系的基础，必须先实现。

**Independent Test**: 调用 `app.Crypto().Encrypt()` 和 `app.Crypto().Decrypt()` 验证加解密正确性。

**Acceptance Scenarios**:

1. **Given** `PB_MASTER_KEY` 已配置（≥32 字节）, **When** 启动 PocketBase, **Then** `app.Crypto().IsEnabled()` 返回 `true`
2. **Given** `PB_MASTER_KEY` 未配置, **When** 启动 PocketBase, **Then** `app.Crypto().IsEnabled()` 返回 `false`
3. **Given** CryptoEngine 启用, **When** 调用 `Encrypt("secret")`, **Then** 返回 Base64 编码的密文
4. **Given** CryptoEngine 启用, **When** 对密文调用 `Decrypt()`, **Then** 返回原始明文
5. **Given** 使用不同 Master Key 的密文, **When** 调用 `Decrypt()`, **Then** 返回解密错误

---

### User Story 2 - SecretField 用户级密钥 (Priority: P1)

作为应用开发者，我希望能在任意 Collection 中添加 `secret` 类型字段，以便用户安全存储自己的 API Keys。

**Why this priority**: SecretField 是用户自助管理密钥的核心能力。

**Independent Test**: 为 `users` Collection 添加 `api_key` secret 字段，验证用户可以安全存取。

**Acceptance Scenarios**:

1. **Given** CryptoEngine 已启用, **When** 创建 secret 类型字段, **Then** 字段创建成功
2. **Given** CryptoEngine 未启用, **When** 尝试创建 secret 字段, **Then** 返回错误提示配置 Master Key
3. **Given** secret 字段已创建, **When** 用户写入值, **Then** 值自动加密存储
4. **Given** 用户读取记录, **When** 调用 `record.GetString("api_key")`, **Then** 返回解密后的明文
5. **Given** Proxy 配置 `@request.auth.api_key`, **When** 用户发起代理请求, **Then** 使用用户的 API Key

---

### User Story 3 - Secrets 插件系统级密钥 (Priority: P2)

作为系统管理员，我希望通过 Secrets 插件管理共享的系统级 API Keys，以便多个用户/功能复用同一个密钥。

**Why this priority**: 系统级密钥管理是企业级功能，但不是每个项目都需要。

**Independent Test**: 注册 secrets 插件，通过 HTTP API 创建和获取系统密钥。

**Acceptance Scenarios**:

1. **Given** 未注册 secrets 插件, **When** 访问 `/api/secrets`, **Then** 返回 404
2. **Given** 注册 secrets 插件, **When** Superuser 调用 `POST /api/secrets`, **Then** 密钥加密存储到 `_secrets` 表
3. **Given** 密钥已存储, **When** Superuser 调用 `GET /api/secrets/:key`, **Then** 返回解密后的值
4. **Given** 密钥已存储, **When** Proxy 配置 `{{secrets.KEY}}`, **Then** 正确解析系统密钥
5. **Given** 非 Superuser, **When** 调用 secrets API, **Then** 返回 403 Forbidden

---

### User Story 4 - 混合使用场景 (Priority: P2)

作为开发者，我希望能在 Proxy 中同时使用系统密钥和用户密钥，以便实现灵活的 API Key 策略。

**Why this priority**: 混合使用是常见的企业级需求。

**Independent Test**: 配置 Proxy 使用 `@request.auth.api_key || {{secrets.DEFAULT_KEY}}` 作为 fallback。

**Acceptance Scenarios**:

1. **Given** 用户设置了 api_key, **When** 发起代理请求, **Then** 使用用户的 api_key
2. **Given** 用户未设置 api_key, **When** 发起代理请求, **Then** fallback 到系统 DEFAULT_KEY
3. **Given** 系统 DEFAULT_KEY 也未设置, **When** 发起代理请求, **Then** 返回 400 错误

---

### Edge Cases

**CryptoEngine (Layer 1)**:
- Master Key 变更后，所有已加密数据无法解密（设计如此，需重新设置）
- Master Key 丢失后数据不可恢复，需重新创建所有密钥
- `PB_MASTER_KEY` 长度不足 32 字节时，记录警告日志，功能不可用
- 并发加解密操作的线程安全性
- Base64 编码的密文中包含特殊字符的处理

**SecretField (Layer 2)**:
- CryptoEngine 禁用时，secret 字段不可用，提示配置 Master Key
- Secret 字段值超过 maxSize（默认 4KB）限制时，返回验证错误
- 空字符串 `""` 视为有效值，存储加密后的空串
- 特殊字符（Unicode、换行符）正确加密解密
- 并发读写同一 secret 字段时数据一致性
- **secret 字段不支持搜索/过滤（加密后无法比较）**
- **secret 字段不支持索引（加密后无意义）**

**Secrets Plugin (Layer 3)**:
- Secret Value 超过 4KB 时返回 `ErrValueTooLarge` / HTTP 400
- Key 命名建议 `VENDOR_TYPE_ENV` 格式，但不强制
- 并发更新同一 Secret 时最后写入者胜出（Last Write Wins）
- 加密失败时返回错误，不存储明文
- 解密失败（密文损坏）时返回错误，记录日志

---

### Assumptions

1. CryptoEngine 是 Core 的一部分，始终可用（但可能未启用）
2. SecretField 是 Core 字段类型，不需要额外注册
3. Secrets 插件是可选的，需要显式注册
4. 两者共享同一个 Master Key（`PB_MASTER_KEY`）
5. 日志系统自动过滤所有 secret 值，防止泄露
6. Master Key 由运维人员通过环境变量安全配置
7. Admin UI 对 `_secrets` 不提供 "Reveal" 功能（SecretField 可 Reveal 5 秒）
8. SecretField 的 `hidden` 属性默认为 `true`
9. API 响应中，`hidden: true` 的字段默认不返回，需 `?fields=` 显式请求

---

## Functional Requirements

| ID | Requirement | Priority | Layer | User Story |
|----|-------------|----------|-------|------------|
| **Layer 1: CryptoEngine** |
| FR-001 | CryptoEngine 接口定义 | P1 | Core | US1 |
| FR-002 | AES-256-GCM 加密实现 | P1 | Core | US1 |
| FR-003 | NoopCryptoEngine 空实现 | P1 | Core | US1 |
| FR-004 | `app.Crypto()` 方法 | P1 | Core | US1 |
| FR-005 | SecureZero 安全擦除函数 | P1 | Core | US1 |
| **Layer 2: SecretField** |
| FR-006 | SecretField 类型定义（含 SecretFieldValue 结构体） | P1 | Core | US2 |
| FR-007 | SecretField 自动加解密（FindSetter/FindGetter） | P1 | Core | US2 |
| FR-008 | SecretField Hidden 属性（默认 true） | P1 | Core | US2 |
| FR-009 | SecretField MaxSize 限制（默认 4KB） | P2 | Core | US2 |
| FR-010 | SecretField 禁止搜索/过滤/索引 | P1 | Core | US2 |
| FR-011 | Proxy 模板支持 `@request.auth.<secret_field>` | P1 | Core | US2 |
| FR-012 | Hook 中 `record.GetString()` 返回解密值 | P1 | Core | US2 |
| FR-013 | Admin UI Reveal 功能（5 秒自动隐藏） | P1 | Core | US2 |
| FR-014 | 导出密文/导入自动加密 | P2 | Core | US2 |
| **Layer 3: Secrets Plugin** |
| FR-015 | Secrets 插件 MustRegister | P2 | Plugin | US3 |
| FR-016 | `_secrets` 系统表（key, value, env, description, created, updated） | P2 | Plugin | US3 |
| FR-017 | HTTP API `/api/secrets` CRUD | P2 | Plugin | US3 |
| FR-018 | HTTP API 仅 Superuser 访问 | P2 | Plugin | US3 |
| FR-019 | env 字段实现环境隔离（global/dev/prod） | P2 | Plugin | US3 |
| FR-020 | Proxy 模板支持 `{{secrets.KEY}}` | P2 | Plugin | US4 |
| FR-021 | JS SDK SecretsService | P2 | Plugin | US3 |
| FR-022 | Admin UI 禁止 Reveal（仅 Overwrite） | P2 | Plugin | US3 |
| FR-023 | 日志过滤 Secret 值 | P2 | Core/Plugin | - |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 加密算法安全性 | AES-256-GCM | 代码审查 |
| SC-002 | 加解密延迟 | < 1ms | Benchmark |
| SC-003 | Master Key 不落盘 | 100% | 安全审计 |
| SC-004 | 测试覆盖率 | > 80% | go test -cover |
| SC-005 | Layer 1-2 无外部依赖 | 0 | 依赖分析 |
| SC-006 | HTTP API 响应延迟 | < 10ms (P99) | Benchmark |
| SC-007 | Admin UI 无明文泄露 | 100% | 安全测试 |

### 参考 Benchmark 数据（015-secret-field）

| 操作 | 延迟 | 说明 |
|------|------|------|
| 加密 | ~564ns | 单次加密操作 |
| 解密 | ~241ns | 单次解密操作 |
| 批量读取 | ~185μs/100条 | 含解密的记录读取 |

---

## Schema Definitions

### Layer 2: SecretField 类型

```go
const FieldTypeSecret = "secret"

type SecretField struct {
    Name        string `form:"name" json:"name"`
    Id          string `form:"id" json:"id"`
    System      bool   `form:"system" json:"system"`
    Hidden      bool   `form:"hidden" json:"hidden"`  // 默认 true
    Presentable bool   `form:"presentable" json:"presentable"`
    Required    bool   `form:"required" json:"required"`
    MaxSize     int    `form:"maxSize" json:"maxSize"`  // 默认 4KB
}

// SecretFieldValue 内部状态结构体
type SecretFieldValue struct {
    Plain     string  // 明文（设置时）
    Encrypted string  // 密文（存储后）
    LastError error   // 加密/解密错误
}
```

**数据库存储格式**:
```
Column Type: TEXT DEFAULT '' NOT NULL
Storage Format: Base64( Nonce[12] || Ciphertext || Tag )
```

**与 PasswordField 对比**:

| 特性 | PasswordField | SecretField |
|------|---------------|-------------|
| 加密方式 | bcrypt (单向哈希) | AES-256-GCM (可逆) |
| 可读回明文 | ❌ 不能 | ✅ 能 |
| 用途 | 密码验证 | 存储 API Keys |
| Hidden 默认值 | true | true |
| Reveal 功能 | ❌ 无 | ✅ 有（5 秒自动隐藏）|
| 支持搜索/过滤 | ❌ | ❌ |
| 支持索引 | ❌ | ❌ |

### Layer 3: `_secrets` 系统表

```sql
CREATE TABLE _secrets (
    id          TEXT PRIMARY KEY,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,  -- 加密密文 (Base64)
    env         TEXT NOT NULL DEFAULT 'global',  -- global/dev/prod
    description TEXT DEFAULT '',
    created     TEXT NOT NULL,
    updated     TEXT NOT NULL,
    UNIQUE(key, env)
);
```

| Field | Type | Options | Description |
|-------|------|---------|-------------|
| `key` | text | Unique(key,env), Required | 键名，建议 `VENDOR_TYPE_ENV` |
| `value` | text | **Encrypted** | 密文 (Base64: Nonce \|\| Ciphertext) |
| `env` | select | `global`, `dev`, `prod` | 环境隔离标识 |
| `description` | text | Optional | 备注说明 |
| `created` | date | System | 创建时间 |
| `updated` | date | System | 最后更新时间 |

---

## JS SDK API Design

### Layer 3: SecretsService（Secrets 插件）

```typescript
// jssdk/src/services/SecretsService.ts

export interface SecretModel {
    key: string;
    value: string;      // 列表时为掩码，get 时为明文
    env: "global" | "dev" | "prod";
    description?: string;
    created: string;
    updated: string;
}

export interface SecretCreateParams {
    key: string;
    value: string;
    env?: "global" | "dev" | "prod";
    description?: string;
}

export interface SecretUpdateParams {
    value?: string;
    env?: "global" | "dev" | "prod";
    description?: string;
}

export class SecretsService extends BaseService {
    async get(key: string): Promise<string>;
    async getWithDefault(key: string, defaultValue: string): Promise<string>;
    async list(): Promise<SecretModel[]>;
    async create(params: SecretCreateParams): Promise<SecretModel>;
    async update(key: string, params: SecretUpdateParams): Promise<SecretModel>;
    async delete(key: string): Promise<boolean>;
    async exists(key: string): Promise<boolean>;
}
```

**Superuser 使用示例**:

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://localhost:8090');

// 以 Superuser 身份认证
await pb.collection('_superusers').authWithPassword('admin@example.com', 'password');

// 创建系统密钥
await pb.secrets.create({
    key: 'OPENAI_API_KEY',
    value: 'sk-proj-xxx',
    env: 'prod',
    description: 'Production OpenAI Key'
});

// 获取密钥（解密值）
const apiKey = await pb.secrets.get('OPENAI_API_KEY');

// 带默认值获取
const endpoint = await pb.secrets.getWithDefault('API_ENDPOINT', 'https://api.default.com');

// 列出所有密钥（值显示掩码）
const secrets = await pb.secrets.list();
// [{ key: 'OPENAI_API_KEY', value: 'sk-proj-***', env: 'prod', ... }]
```

### Layer 2: SecretField 用户使用示例

```javascript
// 普通用户管理自己的 API Key
await pb.collection('users').authWithPassword('user@example.com', 'password');

// 更新自己的 api_key
await pb.collection('users').update(pb.authStore.record.id, {
    api_key: 'sk-my-personal-key'
});

// 读取自己的记录（需要显式请求 hidden 字段）
const me = await pb.collection('users').getOne(pb.authStore.record.id, {
    fields: 'id,email,api_key'
});
console.log(me.api_key);  // 'sk-my-personal-key'

// 发起代理请求（使用自己的 api_key）
const response = await pb.send('/-/openai/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
    })
});
```

---

## Proxy 模板语法

### 支持的模板变量

| 语法 | 说明 | 来源 | Layer |
|------|------|------|-------|
| `{env.VAR_NAME}` | 环境变量 | 系统环境 | - |
| `{{secrets.KEY_NAME}}` | 系统密钥 | `_secrets` 表 | Plugin |
| `@request.auth.<field>` | 用户字段（含 secret） | 当前认证用户 | Core |

### 示例配置

**使用用户 secret 字段（Layer 2）**:

```json
{
  "path": "/-/openai",
  "upstream": "https://api.openai.com",
  "headers": {
    "Authorization": "Bearer @request.auth.api_key"
  },
  "accessRule": "@request.auth.api_key != ''"
}
```

**使用系统密钥（Layer 3，需注册 Secrets 插件）**:

```json
{
  "path": "/-/company-ai",
  "upstream": "https://api.openai.com",
  "headers": {
    "Authorization": "Bearer {{secrets.OPENAI_API_KEY}}"
  }
}
```

**混合使用（优先用户 Key，fallback 到系统 Key）**:

```json
{
  "path": "/-/hybrid-ai",
  "upstream": "https://api.openai.com",
  "headers": {
    "Authorization": "Bearer @request.auth.api_key || {{secrets.OPENAI_DEFAULT_KEY}}"
  }
}
```

---

## 详细设计

### Layer 1: `core/crypto.go` - 加密引擎

```go
// core/crypto.go

// CryptoEngine 加密引擎接口
type CryptoEngine interface {
    // Encrypt 加密明文，返回 Base64 编码的密文
    Encrypt(plaintext string) (string, error)
    
    // Decrypt 解密 Base64 编码的密文，返回明文
    Decrypt(ciphertext string) (string, error)
    
    // IsEnabled 是否启用（Master Key 是否配置）
    IsEnabled() bool
    
    // MaskValue 生成掩码显示 (sk-xxx → sk-***)
    MaskValue(value string, visibleChars int) string
}

// NoopCryptoEngine 未配置 Master Key 时的空实现
type NoopCryptoEngine struct{}

func (n *NoopCryptoEngine) Encrypt(plaintext string) (string, error) {
    return "", ErrMasterKeyNotConfigured
}

func (n *NoopCryptoEngine) Decrypt(ciphertext string) (string, error) {
    return "", ErrMasterKeyNotConfigured
}

func (n *NoopCryptoEngine) IsEnabled() bool { return false }

func (n *NoopCryptoEngine) MaskValue(value string, visibleChars int) string {
    return maskString(value, visibleChars)
}

// AESCryptoEngine AES-256-GCM 实现
type AESCryptoEngine struct {
    key []byte
}

func NewAESCryptoEngine(masterKey string) (*AESCryptoEngine, error) {
    // 从 Master Key 派生 256-bit 密钥（使用 HKDF 或直接截取）
    key := deriveKey(masterKey)
    return &AESCryptoEngine{key: key}, nil
}

func (e *AESCryptoEngine) Encrypt(plaintext string) (string, error) {
    // AES-256-GCM 加密
    // 返回: Base64(Nonce[12] || Ciphertext || Tag)
}

func (e *AESCryptoEngine) Decrypt(ciphertext string) (string, error) {
    // AES-256-GCM 解密
}

func (e *AESCryptoEngine) IsEnabled() bool { return true }

func (e *AESCryptoEngine) MaskValue(value string, visibleChars int) string {
    return maskString(value, visibleChars)
}
```

### Layer 1: `core/app.go` - App 接口扩展

```go
// core/app.go

type App interface {
    // ... 现有方法 ...
    
    // Crypto 返回加密引擎
    // 如果 PB_MASTER_KEY 未配置，返回 NoopCryptoEngine
    Crypto() CryptoEngine
}
```

### Layer 1: `core/base.go` - BaseApp 实现

```go
// core/base.go

type BaseApp struct {
    // ... 现有字段 ...
    crypto CryptoEngine
}

func (app *BaseApp) Crypto() CryptoEngine {
    return app.crypto
}

// Bootstrap 中初始化
func (app *BaseApp) Bootstrap() error {
    // ... 现有逻辑 ...
    
    // 初始化 CryptoEngine
    masterKey := os.Getenv("PB_MASTER_KEY")
    if masterKey != "" && len(masterKey) >= 32 {
        engine, err := NewAESCryptoEngine(masterKey)
        if err != nil {
            app.Logger().Warn("Failed to init crypto engine", "error", err)
            app.crypto = &NoopCryptoEngine{}
        } else {
            app.crypto = engine
        }
    } else {
        if masterKey != "" {
            app.Logger().Warn("PB_MASTER_KEY too short, need >= 32 bytes")
        }
        app.crypto = &NoopCryptoEngine{}
    }
    
    return nil
}
```

### Layer 2: `core/field_secret.go` - Secret 字段类型

```go
// core/field_secret.go

const FieldTypeSecret = "secret"

var _ Field = (*SecretField)(nil)

type SecretField struct {
    Name        string `form:"name" json:"name"`
    Id          string `form:"id" json:"id"`
    System      bool   `form:"system" json:"system"`
    Hidden      bool   `form:"hidden" json:"hidden"`
    Required    bool   `form:"required" json:"required"`
    MaxSize     int    `form:"maxSize" json:"maxSize"`
}

func (f *SecretField) Type() string {
    return FieldTypeSecret
}

// PrepareValue 在存储前加密
func (f *SecretField) PrepareValue(app App, record *Record, raw any) (any, error) {
    if !app.Crypto().IsEnabled() {
        return nil, ErrMasterKeyNotConfigured
    }
    
    str, _ := raw.(string)
    if str == "" {
        return "", nil
    }
    
    // 检查是否已经是密文（避免重复加密）
    if isEncrypted(str) {
        return str, nil
    }
    
    return app.Crypto().Encrypt(str)
}

// GetValue 在读取时解密
func (f *SecretField) GetValue(app App, record *Record, raw any) (any, error) {
    str, _ := raw.(string)
    if str == "" {
        return "", nil
    }
    
    if !app.Crypto().IsEnabled() {
        return "", ErrMasterKeyNotConfigured
    }
    
    return app.Crypto().Decrypt(str)
}

// ValidateSettings 验证字段配置
func (f *SecretField) ValidateSettings(app App, collection *Collection) error {
    if !app.Crypto().IsEnabled() {
        return validation.NewError(
            "field_secret_master_key_required",
            "Secret field requires PB_MASTER_KEY environment variable",
        )
    }
    return nil
}
```

### Layer 3: `plugins/secrets/register.go` - Secrets 插件

```go
// plugins/secrets/register.go

package secrets

// Config 插件配置
type Config struct {
    Disabled bool
}

// MustRegister 注册 secrets 插件
func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

func Register(app core.App, config Config) error {
    if config.Disabled {
        return nil
    }
    
    // 检查 CryptoEngine 是否可用
    if !app.Crypto().IsEnabled() {
        app.Logger().Warn("Secrets plugin disabled: PB_MASTER_KEY not configured")
        return nil
    }
    
    p := &secretsPlugin{
        app:    app,
        config: config,
    }
    
    // 注册 migration（创建 _secrets 表）
    app.OnBootstrap().BindFunc(p.onBootstrap)
    
    // 注册路由
    app.OnServe().BindFunc(p.onServe)
    
    return nil
}
```

### Layer 3: `plugins/secrets/repository.go` - 存储层

```go
// plugins/secrets/repository.go

package secrets

// SecretsRepository 系统密钥存储
type SecretsRepository struct {
    app core.App
}

// Get 获取并解密系统密钥
func (r *SecretsRepository) Get(key string, env ...string) (string, error) {
    // 查询 _secrets 表
    // 使用 app.Crypto().Decrypt() 解密
}

// Set 加密并存储系统密钥
func (r *SecretsRepository) Set(key, value string, env string) error {
    // 使用 app.Crypto().Encrypt() 加密
    // 存入 _secrets 表
}

// Delete 删除密钥
func (r *SecretsRepository) Delete(key string) error {
    // 从 _secrets 表删除
}

// List 列出所有密钥（值显示掩码）
func (r *SecretsRepository) List() ([]*Secret, error) {
    // 查询所有密钥
    // 值使用 app.Crypto().MaskValue() 掩码
}
```

### Layer 3: `plugins/secrets/routes.go` - HTTP API

```go
// plugins/secrets/routes.go

package secrets

func (p *secretsPlugin) onServe(e *core.ServeEvent) error {
    // POST   /api/secrets           - 创建 Secret
    // GET    /api/secrets           - 列出所有 Secrets（值掩码）
    // GET    /api/secrets/:key      - 获取 Secret 值（解密）
    // PUT    /api/secrets/:key      - 更新 Secret 值
    // DELETE /api/secrets/:key      - 删除 Secret
    
    g := e.Router.Group("/api/secrets")
    g.Bind(apis.RequireSuperuserAuth())
    
    g.POST("", p.createHandler())
    g.GET("", p.listHandler())
    g.GET("/{key}", p.getHandler())
    g.PUT("/{key}", p.updateHandler())
    g.DELETE("/{key}", p.deleteHandler())
    
    return e.Next()
}
```

### Layer 3: `plugins/secrets/api.go` - 便捷方法

```go
// plugins/secrets/api.go

package secrets

// GetSecret 便捷方法（供其他代码使用）
func GetSecret(app core.App, key string) (string, error) {
    repo := getRepository(app)
    if repo == nil {
        return "", ErrSecretsPluginNotRegistered
    }
    return repo.Get(key)
}

// GetSecretWithDefault 带默认值的便捷方法
func GetSecretWithDefault(app core.App, key string, defaultValue string) string {
    value, err := GetSecret(app, key)
    if err != nil {
        return defaultValue
    }
    return value
}
```

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   plugins/secrets/          依赖→    core/crypto.go         │
│   (可选插件)                         (加密引擎)              │
│                                           ↑                 │
│                                           │                 │
│   core/field_secret.go      依赖→    core/crypto.go         │
│   (核心字段类型)                     (加密引擎)              │
│                                                             │
│   plugins/gateway/          依赖→    core/field_secret.go   │
│   (代理网关)                         (解析 @request.auth.x) │
│                                           │                 │
│                             可选依赖→  plugins/secrets/      │
│                                      (解析 {{secrets.x}})   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 使用方式对比

### SecretField（Core，始终可用）

```go
// 任何 Collection 都可以添加 secret 字段
collection := app.FindCollectionByNameOrId("users")

// 自动加密存储
record.Set("api_key", "sk-xxx")
app.Save(record)

// 自动解密读取
apiKey := record.GetString("api_key") // "sk-xxx"
```

### Secrets Plugin（可选）

```go
// main.go - 显式注册
import "github.com/pocketbase/pocketbase/plugins/secrets"

func main() {
    app := pocketbase.New()
    
    // 可选：注册 secrets 插件
    secrets.MustRegister(app, secrets.Config{})
    
    app.Start()
}

// 使用
apiKey, err := secrets.GetSecret(app, "OPENAI_API_KEY")

// 或通过 HTTP API
// POST /api/secrets { "key": "OPENAI_API_KEY", "value": "sk-xxx" }
```

---

## 场景对比

| 场景 | 使用 `_secrets` | 使用 `SecretField` |
|------|:------------------:|:----------------------:|
| 公司统一的 OpenAI Key | ✅ | ❌ |
| 用户自带 OpenAI Key（BYOK） | ❌ | ✅ |
| Stripe 支付网关密钥 | ✅ | ❌ |
| 用户的第三方 OAuth Token | ❌ | ✅ |
| 数据库连接密码 | ✅ | ❌ |
| 用户的 GitHub Personal Token | ❌ | ✅ |

---

## 目录结构

```
core/
├── crypto.go              # Layer 1: CryptoEngine 接口和实现
├── crypto_test.go         # 加密引擎测试
├── field_secret.go        # Layer 2: SecretField 类型
├── field_secret_test.go   # SecretField 测试
├── app.go                 # 扩展 App 接口
└── base.go                # BaseApp 实现

plugins/secrets/
├── register.go            # Layer 3: 插件注册
├── config.go              # 插件配置
├── repository.go          # 存储层
├── routes.go              # HTTP API 路由
├── handlers.go            # 请求处理器
├── api.go                 # 便捷方法
├── migration.go           # _secrets 表迁移
└── README.md              # 插件文档
```

---

## 总结

| 组件 | 位置 | 理由 |
|------|------|------|
| **CryptoEngine** | `core/` | 基础设施，被多个组件依赖 |
| **SecretField** | `core/` | 字段类型是核心能力，record.GetString() 需要用 |
| **Secrets Plugin** | `plugins/` | 可选功能，不是每个项目都需要系统密钥管理 |

**好处**：
1. ✅ **最小化 Core**：只有必要的放在 core
2. ✅ **复用加密引擎**：两者共享 `app.Crypto()`
3. ✅ **按需加载**：不需要 `_secrets` 表的项目不用注册插件
4. ✅ **依赖清晰**：Plugin 依赖 Core，但 Core 不依赖 Plugin

---

## Admin UI 行为差异

| 功能 | SecretField (Layer 2) | `_secrets` (Layer 3) |
|------|----------------------|---------------------|
| 输入框类型 | 密码 `******` | 密码 `******` |
| 列表显示 | 掩码 `sk-••••••345` | 掩码 `sk-proj-***` |
| Reveal 功能 | ✅ 有（5 秒自动隐藏）| ❌ 无（安全考虑）|
| 编辑方式 | 覆盖写入 | 仅 Overwrite |
| 特殊标识 | 无 | 锁图标（系统安全表）|
| 功能未启用提示 | 字段创建失败 | 配置引导页面 |

---

## SQL 参考（Layer 3: Secrets Plugin）

### 基础操作

```sql
-- Create Secret (UPSERT)
INSERT INTO _secrets (id, key, value, env, description, created, updated)
VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
ON CONFLICT (key, env) DO UPDATE
SET value = EXCLUDED.value, 
    description = EXCLUDED.description,
    updated = NOW();

-- Get Secret
SELECT value FROM _secrets
WHERE key = $1 AND env = $2;

-- Get Secret with fallback to global
SELECT value FROM _secrets
WHERE key = $1 AND env IN ($2, 'global')
ORDER BY CASE WHEN env = $2 THEN 0 ELSE 1 END
LIMIT 1;

-- Delete Secret
DELETE FROM _secrets WHERE key = $1 AND env = $2;

-- List Secrets (with mask)
SELECT id, key, 
       CASE 
         WHEN length(value) > 10 THEN substring(value, 1, 6) || '***'
         ELSE '***'
       END as masked_value,
       env, description, created, updated
FROM _secrets
ORDER BY key, env;
```

### 掩码函数

```go
// MaskValue 生成掩码显示值
func MaskValue(value string, visibleChars int) string {
    if len(value) <= visibleChars {
        return "***"
    }
    // 显示前缀 + 掩码
    // sk-proj-xxx -> sk-proj-***
    prefix := value[:visibleChars]
    return prefix + "***"
}
```

---

## Crypto 实现参考（Layer 1）

### Encrypt

```go
func (e *AESCryptoEngine) Encrypt(plaintext []byte) ([]byte, error) {
    // 1. 创建 AES cipher
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return nil, err
    }
    
    // 2. 创建 GCM 模式
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    // 3. 生成随机 Nonce (12 bytes)
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }
    
    // 4. 加密 (Nonce || Ciphertext || Tag)
    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
    
    return ciphertext, nil
}
```

### Decrypt

```go
func (e *AESCryptoEngine) Decrypt(ciphertext []byte) ([]byte, error) {
    // 1. 创建 AES cipher
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return nil, err
    }
    
    // 2. 创建 GCM 模式
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    // 3. 提取 Nonce
    nonceSize := gcm.NonceSize()
    if len(ciphertext) < nonceSize {
        return nil, ErrInvalidCiphertext
    }
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
    
    // 4. 解密并验证
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return nil, ErrDecryptionFailed
    }
    
    return plaintext, nil
}
```

### SecureZero

```go
// SecureZero 安全擦除内存
func SecureZero(buf []byte) {
    for i := range buf {
        buf[i] = 0
    }
    // 防止编译器优化掉
    runtime.KeepAlive(buf)
}
```

---

## 安全考量

### 权限控制

**SecretField (Layer 2)** - 由 Collection Rules 控制：

```
// users collection rules
viewRule: "@request.auth.id = id"
updateRule: "@request.auth.id = id"
```

**`_secrets` (Layer 3)** - 仅 Superuser：
- 未认证返回 `401 Unauthorized`
- 非 Superuser 返回 `403 Forbidden`
- 功能未启用返回 `503 Service Unavailable`

### 日志过滤

```go
// 日志自动过滤
log.Debug("Secret updated", "key", secretKey, "value", "[REDACTED]")
```

### Audit Trail（可选）

```
[AUDIT] Superuser admin@example.com created secret OPENAI_API_KEY at 2026-02-05T10:00:00Z
[AUDIT] User user_123 updated field api_key at 2026-02-05T10:00:00Z
```
