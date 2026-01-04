# Feature Specification: TOF 认证集成

**Feature Branch**: `002-tof-auth-integration`  
**Created**: 2026-01-04  
**Status**: Draft  
**Input**: 将 tmp 目录下的 TOF 认证代码融入 PocketBase 主分支，作为可选插件提供

## 背景与目标

将原先基于 PocketBase 作为 library 打包的 TOF 认证功能（`tmp/main.go`, `tmp/tof-routes.go`, `tmp/tof.go`）融入到当前 PocketBase 分支，使其成为一个可选的认证插件。

### 核心功能分析

原代码包含三个主要部分：

1. **TOF 身份验证** (`tof.go`)
   - 校验腾讯 TOF 网关签名
   - 解密 JWE 格式的身份信息
   - 支持安全模式和兼容模式（明文身份信息）

2. **TOF 路由处理** (`tof-routes.go`)
   - `/api/tof/logout` - TOF 登出重定向
   - `/api/tof/redirect` - TOF 身份验证后重定向
   - `/api/collections/{collection}/auth-with-tof` - TOF 认证（遵循 PocketBase 认证规范）

3. **JSVM 扩展** (`main.go`)
   - 通过 `OnInit` 回调向 JS 运行时注入 `$tof.getTofIdentity` 函数

### 原实现问题分析

原 `tmp/tof-routes.go` 中的实现存在以下问题：

| 问题 | 影响 |
|------|------|
| **绕过标准认证流程** | 直接调用 `user.NewAuthToken()` 而非 `apis.RecordAuthResponse()` |
| **没有触发认证钩子** | 跳过了 `OnRecordAuthRequest` 等钩子，无法被其他插件监听 |
| **没有 MFA 支持** | 无法与其他认证方式配合进行多因素认证 |
| **没有 AuthRule 检查** | 跳过了 Collection 的认证规则验证 |
| **没有登录告警** | 跳过了新设备登录的邮件告警 |
| **响应格式不标准** | 返回了额外字段，与其他认证方式不一致 |

### 方案选型

| 方案 | 复杂度 | 说明 |
|------|--------|------|
| **A: OAuth2 Provider** | 高 | TOF 不是标准 OAuth2 流程，强行适配较别扭 |
| **B: 自定义路由 + 标准响应** ✅ | 低 | 改动最小，保留现有逻辑，获得所有标准功能 |
| **C: 完整自定义认证方法** | 中 | 需要修改 core 层，侵入性较大 |

**选择方案 B**：保留现有的 TOF 验证逻辑，仅将响应方式改为调用 `apis.RecordAuthResponse()`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 通过 TOF 认证登录系统 (Priority: P1)

作为企业用户，我希望能够通过腾讯 TOF 网关认证后自动登录系统，无需单独注册账号。

**Why this priority**: 这是 TOF 集成的核心价值，让企业用户可以使用统一身份认证。

**Independent Test**: 可以通过携带正确的 TOF headers 访问认证接口，验证是否能获取到有效的 auth token。

**Acceptance Scenarios**:

1. **Given** 用户已通过 TOF 网关认证, **When** 访问 `/api/collections/users/auth-with-tof` 接口, **Then** 返回包含 token 和用户信息的 JSON 响应
2. **Given** 用户首次通过 TOF 认证, **When** 系统中不存在对应邮箱的用户, **Then** 自动创建新用户并返回 token
3. **Given** 用户再次通过 TOF 认证, **When** 系统中已存在对应邮箱的用户, **Then** 直接返回该用户的 token

---

### User Story 2 - TOF 登出 (Priority: P2)

作为企业用户，我希望能够通过系统登出并同时登出 TOF，确保安全退出。

**Why this priority**: 登出是认证流程的必要补充，但优先级低于登录。

**Independent Test**: 可以通过访问登出接口，验证是否正确重定向到 TOF 登出页面。

**Acceptance Scenarios**:

1. **Given** 用户已登录系统, **When** 访问 `/api/tof/logout?url=xxx` 接口, **Then** 重定向到 TOF 登出页面
2. **Given** 登出成功后, **When** TOF 处理完成, **Then** 重定向回指定的 url 参数地址

---

### User Story 3 - JS Hooks 中使用 TOF 身份验证 (Priority: P2)

作为开发者，我希望能够在 JS Hooks 中调用 TOF 身份验证函数，以便在自定义逻辑中验证用户身份。

**Why this priority**: 这是扩展性功能，让开发者可以在 hooks 中灵活使用 TOF 认证。

**Independent Test**: 可以在 pb_hooks 中编写 JS 代码调用 `$tof.getTofIdentity()`，验证是否能正确返回身份信息。

**Acceptance Scenarios**:

1. **Given** 开发者在 pb_hooks 中编写代码, **When** 调用 `$tof.getTofIdentity(token, taiId, timestamp, signature, seq)`, **Then** 返回包含 loginname 和 staffid 的身份对象
2. **Given** TOF 参数无效, **When** 调用 `$tof.getTofIdentity()`, **Then** 抛出错误信息

---

### Edge Cases

- TOF 签名过期（超过 180 秒）如何处理？返回签名过期错误
- TOF token 过期如何处理？返回 token 过期错误
- 认证 `_superusers` 集合但用户不存在？返回错误，不自动创建超级用户
- 网络问题导致无法验证签名？返回验证失败错误
- **本地开发时无法被 TOF 网关调用？设置 `TOF_DEV_MOCK_USER` 环境变量启用模拟模式**

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 `plugins/tofauth` 插件包，可通过 `tofauth.MustRegister()` 注册
- **FR-002**: 插件 MUST 提供 `GET /api/collections/{collection}/auth-with-tof` 接口进行 TOF 认证
- **FR-003**: 插件 MUST 提供 `GET /api/tof/logout` 接口进行 TOF 登出
- **FR-004**: 插件 MUST 提供 `GET /api/tof/redirect` 接口进行 TOF 重定向验证
- **FR-005**: 插件 MUST 支持通过 `Config.OnInit` 向 JSVM 注入 `$tof` 对象
- **FR-006**: 认证成功时 MUST 自动创建不存在的普通用户（非 `_superusers`）
- **FR-007**: 插件 MUST 支持配置 `SafeMode` 开关，控制是否使用安全模式验证
- **FR-008**: 插件 MUST 支持配置 `DefaultAppKey` 用于 TOF 登出重定向
- **FR-009**: 签名验证 MUST 检查时间戳是否在 180 秒内
- **FR-010**: 插件 MUST 提供 `GetTofIdentity()` 函数供外部调用
- **FR-011**: 插件 MUST 支持 `DevMockUser` 配置，用于本地开发时模拟 TOF 身份

### Non-Functional Requirements

- **NFR-001**: 插件代码 MUST 遵循现有 plugins 目录的组织结构
- **NFR-002**: 插件 MUST 包含完整的单元测试
- **NFR-003**: 插件 MUST 在 `examples/base/main.go` 中默认启用
- **NFR-004**: 插件 MUST 生成 TypeScript 类型定义供 JSVM 使用

### Key Entities

- **Identity**: TOF 身份信息，包含 loginname、staffid、expiration、ticket
- **Config**: 插件配置，包含 SafeMode、DefaultAppKey、RoutePrefix

## 设计方案 *(mandatory)*

### 方案概述

创建新的 `plugins/tofauth` 插件包，遵循现有插件（如 `jsvm`、`ghupdate`）的设计模式。

**关键改进**：使用 `apis.RecordAuthResponse()` 替代直接生成 token，融入 PocketBase 标准认证流程。

### 目录结构

```
plugins/
└── tofauth/
    ├── tofauth.go       # 插件主入口，提供 MustRegister/Register 函数
    ├── identity.go      # TOF 身份验证逻辑（原 tof.go）
    ├── routes.go        # HTTP 路由处理（原 tof-routes.go，使用标准响应）
    ├── jsvm.go          # JSVM 绑定逻辑
    └── tofauth_test.go  # 单元测试
```

### 核心改进：使用标准认证响应

```go
// 原实现（有问题）
authToken, err := user.NewAuthToken()
return e.JSON(http.StatusOK, map[string]interface{}{
    "token":       authToken,
    "record":      user,
    "tofIdentity": identity,
})

// 改进后（使用标准响应）
return apis.RecordAuthResponse(e, user, "tof", map[string]any{
    "tofIdentity": identity,
})
```

**自动获得的能力**：
- ✅ MFA 多因素认证支持
- ✅ AuthRule 认证规则检查
- ✅ 新设备登录邮件告警
- ✅ `OnRecordAuthRequest` 钩子触发
- ✅ 标准化 JSON 响应格式

### 核心 API 设计

```go
// plugins/tofauth/tofauth.go
package tofauth

// Config 定义 tofauth 插件的配置选项
type Config struct {
    // AppKey 太湖应用 Key（必填）
    // 用于 TOF 登出重定向
    // 默认从环境变量 TOF_APP_KEY 读取
    AppKey string

    // AppToken 太湖应用 Token（必填）
    // 用于校验网关签名和解密 JWE 身份信息
    // 默认从环境变量 TOF_APP_TOKEN 读取
    // 如果环境变量和配置都为空，插件将不会注册（静默跳过）
    AppToken string

    // SafeMode 启用安全模式验证（推荐生产环境启用）
    // 默认: true
    SafeMode bool

    // RoutePrefix API 路由前缀
    // 默认: "/api/tof"
    RoutePrefix string

    // CheckTimestamp 是否检查时间戳过期（180秒）
    // 默认: true（生产环境应启用）
    CheckTimestamp bool

    // DevMockUser 开发模式下的模拟用户名
    // 当 TOF headers 缺失时，使用此用户名模拟登录
    // 仅用于本地开发调试，生产环境请勿设置
    // 默认从环境变量 TOF_DEV_MOCK_USER 读取
    DevMockUser string
}

// MustRegister 注册 tofauth 插件
// 如果 AppToken 为空（配置和环境变量都未设置），静默跳过注册
// 这样可以在不使用 TOF 的环境中无需修改代码
func MustRegister(app core.App, config Config)

// Register 注册 tofauth 插件
// 返回 false 表示因 AppToken 为空而跳过注册
func Register(app core.App, config Config) (registered bool, err error)

// GetTofIdentity 验证 TOF 身份并返回身份信息
// 可供外部直接调用
func GetTofIdentity(token, taiId, timestamp, signature, seq string, safeMode bool) (Identity, error)

// BindToVM 将 $tof 对象绑定到 goja.Runtime
// 用于在 jsvm.Config.OnInit 中调用
func BindToVM(vm *goja.Runtime, safeMode bool)
```

### 环境变量自动检测

```go
// Register 内部实现
func Register(app core.App, config Config) (bool, error) {
    // 优先使用配置值，否则从环境变量读取
    if config.AppKey == "" {
        config.AppKey = os.Getenv("TOF_APP_KEY")
    }
    if config.AppToken == "" {
        config.AppToken = os.Getenv("TOF_APP_TOKEN")
    }
    if config.DevMockUser == "" {
        config.DevMockUser = os.Getenv("TOF_DEV_MOCK_USER")
    }
    
    // 如果 AppToken 仍为空，静默跳过注册
    if config.AppToken == "" {
        app.Logger().Debug("tofauth: TOF_APP_TOKEN not set, skipping registration")
        return false, nil
    }
    
    // 正常注册插件...
    return true, nil
}
```

### 开发模式 Mock 机制

本地开发时，PocketBase 无法被 TOF 网关调用，此时可以通过设置 `TOF_DEV_MOCK_USER` 环境变量启用模拟模式：

```bash
# 本地开发启动
TOF_APP_KEY=your-key TOF_APP_TOKEN=your-token TOF_DEV_MOCK_USER=yourname ./pocketbase serve
```

**Mock 模式行为**：
- 当请求缺少 TOF headers（`x-tai-identity`, `timestamp`, `signature`, `x-rio-seq`）时
- 如果设置了 `TOF_DEV_MOCK_USER`，使用该用户名创建模拟身份
- 模拟身份的 `staffid` 为 `9999999`，`expiration` 为 `2099-12-31T23:59:59Z`
- 如果未设置 `TOF_DEV_MOCK_USER`，返回 401 未授权错误

**安全警告**：
- ⚠️ **生产环境请勿设置 `TOF_DEV_MOCK_USER`**
- 此功能仅用于本地开发调试，绕过了 TOF 身份验证

### 使用示例

```go
// examples/base/main.go
import (
    "github.com/pocketbase/pocketbase/plugins/tofauth"
    "github.com/pocketbase/pocketbase/plugins/jsvm"
)

func main() {
    app := pocketbase.New()

    // 注册 TOF 认证插件
    // 自动从环境变量 TOF_APP_KEY 和 TOF_APP_TOKEN 读取配置
    // 如果环境变量未设置，插件将静默跳过，不影响其他功能
    tofauth.MustRegister(app, tofauth.Config{
        SafeMode:       true,
        CheckTimestamp: true,
    })

    // 注册 jsvm 插件，并注入 $tof 对象
    jsvm.MustRegister(app, jsvm.Config{
        OnInit: func(vm *goja.Runtime) {
            tofauth.BindToVM(vm, true)
        },
    })

    app.Start()
}
```

### JSVM 类型定义

需要在 `plugins/jsvm/internal/types/generated/types.d.ts` 中添加：

```typescript
interface TofIdentity {
    loginname: string;
    staffid: number;
    expiration: string;
    ticket?: string;
}

interface Tof {
    getTofIdentity(
        token: string,
        taiId: string,
        timestamp: string,
        signature: string,
        seq: string
    ): TofIdentity;
}

declare var $tof: Tof;
```

### 依赖管理

需要在 `go.mod` 中添加：
```
github.com/go-jose/go-jose/v3  // JWE 解密
```

### 认证流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TOF 认证流程                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 请求到达                                                         │
│     GET /api/collections/{collection}/auth-with-tof                  │
│     Headers: x-tai-identity, timestamp, signature, x-rio-seq        │
│                         │                                           │
│                         ▼                                           │
│  2. TOF 身份验证 (GetTofIdentity)                                    │
│     - 校验网关签名 (checkSignature)                                  │
│     - 解密身份信息 (decodeJWE) 或 获取明文身份 (getPlainIdentity)     │
│                         │                                           │
│                         ▼                                           │
│  3. 查找/创建用户                                                    │
│     - FindAuthRecordByEmail({loginname}@tencent.com)                │
│     - 不存在则创建新用户（非 _superusers）                            │
│                         │                                           │
│                         ▼                                           │
│  4. 调用标准认证响应 ⭐ (关键改进)                                    │
│     apis.RecordAuthResponse(e, user, "tof", meta)                   │
│                         │                                           │
│                         ▼                                           │
│  5. PocketBase 标准流程                                              │
│     - 生成 JWT Token                                                │
│     - 检查 AuthRule                                                 │
│     - 检查 MFA 要求                                                 │
│     - 触发 OnRecordAuthRequest 钩子                                 │
│     - 发送登录告警（如需要）                                         │
│                         │                                           │
│                         ▼                                           │
│  6. 返回标准响应                                                     │
│     { "token": "...", "record": {...}, "meta": {"tofIdentity":...} }│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有原有 TOF 认证功能正常工作，API 行为与原实现一致
- **SC-002**: 插件可通过配置启用/禁用，不影响不使用 TOF 的用户
- **SC-003**: JSVM 中可正常调用 `$tof.getTofIdentity()` 函数
- **SC-004**: 单元测试覆盖率达到 80% 以上
- **SC-005**: `examples/base/main.go` 默认集成 TOF 认证插件
- **SC-006**: 代码风格与现有 plugins 目录保持一致
- **SC-007**: ✅ 认证成功后触发 `OnRecordAuthRequest` 钩子
- **SC-008**: ✅ 支持 MFA 多因素认证（如 Collection 配置了 MFA）
- **SC-009**: ✅ 遵守 Collection 的 AuthRule 认证规则

## Assumptions

- 腾讯 TOF 网关的签名算法和协议保持稳定
- 用户邮箱格式为 `{loginname}@tencent.com`
- 系统已有 auth collection 机制可复用
- JWE 解密使用 `go-jose` 库

## 与其他方案的对比

### 为什么不选择 OAuth2 Provider 方案？

TOF 认证流程与标准 OAuth2 有本质区别：

| 对比项 | 标准 OAuth2 | TOF 认证 |
|--------|------------|----------|
| 认证发起 | 客户端重定向到 Provider | 网关代理，Header 携带身份 |
| Token 获取 | 通过 code 换取 token | 直接从 Header 解密获取 |
| 用户信息 | 调用 UserInfo API | 直接从 Header 解析 |
| 配置方式 | Client ID/Secret | App Token |

强行将 TOF 适配为 OAuth2 Provider 会导致：
- 代码逻辑不自然，难以理解
- 需要 mock 大量 OAuth2 接口
- 无法利用 OAuth2 Provider 的配置 UI

### 为什么不选择完整自定义认证方法？

完整自定义认证方法需要：
- 在 `core/` 层添加新的事件类型
- 修改 `core/base.go` 添加新钩子
- 侵入性较大，不适合作为可选插件

**方案 B（自定义路由 + 标准响应）是最佳平衡点**：
- 保留 TOF 特有的验证逻辑
- 复用 PocketBase 标准认证流程的所有能力
- 作为独立插件，不侵入 core 层
