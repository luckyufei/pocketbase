# 迁移计划：密钥管理从 Core 迁移到 Plugin

**Feature Branch**: `030-secrets-migration`  
**Created**: 2026-02-05  
**Status**: Ready for Dev  
**Reference**: `specs/029-crypto-architecture/spec.md`, `specs/007-secret-management/spec.md`

## 背景

根据 029 架构设计，需要将现有的 `_secrets` 系统表管理功能从 `core/` 迁移到 `plugins/secrets/`，实现以下目标：

1. **Layer 1 (CryptoEngine)**: 保留在 `core/`，重命名为 `crypto.go`
2. **Layer 2 (SecretField)**: 保留在 `core/`，继续使用 CryptoEngine
3. **Layer 3 (Secrets Plugin)**: 从 `core/` 迁移到 `plugins/secrets/`

---

## 当前代码结构

### Core 目录（需要重构）

| 文件 | 当前位置 | 目标位置 | 说明 |
|------|---------|---------|------|
| `secrets_crypto.go` | `core/` | `core/crypto.go` | 重命名为通用 CryptoEngine |
| `secrets_settings.go` | `core/` | 合并到 `core/crypto.go` | Master Key 管理逻辑 |
| `secrets_store.go` | `core/` | `plugins/secrets/store.go` | **迁移到插件** |
| `secrets_hooks.go` | `core/` | 拆分 | CryptoEngine 部分留 core，SecretsStore 部分移到插件 |
| `field_secret.go` | `core/` | 保持 | 仅修改依赖：`SecretsSettings` → `Crypto()` |

### APIs 目录（需要迁移）

| 文件 | 当前位置 | 目标位置 | 说明 |
|------|---------|---------|------|
| `secrets_routes.go` | `apis/` | `plugins/secrets/routes.go` | **迁移到插件** |
| `secrets_routes_test.go` | `apis/` | `plugins/secrets/routes_test.go` | **迁移到插件** |

### Migrations 目录（需要迁移）

| 文件 | 当前位置 | 目标位置 | 说明 |
|------|---------|---------|------|
| `1736500000_create_secrets.go` | `migrations/` | `plugins/secrets/migrations/` | **迁移到插件** |

### 引用方需要修改

| 文件 | 修改内容 |
|------|---------|
| `core/app.go` | 移除 `Secrets()`, `SecretsSettings()`；添加 `Crypto()` |
| `core/base.go` | 移除 `secretsStore`, `secretsSettings`；添加 `crypto` 字段 |
| `core/field_secret.go` | 使用 `app.Crypto()` 替代 `app.SecretsSettings().GetCryptoEngine()` |
| `plugins/gateway/header.go` | 修改 secrets 引用逻辑（从插件获取） |
| `examples/base/main.go` | 添加 `secrets.MustRegister(app, config)` |

---

## 迁移阶段

### Phase 1: 创建 Core CryptoEngine（不破坏现有功能）

**目标**：创建新的 `core/crypto.go`，提供 `app.Crypto()` 接口。

**任务**：

| ID | 任务 | 文件 | 测试 |
|----|------|------|------|
| M001 | 创建 `CryptoEngine` 接口 | `core/crypto.go` | ✓ |
| M002 | 实现 `aesCryptoEngine` | `core/crypto.go` | ✓ |
| M003 | 实现 `NoopCryptoEngine` | `core/crypto.go` | ✓ |
| M004 | 添加 `SecureZero()` 函数 | `core/crypto.go` | ✓ |
| M005 | 在 `BaseApp` 中添加 `crypto` 字段 | `core/base.go` | ✓ |
| M006 | 实现 `app.Crypto()` 方法 | `core/base.go` | ✓ |
| M007 | 在 Bootstrap 中初始化 CryptoEngine | `core/base_app.go` | ✓ |
| M008 | 添加 `core/crypto_test.go` | `core/crypto_test.go` | ✓ |

**验收标准**：
- `app.Crypto().Encrypt()` / `Decrypt()` 工作正常
- `app.Crypto().IsEnabled()` 正确反映 Master Key 状态
- 现有 `SecretsSettings` 和 `Secrets()` 仍然可用（兼容期）

---

### Phase 2: 迁移 SecretField 到使用 CryptoEngine

**目标**：修改 `SecretField` 使用新的 `app.Crypto()` 接口。

**任务**：

| ID | 任务 | 文件 | 测试 |
|----|------|------|------|
| M009 | 修改 `SecretField` 使用 `app.Crypto()` | `core/field_secret.go` | ✓ |
| M010 | 更新 `SecretField` 测试 | `core/field_secret_test.go` | ✓ |
| M011 | 验证加解密兼容性 | Integration Test | ✓ |

**验收标准**：
- `SecretField` 加解密功能正常
- 现有数据可以正常读取（密文格式不变）

---

### Phase 3: 创建 Secrets Plugin 骨架

**目标**：创建 `plugins/secrets/` 目录结构。

**任务**：

| ID | 任务 | 文件 | 测试 |
|----|------|------|------|
| M012 | 创建插件目录结构 | `plugins/secrets/` | - |
| M013 | 创建 `Config` 结构体 | `plugins/secrets/config.go` | ✓ |
| M014 | 创建 `MustRegister()` 函数 | `plugins/secrets/register.go` | ✓ |
| M015 | 定义 `SecretsStore` 接口 | `plugins/secrets/store.go` | ✓ |
| M016 | 创建 README.md | `plugins/secrets/README.md` | - |

**目录结构**：
```
plugins/secrets/
├── register.go        # MustRegister/Register 函数
├── config.go          # Config 结构体
├── store.go           # SecretsStore 接口和实现
├── routes.go          # HTTP API 路由
├── routes_test.go     # API 测试
├── migrations/        # _secrets 表迁移
│   └── 001_create_secrets.go
└── README.md          # 文档
```

---

### Phase 4: 迁移 SecretsStore 实现

**目标**：将 `core/secrets_store.go` 迁移到 `plugins/secrets/store.go`。

**任务**：

| ID | 任务 | 文件 | 测试 |
|----|------|------|------|
| M017 | 迁移 `SecretsStore` 接口 | `plugins/secrets/store.go` | ✓ |
| M018 | 迁移 `secretsStore` 实现 | `plugins/secrets/store.go` | ✓ |
| M019 | 修改使用 `app.Crypto()` | `plugins/secrets/store.go` | ✓ |
| M020 | 迁移测试 | `plugins/secrets/store_test.go` | ✓ |

---

### Phase 5: 迁移 HTTP API

**目标**：将 `apis/secrets_routes.go` 迁移到 `plugins/secrets/routes.go`。

**任务**：

| ID | 任务 | 文件 | 测试 |
|----|------|------|------|
| M021 | 迁移路由注册逻辑 | `plugins/secrets/routes.go` | ✓ |
| M022 | 迁移 API 处理函数 | `plugins/secrets/routes.go` | ✓ |
| M023 | 迁移测试 | `plugins/secrets/routes_test.go` | ✓ |
| M024 | 在 `MustRegister()` 中注册路由 | `plugins/secrets/register.go` | ✓ |

---

### Phase 6: 迁移 Migration

**目标**：将 `_secrets` 表迁移文件移动到插件。

**任务**：

| ID | 任务 | 文件 | 测试 |
|----|------|------|------|
| M025 | 迁移 `1736500000_create_secrets.go` | `plugins/secrets/migrations/` | ✓ |
| M026 | 在 `MustRegister()` 中注册迁移 | `plugins/secrets/register.go` | ✓ |

---

### Phase 7: 清理 Core 中的旧代码

**目标**：删除 `core/` 中已迁移的代码。

**任务**：

| ID | 任务 | 文件 | 说明 |
|----|------|------|------|
| M027 | 删除 `core/secrets_store.go` | - | 已迁移到插件 |
| M028 | 删除 `core/secrets_store_test.go` | - | 已迁移到插件 |
| M029 | 删除 `core/secrets_settings.go` | - | 合并到 `crypto.go` |
| M030 | 删除 `core/secrets_settings_test.go` | - | 合并到 `crypto_test.go` |
| M031 | 删除 `core/secrets_hooks.go` | - | 功能拆分到 `crypto.go` 和插件 |
| M032 | 删除 `apis/secrets_routes.go` | - | 已迁移到插件 |
| M033 | 删除 `apis/secrets_routes_test.go` | - | 已迁移到插件 |
| M034 | 删除 `migrations/1736500000_create_secrets.go` | - | 已迁移到插件 |

---

### Phase 8: 更新 App 接口

**目标**：修改 `core/app.go` 接口定义。

**任务**：

| ID | 任务 | 文件 | 说明 |
|----|------|------|------|
| M035 | 移除 `Secrets() SecretsStore` | `core/app.go` | 插件提供 |
| M036 | 移除 `SecretsSettings() *SecretsSettings` | `core/app.go` | 改用 `Crypto()` |
| M037 | 添加 `Crypto() CryptoEngine` | `core/app.go` | 新接口 |
| M038 | 更新 `BaseApp` 实现 | `core/base.go` | 移除旧字段 |

---

### Phase 9: 更新依赖方

**目标**：更新所有引用 Secrets 的代码。

**任务**：

| ID | 任务 | 文件 | 说明 |
|----|------|------|------|
| M039 | 更新 Gateway 插件 | `plugins/gateway/header.go` | 使用插件 API |
| M040 | 更新 examples/base | `examples/base/main.go` | 注册 secrets 插件 |
| M041 | 更新 WebUI | `webui/` | 调整 API 调用 |
| M042 | 更新 UI (Svelte) | `ui/` | 调整 API 调用 |

---

### Phase 10: 文档和测试

**目标**：更新文档，确保测试通过。

**任务**：

| ID | 任务 | 文件 | 说明 |
|----|------|------|------|
| M043 | 更新 CODEBUDDY.md | `CODEBUDDY.md` | 插件使用说明 |
| M044 | 更新 README.md | `README.md` | 插件列表 |
| M045 | 创建 secrets 插件 README | `plugins/secrets/README.md` | 详细文档 |
| M046 | 运行全量测试 | - | `go test ./...` |
| M047 | 运行 PostgreSQL 测试 | - | 双数据库验证 |

---

## 关键接口变更

### 移除的接口

```go
// core/app.go - 移除
type App interface {
    // 这两个方法将被移除
    Secrets() SecretsStore
    SecretsSettings() *SecretsSettings
}
```

### 新增的接口

```go
// core/app.go - 新增
type App interface {
    // 新增 CryptoEngine 访问
    Crypto() CryptoEngine
}

// core/crypto.go - 新增
type CryptoEngine interface {
    IsEnabled() bool
    Encrypt(plaintext string) (string, error)
    Decrypt(ciphertext string) (string, error)
    SecureZero(data []byte)
}
```

### 插件 API

```go
// plugins/secrets/register.go
func MustRegister(app core.App, config Config)
func Register(app core.App, config Config) error

// plugins/secrets/store.go
type SecretsStore interface {
    Set(key, value string, options ...SetOption) error
    Get(key string, options ...GetOption) (string, error)
    Delete(key string) error
    List() ([]*SecretModel, error)
    Exists(key string) bool
}

// 获取 SecretsStore 实例
func GetStore(app core.App) SecretsStore
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 密文格式变化导致数据无法解密 | 高 | 保持密文格式不变（Nonce + Ciphertext） |
| 接口变更导致编译错误 | 中 | 分阶段迁移，保持兼容期 |
| Gateway 插件依赖变更 | 中 | 提供 `GetStore()` 便捷方法 |
| 测试覆盖不足 | 中 | 迁移测试同步进行 |

---

## 时间估算

| Phase | 任务数 | 预估时间 |
|-------|--------|---------|
| Phase 1: CryptoEngine | 8 | 2h |
| Phase 2: SecretField 迁移 | 3 | 1h |
| Phase 3: 插件骨架 | 5 | 1h |
| Phase 4: SecretsStore 迁移 | 4 | 1.5h |
| Phase 5: HTTP API 迁移 | 4 | 1.5h |
| Phase 6: Migration 迁移 | 2 | 0.5h |
| Phase 7: 清理旧代码 | 8 | 1h |
| Phase 8: App 接口更新 | 4 | 1h |
| Phase 9: 依赖方更新 | 4 | 2h |
| Phase 10: 文档和测试 | 5 | 1h |
| **总计** | **47** | **~12.5h** |

---

## 验收标准

1. ✅ `app.Crypto()` 接口可用，加解密功能正常
2. ✅ `SecretField` 使用 `app.Crypto()` 工作正常
3. ✅ 注册 secrets 插件后，`/api/secrets` API 可用
4. ✅ 未注册 secrets 插件时，`/api/secrets` 返回 404
5. ✅ Gateway 插件 `{{secrets.KEY}}` 语法正常工作
6. ✅ 现有密文数据可以正常解密
7. ✅ 全量测试通过（SQLite + PostgreSQL）
8. ✅ 文档更新完成
