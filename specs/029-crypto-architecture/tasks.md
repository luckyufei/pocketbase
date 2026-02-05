# Implementation Tasks: 密钥管理架构设计

**Branch**: `029-crypto-architecture` | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- `[FR-###]` = Implements Functional Requirement
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Layer 1 - CryptoEngine (Priority: P1) 🔐

**Purpose**: 实现统一的加密引擎接口和 AES-256-GCM 实现

**⚠️ CRITICAL**: 此阶段是所有后续功能的基础，必须先完成

### Interface Definition

- [ ] T001 [US1][FR-001] 创建 `core/crypto.go`，定义 CryptoEngine 接口
  - `Encrypt(plaintext string) (string, error)` - 加密并返回 Base64 密文
  - `Decrypt(ciphertext string) (string, error)` - 解密 Base64 密文
  - `IsEnabled() bool` - 是否启用（Master Key 是否配置）
  - `MaskValue(value string, visibleChars int) string` - 生成掩码显示

### AES-256-GCM Implementation

- [ ] T002 [US1][FR-002] 实现 `AESCryptoEngine` 结构体
  - 存储 32 字节派生密钥
  - 线程安全设计
- [ ] T003 [US1][FR-002] 实现 `NewAESCryptoEngine(masterKey string) (*AESCryptoEngine, error)`
  - 验证 masterKey 长度 >= 32 字节
  - 使用 HKDF 或直接截取派生 256-bit 密钥
- [ ] T004 [US1][FR-002] 实现 `Encrypt()` 方法
  - 创建 AES cipher
  - 创建 GCM 模式
  - 生成随机 12 字节 Nonce
  - 加密 → `Base64(Nonce[12] || Ciphertext || Tag)`
- [ ] T005 [US1][FR-002] 实现 `Decrypt()` 方法
  - Base64 解码
  - 提取 Nonce（前 12 字节）
  - GCM 解密并验证
  - 返回明文

### NoopCryptoEngine

- [ ] T006 [US1][FR-003] 实现 `NoopCryptoEngine` 结构体
  - `Encrypt()` → 返回 `ErrMasterKeyNotConfigured`
  - `Decrypt()` → 返回 `ErrMasterKeyNotConfigured`
  - `IsEnabled()` → 返回 `false`
  - `MaskValue()` → 正常工作（不依赖加密）

### SecureZero

- [ ] T007 [US1][FR-005] 实现 `SecureZero(buf []byte)` 函数
  - 逐字节清零
  - 使用 `runtime.KeepAlive()` 防止编译器优化

### App Integration

- [ ] T008 [US1][FR-004] 在 `core/app.go` 接口中添加 `Crypto() CryptoEngine` 方法
- [ ] T009 [US1][FR-004] 在 `core/base.go` BaseApp 中添加 `crypto CryptoEngine` 字段
- [ ] T010 [US1][FR-004] 在 `BaseApp.Bootstrap()` 中初始化 CryptoEngine
  - 读取 `PB_MASTER_KEY` 环境变量
  - 长度 >= 32 → 创建 `AESCryptoEngine`
  - 长度不足 → 记录警告，使用 `NoopCryptoEngine`
  - 未配置 → 使用 `NoopCryptoEngine`

### Error Definitions

- [ ] T011 [US1] 在 `core/crypto.go` 中定义错误常量
  - `ErrMasterKeyNotConfigured`
  - `ErrMasterKeyTooShort`
  - `ErrInvalidCiphertext`
  - `ErrDecryptionFailed`

### Unit Tests

- [ ] T012 [US1] 编写 `core/crypto_test.go`
  - 测试加密/解密往返
  - 测试 Nonce 唯一性（同一明文加密两次产生不同密文）
  - 测试篡改检测（修改密文后解密失败）
  - 测试不同 Master Key 解密失败
  - 测试空字符串加密
  - 测试特殊字符（Unicode、换行符）
  - 测试 NoopCryptoEngine 行为
  - 测试 MaskValue 掩码生成

**Checkpoint**: CryptoEngine 就绪，`app.Crypto()` 可用 ✅

---

## Phase 2: Layer 2 - SecretField 核心实现 (Priority: P1) 🎯 MVP

**Purpose**: 实现 SecretField 字段类型核心功能

**⚠️ Depends on**: Phase 1 完成

### Field Type Definition

- [ ] T013 [US2][FR-006] 创建 `core/field_secret.go`，定义 SecretField 结构体
  - Name, Id, System, Hidden（默认 true）, Presentable, Required, MaxSize（默认 4KB）
  - 实现 Field 接口所有方法
- [ ] T014 [US2][FR-006] 在 `init()` 中注册 `FieldTypeSecret = "secret"`
- [ ] T015 [US2][FR-006] 定义 `SecretFieldValue` 结构体
  - Plain string（明文）
  - Encrypted string（密文）
  - LastError error
- [ ] T016 [US2] 实现 `ColumnType()` 返回 `"TEXT DEFAULT '' NOT NULL"`

### Encryption Integration

- [ ] T017 [US2][FR-007] 实现 `FindSetter()` - 设置值时加密
  - 检查 `app.Crypto().IsEnabled()`
  - 空字符串直接存储（视为有效值）
  - 调用 `app.Crypto().Encrypt(plain)` 加密
  - 创建 SecretFieldValue 存储状态
  - 检测是否已是密文（避免重复加密）
- [ ] T018 [US2][FR-007] 实现 `FindGetter()` - 获取值时解密
  - 如果有 Plain，直接返回
  - 如果有 Encrypted，调用 `app.Crypto().Decrypt()` 解密
  - 返回明文字符串
- [ ] T019 [US2] 实现 `DriverValue()` - 数据库存储
  - 返回加密后的密文字符串
- [ ] T020 [US2] 实现 `PrepareValue()` - 从数据库读取
  - 将密文包装为 SecretFieldValue

### Hidden Attribute

- [ ] T021 [US2][FR-008] 设置 Hidden 属性默认值为 `true`
- [ ] T022 [US2][FR-008] 验证 API 响应行为
  - `hidden: true` 时默认不返回
  - `?fields=` 显式请求时返回

### Validation

- [ ] T023 [US2][FR-010] 实现 `ValidateSettings()` - 验证字段配置
  - 检查 `app.Crypto().IsEnabled()`，未启用时返回错误
  - 验证 MaxSize 范围 (1 - 4096)
- [ ] T024 [US2] 实现 `ValidateValue()` - 验证字段值
  - 检查 Required 约束
  - 检查 MaxSize 限制
  - 检查加密错误 LastError

### Search/Filter/Index Restrictions

- [ ] T025 [US2][FR-010] 实现搜索/过滤限制
  - secret 字段不支持搜索/过滤（加密后无法比较）
  - Filter 表达式中使用 secret 字段值比较时返回错误
- [ ] T026 [US2][FR-010] 实现索引限制
  - secret 字段不支持创建索引（加密后无意义）

### Unit Tests

- [ ] T027 [US2] 编写 `core/field_secret_test.go`
  - 测试字段创建和配置
  - 测试加密/解密往返
  - 测试 MaxSize 验证
  - 测试 Required 验证
  - 测试 CryptoEngine 不可用时行为
  - 测试空字符串加密存储
  - 测试特殊字符（Unicode、换行符）
  - 测试 Hidden 默认值
  - 测试搜索/过滤限制
  - 测试索引限制

**Checkpoint**: SecretField 核心功能就绪 ✅

---

## Phase 3: Layer 2 - SecretField API/Hook 集成 (Priority: P1) 🎯 MVP

**Purpose**: SecretField 与 API 和 Hook 系统集成

**⚠️ Depends on**: Phase 2 完成

### API Integration

- [ ] T028 [US2][FR-012] 验证 `apis/record_crud.go` 自动支持 secret 字段
  - 创建记录时 secret 字段加密存储
  - 读取记录时 secret 字段解密返回
  - 更新记录时 secret 字段重新加密
- [ ] T029 [US2] 验证 Collection Rules 权限控制
  - viewRule 控制谁能读取 secret 字段
  - updateRule 控制谁能修改 secret 字段

### Hook Integration

- [ ] T030 [US2][FR-012] 验证 `record.GetString("secret_field")` 返回明文
- [ ] T031 [US2][FR-012] 验证 `record.Get("secret_field")` 返回明文字符串
- [ ] T032 [US2][FR-012] 验证 `record.GetRaw("secret_field")` 返回 SecretFieldValue

### JS Hook Support

- [ ] T033 [US2] 验证 JS 中 `record.secret_field` 返回明文（通过 FindGetter）

### Integration Tests

- [ ] T034 [US2] 编写 `apis/record_crud_secret_test.go`
  - 测试创建包含 secret 字段的记录
  - 测试读取记录（含/不含 secret 字段）
  - 测试更新 secret 字段值
  - 测试权限控制
- [ ] T035 [US2] 编写 Hook 集成测试
  - OnRecordCreate 中读取 secret 值
  - OnRecordUpdate 中修改 secret 值

**Checkpoint**: SecretField API/Hook 集成完成 ✅

---

## Phase 4: Layer 2 - Proxy 模板支持 (Priority: P1) 🎯 MVP

**Purpose**: Proxy 网关支持读取用户 secret 字段

**⚠️ Depends on**: Phase 3 完成

### Template Resolution

- [ ] T036 [US2][FR-011] 修改 `core/proxy_header.go` 支持 `@request.auth.<field>` 模板
  - 识别 `@request.auth.xxx` 格式
  - 从当前认证用户 Record 获取字段值
  - 对于 secret 字段，通过 GetString 自动解密
- [ ] T037 [US2][FR-011] 处理 secret 字段为空的情况
  - 返回空字符串
- [ ] T038 [US2][FR-011] 处理用户未认证的情况
  - 返回错误或拒绝请求

### Access Rule Extension

- [ ] T039 [US2] 验证 accessRule 支持 secret 字段判断
  - `@request.auth.api_key != ""` 检查非空
  - 不能比较 secret 值本身（加密后无法比较）

### Proxy Tests

- [ ] T040 [US2] 编写 Proxy secret 字段集成测试
  - 测试 header 模板解析
  - 测试用户 A/B 使用不同 API Key
  - 测试空值处理
  - 测试未认证情况

**Checkpoint**: Proxy 可使用用户 secret 字段 ✅

---

## Phase 5: Layer 2 - Admin UI (Priority: P1)

**Purpose**: Admin UI 安全地管理 secret 字段

**⚠️ Depends on**: Phase 3 完成

### Field Input Component

- [ ] T041 [US2][FR-013] 创建 SecretInput 组件
  - 密码类型输入框 `******`
  - Reveal 按钮（点击显示 5 秒后自动隐藏）
  - 掩码显示 `sk-••••••345`
- [ ] T042 [US2] 在字段渲染器中注册 secret 类型

### Collection Schema UI

- [ ] T043 [US2] 在字段类型选择器中添加 `secret` 选项
- [ ] T044 [US2] 创建 SecretField 配置表单
  - Required 开关
  - MaxSize 输入
  - Hidden 开关（默认开）

### Record Form UI

- [ ] T045 [US2][FR-013] 记录编辑表单使用 SecretInput 组件
- [ ] T046 [US2] 记录列表显示掩码值 `sk-••••••345`
- [ ] T047 [US2][FR-013] 实现 Reveal 功能（5 秒自动隐藏）

### UI Tests

- [ ] T048 [US2] 手动测试 Admin UI
  - 添加 secret 字段到 Collection
  - 创建/编辑记录设置 secret 值
  - 验证列表显示掩码
  - 验证 Reveal 功能（5 秒自动隐藏）

**Checkpoint**: Admin UI 可安全管理 secret 字段 ✅

---

## Phase 6: Layer 2 - Import/Export (Priority: P2)

**Purpose**: 批量导入导出安全处理

**⚠️ Depends on**: Phase 3 完成

### Export Handling

- [ ] T049 [US2][FR-014] 验证导出时 secret 字段输出密文
  - 不暴露明文
  - 格式为 Base64 密文

### Import Handling

- [ ] T050 [US2][FR-014] 修改导入逻辑检测 secret 字段值
  - 如果是明文 → 加密后存储
  - 如果是有效密文（Base64 格式）→ 直接存储

### Import/Export Tests

- [ ] T051 [US2] 编写导入导出测试
  - 测试导出包含 secret 字段的数据
  - 测试导入明文
  - 测试导入密文

**Checkpoint**: 导入导出安全处理 ✅

---

## Phase 7: Layer 3 - Secrets Plugin 核心 (Priority: P2) 🔌

**Purpose**: 实现系统级密钥管理插件

**⚠️ Depends on**: Phase 1 完成

### Plugin Registration

- [ ] T052 [US3][FR-015] 创建 `plugins/secrets/register.go`
  - 定义 `Config` 结构体（Disabled bool）
  - 实现 `MustRegister(app core.App, config Config)`
  - 实现 `Register(app core.App, config Config) error`
  - 检查 `app.Crypto().IsEnabled()`，未启用时记录警告

### Migration

- [ ] T053 [US3][FR-016] 创建 `plugins/secrets/migration.go`
  - 创建 `_secrets` 系统表
  - Schema: id, key, value, env, description, created, updated
  - UNIQUE(key, env) 约束

### Repository

- [ ] T054 [US3] 创建 `plugins/secrets/repository.go`
  - 定义 `SecretsRepository` 结构体
- [ ] T055 [US3] 实现 `Get(key string, env ...string) (string, error)`
  - 查询 _secrets 表
  - 调用 `app.Crypto().Decrypt()` 解密
- [ ] T056 [US3] 实现 `Set(key, value string, env string) error`
  - 调用 `app.Crypto().Encrypt()` 加密
  - UPSERT 到 _secrets 表
- [ ] T057 [US3] 实现 `Delete(key string, env ...string) error`
- [ ] T058 [US3] 实现 `List() ([]*Secret, error)`
  - 返回所有密钥
  - 值使用 `app.Crypto().MaskValue()` 掩码
- [ ] T059 [US3] 实现 `Exists(key string, env ...string) (bool, error)`

### Environment Isolation

- [ ] T060 [US3][FR-019] 实现环境隔离逻辑
  - env 字段支持 `global`, `dev`, `prod`
  - Get 时优先级：指定 env > global

### Convenience API

- [ ] T061 [US3] 创建 `plugins/secrets/api.go`
  - `GetSecret(app core.App, key string) (string, error)`
  - `GetSecretWithDefault(app core.App, key string, defaultValue string) string`

### Unit Tests

- [ ] T062 [US3] 编写 `plugins/secrets/repository_test.go`
  - 测试 Set/Get/Delete 基础操作
  - 测试环境隔离
  - 测试掩码显示

**Checkpoint**: Secrets Plugin 核心功能就绪 ✅

---

## Phase 8: Layer 3 - Secrets HTTP API (Priority: P2)

**Purpose**: 提供 HTTP API 供管理和 JS SDK 调用

**⚠️ Depends on**: Phase 7 完成

### HTTP Routes

- [ ] T063 [US3][FR-017] 创建 `plugins/secrets/routes.go`
  - 路由组 `/api/secrets`
- [ ] T064 [US3][FR-018] 实现 Superuser 权限检查中间件
  - 未认证返回 `401 Unauthorized`
  - 非 Superuser 返回 `403 Forbidden`
  - 功能未启用返回 `503 Service Unavailable`
- [ ] T065 [US3][FR-017] 实现 `POST /api/secrets` 端点（创建 Secret）
- [ ] T066 [US3][FR-017] 实现 `GET /api/secrets` 端点（列出所有，掩码显示）
- [ ] T067 [US3][FR-017] 实现 `GET /api/secrets/:key` 端点（获取解密值）
- [ ] T068 [US3][FR-017] 实现 `PUT /api/secrets/:key` 端点（更新 Secret）
- [ ] T069 [US3][FR-017] 实现 `DELETE /api/secrets/:key` 端点（删除 Secret）

### API Tests

- [ ] T070 [US3] 编写 `plugins/secrets/routes_test.go`
  - 测试所有 CRUD 端点
  - 测试权限控制（401, 403）
  - 测试功能未启用（503）
  - 测试环境参数

**Checkpoint**: HTTP API 可用 ✅

---

## Phase 9: Layer 3 - JS SDK Integration (Priority: P2)

**Purpose**: 在 JS SDK 中实现 SecretsService

**⚠️ Depends on**: Phase 8 完成

### SecretsService

- [ ] T071 [US3][FR-021] 创建 `jssdk/src/services/SecretsService.ts`
  - 定义 `SecretModel` 接口
  - 定义 `SecretCreateParams`, `SecretUpdateParams` 接口
- [ ] T072 [US3][FR-021] 实现 `get(key: string): Promise<string>`
- [ ] T073 [US3][FR-021] 实现 `getWithDefault(key: string, defaultValue: string): Promise<string>`
- [ ] T074 [US3][FR-021] 实现 `list(): Promise<SecretModel[]>`
- [ ] T075 [US3][FR-021] 实现 `create(params: SecretCreateParams): Promise<SecretModel>`
- [ ] T076 [US3][FR-021] 实现 `update(key: string, params: SecretUpdateParams): Promise<SecretModel>`
- [ ] T077 [US3][FR-021] 实现 `delete(key: string): Promise<boolean>`
- [ ] T078 [US3][FR-021] 实现 `exists(key: string): Promise<boolean>`

### Client Integration

- [ ] T079 [US3] 在 `jssdk/src/Client.ts` 中注册 SecretsService
  - 添加 `readonly secrets: SecretsService` 属性
- [ ] T080 [US3] 在 `jssdk/src/index.ts` 中导出类型

### SDK Tests

- [ ] T081 [US3] 编写 `jssdk/tests/services/SecretsService.spec.ts`
  - 测试所有 CRUD 操作
  - 测试 getWithDefault 默认值
  - 测试权限错误处理

**Checkpoint**: JS SDK `pb.secrets.*` 可用 ✅

---

## Phase 10: Layer 3 - Proxy 模板支持 (Priority: P2)

**Purpose**: Proxy 支持系统密钥模板

**⚠️ Depends on**: Phase 7 完成

### Template Resolution

- [ ] T082 [US4][FR-020] 在 Proxy 中支持 `{{secrets.KEY}}` 模板
  - 识别 `{{secrets.xxx}}` 格式
  - 调用 `secrets.GetSecret(app, key)` 获取值
  - 处理密钥不存在情况
- [ ] T083 [US4] 支持混合模板 `@request.auth.api_key || {{secrets.DEFAULT_KEY}}`
  - 优先使用用户密钥
  - fallback 到系统密钥

### Proxy Tests

- [ ] T084 [US4] 编写 Proxy 系统密钥集成测试
  - 测试 `{{secrets.KEY}}` 解析
  - 测试混合使用场景
  - 测试密钥不存在时行为

**Checkpoint**: Proxy 支持系统密钥模板 ✅

---

## Phase 11: Layer 3 - Admin UI (Priority: P2)

**Purpose**: Admin UI 管理系统密钥

**⚠️ Depends on**: Phase 8 完成

### Secrets Management Page

- [ ] T085 [US3][FR-022] 创建 Secrets 列表页面
  - 显示掩码值 `sk-proj-***`
  - 显示锁图标标识系统安全表
  - 功能未启用时显示配置引导
- [ ] T086 [US3] 创建 Secret 表单组件
  - Value 输入框为密码类型
  - 支持 env 选择（global/dev/prod）
  - 支持 description 输入
- [ ] T087 [US3][FR-022] 实现 "Overwrite" 功能（禁止 "Reveal"）
- [ ] T088 [US3] 添加删除确认对话框
- [ ] T089 [US3] 在 Admin UI 侧边栏添加 "Secrets" 菜单项

### UI Tests

- [ ] T090 [US3] 手动测试 Admin UI
  - 创建/编辑/删除 Secret
  - 验证掩码显示
  - 验证无 Reveal 功能

**Checkpoint**: Admin UI 可管理系统密钥 ✅

---

## Phase 12: Security Hardening & Polish

**Purpose**: 安全加固和收尾

### Log Filtering

- [ ] T091 [P][FR-023] 在日志系统中过滤 secret 相关值
  - 检测 secret 字段类型
  - 替换为 `[REDACTED]`
- [ ] T092 [P] 验证 debug 日志不泄露 secret 值

### Edge Cases

- [ ] T093 [P] Secret Value 大小验证（最大 4KB）
- [ ] T094 [P] Secret Key 格式验证（建议 `VENDOR_TYPE_ENV`，但不强制）
- [ ] T095 [P] 并发加解密线程安全性测试
- [ ] T096 [P] Master Key 变更后解密失败处理

### Benchmarks

- [ ] T097 编写 `core/crypto_benchmark_test.go`
  - 加密延迟 (目标 < 1ms)
  - 解密延迟 (目标 < 1ms)
- [ ] T098 编写 `core/field_secret_benchmark_test.go`
  - 批量读取性能

### Final Validation

- [ ] T099 运行完整测试套件
- [ ] T100 安全审查：确认 Master Key 不落盘
- [ ] T101 安全审查：确认日志无明文泄露
- [ ] T102 代码审查
- [ ] T103 更新 CHANGELOG

**Checkpoint**: 功能完成，可合并 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Layer 1: CryptoEngine)
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
Phase 2 (Layer 2: SecretField Core)   Phase 7 (Layer 3: Secrets Plugin Core)
    │                                  │
    ▼                                  ├──────────────┐
Phase 3 (API/Hook Integration)        ▼              ▼
    │                            Phase 8         Phase 10
    ├──────────┬─────────────┐  (HTTP API)      (Proxy Template)
    ▼          ▼             ▼       │
Phase 4    Phase 5       Phase 6     ▼
(Proxy)    (Admin UI)    (Import)  Phase 9
                                   (JS SDK)
                                      │
                                      ▼
                                  Phase 11
                                  (Admin UI)
                                      │
    └──────────────────────────────────┤
                                       ▼
                                   Phase 12
                                   (Polish)
```

### Parallelization Opportunities

**Phase 2-6 与 Phase 7-11 可并行**:
- Layer 2 (SecretField) 和 Layer 3 (Secrets Plugin) 在 Phase 1 完成后可并行开发
- 两者仅共享 Layer 1 CryptoEngine，无其他依赖

**Phase 内部并行**:
- Phase 3: T028-T32 可并行
- Phase 12: 所有 `[P]` 标记的任务可并行

---

## Estimated Effort

| Phase | Description | Tasks | Est. Hours | Parallelizable |
|-------|-------------|-------|------------|----------------|
| Phase 1 | CryptoEngine | 12 | 5h | No |
| Phase 2 | SecretField Core | 15 | 6h | No |
| Phase 3 | API/Hook Integration | 8 | 3h | No |
| Phase 4 | Proxy Template | 5 | 2h | Yes |
| Phase 5 | SecretField Admin UI | 8 | 4h | Yes |
| Phase 6 | Import/Export | 3 | 1.5h | Yes |
| Phase 7 | Secrets Plugin Core | 11 | 5h | Yes (with 2-6) |
| Phase 8 | HTTP API | 8 | 3h | No |
| Phase 9 | JS SDK | 11 | 3h | No |
| Phase 10 | Secrets Proxy | 3 | 1.5h | Yes |
| Phase 11 | Secrets Admin UI | 6 | 3h | No |
| Phase 12 | Polish | 13 | 4h | Yes |
| **Total** | | **103** | **~41h** | |

---

## MVP Definition

### MVP 1: SecretField (Layer 1 + Layer 2)

**Phase 1 + Phase 2 + Phase 3 + Phase 4**

完成后具备：
- ✅ CryptoEngine 接口和 AES-256-GCM 实现
- ✅ `app.Crypto()` 方法可用
- ✅ SecretField 字段类型
- ✅ 加密存储/解密读取
- ✅ RESTful API CRUD 支持
- ✅ Hook 中读取解密值
- ✅ Proxy 使用用户 secret 字段 `@request.auth.api_key`

**MVP 1 预估工时**: ~16h

### MVP 2: Secrets Plugin (Layer 3)

**Phase 7 + Phase 8 + Phase 9 + Phase 10**

完成后具备：
- ✅ `_secrets` 系统表
- ✅ HTTP API `/api/secrets`
- ✅ JS SDK `pb.secrets.*`
- ✅ Proxy 使用系统密钥 `{{secrets.KEY}}`
- ✅ 环境隔离 (global/dev/prod)

**MVP 2 预估工时**: ~12.5h（可与 MVP 1 并行开发）

---

## Spec Coverage Checklist

### User Stories

| US# | Description | Tasks | Status |
|-----|-------------|-------|--------|
| US1 | CryptoEngine 基础设施 | T001-T012 | Phase 1 |
| US2 | SecretField 用户级密钥 | T013-T051 | Phase 2-6 |
| US3 | Secrets 插件系统级密钥 | T052-T090 | Phase 7-11 |
| US4 | 混合使用场景 | T082-T084 | Phase 10 |

### Functional Requirements

| FR# | Requirement | Task | Phase |
|-----|-------------|------|-------|
| FR-001 | CryptoEngine 接口定义 | T001 | 1 |
| FR-002 | AES-256-GCM 加密实现 | T002-T005 | 1 |
| FR-003 | NoopCryptoEngine 空实现 | T006 | 1 |
| FR-004 | `app.Crypto()` 方法 | T008-T010 | 1 |
| FR-005 | SecureZero 安全擦除函数 | T007 | 1 |
| FR-006 | SecretField 类型定义 | T013-T016 | 2 |
| FR-007 | SecretField 自动加解密 | T017-T020 | 2 |
| FR-008 | SecretField Hidden 属性 | T021-T022 | 2 |
| FR-009 | SecretField MaxSize 限制 | T023 | 2 |
| FR-010 | SecretField 禁止搜索/过滤/索引 | T025-T026 | 2 |
| FR-011 | Proxy 模板 `@request.auth.*` | T036-T038 | 4 |
| FR-012 | Hook 中 `record.GetString()` 解密 | T030-T032 | 3 |
| FR-013 | Admin UI Reveal (5 秒) | T041, T047 | 5 |
| FR-014 | 导出密文/导入自动加密 | T049-T050 | 6 |
| FR-015 | Secrets 插件 MustRegister | T052 | 7 |
| FR-016 | `_secrets` 系统表 | T053 | 7 |
| FR-017 | HTTP API CRUD | T065-T069 | 8 |
| FR-018 | HTTP API 仅 Superuser | T064 | 8 |
| FR-019 | env 环境隔离 | T060 | 7 |
| FR-020 | Proxy 模板 `{{secrets.*}}` | T082 | 10 |
| FR-021 | JS SDK SecretsService | T071-T078 | 9 |
| FR-022 | Admin UI 禁止 Reveal | T087 | 11 |
| FR-023 | 日志过滤 Secret 值 | T091-T092 | 12 |

### Success Criteria

| SC# | Metric | Validation Task |
|-----|--------|-----------------|
| SC-001 | AES-256-GCM | T002-T005 |
| SC-002 | 加解密延迟 < 1ms | T097 |
| SC-003 | Master Key 不落盘 | T100 |
| SC-004 | 测试覆盖率 > 80% | T099 |
| SC-005 | Layer 1-2 无外部依赖 | 代码审查 |
| SC-006 | HTTP API < 10ms (P99) | T098 |
| SC-007 | Admin UI 无明文泄露 | T101 |

### Edge Cases

| Edge Case | Validation Task |
|-----------|-----------------|
| Master Key 变更后解密失败 | T096, T012 |
| Master Key 长度不足 | T010, T012 |
| 并发加解密线程安全 | T095 |
| secret 字段禁止搜索/过滤 | T025, T027 |
| secret 字段禁止索引 | T026, T027 |
| Secret Value > 4KB | T093, T023 |
| 空字符串加密 | T017, T027 |
| 特殊字符处理 | T012, T027 |

---

## 结论

Tasks 已完整覆盖 spec 中的所有需求：
- ✅ 4 个 User Stories
- ✅ 23 个 Functional Requirements
- ✅ 7 个 Success Criteria
- ✅ 所有 Edge Cases
- ✅ Schema Definitions (SecretField, _secrets 表)
- ✅ JS SDK API Design
- ✅ Proxy 模板语法
- ✅ Admin UI 行为差异
- ✅ SQL 参考
- ✅ Crypto 实现参考
- ✅ 安全考量（权限控制、日志过滤）
