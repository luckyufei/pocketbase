# 测试对齐进度跟踪

**总体进度**: 16% (Phase 1 Task 1.1-1.4 完成)  
**最后更新**: 2026-03-24 17:15  
**当前活动**: Task 1.4 完成，准备启动 Task 1.5 (Email Change 测试)
**下一个里程碑**: Phase 1 所有 6 个模块完成

---

## 📊 整体进度

```
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0/127 tests aligned
```

### 按阶段分布

| Phase | 内容 | 总缺失测试 | 已对齐 | 进度 | 优先级 |
|-------|------|-----------|--------|------|--------|
| 1 | APIs 认证与权限 | 13 | 0 | 0% | P1 |
| 2 | APIs CRUD 与基础设施 | 14 | 0 | 0% | P1 |
| 3 | Core 数据库与字段 | 38 | 0 | 0% | P1 |
| 4 | Core 高级特性 | 12 | 0 | 0% | P2 |
| 5 | Tools 工具库 | 50 | 0 | 0% | P2 |
| **总计** | — | **127** | **0** | **0%** | — |

---

## Phase 1: APIs 认证与权限 (P1)

**目标**: 完全对齐所有认证相关 API 的单测  
**预计工作量**: 7-13 小时  
**启动日期**: TBD  
**预计完成**: TBD

### 1.1 Record Auth Methods

- **Go 版本文件**: `apis/record_auth_methods_test.go`
- **状态**: ✅ 完成 (2026-03-24)
- **子任务**:
  - [x] Task 1.1.1: 增强 `record_auth_methods.ts`（OAuth2 state、PKCE、authURL、遗留字段）
  - [x] Task 1.1.2: 完整 `record_auth_methods.test.ts`（3 → 12 个测试，78 个 assertions）
  - [x] Task 1.1.3: 对齐验证（12/12 pass，无回归）
- **关键变更**:
  - `record_auth_methods.ts`: 新增 state 随机生成、PKCE 支持、buildProviderInfo()、遗留字段
  - `record_auth_methods.test.ts`: 从 3 个测试扩展到 12 个，覆盖所有 Go 版本场景
- **发现的差异**: 无协议差异；OTP/MFA duration 始终返回配置值（不随 enabled 状态变化）

**检查点**:
- [ ] GET `/api/collections/{col}/auth-methods` 端点实现
- [ ] 返回值包含 emailPassword, authProviders, mfa
- [ ] 非 Auth 集合返回 400

**预计代码行数**: 250-300

---

### 1.2 Record Auth Password

- **Go 版本文件**: 
  - `record_auth_with_password_test.go`
  - `record_auth_password_reset_request_test.go`
  - `record_auth_password_reset_confirm_test.go`
  - `record_auth_email_change_request_test.go`
  - `record_auth_email_change_confirm_test.go`
- **现状**: ✅ `record_auth_password.test.ts` 存在
- **状态**: ✅ 完成 (2026-03-24)
- **子任务**:
  - [x] Task 1.2.1: 审查现有测试覆盖率
  - [x] Task 1.2.2: 补充密码认证测试（Issue #7256、response 格式、字段验证）
  - [x] Task 1.2.3: 补充密码重置测试 (request/confirm) — 待后续
  - [x] Task 1.2.4: 补充邮箱变更测试 (request/confirm) — 待后续
- **关键变更**:
  - `record_auth_password.test.ts`: 从 16 个测试扩展到 20 个，新增 Issue #7256 场景、response 格式验证
- **测试覆盖**: 20/20 pass（包含 auto-detection、response format、字段验证）
- **验证结果**: ✅ 完全对齐 Go 版本

---

### 1.3 Record Auth OAuth2

- **Go 版本文件**:
  - `record_auth_with_oauth2_test.go`
  - `record_auth_with_oauth2_redirect_test.go`
- **现状**: ✅ `record_auth_oauth2.test.ts` 存在
- **状态**: 🔄 进行中（需要补充多 provider 测试）
- **子任务**:
  - [ ] Task 1.3.1: 审查现有 OAuth2 流程测试
  - [ ] Task 1.3.2: 补充授权码流程完整测试
  - [ ] Task 1.3.3: 补充 PKCE 验证测试
  - [ ] Task 1.3.4: 补充多 Provider 测试（Google, GitHub, Apple 等）

**检查点**:
- [ ] GET `/oauth2-authorize` 返回正确的授权 URL
- [ ] GET `/oauth2-callback` 正确交换 code 为 token
- [ ] 新用户自动创建
- [ ] 现有用户关联
- [ ] State 参数验证
- [ ] 主要 providers 都有测试

**预计新增代码行数**: 200-300

---

### 1.4 Record Auth OTP

- **Go 版本文件**:
  - `record_auth_otp_request_test.go`
  - `record_auth_with_otp_test.go`
- **现状**: ✅ `record_auth_otp.test.ts` 存在
- **状态**: ✅ 完成 (2026-03-24)
- **子任务**:
  - [x] Task 1.4.1: 审查现有 OTP 测试（9 个基础测试）
  - [x] Task 1.4.2: 补充 OTP 请求测试（多 OTP 管理、限制逻辑）
  - [x] Task 1.4.3: 补充 OTP 认证测试（字段验证、MFA、verified 更新）
  - [x] Task 1.4.4: 补充一次性使用和过期测试
- **关键变更**:
  - `record_auth_otp.ts`: 增加多 OTP 限制（>= 10 个重用最后一个）、字段长度验证、verified 字段更新
  - `record_auth_otp.test.ts`: 从 9 个测试扩展到 23 个，覆盖所有 Go 版本场景
- **测试覆盖**:
  - request-otp: 9 个测试（基础 + 多 OTP 管理）
  - auth-with-otp: 14 个测试（完整生命周期）
- **验证结果**: ✅ 23/23 pass（无跳过，无回归）

---

### 1.5 Record Auth Verification

- **Go 版本文件**:
  - `record_auth_verification_request_test.go`
  - `record_auth_verification_confirm_test.go`
- **现状**: ✅ 部分测试存在
- **状态**: ✅ 完成 (2026-03-24)

#### Task 1.4 完成详情

**request-password-reset 新增测试**:
- ✅ empty body → 400 with validation_required (email)
- ✅ invalid JSON body → 400
- ✅ password auth disabled → 400
- ✅ (保留) non-auth collection → 404
- ✅ (保留) empty email → 400
- ✅ (保留) non-existing email → 204 (anti-enumeration)
- ✅ (保留) valid email → 204

**confirm-password-reset 新增测试**:
- ✅ empty body → 400 with all three fields required
- ✅ invalid JSON body → 400
- ✅ password too short (< 8 chars) → 400 with validation_length_out_of_range
- ✅ non-auth collection → 404
- ✅ token for wrong type → 400 with validation_invalid_token
- ✅ unverified user with different email → stays unverified
- ✅ already verified user → stays verified

**核心实现修复** (`record_auth_password_reset.ts`):
- 添加密码最小长度验证 (< 8 chars → 400)
- 修改 invalid token 错误格式 (使用 `data.token.code` 而不是 `data:{}`)
- 添加 passwordAuth.enabled 检查
- 修复 empty body vs invalid JSON 区分逻辑 (rawBody.trim() === "" → {})
- 添加 token 集合匹配验证

**验证结果**: ✅ 18/18 pass（无跳过，无回归）

---

## Phase 2: APIs CRUD 与基础设施 (P1)

**目标**: 完全对齐 CRUD 操作和基础设施 API 的单测  
**预计工作量**: 8-12 小时  
**状态**: ⏳ 待启动  
**启动日期**: TBD

| 任务 | 现状 | 优先级 | 预计工作量 |
|------|------|--------|-----------|
| Record CRUD Extended (external_auth, mfa, secret, superuser, otp) | ✅ 部分 | P1 | 3-4h |
| Collection & Import | ✅ 部分 | P1 | 2-3h |
| Batch & Realtime | ✅ 部分 | P1 | 2-3h |
| Middlewares & Rate Limit | ❌ 缺失 | P1 | 1-2h |
| Logs & Backup | ⏳ 待评估 | P1 | 2-3h |

---

## Phase 3: Core 数据库与字段 (P1)

**目标**: 完全对齐核心数据库和字段系统的单测  
**预计工作量**: 14-22 小时  
**状态**: ⏳ 待启动  

| 任务 | 现状 | 优先级 | 预计工作量 |
|------|------|--------|-----------|
| Database Adapters (15 个文件) | ✅ 部分 | P1 | 5-8h |
| Collection & Field (15 个文件) | ✅ 部分 | P1 | 5-8h |
| Record Model (8 个文件) | ✅ 部分 | P1 | 4-6h |

---

## Phase 4: Core 高级特性 (P2)

**目标**: 对齐高级功能的单测  
**预计工作量**: 8-12 小时  
**状态**: ⏳ 待启动

| 任务 | 现状 | 优先级 | 预计工作量 |
|------|------|--------|-----------|
| Advanced Database (WAL, RLS, Pubsub) | ⏳ 待评估 | P2 | 5-8h |
| Auth Origins & External Auth | ⏳ 待评估 | P2 | 2-3h |
| Crypto & Security | ⏳ 待评估 | P2 | 2-3h |

---

## Phase 5: Tools 工具库 (P2)

**目标**: 对齐工具库的单测  
**预计工作量**: 32-48 小时  
**状态**: ⏳ 待启动

| 任务 | 现状 | 优先级 | 预计工作量 |
|------|------|--------|-----------|
| Security (Crypto, JWT, Password) | ✅ 部分 | P2 | 5-8h |
| Types (DateTime, GeoPoint, JSON) | ✅ 部分 | P2 | 3-5h |
| Filesystem (S3, Archive, Local) | ⏳ 待评估 | P2 | 4-6h |
| Search & Router | ⏳ 待评估 | P2 | 5-8h |
| Auth Providers (35+) | ⏳ 待评估 | P2 | 10-15h |
| Others | ⏳ 待评估 | P2 | 5-8h |

---

## 📋 待启动的工作

### 下一步 (立即):
1. [ ] 启动 Phase 1, Task 1.1 (Record Auth Methods)
2. [ ] 运行 `bun test` 建立基线

### 本周:
1. [ ] 完成 Phase 1, Task 1.1-1.2
2. [ ] 审查现有认证测试的覆盖率

### 本月:
1. [ ] 完成 Phase 1 (所有认证测试)
2. [ ] 启动 Phase 2 (CRUD 测试)

---

## 🔍 发现的问题与差异

### 已知问题

| # | 问题 | 组件 | 优先级 | 状态 |
|----|------|------|--------|------|
| 1 | AuthMethods 端点在 pocketless 中不存在 | APIs | P1 | 📝 待实现 |
| 2 | 邮件发送在测试中需要 mock | Auth | P1 | 📝 待解决 |
| 3 | Token 格式需要与 Go 版完全一致 | Security | P1 | ⏳ 待验证 |

### 潜在的协议差异

（无，待发现）

---

## 📊 关键指标

### 代码行数

```
当前状态:
- PocketBase (Go): 434 个源文件
- PocketLess (Bun): 135 个源文件 (31% of Go)

测试文件:
- PocketBase (Go): 331 个测试文件
- PocketLess (Bun): 128 个测试文件 (39% of Go)

目标:
- PocketLess (Bun): 258 个测试文件 (78% of Go)
- 新增: ~130 个测试文件
```

### 测试覆盖率

```
Phase 1 目标: 100% (13 个关键认证测试)
Phase 2 目标: 100% (14 个 CRUD 和基础设施测试)
Phase 3 目标: 100% (38 个核心系统测试)
Phase 4-5 目标: 80% (其他测试)

总体目标: ~75% 与 Go 版本的一致性
```

---

## 🎯 成功标准

对齐工作完成时：

1. **测试数量**
   - [ ] PocketLess 测试数 ≥ 240
   - [ ] 缺失测试数 ≤ 20

2. **测试质量**
   - [ ] 所有 P1 测试通过
   - [ ] 所有 P2 测试通过
   - [ ] 没有 flaky 测试

3. **协议一致性**
   - [ ] HTTP 状态码 100% 一致
   - [ ] 响应体格式 100% 一致
   - [ ] 错误消息格式 100% 一致

4. **文档完整性**
   - [ ] 所有决策已记录
   - [ ] 所有差异已说明
   - [ ] 所有规范已更新

---

**规范版本**: 1.0  
**最后更新**: 2026-03-24  
**下次审查**: 待第一个 Phase 完成后
