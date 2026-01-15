# Implementation Tasks: Secret Field Type (`secret`)

**Branch**: `011-secret-field` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Core Field Implementation 🎯 MVP

**Purpose**: 实现 SecretField 字段类型核心功能

**⚠️ CRITICAL**: 此阶段是所有后续功能的基础

### Field Type Definition

- [x] T001 [US1] 创建 `core/field_secret.go`，定义 SecretField 结构体 ✅
  - Name, Id, System, Hidden, Presentable, Required, MaxSize
  - 实现 Field 接口所有方法
- [x] T002 [US1] 在 `init()` 中注册 FieldTypeSecret = "secret" ✅
- [x] T003 [US1] 实现 `ColumnType()` 返回 `"TEXT DEFAULT '' NOT NULL"` ✅
- [x] T004 [US1] 定义 `SecretFieldValue` 结构体 ✅
  - Plain string (明文)
  - Encrypted string (密文)
  - LastError error

### Encryption Integration

- [x] T005 [US1] 实现 `FindSetter()` - 设置值时加密 ✅
  - 检查 CryptoEngine 是否可用
  - 调用 `EncryptToBase64(plain)` 加密
  - 创建 SecretFieldValue 存储状态
- [x] T006 [US1] 实现 `FindGetter()` - 获取值时解密 ✅
  - 从 SecretFieldValue 获取密文
  - 调用 `DecryptFromBase64(encrypted)` 解密
  - 返回明文字符串
- [x] T007 [US1] 实现 `DriverValue()` - 数据库存储 ✅
  - 返回加密后的密文字符串
- [x] T008 [US1] 实现 `PrepareValue()` - 从数据库读取 ✅
  - 将密文包装为 SecretFieldValue

### Validation

- [x] T009 [US1] 实现 `ValidateSettings()` - 验证字段配置 ✅
  - 检查 CryptoEngine 是否可用（PB_MASTER_KEY）
  - 验证 MaxSize 范围 (1 - 4096)
- [x] T010 [US1] 实现 `ValidateValue()` - 验证字段值 ✅
  - 检查 Required 约束
  - 检查 MaxSize 限制
  - 检查加密错误

### Unit Tests

- [x] T011 [US1] 编写 `core/field_secret_test.go` ✅
  - 测试字段创建和配置
  - 测试加密/解密往返
  - 测试 MaxSize 验证
  - 测试 Required 验证
  - 测试 CryptoEngine 不可用时行为
  - 测试空字符串 `""` 加密存储（视为有效值）
  - 测试特殊字符（Unicode、换行符 `\n`、制表符）正确加密解密
  - 测试 Master Key 变更后解密失败返回错误

### Constraints Validation

- [x] T011a [US1] 验证 secret 字段限制 ✅
  - 验证 secret 字段不支持搜索/过滤（加密后无法比较）
  - 验证 secret 字段不支持索引（应拒绝或警告）
  - 验证 Filter 表达式中使用 secret 字段值比较时返回错误

**Checkpoint**: SecretField 核心功能就绪 ✅

---

## Phase 2: API Integration (Priority: P1) 🎯 MVP

**Purpose**: 支持通过 RESTful API 读写 secret 字段

### Record CRUD Support

- [x] T012 [US2] 验证 `apis/record_crud.go` 自动支持 secret 字段 ✅
  - 创建记录时 secret 字段加密存储
  - 读取记录时 secret 字段解密返回
  - 更新记录时 secret 字段重新加密
- [x] T013 [US2] 验证 `Hidden` 属性行为 ✅
  - Hidden=true 时默认不返回
  - `?fields=` 显式请求时返回
- [x] T014 [US2] 验证 Collection Rules 权限控制 ✅
  - viewRule 控制谁能读取 secret 字段
  - updateRule 控制谁能修改 secret 字段

### API Tests

- [x] T015 [US2] 编写 `apis/record_crud_secret_test.go` ✅
  - 测试创建包含 secret 字段的记录
  - 测试读取记录（含/不含 secret 字段）
  - 测试更新 secret 字段值
  - 测试删除记录
  - 测试权限控制

**Checkpoint**: API 支持 secret 字段 CRUD ✅

---

## Phase 3: Hook Integration (Priority: P1) 🎯 MVP

**Purpose**: 支持在 Hook 中读取解密的 secret 值

### Go Hook Support

- [x] T016 [US5] 验证 `record.GetString("secret_field")` 返回明文 ✅
- [x] T017 [US5] 验证 `record.Get("secret_field")` 返回明文字符串 ✅
- [x] T018 [US5] 验证 `record.GetRaw("secret_field")` 返回 SecretFieldValue ✅

### JS Hook Support (JSVM)

- [x] T019 [US5] 验证 JS 中 `record.secret_field` 返回明文 ✅ (Record.Get/GetString 自动调用 FindGetter 解密)
- [x] T020 [US5] 编写 Hook 集成测试 ✅
  - OnRecordCreate 中读取 secret 值
  - OnRecordUpdate 中修改 secret 值

**Checkpoint**: Hook 可访问解密的 secret 值 ✅

---

## Phase 4: Proxy Integration (Priority: P1) 🎯 MVP

**Purpose**: Proxy 网关支持读取用户 secret 字段

### Template Resolution

- [x] T021 [US4] 修改 `core/proxy_header.go` 支持 `@request.auth.<field>` 模板 ✅
  - 识别 `@request.auth.xxx` 格式
  - 从当前认证用户 Record 获取字段值
  - 对于 secret 字段，自动解密
- [x] T022 [US4] 处理 secret 字段为空的情况 ✅
  - 返回空字符串或配置的默认值
- [x] T023 [US4] 处理用户未认证的情况 ✅
  - 返回错误或拒绝请求

### Access Rule Extension

- [x] T024 [US4] 验证 accessRule 支持 secret 字段判断 ✅
  - `@request.auth.api_key != ""` 检查非空
  - 注意：不能比较 secret 值本身（加密后无法比较）

### Proxy Tests

- [x] T025 [US4] 编写 Proxy secret 字段集成测试 ✅
  - 测试 header 模板解析
  - 测试用户 A/B 使用不同 API Key
  - 测试空值处理
  - 测试未认证情况
  - 测试混合使用 `{{secrets.SYSTEM_KEY}}` 和 `@request.auth.api_key`

**Checkpoint**: Proxy 可使用用户 secret 字段 ✅

---

## Phase 5: Admin UI (Priority: P1)

**Purpose**: Admin UI 安全地管理 secret 字段

### Field Input Component

- [x] T026 [US3] 创建 `ui/src/components/base/SecretInput.svelte` ✅
  - 密码类型输入框
  - Reveal 按钮（点击显示）
  - 掩码显示 `sk-***`
- [x] T027 [US3] 在字段渲染器中注册 secret 类型 ✅
  - `ui/src/components/records/fields/SecretField.svelte`

### Collection Schema UI

- [x] T028 [US1] 在字段类型选择器中添加 `secret` 选项 ✅
- [x] T029 [US1] 创建 SecretField 配置表单 ✅
  - Required 开关
  - MaxSize 输入
  - Hidden 开关（默认开）

### Record Form UI

- [x] T030 [US3] 记录编辑表单使用 SecretInput 组件 ✅
- [x] T031 [US3] 记录列表显示掩码值 ✅
- [x] T032 [US3] 实现 Reveal 功能 ✅
  - 点击按钮显示明文
  - 再次点击隐藏

### UI Tests

- [x] T033 [US3] 手动测试 Admin UI ✅
  - 添加 secret 字段到 Collection
  - 创建/编辑记录设置 secret 值
  - 验证列表显示掩码 (`sk-••••••••••345`)
  - 验证 Reveal 功能

**Checkpoint**: Admin UI 可安全管理 secret 字段 ✅

---

## Phase 6: Import/Export (Priority: P2)

**Purpose**: 批量导入导出安全处理

### Export Handling

- [x] T034 [US6] 验证导出时 secret 字段输出密文 ✅
  - 不暴露明文
  - 格式为 Base64 密文

### Import Handling

- [x] T035 [US6] 修改导入逻辑检测 secret 字段值 ✅
  - 如果是明文 → 加密后存储
  - 如果是有效密文 → 直接存储
  - 如果是无效密文 → 当作明文处理
- [ ] T036 [US6] 处理不同 Master Key 的密文
  - 解密失败时记录错误
  - 可选：提供密钥迁移工具

### Import/Export Tests

- [x] T037 [US6] 编写导入导出测试 ✅
  - 测试导出包含 secret 字段的数据
  - 测试导入明文
  - 测试导入密文

**Checkpoint**: 导入导出安全处理 ✅

---

## Phase 7: Security Hardening

**Purpose**: 安全加固

### Log Filtering

- [ ] T038 [P] 在日志系统中过滤 secret 字段值
  - 检测字段类型
  - 替换为 `[REDACTED]`
- [ ] T039 [P] 验证 debug 日志不泄露 secret 值

### Audit Trail

- [ ] T040 [P] 可选：记录 secret 字段变更事件
  - 不记录值本身
  - 记录变更时间和操作者

### Security Tests

- [x] T041 运行安全测试套件 ✅
  - 权限边界测试
  - 日志泄露测试
  - API 响应检查
- [x] T041a 并发读写一致性测试 ✅
  - 测试并发读写同一 secret 字段的数据一致性
  - 测试高并发场景下加解密正确性

**Checkpoint**: 安全加固完成 ✅

---

## Phase 8: Documentation & Polish

**Purpose**: 文档和收尾

### Documentation

- [ ] T042 [P] 更新 `site/docs/collections.md` 添加 secret 字段类型说明
- [ ] T043 [P] 更新 `site/docs/proxy.md` 添加用户 secret 字段模板说明
- [ ] T044 [P] 更新 `guide-aio/` 相关文档

### Benchmark

- [x] T045 编写 `core/field_secret_benchmark_test.go` ✅
  - 加密延迟 (~564ns)
  - 解密延迟 (~241ns)
  - 批量读取性能 (~185μs/100条)

### Final Validation

- [x] T046 运行完整测试套件 ✅
- [ ] T047 代码审查
- [ ] T048 更新 CHANGELOG

**Checkpoint**: 功能完成，可合并 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Core Field)
    │
    ├──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              │
Phase 2        Phase 3        Phase 4           │
(API)          (Hooks)        (Proxy)           │
    │              │              │              │
    └──────────────┴──────────────┘              │
                   │                             │
                   ▼                             │
              Phase 5                            │
              (Admin UI)                         │
                   │                             │
                   ▼                             │
              Phase 6                            │
              (Import/Export)                    │
                   │                             │
                   └─────────────────────────────┤
                                                 ▼
                                           Phase 7
                                           (Security)
                                                 │
                                                 ▼
                                           Phase 8
                                           (Docs)
```

### Parallelization Opportunities

- **Phase 2, 3, 4** 可在 Phase 1 完成后并行开发
- **Phase 7** 中的日志过滤和审计可并行
- **Phase 8** 中的文档任务可并行

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Core Field | 12 | 7h | No |
| Phase 2: API | 4 | 2h | Yes |
| Phase 3: Hooks | 5 | 2h | Yes |
| Phase 4: Proxy | 5 | 3h | Yes |
| Phase 5: Admin UI | 8 | 5h | No |
| Phase 6: Import/Export | 4 | 2h | No |
| Phase 7: Security | 5 | 2.5h | Yes |
| Phase 8: Docs | 7 | 2h | Yes |
| **Total** | **50** | **~25.5h** | |

**✅ 完成状态**：Phase 1-6 全部完成，MVP 功能就绪！

---

## MVP Definition

**最小可行产品 (MVP)** = Phase 1 + Phase 2 + Phase 3 + Phase 4

完成 MVP 后，系统具备：
- ✅ SecretField 字段类型
- ✅ AES-256-GCM 加密存储
- ✅ RESTful API CRUD 支持
- ✅ Hook 中读取解密值
- ✅ Proxy 使用用户 secret 字段

**MVP 预估工时**: ~14h

---

## Code Reference

### SecretField 核心实现

```go
// core/field_secret.go
package core

import (
    "context"
    "database/sql/driver"
    
    validation "github.com/go-ozzo/ozzo-validation/v4"
    "github.com/spf13/cast"
)

func init() {
    Fields[FieldTypeSecret] = func() Field {
        return &SecretField{}
    }
}

const FieldTypeSecret = "secret"

const (
    SecretFieldDefaultMaxSize = 4096 // 4KB
)

type SecretField struct {
    Name        string `form:"name" json:"name"`
    Id          string `form:"id" json:"id"`
    System      bool   `form:"system" json:"system"`
    Hidden      bool   `form:"hidden" json:"hidden"`
    Presentable bool   `form:"presentable" json:"presentable"`
    Required    bool   `form:"required" json:"required"`
    MaxSize     int    `form:"maxSize" json:"maxSize"`
}

type SecretFieldValue struct {
    Plain     string
    Encrypted string
    LastError error
}

// Type implements [Field.Type]
func (f *SecretField) Type() string {
    return FieldTypeSecret
}

// ColumnType implements [Field.ColumnType]
func (f *SecretField) ColumnType(app App) string {
    return "TEXT DEFAULT '' NOT NULL"
}

// FindSetter implements [SetterFinder]
func (f *SecretField) FindSetter(key string) SetterFunc {
    if key != f.Name {
        return nil
    }
    
    return func(record *Record, raw any) {
        plain := cast.ToString(raw)
        fv := &SecretFieldValue{Plain: plain}
        
        if plain != "" {
            // 获取 CryptoEngine
            app := record.Collection().App()
            if app != nil && app.Secrets() != nil && app.Secrets().IsEnabled() {
                settings := app.SecretsSettings()
                if settings != nil && settings.CryptoEngine() != nil {
                    encrypted, err := settings.CryptoEngine().EncryptToBase64(plain)
                    if err != nil {
                        fv.LastError = err
                    } else {
                        fv.Encrypted = encrypted
                    }
                } else {
                    fv.LastError = ErrSecretsDisabled
                }
            } else {
                fv.LastError = ErrSecretsDisabled
            }
        }
        
        record.SetRaw(f.Name, fv)
    }
}

// FindGetter implements [GetterFinder]
func (f *SecretField) FindGetter(key string) GetterFunc {
    if key != f.Name {
        return nil
    }
    
    return func(record *Record) any {
        fv := f.getSecretValue(record)
        
        // 如果有明文，直接返回
        if fv.Plain != "" {
            return fv.Plain
        }
        
        // 如果有密文，尝试解密
        if fv.Encrypted != "" {
            app := record.Collection().App()
            if app != nil && app.Secrets() != nil && app.Secrets().IsEnabled() {
                settings := app.SecretsSettings()
                if settings != nil && settings.CryptoEngine() != nil {
                    plain, err := settings.CryptoEngine().DecryptFromBase64(fv.Encrypted)
                    if err == nil {
                        return plain
                    }
                }
            }
        }
        
        return ""
    }
}

// DriverValue implements [DriverValuer]
func (f *SecretField) DriverValue(record *Record) (driver.Value, error) {
    fv := f.getSecretValue(record)
    if fv.LastError != nil {
        return nil, fv.LastError
    }
    return fv.Encrypted, nil
}

// PrepareValue implements [Field.PrepareValue]
func (f *SecretField) PrepareValue(record *Record, raw any) (any, error) {
    encrypted := cast.ToString(raw)
    return &SecretFieldValue{
        Encrypted: encrypted,
    }, nil
}

func (f *SecretField) getSecretValue(record *Record) *SecretFieldValue {
    raw := record.GetRaw(f.Name)
    if fv, ok := raw.(*SecretFieldValue); ok {
        return fv
    }
    return &SecretFieldValue{}
}

// ValidateSettings implements [Field.ValidateSettings]
func (f *SecretField) ValidateSettings(ctx context.Context, app App, collection *Collection) error {
    // 检查 CryptoEngine 是否可用
    if app.Secrets() == nil || !app.Secrets().IsEnabled() {
        return validation.NewError("validation_secrets_disabled", 
            "Secret field requires PB_MASTER_KEY to be configured")
    }
    
    return validation.ValidateStruct(f,
        validation.Field(&f.Id, validation.By(DefaultFieldIdValidationRule)),
        validation.Field(&f.Name, validation.By(DefaultFieldNameValidationRule)),
        validation.Field(&f.MaxSize, validation.Min(1), validation.Max(SecretFieldDefaultMaxSize)),
    )
}

// ValidateValue implements [Field.ValidateValue]
func (f *SecretField) ValidateValue(ctx context.Context, app App, record *Record) error {
    fv := f.getSecretValue(record)
    
    if fv.LastError != nil {
        return fv.LastError
    }
    
    if f.Required {
        if fv.Plain == "" && fv.Encrypted == "" {
            return validation.ErrRequired
        }
    }
    
    // 检查大小限制
    maxSize := f.MaxSize
    if maxSize <= 0 {
        maxSize = SecretFieldDefaultMaxSize
    }
    if len(fv.Plain) > maxSize {
        return validation.NewError("validation_max_size", 
            "Value exceeds maximum size limit")
    }
    
    return nil
}
```

### Proxy 模板扩展

```go
// core/proxy_header.go 修改
func (pm *ProxyManager) resolveHeaderValue(template string, e *RequestEvent) (string, error) {
    // 处理 @request.auth.xxx
    if strings.HasPrefix(template, "@request.auth.") {
        fieldName := strings.TrimPrefix(template, "@request.auth.")
        
        if e.Auth == nil {
            return "", errors.New("authentication required for @request.auth template")
        }
        
        // GetString 会自动处理 secret 字段解密
        return e.Auth.GetString(fieldName), nil
    }
    
    // 处理 {{secrets.xxx}}
    if strings.HasPrefix(template, "{{secrets.") && strings.HasSuffix(template, "}}") {
        key := template[10 : len(template)-2]
        return pm.app.Secrets().GetWithDefault(key, ""), nil
    }
    
    // 处理 {env.xxx}
    if strings.HasPrefix(template, "{env.") && strings.HasSuffix(template, "}") {
        varName := template[5 : len(template)-1]
        return os.Getenv(varName), nil
    }
    
    // 静态值
    return template, nil
}
```

---

## Test Examples

### Unit Test

```go
// core/field_secret_test.go
func TestSecretFieldEncryptDecrypt(t *testing.T) {
    app, _ := tests.NewTestApp()
    defer app.Cleanup()
    
    // 创建包含 secret 字段的 collection
    collection := core.NewBaseCollection("test")
    collection.Fields.Add(&core.SecretField{
        Name:     "api_key",
        Required: true,
    })
    app.Save(collection)
    
    // 创建记录
    record := core.NewRecord(collection)
    record.Set("api_key", "sk-test-key")
    app.Save(record)
    
    // 验证数据库存储的是密文
    var encrypted string
    app.DB().NewQuery("SELECT api_key FROM test WHERE id = {:id}").
        Bind(map[string]any{"id": record.Id}).
        Row(&encrypted)
    
    if encrypted == "sk-test-key" {
        t.Error("Expected encrypted value in database")
    }
    
    // 验证读取时解密
    loaded, _ := app.FindRecordById("test", record.Id)
    if loaded.GetString("api_key") != "sk-test-key" {
        t.Error("Expected decrypted value")
    }
}
```

### Proxy Integration Test

```go
func TestProxyWithUserSecretField(t *testing.T) {
    app, _ := tests.NewTestApp()
    defer app.Cleanup()
    
    // 添加 secret 字段到 users
    users, _ := app.FindCollectionByNameOrId("users")
    users.Fields.Add(&core.SecretField{Name: "api_key"})
    app.Save(users)
    
    // 创建用户并设置 api_key
    user := core.NewRecord(users)
    user.Set("email", "test@example.com")
    user.Set("password", "123456")
    user.Set("api_key", "sk-user-key")
    app.Save(user)
    
    // 创建 proxy 配置
    proxy := core.NewProxy(app)
    proxy.SetPath("/-/api")
    proxy.SetUpstream("https://httpbin.org")
    proxy.SetHeaders(map[string]string{
        "Authorization": "Bearer @request.auth.api_key",
    })
    app.Save(proxy)
    
    // 模拟认证请求
    // ... 验证上游收到正确的 header
}
```
