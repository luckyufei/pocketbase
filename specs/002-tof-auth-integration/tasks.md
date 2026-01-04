# Task Breakdown: TOF 认证集成

**Feature**: 002-tof-auth-integration  
**Created**: 2026-01-04

## Phase 1: 核心插件框架

### T001: 创建插件目录结构 [US1]
- [ ] 创建 `plugins/tofauth/` 目录
- [ ] 创建空的 `tofauth.go` 文件
- [ ] 创建空的 `identity.go` 文件
- [ ] 创建空的 `routes.go` 文件
- [ ] 创建空的 `jsvm.go` 文件

### T002: 添加 go-jose 依赖 [US1]
- [ ] 执行 `go get github.com/go-jose/go-jose/v3`
- [ ] 确认 `go.mod` 和 `go.sum` 更新

### T003: 实现 Config 结构 [US1]
- [ ] 定义 `Config` 结构体
- [ ] 添加 `SafeMode` 字段（默认 true）
- [ ] 添加 `DefaultAppKey` 字段（默认 "ggzc"）
- [ ] 添加 `RoutePrefix` 字段（默认 "/apix/tof"）
- [ ] 添加 `CheckTimestamp` 字段（默认 true）

### T004: 实现 Register 函数 [US1]
- [ ] 实现 `Register(app core.App, config Config) error`
- [ ] 实现 `MustRegister(app core.App, config Config)`
- [ ] 添加配置默认值处理
- [ ] 添加插件初始化日志

---

## Phase 2: 身份验证逻辑

### T005: 定义 Identity 结构 [US1]
- [ ] 定义 `Identity` 结构体
  ```go
  type Identity struct {
      LoginName  string  `json:"loginname"`
      StaffId    int     `json:"staffid"`
      Expiration string  `json:"expiration"`
      Ticket     *string `json:"ticket"`
  }
  ```

### T006: 实现签名校验 [US1]
- [ ] 迁移 `checkSignature()` 函数
- [ ] 支持 SafeMode 配置
- [ ] 添加时间戳过期检查（通过 CheckTimestamp 配置）
- [ ] 使用 SHA256 计算签名

### T007: 实现 JWE 解密 [US1]
- [ ] 迁移 `decodeAuthorizationHeader()` 函数
- [ ] 使用 go-jose/v3 解析 JWE
- [ ] 解密并解析 Identity JSON
- [ ] 添加 token 过期检查

### T008: 实现明文身份获取 [US1]
- [ ] 迁移 `getPlainIdentity()` 函数
- [ ] 从 headers 中提取 staffid 和 staffname
- [ ] 仅在非 SafeMode 下使用

### T009: 实现公开 API [US1]
- [ ] 实现 `GetTofIdentity(token, taiId, timestamp, signature, seq string, safeMode bool) (Identity, error)`
- [ ] 整合签名校验和身份解析
- [ ] 添加详细的错误信息

---

## Phase 3: HTTP 路由实现 ⭐ 关键改进

### T010: 实现辅助函数 [US1][US2]
- [ ] 迁移 `cleanURL()` 函数
- [ ] 处理 URL 中的多余斜杠

### T011: 实现认证路由 ⭐ 关键改进 [US1]
- [ ] 实现 `handleAuth(e *core.RequestEvent) error`
- [ ] 从 headers 提取 TOF 参数
- [ ] 调用 `GetTofIdentity()` 验证身份
- [ ] 查找或创建用户记录
- [ ] **⭐ 使用 `apis.RecordAuthResponse()` 返回结果**
  ```go
  // 关键改动：使用标准认证响应
  return apis.RecordAuthResponse(e, user, "tof", map[string]any{
      "tofIdentity": identity,
  })
  ```
- [ ] 处理 `_superusers` 特殊情况（不自动创建）

### T012: 实现登出路由 [US2]
- [ ] 实现 `handleLogout(e *core.RequestEvent) error`
- [ ] 获取 `url` 和 `appkey` 查询参数
- [ ] 构建 TOF 登出 URL
- [ ] 返回 307 重定向

### T013: 实现重定向路由 [US1]
- [ ] 实现 `handleRedirect(e *core.RequestEvent) error`
- [ ] 验证 TOF 身份
- [ ] 验证成功重定向到目标 URL
- [ ] 验证失败重定向到 TOF 登录页

### T014: 注册路由到 App [US1][US2]
- [ ] 在 `Register()` 中添加 `app.OnServe().BindFunc()`
- [ ] 注册 `GET {prefix}/auth/{collection}`
- [ ] 注册 `GET {prefix}/logout`
- [ ] 注册 `GET {prefix}/redirect`

---

## Phase 4: JSVM 集成

### T015: 实现 BindToVM 函数 [US3]
- [ ] 创建 `$tof` 对象
- [ ] 绑定 `getTofIdentity` 方法
- [ ] 处理 Go 到 JS 的类型转换
- [ ] 处理错误到 JS 异常的转换

### T016: 更新 JSVM 类型定义 [US3]
- [ ] 在 `plugins/jsvm/internal/types/generated/types.d.ts` 中添加：
  - `TofIdentity` 接口
  - `Tof` 接口
  - `$tof` 全局变量声明

---

## Phase 5: 集成与测试

### T017: 更新示例项目 [US1][US2][US3]
- [ ] 修改 `examples/base/main.go`
- [ ] 添加 `tofauth.MustRegister()` 调用
- [ ] 在 `jsvm.Config.OnInit` 中调用 `tofauth.BindToVM()`

### T018: 编写单元测试 [P]
- [ ] 测试 `checkSignature()` 正常签名
- [ ] 测试 `checkSignature()` 无效签名
- [ ] 测试 `checkSignature()` 过期时间戳
- [ ] 测试 `GetTofIdentity()` 完整流程
- [ ] 测试 `handleAuth()` 新用户创建
- [ ] 测试 `handleAuth()` 已有用户
- [ ] 测试 `handleAuth()` superusers 拒绝
- [ ] 测试 `handleLogout()` 重定向
- [ ] 测试 `handleRedirect()` 成功/失败
- [ ] **⭐ 测试认证后 `OnRecordAuthRequest` 钩子是否触发**

### T019: 集成测试与修复
- [ ] 运行 `go test ./plugins/tofauth/...`
- [ ] 运行 `go build ./examples/base`
- [ ] 手动测试 API 端点
- [ ] 修复发现的问题

---

## Summary

| Phase | 任务数 | 预估时间 | 说明 |
|-------|--------|----------|------|
| Phase 1 | 4 | 0.5h | 基础框架 |
| Phase 2 | 5 | 1h | 核心逻辑（基本无改动） |
| Phase 3 | 5 | 1h | 路由实现（⭐ 关键改进点） |
| Phase 4 | 2 | 0.5h | JSVM 集成 |
| Phase 5 | 3 | 2h | 测试集成 |
| **Total** | **19** | **5h** | 比原计划减少 3h |

## 关键改进点

**T011 是整个迁移的核心改进**：

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

这一行改动自动获得：
- ✅ MFA 多因素认证支持
- ✅ AuthRule 认证规则检查
- ✅ 新设备登录邮件告警
- ✅ `OnRecordAuthRequest` 钩子触发
- ✅ 标准化 JSON 响应格式

## Dependencies

```
T001 ──┬── T003 ── T004
       │
T002 ──┤
       │
       ├── T005 ── T006 ──┬── T009 ── T011 ⭐ ── T014 ── T017
       │                  │
       │          T007 ───┤
       │                  │
       │          T008 ───┘
       │
       ├── T010 ── T012 ── T014
       │
       │          T013 ── T014
       │
       └── T015 ── T016 ── T017

T017 ── T018 ── T019
```
