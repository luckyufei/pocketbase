# Phase 1 详细分析：APIs 认证与权限测试对齐

**阶段**: Phase 1 - APIs 认证与权限  
**目标**: 补充和对齐所有认证相关测试  
**预计工作量**: 7-13 小时  
**优先级**: P1

---

## 1. Record Auth Methods Tests

### Go 版本文件位置

```
/Users/yufei/workspace/pocketbase-main/apis/record_auth_methods_test.go
```

### 关键代码片段分析

**测试场景 1**: Auth Methods 端点返回结果

```go
// Go 版本核心测试
func testRecordAuthMethods(t *testing.T, app core.App, collection string) {
    // GET /api/collections/{collection}/auth-methods
    // 返回:
    // {
    //   "emailPassword": bool,
    //   "authProviders": [
    //     {
    //       "name": "google",
    //       "state": "...",
    //       "codeVerifier": "..."
    //     }
    //   ],
    //   "mfa": { ... }
    // }
}
```

**关键验证点**:
- ✓ 返回 `emailPassword` 是否启用
- ✓ 返回所有 OAuth2 providers 列表
- ✓ 返回 MFA 配置
- ✓ State 参数有效期和验证
- ✓ Code Verifier (PKCE 支持)

### PocketLess 现状

**文件位置**: `pocketless/src/apis/record_auth_methods.test.ts`

**现状**: ❌ **不存在** - 需要新建

### 实现计划

#### Task 1.1: 创建 record_auth_methods.ts 模块

**需要实现的端点**:

```typescript
// src/apis/record_auth_methods.ts

/**
 * GET /api/collections/:collectionIdOrName/auth-methods
 * 
 * 返回指定认证集合支持的认证方法配置
 * 
 * 响应示例:
 * {
 *   "emailPassword": true,
 *   "authProviders": [
 *     {
 *       "name": "google",
 *       "displayName": "Google",
 *       "state": "base64_state",
 *       "codeVerifier": "base64_code_verifier"
 *     },
 *     ...
 *   ],
 *   "mfa": {
 *     "enabled": true,
 *     "duration": 1800  // 秒
 *   }
 * }
 */
export function setupAuthMethodsRoutes(router: Router, app: App) {
  router.get(
    "/api/collections/:collectionIdOrName/auth-methods",
    async (c) => {
      const collection = await resolveCollection(c, app);
      
      if (!collection.isAuth) {
        return c.json({ code: 400, message: "Not an auth collection" }, 400);
      }

      const authOptions = collection.authOptions || {};
      
      return c.json({
        emailPassword: authOptions.passwordAuth || false,
        authProviders: await buildAuthProviders(app, authOptions),
        mfa: {
          enabled: authOptions.mfa?.enabled || false,
          duration: authOptions.mfa?.duration || 1800
        }
      });
    }
  );
}
```

#### Task 1.2: 创建 record_auth_methods.test.ts 测试文件

**测试用例列表**:

```typescript
describe("Record Auth Methods", () => {
  
  // Test 1: 非 Auth 集合返回 400
  test("GET /auth-methods on non-auth collection returns 400", async () => {
    // Setup: 创建普通（非 Auth）集合
    // Execute: GET /api/collections/posts/auth-methods
    // Assert: status === 400, message contains "Not an auth collection"
  });

  // Test 2: Auth 集合返回正确配置
  test("GET /auth-methods returns correct auth config", async () => {
    // Setup: 创建 Auth 集合，启用 emailPassword
    // Execute: GET /api/collections/users/auth-methods
    // Assert:
    //   - emailPassword === true
    //   - authProviders 是数组
    //   - mfa.enabled === true/false
  });

  // Test 3: OAuth2 Provider 列表正确
  test("OAuth2 providers list matches enabled providers", async () => {
    // Setup: 设置 OAuth2 (Google, GitHub, Apple)
    // Execute: GET /api/collections/users/auth-methods
    // Assert:
    //   - authProviders.length === 3
    //   - 每个 provider 包含 name, state, codeVerifier
    //   - state 是有效的 base64
  });

  // Test 4: State 参数有效期
  test("Auth state parameter expires after timeout", async () => {
    // Setup: 获取初始 state
    // Execute: 等待状态过期时间
    // Assert: state 不再有效
  });

  // Test 5: MFA 配置返回
  test("MFA configuration is returned correctly", async () => {
    // Setup: 启用 MFA
    // Execute: GET /api/collections/users/auth-methods
    // Assert:
    //   - mfa.enabled === true
    //   - mfa.duration 是数字
  });

  // Test 6: 未认证用户也能访问（公开端点）
  test("Auth methods endpoint is accessible without authentication", async () => {
    // Setup: 不提供任何 token
    // Execute: GET /api/collections/users/auth-methods
    // Assert: 返回 200，包含完整配置
  });
});
```

**预计代码行数**: 150-200 行

---

## 2. Record Auth Password Tests

### Go 版本文件位置

```
/Users/yufei/workspace/pocketbase-main/apis/record_auth_with_password_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_auth_password_reset_request_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_auth_password_reset_confirm_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_auth_email_change_request_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_auth_email_change_confirm_test.go
```

### PocketLess 现状

**文件位置**: `pocketless/src/apis/record_auth_password.test.ts`

**现状**: ✅ 部分存在，但需要完整性审查和补充

### 实现计划

#### Task 2.1: 分析现有 record_auth_password.test.ts

**检查项**:

```
✓ 密码认证端点测试是否完整？
  - POST /api/collections/users/auth-with-password
  - 正确密码场景
  - 错误密码场景
  - 非存在用户场景
  - MFA 启用场景

✓ Token 刷新端点测试是否完整？
  - POST /api/collections/users/auth-refresh
  - 有效 token 更新
  - 过期 token 拒绝
  - 无效 token 拒绝

✓ JWT Claims 是否与 Go 版一致？
  - sub (用户 ID)
  - email
  - type ("authToken")
  - exp
  - iat
```

#### Task 2.2: 补充缺失的密码重置测试

**新增测试用例**:

```typescript
describe("Record Auth Password - Password Reset", () => {
  
  // Test 1: 请求密码重置
  test("POST /request-password-reset sends reset email", async () => {
    // Setup: 创建用户
    // Execute: POST /api/collections/users/request-password-reset
    //          body: { email: "user@example.com" }
    // Assert:
    //   - status === 204
    //   - 邮件已发送（检查 app.onMailerBeforeSend 钩子）
    //   - 邮件包含重置 URL
  });

  // Test 2: 使用重置 token 确认密码重置
  test("POST /confirm-password-reset updates password", async () => {
    // Setup: 
    //   1. 创建用户
    //   2. 请求密码重置，获取 token
    //   3. 从邮件中提取 token
    // Execute: POST /api/collections/users/confirm-password-reset
    //          body: { token: "reset_token", password: "newPassword123", passwordConfirm: "newPassword123" }
    // Assert:
    //   - status === 200
    //   - 响应包含 token + record
    //   - 新密码生效（尝试用新密码登录）
    //   - 旧密码失效
  });

  // Test 3: 无效重置 token 被拒绝
  test("POST /confirm-password-reset rejects invalid token", async () => {
    // Execute: 使用无效 token
    // Assert: status === 400, message 指示 token 无效
  });

  // Test 4: 过期重置 token 被拒绝
  test("POST /confirm-password-reset rejects expired token", async () => {
    // Setup: 生成 token，等待过期
    // Assert: status === 400
  });

  // Test 5: 密码重置后旧 token 失效
  test("Auth token becomes invalid after password change", async () => {
    // Setup: 
    //   1. 用旧密码登录，获得 token
    //   2. 重置密码
    // Execute: 使用旧 token 调用受保护端点
    // Assert: status === 401
  });
});
```

#### Task 2.3: 补充缺失的邮箱变更测试

```typescript
describe("Record Auth - Email Change", () => {
  
  // Test 1: 请求邮箱变更
  test("POST /request-email-change sends verification email", async () => {
    // Setup: 
    //   1. 创建用户（邮箱：old@example.com）
    //   2. 用该用户登录
    // Execute: POST /api/collections/users/request-email-change
    //          body: { newEmail: "new@example.com" }
    // Assert:
    //   - status === 204
    //   - 邮件已发送到新邮箱
    //   - 旧邮箱未被更改
  });

  // Test 2: 使用变更 token 确认邮箱变更
  test("POST /confirm-email-change updates email", async () => {
    // Setup:
    //   1. 请求邮箱变更，获取 token
    //   2. 从邮件中提取 token
    // Execute: POST /api/collections/users/confirm-email-change
    //          body: { token: "email_change_token", password: "password123" }
    // Assert:
    //   - status === 200
    //   - 响应包含更新后的 record（新邮箱）
    //   - 用新邮箱能登录
  });

  // Test 3: 邮箱冲突检查
  test("POST /request-email-change rejects duplicate email", async () => {
    // Setup: 
    //   1. 用户 A 邮箱：a@example.com
    //   2. 用户 B 邮箱：b@example.com
    // Execute: 用户 B 请求变更邮箱为 a@example.com
    // Assert: status === 400, 错误消息指示邮箱已被使用
  });
});
```

**预计新增代码行数**: 300-400 行

---

## 3. Record Auth OAuth2 Tests

### Go 版本文件位置

```
/Users/yufei/workspace/pocketbase-main/apis/record_auth_with_oauth2_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_auth_with_oauth2_redirect_test.go
```

### PocketLess 现状

**文件位置**: `pocketless/src/apis/record_auth_oauth2.test.ts`

**现状**: ✅ 部分存在，需要完整性审查

### 实现计划

#### Task 3.1: OAuth2 授权码流程测试

```typescript
describe("Record Auth OAuth2 - Authorization Flow", () => {
  
  // Test 1: 获取授权 URL
  test("GET /oauth2-authorize returns authorization URL", async () => {
    // Setup: 配置 Google OAuth2
    // Execute: GET /api/collections/users/oauth2-authorize?provider=google&redirectUrl=http://localhost:3000/callback
    // Assert:
    //   - 返回 redirect URL (Google authorization endpoint)
    //   - URL 包含 client_id, redirect_uri, state, code_challenge
    //   - state 参数已存储
  });

  // Test 2: OAuth2 回调处理
  test("GET /oauth2-callback completes OAuth2 flow", async () => {
    // Setup: Mock OAuth2 provider 返回 authorization code
    // Execute: GET /api/collections/users/oauth2-callback?provider=google&code=auth_code&state=state_param
    // Assert:
    //   - 交换 code 为 access_token
    //   - 从 provider 获取用户信息
    //   - 创建或更新本地用户
    //   - 返回 auth token
  });

  // Test 3: 新用户自动创建
  test("OAuth2 auto-creates new user if not exists", async () => {
    // Setup: 
    //   1. Google 用户：google_id=xxx, email=new@example.com
    //   2. 本地数据库无该用户
    // Execute: 完成 OAuth2 流程
    // Assert:
    //   - 新用户被创建
    //   - email 被设置为 new@example.com
    //   - 与 Google 账号关联
  });

  // Test 4: 现有用户关联
  test("OAuth2 associates existing user", async () => {
    // Setup:
    //   1. 本地用户存在：email=user@example.com
    //   2. OAuth2 返回同一邮箱
    // Execute: 完成 OAuth2 流程
    // Assert:
    //   - 用户未被重复创建
    //   - OAuth2 账号被关联到现有用户
    //   - 返回 auth token
  });

  // Test 5: State 参数验证
  test("OAuth2 validates state parameter", async () => {
    // Execute: /oauth2-callback 使用无效或过期的 state
    // Assert: status === 400, 错误消息指示 state 无效
  });

  // Test 6: PKCE 验证
  test("OAuth2 PKCE code challenge verification", async () => {
    // Setup: 使用 PKCE 流程
    // Assert: code_challenge 被验证
  });
});
```

#### Task 3.2: 多 Provider 支持测试

```typescript
describe("Record Auth OAuth2 - Multiple Providers", () => {
  
  // 测试所有主要 OAuth2 providers
  const providers = [
    'google',
    'github',
    'apple',
    'discord',
    'gitlab',
    'microsoft'
    // ... 更多 providers
  ];

  providers.forEach(provider => {
    test(`OAuth2 flow works with ${provider}`, async () => {
      // 为每个 provider 执行完整流程测试
      // 验证 token 映射规则（每个 provider 的 ID 字段名不同）
    });
  });

  // Test: Provider 字段映射
  test("OAuth2 user field mapping is correct for each provider", async () => {
    // Google: id -> google_id, email -> email
    // GitHub: id -> github_id, login -> username
    // Apple: sub -> apple_id
    // ... 验证所有 providers 的正确映射
  });
});
```

**预计新增代码行数**: 200-300 行

---

## 4. Record Auth OTP Tests

### Go 版本文件位置

```
/Users/yufei/workspace/pocketbase-main/apis/record_auth_otp_request_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_crud_otp_test.go
```

### PocketLess 现状

**文件位置**: `pocketless/src/apis/record_auth_otp.test.ts`

**现状**: ✅ 部分存在，需要补充

### 实现计划

```typescript
describe("Record Auth OTP", () => {
  
  // Test 1: 请求 OTP
  test("POST /request-otp sends OTP code", async () => {
    // Execute: POST /api/collections/users/request-otp
    //          body: { email: "user@example.com" }
    // Assert:
    //   - status === 204
    //   - 邮件已发送
    //   - 邮件包含 6 位数字 OTP
  });

  // Test 2: OTP 认证
  test("POST /auth-with-otp completes authentication", async () => {
    // Setup: 请求 OTP
    // Execute: POST /api/collections/users/auth-with-otp
    //          body: { email: "user@example.com", otp: "123456" }
    // Assert:
    //   - status === 200
    //   - 返回 auth token
  });

  // Test 3: OTP 一次性使用
  test("OTP can only be used once", async () => {
    // Setup: 获取 OTP
    // Execute: 
    //   1. 使用 OTP 登录（成功）
    //   2. 重新使用同一 OTP（应失败）
    // Assert: 第二次返回 400
  });

  // Test 4: OTP 过期
  test("OTP expires after timeout", async () => {
    // Setup: 请求 OTP
    // Execute: 等待过期时间，使用 OTP
    // Assert: status === 400, 错误消息指示 OTP 过期
  });

  // Test 5: 无效 OTP
  test("Invalid OTP is rejected", async () => {
    // Execute: 使用错误的 OTP
    // Assert: status === 400
  });

  // Test 6: MFA 与 OTP 结合
  test("OTP works with MFA enabled", async () => {
    // Setup: 启用 MFA 和 OTP
    // Execute: 完整认证流程
    // Assert: 需要通过 OTP 和其他 MFA 方式
  });
});
```

**预计新增代码行数**: 150-200 行

---

## 5. Record Auth Verification Tests

### Go 版本文件位置

```
/Users/yufei/workspace/pocketbase-main/apis/record_auth_verification_request_test.go
/Users/yufei/workspace/pocketbase-main/apis/record_auth_verification_confirm_test.go
```

### PocketLess 现状

**现状**: ✅ 部分存在，需要补充

### 实现计划

```typescript
describe("Record Auth - Email Verification", () => {
  
  // Test 1: 请求验证邮件
  test("POST /request-verification sends verification email", async () => {
    // Execute: POST /api/collections/users/request-verification
    // Assert:
    //   - status === 204
    //   - 邮件已发送
    //   - 新用户未被标记为已验证
  });

  // Test 2: 确认验证
  test("POST /confirm-verification marks email as verified", async () => {
    // Setup: 请求验证
    // Execute: 使用验证 token
    // Assert:
    //   - status === 200
    //   - record.emailVerified === true
  });

  // Test 3: 验证 token 过期
  test("Verification token expires", async () => {
    // Setup: 生成 token，等待过期
    // Assert: 使用过期 token 返回 400
  });

  // Test 4: 已验证用户再次请求验证
  test("Already verified user can request verification again", async () => {
    // Setup: 用户已验证
    // Execute: 再次请求验证
    // Assert: 返回 204，发送新验证邮件
  });
});
```

**预计新增代码行数**: 100-150 行

---

## 📋 Phase 1 完整任务列表

| # | 任务 | 文件 | 状态 | 工作量 | 依赖 |
|----|------|------|------|--------|------|
| 1.1 | 创建 Auth Methods 端点 | `record_auth_methods.ts` | ❌ 新建 | 1h | 无 |
| 1.2 | 创建 Auth Methods 测试 | `record_auth_methods.test.ts` | ❌ 新建 | 1h | 1.1 |
| 2.1 | 审查现有密码测试 | `record_auth_password.test.ts` | ✅ 审查 | 30min | 无 |
| 2.2 | 补充密码重置测试 | `record_auth_password.test.ts` | ❌ 补充 | 2h | 无 |
| 2.3 | 补充邮箱变更测试 | `record_auth_password.test.ts` | ❌ 补充 | 1h | 无 |
| 3.1 | 审查现有 OAuth2 测试 | `record_auth_oauth2.test.ts` | ✅ 审查 | 30min | 无 |
| 3.2 | 补充 OAuth2 授权流程测试 | `record_auth_oauth2.test.ts` | ❌ 补充 | 2h | 无 |
| 3.3 | 补充多 Provider 测试 | `record_auth_oauth2.test.ts` | ❌ 补充 | 1h | 无 |
| 4.1 | 审查现有 OTP 测试 | `record_auth_otp.test.ts` | ✅ 审查 | 30min | 无 |
| 4.2 | 补充 OTP 完整测试 | `record_auth_otp.test.ts` | ❌ 补充 | 1.5h | 无 |
| 5.1 | 审查现有验证测试 | `record_auth_*.test.ts` | ✅ 审查 | 30min | 无 |
| 5.2 | 补充验证完整测试 | `record_auth_*.test.ts` | ❌ 补充 | 1h | 无 |
| **总计** | — | — | — | **12-14h** | — |

---

## 🔍 对齐检查清单

完成 Phase 1 后，需要验证以下项目:

- [ ] 所有 12 个认证测试文件都在 `pocketless/src/apis/` 中
- [ ] 每个测试文件都能单独运行：`bun test src/apis/xxx.test.ts`
- [ ] 所有测试都通过：`bun test src/apis/record_auth*.test.ts`
- [ ] JWT Claims 结构与 Go 版完全一致
- [ ] 邮件发送流程被正确拦截并验证
- [ ] Token 过期时间与 Go 版一致
- [ ] 错误消息格式与 Go 版一致 (HTTP 状态码和错误对象)
- [ ] 与 Go 版 API 的功能性行为无差异

---

**创建日期**: 2026-03-24  
**最后更新**: 2026-03-24  
**进度**: 分析完成，待实现
