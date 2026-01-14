# Implementation Plan: Secret Field Type (`secret`)

**Branch**: `011-secret-field` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)

## Summary

为 PocketBase 新增 `secret` 字段类型，支持在任意 Collection 中存储用户级加密数据。复用现有的 `CryptoEngine`（基于 `PB_MASTER_KEY`），使用 AES-256-GCM 可逆加密。普通用户可通过 RESTful API 管理自己的 secret 字段值，Proxy 网关可读取用户的 secret 字段作为请求头注入。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `core/secrets_crypto.go` (复用现有 CryptoEngine)
- `core/field_password.go` (参考实现模式)

**Storage**: PostgreSQL/SQLite TEXT 字段  
**Testing**: Go test (unit + integration)  
**Target Platform**: Linux/macOS/Windows  
**Project Type**: Go Backend (PocketBase Field 扩展)  
**Security Goals**: 字段值加密存储，Master Key 永不落盘  
**Constraints**: 依赖 `PB_MASTER_KEY` 配置

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | Field 类型编译进主二进制 |
| Zero External Dependencies | ✅ PASS | 复用现有 CryptoEngine |
| Anti-Stupidity | ✅ PASS | 用户可自助管理密钥，无需 Superuser |
| Data Locality | ✅ PASS | 数据存储在同一数据库 |
| Fail Safe | ✅ PASS | 缺少 Master Key 时拒绝创建 secret 字段 |

## Project Structure

### Documentation

```text
specs/011-secret-field/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code

```text
# Backend (Go)
core/
├── field_secret.go          # SecretField 实现
├── field_secret_test.go     # 单元测试
└── secrets_crypto.go        # (已存在) 复用 CryptoEngine

apis/
├── record_crud.go           # (修改) 支持 secret 字段解密
└── record_auth.go           # (修改) 支持 @request.auth.secret_field

# Proxy 扩展
core/
└── proxy_header.go          # (修改) 支持解析用户 secret 字段

# Admin UI
ui/src/components/
└── base/SecretInput.svelte  # Secret 字段输入组件（带 Reveal）
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Field Type: secret                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  SecretField Struct                     ││
│  │  Name | Hidden | Required | MaxSize                     ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                   Set/Get Handlers                      ││
│  │                                                         ││
│  │  Set("api_key", "sk-xxx")                              ││
│  │    └─▶ CryptoEngine.EncryptToBase64()                  ││
│  │    └─▶ Store encrypted in DB                           ││
│  │                                                         ││
│  │  GetString("api_key")                                  ││
│  │    └─▶ Read encrypted from DB                          ││
│  │    └─▶ CryptoEngine.DecryptFromBase64()                ││
│  │    └─▶ Return plaintext                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Integration Points                    ││
│  │                                                         ││
│  │  • RESTful API: record.api_key → decrypt on read       ││
│  │  • Admin UI: password input + Reveal button            ││
│  │  • Proxy: @request.auth.api_key → decrypt for header   ││
│  │  • Hooks: record.GetString("api_key") → plaintext      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Write Path (Set Secret Field)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ User    │────▶│ Validate│────▶│ Crypto  │────▶│ Database│
│ Input   │     │ Field   │     │ Engine  │     │ Column  │
└─────────┘     └────┬────┘     └────┬────┘     └────┬────┘
                     │               │               │
                     ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ MaxSize  │    │ AES-GCM  │    │  TEXT    │
              │ Check    │    │ Encrypt  │    │  Column  │
              └──────────┘    └──────────┘    └──────────┘
```

### Read Path (Get Secret Field)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Database│────▶│ Crypto  │────▶│ Access  │────▶│ API     │
│ Column  │     │ Engine  │     │ Check   │     │ Response│
└─────────┘     └────┬────┘     └────┬────┘     └────┬────┘
                     │               │               │
                     ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ AES-GCM  │    │ Hidden?  │    │ Plaintext│
              │ Decrypt  │    │ Rules?   │    │ or Omit  │
              └──────────┘    └──────────┘    └──────────┘
```

### Proxy Integration

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Proxy   │────▶│ Parse   │────▶│ Resolve │────▶│ Inject  │
│ Config  │     │ Template│     │ Value   │     │ Header  │
└─────────┘     └────┬────┘     └────┬────┘     └────┬────┘
                     │               │               │
                     ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ @request │    │ Decrypt  │    │ Bearer   │
              │ .auth    │    │ secret   │    │ sk-xxx   │
              │ .api_key │    │ field    │    │          │
              └──────────┘    └──────────┘    └──────────┘
```

## Key Design Decisions

### 1. 复用现有 CryptoEngine

**Decision**: 使用 `core/secrets_crypto.go` 中的 CryptoEngine

**Rationale**:
- 已验证的 AES-256-GCM 实现
- 统一 Master Key 管理
- 减少代码重复

**Trade-off**: 所有加密数据使用同一 Master Key

### 2. Hidden 默认值

**Decision**: Secret 字段 `Hidden` 默认为 `true`

**Rationale**:
- 安全优先，默认不暴露
- 需要时可显式请求
- 与 PasswordField 行为一致

### 3. Reveal 功能（仅 Admin UI）

**Decision**: Admin UI 提供 Reveal 按钮，API 不提供

**Rationale**:
- Admin 需要偶尔查看值
- 5 秒自动隐藏减少泄露风险
- API 调用者通常是程序，不需要 Reveal

### 4. 导入导出处理

**Decision**: 导出密文，导入时自动检测并加密

**Rationale**:
- 导出不暴露明文
- 导入时兼容明文和密文
- 支持数据迁移场景

### 5. Master Key 未配置时行为

**Decision**: 拒绝创建 secret 字段，但不阻塞已有数据读取

**Rationale**:
- 创建时必须能加密
- 已有数据可能需要迁移，允许读取（解密失败时返回错误）

## Field Implementation Reference

参考 `field_password.go` 实现模式：

```go
// field_secret.go
package core

func init() {
    Fields[FieldTypeSecret] = func() Field {
        return &SecretField{}
    }
}

const FieldTypeSecret = "secret"

type SecretField struct {
    Name        string `form:"name" json:"name"`
    Id          string `form:"id" json:"id"`
    System      bool   `form:"system" json:"system"`
    Hidden      bool   `form:"hidden" json:"hidden"`
    Presentable bool   `form:"presentable" json:"presentable"`
    Required    bool   `form:"required" json:"required"`
    MaxSize     int    `form:"maxSize" json:"maxSize"`
}

// SecretFieldValue 存储加密/解密状态
type SecretFieldValue struct {
    Plain     string // 明文（设置时/解密后）
    Encrypted string // 密文（数据库存储）
    LastError error  // 加解密错误
}
```

## Proxy Template Resolution

### 现有模板类型

```go
// proxy_header.go 现有实现
{env.VAR_NAME}        → os.Getenv("VAR_NAME")
{{secrets.KEY_NAME}}  → app.Secrets().Get("KEY_NAME")
```

### 新增用户字段模板

```go
// 需要扩展
@request.auth.field_name → 获取当前用户的 field 值

// 对于 secret 字段
@request.auth.api_key    → 解密后的 secret 值
```

### 实现方式

```go
func resolveHeaderValue(app App, auth *Record, template string) (string, error) {
    // 处理 @request.auth.xxx
    if strings.HasPrefix(template, "@request.auth.") {
        fieldName := strings.TrimPrefix(template, "@request.auth.")
        if auth == nil {
            return "", errors.New("authentication required")
        }
        
        // GetString 会自动处理 secret 字段解密
        return auth.GetString(fieldName), nil
    }
    
    // 其他模板类型...
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Master Key 变更导致数据不可用 | Low | High | 文档警告，迁移工具 |
| 用户误读他人 secret | Low | Critical | Collection Rules 控制 |
| 日志泄露 secret 值 | Medium | High | 日志过滤器 |
| Admin Reveal 被窥屏 | Low | Medium | 5 秒自动隐藏 |
| 性能影响（每次读取解密） | Low | Low | 解密延迟 <1ms |

## Dependencies

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| `core/secrets_crypto.go` | CryptoEngine 复用 |
| `core/secrets_settings.go` | Master Key 检查 |
| `core/field_password.go` | 实现模式参考 |
| `core/proxy_header.go` | Proxy 模板扩展 |
| `apis/record_crud.go` | API 响应处理 |

### UI Dependencies

| Component | Purpose |
|-----------|---------|
| `ui/src/components/base/Field.svelte` | 字段渲染 |
| `ui/src/components/base/TextField.svelte` | 输入组件参考 |

## Testing Strategy

### Unit Tests
- SecretField 创建/验证
- 加密/解密正确性
- MaxSize 验证
- Hidden 行为

### Integration Tests
- API CRUD 完整流程
- Collection Rules 权限控制
- Proxy 模板解析
- Hook 中读取值

### Security Tests
- 不同用户访问控制
- 日志不泄露值
- Admin UI Reveal 行为

### Benchmark Tests
- 加密/解密延迟
- 批量读取性能

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| 加密延迟 | < 1ms | - |
| 解密延迟 | < 1ms | - |
| 测试覆盖率 | > 80% | - |
| API 响应延迟增加 | < 5% | - |
