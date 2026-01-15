# Feature Specification: Secret Field Type (`secret`)

**Feature Branch**: `011-secret-field`  
**Created**: 2026-01-15  
**Status**: Ready for Dev  
**Input**: 用户需求讨论 - 普通用户需要安全存储自己的 API Keys

## 背景

当前 PocketBase 的 `_secrets` 系统表仅供 Superuser 管理系统级密钥（如共享的 OpenAI API Key）。但在实际业务场景中，普通用户也有存储和管理个人敏感数据的需求：

- 用户想使用自己的 OpenAI API Key（使用自己的配额）
- 用户需要存储第三方服务的 Access Token
- 应用需要为每个用户存储独立的支付凭证

现有的 `password` 字段类型使用 bcrypt 单向哈希，无法读回明文。需要一个新的 `secret` 字段类型，使用 AES-256-GCM 可逆加密，允许在需要时解密读取。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collection 添加 Secret 字段 (Priority: P1)

作为开发者，我希望能在任意 Collection 中添加 `secret` 类型字段，以便安全存储用户的敏感数据。

**Why this priority**: 这是 Secret Field 的核心能力，是所有其他功能的基础。

**Independent Test**: 在 Admin UI 中为 `users` Collection 添加 `api_key` 字段（类型为 secret），验证字段创建成功。

**Acceptance Scenarios**:

1. **Given** 编辑 Collection Schema, **When** 选择添加字段类型, **Then** 可以看到 `secret` 类型选项
2. **Given** 添加 secret 字段, **When** 配置字段属性, **Then** 可以设置 `required`、`hidden`、`maxSize` 等选项
3. **Given** Secret 字段已添加, **When** 查看数据库表结构, **Then** 字段为 TEXT 类型
4. **Given** PB_MASTER_KEY 未配置, **When** 尝试添加 secret 字段, **Then** 返回错误提示需要配置 Master Key
5. **Given** Secret 字段已添加, **When** 删除该字段, **Then** 数据库中加密数据一并删除

---

### User Story 2 - 用户通过 API 管理自己的 Secret (Priority: P1)

作为应用用户，我希望能通过 RESTful API 创建、读取、更新自己的 secret 字段值，以便管理个人 API Keys。

**Why this priority**: 这是用户与 Secret Field 交互的主要方式。

**Independent Test**: 使用 JS SDK 创建用户记录并设置 secret 字段值，验证可以正常存取。

**Acceptance Scenarios**:

1. **Given** users Collection 有 secret 字段 `api_key`, **When** 用户创建记录 `{api_key: "sk-xxx"}`, **Then** 值以加密形式存入数据库
2. **Given** 用户已设置 api_key, **When** 用户读取自己的记录, **Then** 返回解密后的明文 `sk-xxx`
3. **Given** 用户 A 已设置 api_key, **When** 用户 B 尝试读取用户 A 的记录, **Then** 根据 Collection Rules 决定是否可见
4. **Given** secret 字段设置了 `hidden: true`, **When** 用户读取记录, **Then** API 响应中不包含该字段
5. **Given** secret 字段 `hidden: true`, **When** 使用 `?fields=api_key` 显式请求, **Then** 仍返回该字段（如果有权限）
6. **Given** 用户更新 api_key 值, **When** 提交 `{api_key: "sk-new"}`, **Then** 新值加密存储，覆盖旧值
7. **Given** 用户删除记录, **When** 记录被删除, **Then** 加密数据一并删除

---

### User Story 3 - Admin UI 安全交互 (Priority: P1)

作为管理员，我希望在 Admin UI 中安全地查看和编辑 secret 字段，以便管理用户数据时防止泄露。

**Why this priority**: Admin UI 是管理数据的主要入口，必须确保安全。

**Independent Test**: 在 Admin UI 中创建、查看、编辑包含 secret 字段的记录。

**Acceptance Scenarios**:

1. **Given** 编辑记录表单, **When** 输入 secret 字段值, **Then** 输入框为密码类型 `******`
2. **Given** 记录已有 secret 值, **When** 在列表页查看, **Then** 显示掩码 `sk-***`
3. **Given** 记录已有 secret 值, **When** 在详情页查看, **Then** 显示掩码，提供 "Reveal" 按钮（点击后显示明文 5 秒）
4. **Given** 点击 Reveal 按钮, **When** 5 秒后, **Then** 自动恢复为掩码显示
5. **Given** 编辑记录, **When** 更新 secret 字段, **Then** 可以输入新值覆盖

---

### User Story 4 - Proxy 网关读取用户 Secret (Priority: P1)

作为开发者，我希望在 `_proxies` 代理配置中能引用用户的 secret 字段值，以便为每个用户使用其自己的 API Key。

**Why this priority**: 这是 Secret Field 的核心使用场景之一，支持按用户计费的 LLM 调用。

**Independent Test**: 配置 Proxy 使用 `@request.auth.api_key` 作为 Authorization header，验证请求使用用户自己的 API Key。

**Acceptance Scenarios**:

1. **Given** users 有 secret 字段 `api_key`, **When** Proxy headers 配置 `"Authorization": "Bearer @request.auth.api_key"`, **Then** 代理请求使用用户的 api_key 值
2. **Given** 用户 api_key 为 `sk-user-xxx`, **When** 用户发起代理请求, **Then** 上游收到 `Authorization: Bearer sk-user-xxx`
3. **Given** 用户 api_key 为空, **When** 用户发起代理请求, **Then** 返回 400 错误提示缺少必要的 API Key
4. **Given** Proxy accessRule 为 `@request.auth.api_key != ""`, **When** 用户未设置 api_key, **Then** 返回 403 Forbidden
5. **Given** 使用 `{{secrets.SYSTEM_KEY}}` 和 `@request.auth.api_key`, **When** 混合使用系统密钥和用户密钥, **Then** 两者都正确解析

---

### User Story 5 - Hook 中读取解密值 (Priority: P1)

作为后端开发者，我希望在 Go/JS Hook 中能获取 secret 字段的解密值，以便在业务逻辑中使用用户的 API Key。

**Why this priority**: Hook 是扩展 PocketBase 的主要方式，需要支持 Secret 读取。

**Independent Test**: 在 OnRecordCreate hook 中读取 secret 字段值并打印日志。

**Acceptance Scenarios**:

1. **Given** record 有 secret 字段 `api_key`, **When** 调用 `record.GetString("api_key")`, **Then** 返回解密后的明文
2. **Given** record 有 secret 字段, **When** 调用 `record.Get("api_key")`, **Then** 返回解密后的明文字符串
3. **Given** record 有 secret 字段, **When** 调用 `record.GetRaw("api_key")`, **Then** 返回 `SecretFieldValue` 结构体
4. **Given** secret 字段值为空, **When** 调用 `record.GetString("api_key")`, **Then** 返回空字符串
5. **Given** 在 JS Hook 中, **When** 访问 `record.api_key`, **Then** 返回解密后的明文

---

### User Story 6 - 批量操作安全处理 (Priority: P2)

作为开发者，我希望批量导入/导出时 secret 字段有合理的处理方式，以便数据迁移时不泄露敏感信息。

**Why this priority**: 批量操作是常见场景，但安全优先级次于实时访问。

**Independent Test**: 导出包含 secret 字段的 Collection，验证导出格式。

**Acceptance Scenarios**:

1. **Given** 导出 Collection 数据, **When** 包含 secret 字段, **Then** 导出加密后的密文（Base64），不是明文
2. **Given** 导入数据, **When** secret 字段值为明文, **Then** 自动加密后存储
3. **Given** 导入数据, **When** secret 字段值为有效密文, **Then** 直接存储（不重复加密）
4. **Given** 使用不同 Master Key 的密文, **When** 导入数据, **Then** 解密失败，返回错误

---

### Edge Cases

- Master Key 未配置时，secret 字段不可用，提示配置
- Master Key 变更后，现有 secret 字段数据无法解密（需重新设置）
- Secret 字段值超过 maxSize 限制时，返回验证错误
- 空字符串 `""` 视为有效值，存储加密后的空串
- 特殊字符（Unicode、换行符）正确加密解密
- 并发读写同一 secret 字段时数据一致性

---

### Assumptions

1. Secret Field 复用 `_secrets` 的 CryptoEngine（同一个 Master Key）
2. Secret Field 的 `hidden` 属性默认为 `true`
3. API 响应中，`hidden: true` 的字段默认不返回，需显式请求
4. Collection Rules 控制谁能读取 secret 字段
5. 日志系统自动过滤 secret 字段值，防止泄露
6. secret 字段不支持搜索/过滤（加密后无法比较）
7. secret 字段不支持索引（加密后无意义）

---

## Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 支持在任意 Collection 添加 secret 类型字段 | P1 | US1 |
| FR-002 | Secret 字段使用 AES-256-GCM 加密存储 | P1 | US1 |
| FR-003 | 用户可通过 RESTful API 读写自己的 secret 字段 | P1 | US2 |
| FR-004 | Secret 字段支持 `hidden` 属性，默认不返回 | P1 | US2 |
| FR-005 | Admin UI 输入框为密码类型 | P1 | US3 |
| FR-006 | Admin UI 支持 Reveal 按钮显示明文（5 秒） | P1 | US3 |
| FR-007 | Proxy headers 支持 `@request.auth.<secret_field>` 模板 | P1 | US4 |
| FR-008 | Go/JS Hook 中可通过 `GetString()` 获取解密值 | P1 | US5 |
| FR-009 | 导出时输出密文，导入时自动加密 | P2 | US6 |
| FR-010 | Secret 字段值大小限制（默认 4KB） | P2 | - |
| FR-011 | PB_MASTER_KEY 未配置时拒绝创建 secret 字段 | P1 | US1 |
| FR-012 | 日志过滤 secret 字段值 | P2 | - |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 加密算法安全性 | AES-256-GCM | 代码审查 |
| SC-002 | 读取延迟（解密） | < 1ms | Benchmark |
| SC-003 | 写入延迟（加密） | < 1ms | Benchmark |
| SC-004 | Admin UI 无明文泄露 | 100% | 安全测试 |
| SC-005 | Proxy 模板解析正确 | 100% | 集成测试 |
| SC-006 | 测试覆盖率 | > 80% | go test -cover |

---

## Schema Definition: SecretField

### 字段类型定义

```go
const FieldTypeSecret = "secret"

type SecretField struct {
    // Name (required) 字段名称
    Name string `form:"name" json:"name"`
    
    // Id 唯一稳定标识符
    Id string `form:"id" json:"id"`
    
    // System 系统字段标识
    System bool `form:"system" json:"system"`
    
    // Hidden 是否在 API 响应中隐藏（默认 true）
    Hidden bool `form:"hidden" json:"hidden"`
    
    // Presentable 是否在关联预览中显示
    Presentable bool `form:"presentable" json:"presentable"`
    
    // Required 是否必填
    Required bool `form:"required" json:"required"`
    
    // MaxSize 最大值大小（字节），默认 4KB
    MaxSize int `form:"maxSize" json:"maxSize"`
}
```

### 数据库存储格式

```
Column Type: TEXT DEFAULT '' NOT NULL
Storage Format: Base64( Nonce[12] || Ciphertext || Tag )
```

### 与 PasswordField 对比

| 特性 | PasswordField | SecretField |
|------|---------------|-------------|
| 加密方式 | bcrypt (单向哈希) | AES-256-GCM (可逆) |
| 可读回明文 | ❌ 不能 | ✅ 能 |
| 用途 | 密码验证 | 存储 API Keys |
| Hidden 默认值 | true | true |
| Reveal 功能 | ❌ 无 | ✅ 有（Admin UI） |

---

## Proxy 模板语法扩展

### 支持的模板变量

| 语法 | 说明 | 来源 |
|------|------|------|
| `{env.VAR_NAME}` | 环境变量 | 系统环境 |
| `{{secrets.KEY_NAME}}` | 系统密钥 | `_secrets` 表 |
| `@request.auth.<field>` | 用户字段（含 secret） | 当前认证用户 |
| `@request.auth.<secret_field>` | 用户 secret 字段 | 当前认证用户（解密） |

### 示例配置

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

用户 A（api_key = "sk-user-a"）发起请求：
```
上游收到: Authorization: Bearer sk-user-a
```

用户 B（api_key = "sk-user-b"）发起请求：
```
上游收到: Authorization: Bearer sk-user-b
```

---

## Go SDK API 设计

### SecretFieldValue 结构体

```go
type SecretFieldValue struct {
    Plain     string // 明文（设置时）
    Encrypted string // 密文（存储后）
    LastError error  // 加密/解密错误
}
```

### Record 交互

```go
// 设置 secret 字段值
record.Set("api_key", "sk-xxx")

// 获取解密后的值
apiKey := record.GetString("api_key")  // "sk-xxx"

// 获取原始结构体
raw := record.GetRaw("api_key").(*SecretFieldValue)
```

### 字段选项

```go
// 创建 SecretField
field := &SecretField{
    Name:     "api_key",
    Hidden:   true,   // 默认
    Required: false,
    MaxSize:  4096,   // 4KB
}
```

---

## JS SDK 使用示例

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://localhost:8090');

// 用户登录
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

## 安全考量

### 权限控制

Secret Field 的访问由 Collection Rules 控制：

```
// users collection rules
viewRule: "@request.auth.id = id"
updateRule: "@request.auth.id = id"
```

用户只能读写自己的 secret 字段。

### 日志过滤

所有包含 secret 字段的日志都需要过滤：

```go
// 日志自动过滤
log.Debug("User updated", "api_key", "[REDACTED]")
```

### Audit Trail

建议记录 secret 字段的变更（不记录值）：

```
[AUDIT] User user_123 updated field api_key at 2026-01-15T10:00:00Z
```

---

## 与现有功能关系

```
┌─────────────────────────────────────────────────────────────┐
│                     PocketBase                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    CryptoEngine                         ││
│  │               (Master Key: PB_MASTER_KEY)               ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│            ┌────────────────┼────────────────┐              │
│            │                │                │              │
│            ▼                ▼                ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  _secrets    │  │ SecretField  │  │  (Future)    │       │
│  │ 系统级密钥    │  │ 用户级密钥    │  │  其他加密    │       │
│  │              │  │              │  │              │       │
│  │ Superuser    │  │ 普通用户     │  │              │       │
│  │ 管理         │  │ 自助管理     │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| 组件 | 管理者 | 用途 | 访问方式 |
|------|--------|------|----------|
| `_secrets` | Superuser | 系统配置 | `app.Secrets().Get()` |
| SecretField | 普通用户 | 用户数据 | `record.GetString()` |
