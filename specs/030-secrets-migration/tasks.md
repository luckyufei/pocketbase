# 迁移任务清单：密钥管理从 Core 到 Plugin

**Reference**: `specs/030-secrets-migration/plan.md`  
**Total Tasks**: 47  
**Estimated Time**: ~12.5h

---

## Phase 1: 创建 Core CryptoEngine（2h）

### T001: 创建 CryptoEngine 接口定义
**文件**: `core/crypto.go`  
**优先级**: P1  
**预估**: 15min

```go
// CryptoEngine 定义加密引擎接口
// 所有需要加密功能的组件（SecretField、Secrets Plugin 等）都通过此接口进行加解密
type CryptoEngine interface {
    // IsEnabled 返回加密功能是否启用（Master Key 是否配置）
    IsEnabled() bool
    
    // Encrypt 加密明文，返回 Base64 编码的密文
    // 密文格式: Base64(Nonce[12] + Ciphertext)
    Encrypt(plaintext string) (string, error)
    
    // Decrypt 解密 Base64 编码的密文，返回明文
    Decrypt(ciphertext string) (string, error)
    
    // SecureZero 安全擦除内存中的敏感数据
    SecureZero(data []byte)
}
```

**验收标准**:
- [ ] 接口定义符合 029 spec
- [ ] 注释完整

---

### T002: 实现 aesCryptoEngine 结构体
**文件**: `core/crypto.go`  
**优先级**: P1  
**预估**: 30min  
**依赖**: T001

```go
// aesCryptoEngine 使用 AES-256-GCM 算法的加密引擎实现
type aesCryptoEngine struct {
    cipher cipher.AEAD
}

// newAESCryptoEngine 创建 AES-256-GCM 加密引擎
// masterKey 必须是 32 字节（256 位）的十六进制字符串
func newAESCryptoEngine(masterKey string) (*aesCryptoEngine, error) {
    // 从 secrets_crypto.go 迁移实现
}

func (e *aesCryptoEngine) IsEnabled() bool {
    return true
}

func (e *aesCryptoEngine) Encrypt(plaintext string) (string, error) {
    // 从 secrets_crypto.go 迁移实现
    // 1. 生成随机 Nonce (12 bytes)
    // 2. AES-256-GCM 加密
    // 3. 返回 Base64(Nonce + Ciphertext)
}

func (e *aesCryptoEngine) Decrypt(ciphertext string) (string, error) {
    // 从 secrets_crypto.go 迁移实现
}

func (e *aesCryptoEngine) SecureZero(data []byte) {
    // 安全擦除实现
}
```

**验收标准**:
- [ ] Encrypt/Decrypt 功能正常
- [ ] 密文格式与现有实现兼容
- [ ] SecureZero 正确擦除内存

---

### T003: 实现 NoopCryptoEngine 空实现
**文件**: `core/crypto.go`  
**优先级**: P1  
**预估**: 10min  
**依赖**: T001

```go
// noopCryptoEngine 空实现，用于 Master Key 未配置时
type noopCryptoEngine struct{}

func (e *noopCryptoEngine) IsEnabled() bool {
    return false
}

func (e *noopCryptoEngine) Encrypt(plaintext string) (string, error) {
    return "", ErrCryptoNotEnabled
}

func (e *noopCryptoEngine) Decrypt(ciphertext string) (string, error) {
    return "", ErrCryptoNotEnabled
}

func (e *noopCryptoEngine) SecureZero(data []byte) {
    // noop
}
```

**验收标准**:
- [ ] IsEnabled() 返回 false
- [ ] Encrypt/Decrypt 返回 ErrCryptoNotEnabled

---

### T004: 定义错误常量
**文件**: `core/crypto.go`  
**优先级**: P1  
**预估**: 5min

```go
var (
    // ErrCryptoNotEnabled 表示加密功能未启用（Master Key 未配置）
    ErrCryptoNotEnabled = errors.New("crypto engine not enabled: PB_MASTER_KEY not set")
    
    // ErrMasterKeyInvalid 表示 Master Key 格式无效
    ErrMasterKeyInvalid = errors.New("invalid master key: must be 64 hex characters (32 bytes)")
    
    // ErrDecryptFailed 表示解密失败（密文损坏或 Key 不匹配）
    ErrDecryptFailed = errors.New("decryption failed: ciphertext may be corrupted or key mismatch")
)
```

---

### T005: 添加 Master Key 加载逻辑
**文件**: `core/crypto.go`  
**优先级**: P1  
**预估**: 15min

```go
const (
    // MasterKeyEnvVar 是 Master Key 环境变量名
    MasterKeyEnvVar = "PB_MASTER_KEY"
    
    // MasterKeyLength 是 Master Key 的期望长度（64 hex chars = 32 bytes）
    MasterKeyLength = 64
)

// loadMasterKey 从环境变量加载 Master Key
func loadMasterKey() (string, error) {
    key := os.Getenv(MasterKeyEnvVar)
    if key == "" {
        return "", ErrCryptoNotEnabled
    }
    if len(key) < MasterKeyLength {
        return "", ErrMasterKeyInvalid
    }
    return key, nil
}
```

---

### T006: 在 BaseApp 中添加 crypto 字段
**文件**: `core/base.go`  
**优先级**: P1  
**预估**: 10min

```go
// BaseApp 添加字段
type BaseApp struct {
    // ... 现有字段 ...
    
    // CryptoEngine 实例
    crypto CryptoEngine
}
```

---

### T007: 实现 app.Crypto() 方法
**文件**: `core/base.go`  
**优先级**: P1  
**预估**: 10min  
**依赖**: T006

```go
// Crypto 返回 CryptoEngine 实例
// 如果 Master Key 未配置，返回 NoopCryptoEngine
func (app *BaseApp) Crypto() CryptoEngine {
    return app.crypto
}
```

---

### T008: 在 Bootstrap 中初始化 CryptoEngine
**文件**: `core/base_app.go`（或 Bootstrap 相关文件）  
**优先级**: P1  
**预估**: 20min  
**依赖**: T002, T003, T005, T007

```go
// initCryptoEngine 初始化加密引擎
func (app *BaseApp) initCryptoEngine() {
    masterKey, err := loadMasterKey()
    if err != nil {
        if err == ErrCryptoNotEnabled {
            app.Logger().Info("Crypto engine disabled: PB_MASTER_KEY not set")
        } else {
            app.Logger().Warn("Crypto engine disabled", "error", err)
        }
        app.crypto = &noopCryptoEngine{}
        return
    }
    
    engine, err := newAESCryptoEngine(masterKey)
    if err != nil {
        app.Logger().Error("Failed to initialize crypto engine", "error", err)
        app.crypto = &noopCryptoEngine{}
        return
    }
    
    app.crypto = engine
    app.Logger().Info("Crypto engine initialized successfully")
}
```

**验收标准**:
- [ ] Bootstrap 时正确初始化 CryptoEngine
- [ ] Master Key 未配置时使用 NoopCryptoEngine
- [ ] 日志信息正确

---

### T009: 创建 crypto_test.go 测试
**文件**: `core/crypto_test.go`  
**优先级**: P1  
**预估**: 30min  
**依赖**: T001-T008

```go
// 测试用例
// - TestCryptoEngine_Interface
// - TestAESCryptoEngine_EncryptDecrypt
// - TestAESCryptoEngine_InvalidKey
// - TestNoopCryptoEngine_Disabled
// - TestSecureZero
// - TestLoadMasterKey_EnvVar
// - TestCryptoEngine_CiphertextFormat（验证与现有格式兼容）
```

**验收标准**:
- [ ] 测试覆盖率 > 90%
- [ ] 密文格式兼容性测试通过

---

## Phase 2: 迁移 SecretField 到使用 CryptoEngine（1h）

### T010: 修改 SecretField 使用 app.Crypto()
**文件**: `core/field_secret.go`  
**优先级**: P1  
**预估**: 30min  
**依赖**: Phase 1 完成

**修改内容**:

```go
// 修改前
func (f *SecretField) encrypt(app App, value string) (string, error) {
    settings := app.SecretsSettings()
    if settings == nil || !settings.IsEnabled() {
        return "", ErrSecretsDisabled
    }
    engine := settings.GetCryptoEngine()
    return engine.Encrypt(value)
}

// 修改后
func (f *SecretField) encrypt(app App, value string) (string, error) {
    crypto := app.Crypto()
    if !crypto.IsEnabled() {
        return "", ErrCryptoNotEnabled
    }
    return crypto.Encrypt(value)
}
```

**验收标准**:
- [ ] 使用 `app.Crypto()` 替代 `app.SecretsSettings().GetCryptoEngine()`
- [ ] 错误信息改为 `ErrCryptoNotEnabled`
- [ ] 加解密功能正常

---

### T011: 更新 SecretField 测试
**文件**: `core/field_secret_test.go`  
**优先级**: P1  
**预估**: 20min  
**依赖**: T010

**修改内容**:
- 移除对 `SecretsSettings` 的测试依赖
- 使用 `app.Crypto()` 进行测试验证

---

### T012: 验证加解密兼容性（集成测试）
**优先级**: P1  
**预估**: 10min  
**依赖**: T010, T011

**测试内容**:
- 使用旧代码加密的数据，新代码能正确解密
- 密文格式保持不变

---

## Phase 3: 创建 Secrets Plugin 骨架（1h）

### T013: 创建插件目录结构
**优先级**: P1  
**预估**: 5min

```
plugins/secrets/
├── register.go
├── config.go
├── store.go
├── routes.go
├── migrations/
│   └── 001_create_secrets.go
└── README.md
```

---

### T014: 创建 Config 结构体
**文件**: `plugins/secrets/config.go`  
**优先级**: P1  
**预估**: 15min

```go
package secrets

// Config 定义 Secrets 插件配置
type Config struct {
    // 是否启用环境隔离（默认 true）
    EnableEnvIsolation bool
    
    // 默认环境（默认 "global"）
    DefaultEnv string
    
    // 最大 Value 大小（默认 4KB）
    MaxValueSize int
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
    return Config{
        EnableEnvIsolation: true,
        DefaultEnv:         "global",
        MaxValueSize:       4096,
    }
}
```

---

### T015: 创建 MustRegister() 函数骨架
**文件**: `plugins/secrets/register.go`  
**优先级**: P1  
**预估**: 20min

```go
package secrets

import (
    "github.com/pocketbase/pocketbase/core"
)

// MustRegister 注册 Secrets 插件（panic on error）
func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

// Register 注册 Secrets 插件
func Register(app core.App, config Config) error {
    // 1. 检查 CryptoEngine 是否启用
    // 2. 注册迁移
    // 3. 初始化 SecretsStore
    // 4. 注册路由
    return nil
}
```

---

### T016: 定义 SecretsStore 接口
**文件**: `plugins/secrets/store.go`  
**优先级**: P1  
**预估**: 15min

```go
package secrets

// SecretModel 表示一个 Secret 记录
type SecretModel struct {
    ID          string `json:"id"`
    Key         string `json:"key"`
    Value       string `json:"value"`       // 列表时为掩码，Get 时为明文
    Env         string `json:"env"`
    Description string `json:"description"`
    Created     string `json:"created"`
    Updated     string `json:"updated"`
}

// SecretsStore 定义 Secrets 存储接口
type SecretsStore interface {
    // Set 创建或更新 Secret
    Set(key, value string, options ...SetOption) error
    
    // Get 获取 Secret 值（解密后的明文）
    Get(key string, options ...GetOption) (string, error)
    
    // Delete 删除 Secret
    Delete(key string, options ...DeleteOption) error
    
    // List 列出所有 Secrets（值显示掩码）
    List(options ...ListOption) ([]*SecretModel, error)
    
    // Exists 检查 Secret 是否存在
    Exists(key string, options ...ExistsOption) bool
}

// GetStore 获取已注册的 SecretsStore 实例
func GetStore(app core.App) SecretsStore {
    // 从 app.Store() 中获取
}
```

---

### T017: 创建 README.md
**文件**: `plugins/secrets/README.md`  
**优先级**: P2  
**预估**: 5min

---

## Phase 4: 迁移 SecretsStore 实现（1.5h）

### T018: 迁移 SecretsStore 实现
**文件**: `plugins/secrets/store.go`  
**优先级**: P1  
**预估**: 45min  
**来源**: `core/secrets_store.go`

**修改内容**:
- 包名从 `core` 改为 `secrets`
- 使用 `app.Crypto()` 替代 `secretsSettings.GetCryptoEngine()`
- 移除对 `secretsSettings` 的依赖

---

### T019: 实现 SetOption/GetOption 等选项
**文件**: `plugins/secrets/options.go`  
**优先级**: P1  
**预估**: 15min

```go
// SetOption 定义 Set 操作的选项
type SetOption func(*setOptions)

type setOptions struct {
    env         string
    description string
}

func WithEnv(env string) SetOption {
    return func(o *setOptions) {
        o.env = env
    }
}

func WithDescription(desc string) SetOption {
    return func(o *setOptions) {
        o.description = desc
    }
}

// GetOption 定义 Get 操作的选项
type GetOption func(*getOptions)

type getOptions struct {
    env string
}

func GetWithEnv(env string) GetOption {
    return func(o *getOptions) {
        o.env = env
    }
}
```

---

### T020: 迁移 SecretsStore 测试
**文件**: `plugins/secrets/store_test.go`  
**优先级**: P1  
**预估**: 30min  
**来源**: `core/secrets_store_test.go`

---

## Phase 5: 迁移 HTTP API（1.5h）

### T021: 迁移路由注册逻辑
**文件**: `plugins/secrets/routes.go`  
**优先级**: P1  
**预估**: 20min  
**来源**: `apis/secrets_routes.go`

```go
// registerRoutes 注册 Secrets API 路由
func registerRoutes(app core.App, store SecretsStore) {
    // POST   /api/secrets
    // GET    /api/secrets
    // GET    /api/secrets/:key
    // PUT    /api/secrets/:key
    // DELETE /api/secrets/:key
}
```

---

### T022: 迁移 API 处理函数
**文件**: `plugins/secrets/routes.go`  
**优先级**: P1  
**预估**: 40min  
**来源**: `apis/secrets_routes.go`

**处理函数**:
- `handleCreate`
- `handleList`
- `handleGet`
- `handleUpdate`
- `handleDelete`

---

### T023: 迁移路由测试
**文件**: `plugins/secrets/routes_test.go`  
**优先级**: P1  
**预估**: 30min  
**来源**: `apis/secrets_routes_test.go`

---

### T024: 在 MustRegister() 中注册路由
**文件**: `plugins/secrets/register.go`  
**优先级**: P1  
**预估**: 10min  
**依赖**: T021, T022

---

## Phase 6: 迁移 Migration（0.5h）

### T025: 迁移 _secrets 表创建脚本
**文件**: `plugins/secrets/migrations/001_create_secrets.go`  
**优先级**: P1  
**预估**: 20min  
**来源**: `migrations/1736500000_create_secrets.go`

```go
package migrations

import "github.com/pocketbase/pocketbase/core"

// CreateSecretsTable 创建 _secrets 系统表
func CreateSecretsTable(app core.App) error {
    // SQLite 和 PostgreSQL 兼容的 DDL
}
```

---

### T026: 在 MustRegister() 中注册迁移
**文件**: `plugins/secrets/register.go`  
**优先级**: P1  
**预估**: 10min  
**依赖**: T025

```go
// Register 中添加迁移注册
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    if err := e.Next(); err != nil {
        return err
    }
    return migrations.CreateSecretsTable(e.App)
})
```

---

## Phase 7: 清理 Core 中的旧代码（1h）

### T027: 删除 core/secrets_store.go
**优先级**: P1  
**预估**: 5min  
**依赖**: Phase 4 完成

---

### T028: 删除 core/secrets_store_test.go
**优先级**: P1  
**预估**: 5min  
**依赖**: T027

---

### T029: 删除 core/secrets_settings.go
**优先级**: P1  
**预估**: 5min  
**依赖**: Phase 1 完成（功能已合并到 crypto.go）

---

### T030: 删除 core/secrets_settings_test.go
**优先级**: P1  
**预估**: 5min  
**依赖**: T029

---

### T031: 删除 core/secrets_hooks.go
**优先级**: P1  
**预估**: 5min  
**依赖**: Phase 1 完成

---

### T032: 删除 core/secrets_benchmark_test.go
**优先级**: P2  
**预估**: 5min

---

### T033: 删除 apis/secrets_routes.go
**优先级**: P1  
**预估**: 5min  
**依赖**: Phase 5 完成

---

### T034: 删除 apis/secrets_routes_test.go
**优先级**: P1  
**预估**: 5min  
**依赖**: T033

---

### T035: 删除 migrations/1736500000_create_secrets.go
**优先级**: P1  
**预估**: 5min  
**依赖**: Phase 6 完成

---

## Phase 8: 更新 App 接口（1h）

### T036: 更新 core/app.go 接口定义
**文件**: `core/app.go`  
**优先级**: P1  
**预估**: 20min

**修改内容**:
```go
// 移除
Secrets() SecretsStore
SecretsSettings() *SecretsSettings

// 添加
Crypto() CryptoEngine
```

---

### T037: 更新 BaseApp 实现
**文件**: `core/base.go`  
**优先级**: P1  
**预估**: 20min  
**依赖**: T036

**修改内容**:
```go
// 移除字段
secretsSettings *SecretsSettings
secretsStore    *secretsStore

// 保留字段（在 Phase 1 已添加）
crypto CryptoEngine
```

---

### T038: 移除 initSecretsStore 调用
**文件**: `core/base_app.go`（或 Bootstrap 相关文件）  
**优先级**: P1  
**预估**: 10min  
**依赖**: T037

---

### T039: 确保编译通过
**优先级**: P1  
**预估**: 10min  
**依赖**: T036-T038

```bash
go build ./...
```

---

## Phase 9: 更新依赖方（2h）

### T040: 更新 Gateway 插件
**文件**: `plugins/gateway/header.go`  
**优先级**: P1  
**预估**: 40min

**修改内容**:
- `{secret.VAR_NAME}` 语法改为调用 `secrets.GetStore(app).Get(key)`
- 添加对 secrets 插件未注册的错误处理

```go
// 修改前
value, err := app.Secrets().Get(key)

// 修改后
store := secrets.GetStore(app)
if store == nil {
    return "", fmt.Errorf("secrets plugin not registered")
}
value, err := store.Get(key)
```

---

### T041: 更新 examples/base/main.go
**文件**: `examples/base/main.go`  
**优先级**: P1  
**预估**: 20min

```go
import (
    "github.com/pocketbase/pocketbase/plugins/secrets"
)

func main() {
    app := pocketbase.New()
    
    // 注册 secrets 插件
    secrets.MustRegister(app, secrets.DefaultConfig())
    
    app.Start()
}
```

---

### T042: 更新 WebUI Secrets 页面
**文件**: `webui/src/pages/settings/Secrets.tsx`  
**优先级**: P2  
**预估**: 30min

**修改内容**:
- API 路径保持不变 `/api/secrets`
- 添加未注册插件时的提示

---

### T043: 更新 UI (Svelte) Secrets 页面
**文件**: `ui/src/components/secrets/PageSecrets.svelte`  
**优先级**: P2  
**预估**: 30min

---

## Phase 10: 文档和测试（1h）

### T044: 更新 CODEBUDDY.md
**文件**: `CODEBUDDY.md`  
**优先级**: P1  
**预估**: 15min

**添加内容**:
- 插件注册说明
- `app.Crypto()` 使用说明

---

### T045: 更新 README.md
**文件**: `README.md`  
**优先级**: P2  
**预估**: 10min

---

### T046: 完善 plugins/secrets/README.md
**文件**: `plugins/secrets/README.md`  
**优先级**: P1  
**预估**: 20min

**内容**:
- 快速开始
- API 参考
- 配置选项
- 使用示例

---

### T047: 运行全量测试
**优先级**: P1  
**预估**: 15min

```bash
# SQLite 测试
go test ./...

# PostgreSQL 测试（如果配置了）
PB_TEST_POSTGRES_DSN="..." go test ./...
```

**验收标准**:
- [ ] 所有测试通过
- [ ] 无 race condition

---

## 任务依赖图

```
Phase 1: CryptoEngine
T001 ─┬─→ T002 ─┬─→ T008 ─→ T009
      │         │
      ├─→ T003 ─┤
      │         │
      └─→ T004 ─┘
T005 ─→ T008
T006 ─→ T007 ─→ T008

Phase 2: SecretField
Phase 1 ─→ T010 ─→ T011 ─→ T012

Phase 3: Plugin Skeleton
T013 ─→ T014 ─→ T015 ─→ T016 ─→ T017

Phase 4: SecretsStore Migration
Phase 3 + Phase 1 ─→ T018 ─→ T019 ─→ T020

Phase 5: HTTP API Migration
Phase 4 ─→ T021 ─→ T022 ─→ T023 ─→ T024

Phase 6: Migration
Phase 3 ─→ T025 ─→ T026

Phase 7: Cleanup
Phase 4 ─→ T027, T028
Phase 1 ─→ T029, T030, T031, T032
Phase 5 ─→ T033, T034
Phase 6 ─→ T035

Phase 8: App Interface
Phase 7 ─→ T036 ─→ T037 ─→ T038 ─→ T039

Phase 9: Dependencies
Phase 8 ─→ T040 ─→ T041 ─→ T042, T043

Phase 10: Docs & Tests
All Phases ─→ T044 ─→ T045 ─→ T046 ─→ T047
```

---

## 并行开发机会

```
┌──────────────────┐
│   Phase 1       │
│  CryptoEngine   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────────┐
│Phase 2 │ │  Phase 3   │
│Secret  │ │  Plugin    │ ← 可并行！
│Field   │ │  Skeleton  │
└────┬───┘ └─────┬──────┘
     │           │
     │     ┌─────┴─────┐
     │     │           │
     │     ▼           ▼
     │ ┌────────┐ ┌────────┐
     │ │Phase 4 │ │Phase 6 │ ← 可并行！
     │ │Store   │ │Migrate │
     │ └────┬───┘ └────┬───┘
     │      │          │
     │      ▼          │
     │ ┌────────┐      │
     │ │Phase 5 │      │
     │ │Routes  │      │
     │ └────┬───┘      │
     │      │          │
     └──────┴──────────┘
              │
              ▼
       ┌──────────────┐
       │   Phase 7    │
       │   Cleanup    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │   Phase 8    │
       │ App Interface│
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │   Phase 9    │
       │ Dependencies │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Phase 10    │
       │ Docs & Tests │
       └──────────────┘
```

---

## 检查清单

### 完成前必须验证

- [x] `app.Crypto().IsEnabled()` 正确反映 Master Key 状态 ✅ (Phase 1)
- [x] `app.Crypto().Encrypt()`/`Decrypt()` 工作正常 ✅ (Phase 1)
- [x] 现有密文数据可以正常解密（格式兼容）✅ (Phase 1)
- [x] `SecretField` 使用 `app.Crypto()` 工作正常 ✅ (Phase 2)
- [x] `secrets.MustRegister()` 注册插件成功 ✅ (Phase 3)
- [x] `/api/secrets` API 工作正常 ✅ (Phase 5 - 所有 API 测试通过)
- [x] Gateway `{secret.KEY}` 语法工作正常 ✅ (Phase 9 T040 - proxy.go 已更新)
- [x] 未注册 secrets 插件时 API 返回 503 Service Unavailable ✅ (routes.go)
- [x] SQLite 测试通过 ✅ (Phase 1-5)
- [ ] PostgreSQL 测试通过 (待验证)
- [x] 无编译错误 ✅ (go build ./... 通过)
- [x] examples/base/main.go 已注册 secrets 插件 ✅ (Phase 9 T041)
