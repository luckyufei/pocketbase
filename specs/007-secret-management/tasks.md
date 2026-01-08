# Implementation Tasks: PocketBase Secret Management (`_secrets`)

**Branch**: `007-secret-management` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Setup (共享基础设施)

**Purpose**: 项目初始化和基本结构创建

- [ ] T001 创建 `migrations/1736500000_create_secrets.go`，定义 `_secrets` 系统表迁移脚本
- [ ] T002 [P] 在 `core/secrets_store.go` 中定义 SecretsStore 接口和常量
- [ ] T003 [P] 在 `core/secrets_settings.go` 中定义 Master Key 配置结构

---

## Phase 2: Crypto Engine (加密引擎) 🔐

**Purpose**: 实现 AES-256-GCM 加密/解密核心功能

**⚠️ CRITICAL**: 此阶段完成前，任何存储操作都无法开始

- [ ] T004 [US1] 在 `core/secrets_crypto.go` 中实现 `Encrypt(plaintext []byte) ([]byte, error)`
  - 生成随机 12 字节 Nonce
  - 使用 AES-256-GCM 加密
  - 返回 `Nonce || Ciphertext` 格式
- [ ] T005 [US1] 在 `core/secrets_crypto.go` 中实现 `Decrypt(ciphertext []byte) ([]byte, error)`
  - 提取 Nonce（前 12 字节）
  - 使用 AES-256-GCM 解密
  - 验证 GCM 认证标签
- [ ] T006 [US1] 在 `core/secrets_crypto.go` 中实现 `EncryptToBase64()` 和 `DecryptFromBase64()`
- [ ] T007 [US1] 在 `core/secrets_crypto.go` 中实现 `SecureZero(buf []byte)` 安全擦除函数
- [ ] T008 [US1] 编写 `core/secrets_crypto_test.go` 加密单元测试
  - 测试加密/解密往返
  - 测试 Nonce 唯一性
  - 测试篡改检测

**Checkpoint**: 加密引擎就绪 ✅

---

## Phase 3: Master Key Management (Priority: P1) 🔑

**Goal**: 实现 Master Key 环境变量配置和验证

**Independent Test**: 
- 设置/不设置 `PB_MASTER_KEY` 验证启动行为

### Implementation for User Story 2

- [ ] T009 [US2] 在 `core/secrets_settings.go` 中实现 `LoadMasterKey()` 从环境变量读取
- [ ] T010 [US2] 在 `core/secrets_settings.go` 中实现 Master Key 长度验证（64 hex = 32 bytes）
- [ ] T011 [US2] 在 `core/secrets_settings.go` 中实现 `ValidateMasterKey()` 格式校验
- [ ] T012 [US2] 在 `core/secrets_settings.go` 中实现 `IsSecretsEnabled()` 检查功能是否可用
- [ ] T013 [US2] 在 `core/app.go` Bootstrap 中添加 Master Key 检查
  - 缺少时记录 Info 日志，Secrets 功能标记为不可用
  - 格式错误时记录 Warning 日志，Secrets 功能标记为不可用
  - 服务正常启动，不阻塞
- [ ] T014 [US2] 编写 `core/secrets_settings_test.go` Master Key 验证测试

**Checkpoint**: Master Key 管理就绪，Secrets 功能可选启用 ✅

---

## Phase 4: User Story 1 - 密钥存储与加密 (Priority: P1) 🎯 MVP

**Goal**: 支持 Secret 的加密存储和解密读取

**Independent Test**: 
- 调用 `secrets.Set()` 和 `secrets.Get()` 验证存取

### Implementation for User Story 1

- [ ] T015 [US1] 在 `migrations/1736500000_create_secrets.go` 中实现 `_secrets` 表创建逻辑
- [ ] T016 [US1] 在 `core/secrets_store.go` 中实现 `Set(key, value string, opts ...SecretOption) error`
  - 检查 `IsSecretsEnabled()`，未启用时返回错误
  - 调用 Crypto Engine 加密
  - UPSERT 到数据库
- [ ] T017 [US1] 在 `core/secrets_store.go` 中实现 `Get(key string) (string, error)`
  - 检查 `IsSecretsEnabled()`，未启用时返回错误
  - 从数据库读取密文
  - 调用 Crypto Engine 解密
  - 安全擦除临时 buffer
- [ ] T018 [US1] 在 `core/secrets_store.go` 中实现 `GetWithDefault(key, defaultValue string) string`
- [ ] T019 [US1] 在 `core/secrets_store.go` 中实现 `Delete(key string) error`
- [ ] T020 [US1] 在 `core/secrets_store.go` 中实现 `Exists(key string) (bool, error)`
- [ ] T021 [US1] 在 `core/secrets_store.go` 中实现 `List() ([]SecretInfo, error)`
  - 返回掩码值 `sk-***`
- [ ] T022 [US1] 在 `core/base.go` 中集成 SecretsStore 到 App 结构体
- [ ] T023 [US1] 在 `core/app.go` 接口中添加 `Secrets()` 方法
- [ ] T024 [US1] 编写 `core/secrets_store_test.go` 基础操作单元测试

**Checkpoint**: 此时 User Story 1 & 2 应完全可用，可独立测试 ✅

---

## Phase 5: User Story 3 - 环境隔离 (Priority: P2)

**Goal**: 支持 Dev/Prod 多环境 Secret 管理

**Independent Test**: 
- 创建同名但不同 `env` 的 Secrets 验证隔离

### Implementation for User Story 3

- [ ] T025 [US3] 在 `core/secrets_store.go` 中实现 `WithEnv(env string) SecretOption`
- [ ] T026 [US3] 在 `core/secrets_store.go` 中实现 `GetForEnv(key, env string) (string, error)`
  - 优先级: 指定 env > global
- [ ] T027 [US3] 在 `core/secrets_store.go` 中修改 `Get()` 支持环境 fallback
- [ ] T028 [US3] 编写环境隔离单元测试

**Checkpoint**: 此时 User Story 1, 2, 3 都应独立可用 ✅

---

## Phase 6: User Story 6 - HTTP API (Priority: P1) 🎯 MVP

**Goal**: 提供 HTTP API 供管理和 JS SDK 调用

**Independent Test**: 
- 使用 curl 调用 `/api/secrets` 端点验证

### Implementation for User Story 6

- [ ] T029 [US6] 在 `apis/secrets_routes.go` 中创建 Secrets API 路由组 `/api/secrets`
- [ ] T030 [US6] 实现 `POST /api/secrets` 端点（创建 Secret）
  - 检查 Secrets 功能是否启用，未启用返回 503
- [ ] T031 [US6] 实现 `GET /api/secrets` 端点（列出所有，掩码显示）
- [ ] T032 [US6] 实现 `GET /api/secrets/:key` 端点（获取解密值）
- [ ] T033 [US6] 实现 `PUT /api/secrets/:key` 端点（更新 Secret）
- [ ] T034 [US6] 实现 `DELETE /api/secrets/:key` 端点（删除 Secret）
- [ ] T035 [US6] 在 `apis/secrets_auth.go` 中实现 Superuser 权限检查中间件
- [ ] T036 [US6] 未认证返回 401，非 Superuser 返回 403，功能未启用返回 503
- [ ] T037 [US6] 编写 `apis/secrets_routes_test.go` HTTP API 测试

**Checkpoint**: HTTP API 可用，JS SDK 可以开始集成 ✅

---

## Phase 6.5: JS SDK Integration

**Goal**: 在 JS SDK 中实现 SecretsService

**Independent Test**: 
- 使用 JS SDK 调用 `pb.secrets.get()` 验证

### Implementation for JS SDK

- [ ] T038 [SDK] 创建 `jssdk/src/services/SecretsService.ts`
  - 定义 `SecretModel`, `SecretCreateParams`, `SecretUpdateParams` 接口
  - 实现 `get(key)` 方法
  - 实现 `getWithDefault(key, defaultValue)` 方法
  - 实现 `list()` 方法
  - 实现 `create(params)` 方法
  - 实现 `update(key, params)` 方法
  - 实现 `delete(key)` 方法
  - 实现 `exists(key)` 方法
- [ ] T039 [SDK] 在 `jssdk/src/Client.ts` 中注册 SecretsService
  - 添加 `readonly secrets: SecretsService` 属性
  - 在构造函数中初始化
- [ ] T040 [SDK] 在 `jssdk/src/index.ts` 中导出类型
- [ ] T041 [SDK] 编写 `jssdk/tests/services/SecretsService.spec.ts` 单元测试
  - 测试所有 CRUD 操作
  - 测试 404 时 getWithDefault 返回默认值
  - 测试权限错误处理

**Checkpoint**: JS SDK 可通过 `pb.secrets.*` 管理 Secrets ✅

---

## Phase 7: User Story 5 - WASM Host Function (Priority: P1) 🎯 MVP

**Goal**: 在 WASM 环境中安全获取 Secrets

**Independent Test**: 
- 在 WASM 函数中调用 `pb.secrets.get()` 验证

### Implementation for User Story 5

- [ ] T042 [US5] 在 `plugins/wasm/host_secrets.go` 中实现 `pb_secret_get` Host Function
- [ ] T043 [US5] 实现从 WASM 线性内存读取 key 字符串
- [ ] T044 [US5] 实现将解密后的值写入 WASM 线性内存
- [ ] T045 [US5] 实现 Go 侧临时 buffer 安全擦除
- [ ] T046 [US5] 在 WASM Runtime 初始化时注册 Host Function
- [ ] T047 [US5] 处理 Key 不存在或功能未启用时的错误返回
- [ ] T048 [US5] 编写 WASM Host Function 集成测试

**Checkpoint**: WASM 环境可安全获取 Secrets ✅

---

## Phase 8: User Story 4 - Admin UI (Priority: P1)

**Goal**: 在 Admin UI 中安全管理 Secrets

**Independent Test**: 
- 通过 Admin UI 创建、查看、更新 Secret 验证

### Implementation for User Story 4

- [ ] T049 [US4] 创建 `ui/src/components/secrets/SecretsList.svelte` 列表组件
  - 显示掩码值 `sk-***`
  - 显示锁图标标识系统安全表
  - 功能未启用时显示配置引导
- [ ] T050 [US4] 创建 `ui/src/components/secrets/SecretForm.svelte` 表单组件
  - Value 输入框为密码类型
  - 支持 env 选择（global/dev/prod）
  - 支持 description 输入
- [ ] T051 [US4] 创建 `ui/src/components/secrets/SecretMaskedValue.svelte` 掩码显示组件
- [ ] T052 [US4] 创建 `ui/src/pages/secrets/Index.svelte` 管理页面
- [ ] T053 [US4] 在 Admin UI 侧边栏添加 "Secrets" 菜单项
- [ ] T054 [US4] 实现 "Overwrite" 功能（不提供 "Reveal"）
- [ ] T055 [US4] 添加删除确认对话框

**Checkpoint**: Admin UI 可安全管理 Secrets ✅

---

## Phase 9: Polish & Security Hardening

**Purpose**: 安全加固和边界处理

- [ ] T056 [P] 添加 Secret Value 大小验证（最大 4KB）
- [ ] T057 [P] 添加 Secret Key 格式验证（建议 `VENDOR_TYPE_ENV`）
- [ ] T058 [P] 在日志系统中添加 Secret 值过滤器
- [ ] T059 [P] 添加操作审计日志（创建/更新/删除）
- [ ] T060 编写 `core/secrets_benchmark_test.go` 性能基准测试
- [ ] T061 运行完整集成测试，验证所有功能正常
- [ ] T062 安全审查：确认 Master Key 不落盘
- [ ] T063 安全审查：确认日志无明文泄露

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Crypto Engine (Phase 2)**: 依赖 Setup 完成 - 阻塞所有存储操作
- **Master Key (Phase 3)**: 依赖 Phase 2 完成
- **User Stories (Phase 4-8)**: 依赖 Phase 3 完成
  - US1 (Phase 4): 核心存储功能
  - US3 (Phase 5): 依赖 US1 完成
  - US6 (Phase 6): 依赖 US1 完成
  - US5 (Phase 7): 依赖 US1 完成
  - US4 (Phase 8): 依赖 US6 完成（Admin UI 调用 HTTP API）
- **Polish (Phase 9)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Crypto Engine)
    │
    ▼
Phase 3 (Master Key - US2)
    │
    ▼
Phase 4 (US1: 密钥存储) ────────────────────┐
    │                                        │
    ├──────────────┬──────────────┬─────────┤
    ▼              ▼              ▼         │
Phase 5        Phase 6        Phase 7       │
(US3: 环境隔离) (US6: HTTP API) (US5: WASM) │
                   │                        │
                   ▼                        │
              Phase 6.5                     │
              (JS SDK)                      │
                   │                        │
                   ▼                        │
              Phase 8                       │
              (US4: Admin UI)               │
                   │                        │
                   └────────────────────────┤
                                            ▼
                                      Phase 9
                                      (Polish)
```

### Parallelization Opportunities

**Phase 1 内部并行**:
- T002 (接口定义) 和 T003 (配置结构) 可并行开发

**Phase 4-7 部分并行**:
- US3, US6, US5 可在 US1 完成后并行开发
- US4 需等待 US6 (HTTP API) 完成

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Setup | 3 | 1h | Yes |
| Phase 2: Crypto Engine | 5 | 4h | No |
| Phase 3: Master Key | 6 | 3h | No |
| Phase 4: US1 密钥存储 | 10 | 6h | No |
| Phase 5: US3 环境隔离 | 4 | 2h | Yes |
| Phase 6: US6 HTTP API | 9 | 5h | Yes |
| Phase 6.5: JS SDK | 4 | 3h | Yes |
| Phase 7: US5 WASM | 7 | 4h | Yes |
| Phase 8: US4 Admin UI | 7 | 5h | No |
| Phase 9: Polish | 8 | 4h | Yes |
| **Total** | **63** | **~37h** | |

---

## MVP Definition

**最小可行产品 (MVP)** = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 6 + Phase 6.5 + Phase 7

完成 MVP 后，系统具备：
- ✅ AES-256-GCM 加密存储
- ✅ Master Key 环境变量配置
- ✅ 缺少 Master Key 时功能不可用（服务正常启动）
- ✅ Set/Get/Delete 基础操作
- ✅ HTTP API（供客户端调用）
- ✅ JS SDK 集成（`pb.secrets.*`）
- ✅ WASM Host Function（Serverless 集成）

**MVP 预估工时**: ~26h

---

## SQL Reference

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

-- List Secrets
SELECT id, key, 
       CASE 
         WHEN length(value) > 10 THEN substring(value, 1, 6) || '***'
         ELSE '***'
       END as masked_value,
       env, description, created, updated
FROM _secrets
ORDER BY key, env;

-- Exists
SELECT 1 FROM _secrets WHERE key = $1 AND env = $2;
```

### 掩码函数

```go
// MaskValue 生成掩码显示值
func MaskValue(value string) string {
    if len(value) <= 6 {
        return "***"
    }
    // 显示前缀 + 掩码
    // sk-proj-xxx -> sk-proj-***
    prefix := value[:6]
    return prefix + "***"
}
```

---

## Crypto Implementation Reference

### Encrypt

```go
func (c *CryptoEngine) Encrypt(plaintext []byte) ([]byte, error) {
    // 1. 创建 AES cipher
    block, err := aes.NewCipher(c.masterKey)
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
func (c *CryptoEngine) Decrypt(ciphertext []byte) ([]byte, error) {
    // 1. 创建 AES cipher
    block, err := aes.NewCipher(c.masterKey)
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

### Secure Zero

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
