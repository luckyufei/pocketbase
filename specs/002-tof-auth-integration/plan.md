# Implementation Plan: TOF 认证集成

**Feature**: 002-tof-auth-integration  
**Created**: 2026-01-04

## Technical Context

### 现有架构分析

| 组件 | 位置 | 说明 |
|------|------|------|
| 插件系统 | `plugins/` | 每个插件独立目录，使用 `MustRegister()` 注册 |
| JSVM 插件 | `plugins/jsvm/` | 支持 `OnInit` 回调注入自定义变量 |
| 路由系统 | `core/serve_event.go` | 通过 `OnServe().BindFunc()` 注册路由 |
| 认证系统 | `core/record_auth.go` | 提供 `FindAuthRecordByEmail()` 等方法 |
| **标准认证响应** | `apis/record_helpers.go` | `RecordAuthResponse()` 提供统一认证响应 |

### 关键发现：标准认证响应

PocketBase 提供了 `apis.RecordAuthResponse()` 函数，所有认证方式（密码、OAuth2、OTP）都通过它返回结果。使用它可以自动获得：

- MFA 多因素认证检查
- AuthRule 认证规则验证
- 新设备登录邮件告警
- `OnRecordAuthRequest` 钩子触发
- 标准化 JSON 响应格式

### 原代码分析

| 文件 | 功能 | 迁移目标 | 关键改动 |
|------|------|----------|----------|
| `tmp/tof.go` | TOF 身份验证核心逻辑 | `plugins/tofauth/identity.go` | 无需改动 |
| `tmp/tof-routes.go` | HTTP 路由处理 | `plugins/tofauth/routes.go` | **使用 `RecordAuthResponse`** |
| `tmp/main.go` | JSVM 注入 | `plugins/tofauth/jsvm.go` | 无需改动 |

### 依赖检查

```bash
# 检查 go-jose 是否已在项目中使用
grep -r "go-jose" go.mod go.sum
```

当前项目未使用 `go-jose`，需要添加依赖。

## Project Structure

```
plugins/tofauth/
├── tofauth.go          # 插件主入口
│   ├── Config struct   # 配置结构
│   ├── MustRegister()  # 注册函数（panic on error）
│   └── Register()      # 注册函数
│
├── identity.go         # 身份验证逻辑
│   ├── Identity struct # 身份信息结构
│   ├── GetTofIdentity()# 公开的身份验证函数
│   ├── checkSignature()# 签名校验（内部）
│   └── decodeJWE()     # JWE 解密（内部）
│
├── routes.go           # HTTP 路由
│   ├── registerRoutes()# 注册所有路由
│   ├── handleAuth()    # /apix/tof/auth/{collection} ⭐ 使用 RecordAuthResponse
│   ├── handleLogout()  # /apix/tof/logout
│   └── handleRedirect()# /apix/tof/redirect
│
├── jsvm.go             # JSVM 绑定
│   └── BindToVM()      # 绑定 $tof 对象到 VM
│
└── tofauth_test.go     # 单元测试
```

## Implementation Phases

### Phase 1: 核心插件框架 [P]

创建插件基础结构，确保可以正确注册和初始化。

**Tasks**:
- T001: 创建 `plugins/tofauth/` 目录结构
- T002: 实现 `Config` 结构和默认值
- T003: 实现 `Register()` 和 `MustRegister()` 函数
- T004: 添加 `go-jose/v3` 依赖到 `go.mod`

### Phase 2: 身份验证逻辑 [P]

迁移 TOF 身份验证核心代码（基本无改动）。

**Tasks**:
- T005: 迁移 `Identity` 结构定义
- T006: 迁移 `checkSignature()` 签名校验逻辑
- T007: 迁移 `decodeJWE()` JWE 解密逻辑
- T008: 迁移 `getPlainIdentity()` 明文身份获取
- T009: 实现公开的 `GetTofIdentity()` 函数

### Phase 3: HTTP 路由实现 ⭐ 关键改进

实现 TOF 相关的 HTTP 路由，**使用标准认证响应**。

**Tasks**:
- T010: 实现 `cleanURL()` 辅助函数
- T011: 实现 `/apix/tof/auth/{collection}` 路由 ⭐ **使用 `apis.RecordAuthResponse()`**
- T012: 实现 `/apix/tof/logout` 路由
- T013: 实现 `/apix/tof/redirect` 路由
- T014: 在 `Register()` 中注册路由到 app

### Phase 4: JSVM 集成

实现 JSVM 绑定，支持在 JS Hooks 中使用 TOF 认证。

**Tasks**:
- T015: 实现 `BindToVM()` 函数
- T016: 更新 JSVM 类型定义文件

### Phase 5: 集成与测试

将插件集成到示例项目并编写测试。

**Tasks**:
- T017: 更新 `examples/base/main.go` 集成 tofauth 插件
- T018: 编写单元测试
- T019: 运行测试并修复问题

## Complexity Tracker

| 任务 | 预估复杂度 | 实际复杂度 | 备注 |
|------|-----------|-----------|------|
| T001-T004 | Low | - | 基础框架 |
| T005-T009 | Low | - | 核心逻辑迁移（基本无改动） |
| T010-T014 | Low | - | 路由实现（关键改进点简单） |
| T015-T016 | Low | - | JSVM 集成 |
| T017-T019 | Medium | - | 测试集成 |

## Risk Assessment

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| go-jose 版本兼容性 | Medium | 使用 v3 稳定版本 |
| RecordAuthResponse 参数变化 | Low | 参考现有认证方式的调用方式 |

## Notes

1. **关键改进**：`handleAuth()` 中使用 `apis.RecordAuthResponse()` 替代直接生成 token
2. 原代码中 `identitySafeMode` 是常量，改为配置项 `Config.SafeMode`
3. 原代码中时间戳过期检查被注释，改为配置项 `Config.CheckTimestamp`
4. 路由前缀 `/apix/tof` 可配置，方便用户自定义
