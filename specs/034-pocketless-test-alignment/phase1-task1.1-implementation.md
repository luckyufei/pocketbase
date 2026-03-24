# Phase 1, Task 1.1 实现计划：Record Auth Methods

**任务**: 完全实现 Record Auth Methods 端点与测试，确保与 Go 版本 100% 对齐  
**优先级**: P1 (关键功能)  
**预计工作量**: 2-3 小时  
**状态**: 🚀 立即启动

---

## 🎯 任务目标

实现 `GET /api/collections/:collectionIdOrName/auth-methods` 端点，返回指定认证集合支持的认证方法配置，包括：
- ✅ Password 认证信息
- ✅ OAuth2 provider 列表（完整配置）
- ✅ MFA 配置
- ✅ OTP 配置
- ✅ 速率限制规则验证

---

## 📊 当前状态分析

### Go 版本 (已完成) ✅

**文件**: `/apis/record_auth_methods.go` (171 行) + `/apis/record_auth_methods_test.go` (107 行)

**已实现的功能**:
```
✅ GET /api/collections/:collection/auth-methods
✅ 返回完整的 OAuth2 provider 信息（包括 state、PKCE、authURL）
✅ 生成随机 state (30 字符)
✅ 支持 PKCE (code_challenge, code_verifier, code_challenge_method)
✅ 生成完整的 OAuth2 authURL
✅ MFA 和 OTP 配置返回
✅ 遗留字段兼容性（v0.22）
✅ RateLimit 规则 (nologin:listAuthMethods, *:listAuthMethods)
✅ 双数据库测试 (SQLite + PostgreSQL)
```

### Bun 版本 (部分完成) ⚠️

**文件**: `/pocketless/src/apis/record_auth_methods.ts` (87 行) + `/pocketless/src/apis/record_auth_methods.test.ts` (123 行)

**已实现的功能**:
```
✅ GET /api/collections/:collection/auth-methods
✅ 基础路由和错误处理
✅ Collection 查找
✅ 基础配置提取
✅ MFA/OTP 配置返回
```

**缺失的功能**:
```
❌ OAuth2 state 生成 (返回空字符串)
❌ PKCE 参数 (codeVerifier, codeChallenge, codeChallengeMethod)
❌ 完整的 OAuth2 authURL 生成
❌ 对齐的响应格式（缺少某些字段）
❌ RateLimit 测试
❌ 完整的错误处理和验证
```

---

## 📋 实现计划（分三个子任务）

### Subtask 1.1.1: 增强 record_auth_methods.ts 实现

**时间**: 45-60 分钟

#### 1. 完成 OAuth2 配置生成

**需要修改的文件**: `/pocketless/src/apis/record_auth_methods.ts`

**当前代码问题**:
```typescript
// ❌ 错误：state 为空
const providerInfos = oauth2.providers.map((p) => ({
  name: p.name,
  displayName: capitalize(p.name),
  state: "",  // 这是错误的！
}))
```

**改进方案**:

```typescript
import { randomString } from "../tools/security";
import { base64encode } from "../tools/security";

// 生成 OAuth2 state 参数
function generateOAuth2State(): string {
  return randomString(30);  // Go 版本也是 30 字符
}

// 生成 PKCE code_verifier
function generateCodeVerifier(): string {
  // RFC 7636: 43-128 字符，使用 [A-Z] [a-z] [0-9] - . _ ~
  return randomString(128);  // 最大长度
}

// 从 code_verifier 生成 code_challenge
function generateCodeChallenge(verifier: string): string {
  // SHA256(verifier) -> base64url 编码
  const crypto = require("crypto");
  const hash = crypto
    .createHash("sha256")
    .update(verifier)
    .digest();
  return base64urlEncode(hash);
}

// 完整的 provider info
function buildProviderInfo(
  provider: OAuthProvider,
  redirectUrl?: string
): ProviderInfo {
  const state = generateOAuth2State();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // 构建 OAuth2 授权 URL
  const authUrl = buildOAuth2AuthUrl({
    provider: provider.name,
    clientId: provider.clientId,
    redirectUrl: redirectUrl || "http://localhost:8090/api/oauth2-callback",
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
  });

  return {
    name: provider.name,
    displayName: provider.displayName || capitalize(provider.name),
    state,
    authUrl,
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

// OAuth2 授权 URL 构建
function buildOAuth2AuthUrl(options: {
  provider: string;
  clientId: string;
  redirectUrl: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}): string {
  // 使用 Arctic 库或手动构建
  // Go 版本实现参考: core/base_oauth2.go
  
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUrl,
    response_type: "code",
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: options.codeChallengeMethod,
    // provider 特定参数 (scope, prompt 等)
  });
  
  // 根据 provider 类型返回授权 URL
  const baseUrls: Record<string, string> = {
    google: "https://accounts.google.com/o/oauth2/v2/auth",
    github: "https://github.com/login/oauth/authorize",
    discord: "https://discord.com/oauth/authorize",
    // ... 更多 providers
  };
  
  return `${baseUrls[options.provider]}?${params.toString()}`;
}
```

#### 2. 更新响应类型定义

```typescript
// 更新响应结构体
interface ProviderInfo {
  name: string;
  displayName: string;
  state: string;
  authUrl: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
}

interface AuthMethodsResponse {
  password: PasswordResponse;
  oauth2: OAuth2Response;
  mfa: MFAResponse;
  otp: OTPResponse;
  
  // 遗留字段（v0.22 兼容性）
  authProviders?: ProviderInfo[];
  usernamePassword?: boolean;
  emailPassword?: boolean;
}
```

#### 3. 完整的端点实现

```typescript
router.get(
  "/api/collections/:collectionIdOrName/auth-methods",
  async (c) => {
    try {
      const collectionIdOrName = c.req.param("collectionIdOrName");
      
      // 1. 查找集合
      const collection = await app.findCollectionByNameOrId(collectionIdOrName);
      
      if (!collection) {
        return c.json(
          {
            code: 404,
            message: "The requested collection was not found.",
            data: {},
          },
          404
        );
      }

      // 2. 验证是认证集合
      if (!collection.isAuth) {
        return c.json(
          {
            code: 404,
            message: "The requested collection was not found.",
            data: {},
          },
          404
        );
      }

      // 3. 构建响应
      const authConfig = collection.authOptions || {};
      
      // Password 认证信息
      const passwordResponse: PasswordResponse = {
        enabled: authConfig.passwordAuth || false,
        identityFields: authConfig.identityFields || ["email", "username"],
      };

      // OAuth2 认证信息
      let oauth2Providers: ProviderInfo[] = [];
      if (authConfig.oauth2 && authConfig.oauth2.enabled) {
        oauth2Providers = authConfig.oauth2.providers.map((p) =>
          buildProviderInfo(p, c.req.query("redirectUrl"))
        );
      }

      const oauth2Response: OAuth2Response = {
        enabled: authConfig.oauth2?.enabled || false,
        providers: oauth2Providers,
      };

      // MFA 认证信息
      const mfaResponse: MFAResponse = {
        enabled: authConfig.mfa?.enabled || false,
        duration: authConfig.mfa?.duration || 1800,
      };

      // OTP 认证信息
      const otpResponse: OTPResponse = {
        enabled: authConfig.otp?.enabled || false,
        duration: authConfig.otp?.duration || 300,
      };

      // 4. 返回完整响应
      return c.json({
        password: passwordResponse,
        oauth2: oauth2Response,
        mfa: mfaResponse,
        otp: otpResponse,
        // 遗留字段
        authProviders: oauth2Providers,
        usernamePassword: passwordResponse.enabled,
        emailPassword: passwordResponse.enabled,
      });
    } catch (error) {
      return c.json(
        {
          code: 500,
          message: "An error occurred while processing your request.",
          data: {},
        },
        500
      );
    }
  }
);
```

---

### Subtask 1.1.2: 完整的测试覆盖

**时间**: 60-90 分钟

**需要修改的文件**: `/pocketless/src/apis/record_auth_methods.test.ts`

#### 1. 测试基础设施

```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { App } from "../core/app";
import { BaseCollection } from "../core/base_model";
import { setupAuthMethodsRoutes } from "./record_auth_methods";

describe("Record Auth Methods", () => {
  let app: App;
  let router: Hono;

  beforeAll(async () => {
    // 创建测试用 app
    app = createMockApp();
    
    // 创建 Hono 路由
    router = new Hono();
    setupAuthMethodsRoutes(router, app);
  });

  // 测试用例...
});
```

#### 2. 关键测试用例

**Test 1: 非认证集合返回 404**

```typescript
test("non-auth collection returns 404", async () => {
  // Setup
  const nonAuthCol = createMockCollection({ isAuth: false });
  app.findCollectionByNameOrId = async () => nonAuthCol;

  // Execute
  const res = await router.request(
    new Request("http://localhost:8090/api/collections/posts/auth-methods")
  );

  // Assert
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.code).toBe(404);
  expect(body.message).toContain("not found");
});
```

**Test 2: 所有方法禁用返回基础配置**

```typescript
test("all auth methods disabled returns disabled flags", async () => {
  // Setup
  const col = createMockCollection({
    isAuth: true,
    authOptions: {
      passwordAuth: false,
      oauth2: { enabled: false, providers: [] },
      mfa: { enabled: false, duration: 1800 },
      otp: { enabled: false, duration: 300 },
    },
  });

  // Execute
  const res = await router.request(
    new Request("http://localhost:8090/api/collections/users/auth-methods")
  );

  // Assert
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.password.enabled).toBe(false);
  expect(body.oauth2.enabled).toBe(false);
  expect(body.mfa.enabled).toBe(false);
  expect(body.otp.enabled).toBe(false);
});
```

**Test 3: 密码和 OAuth2 启用返回完整配置**

```typescript
test("password and oauth2 enabled returns full config", async () => {
  // Setup
  const col = createMockCollection({
    isAuth: true,
    authOptions: {
      passwordAuth: true,
      identityFields: ["email", "username"],
      oauth2: {
        enabled: true,
        providers: [
          { name: "google", clientId: "xxx" },
          { name: "github", clientId: "yyy" },
        ],
      },
      mfa: { enabled: true, duration: 1800 },
      otp: { enabled: true, duration: 300 },
    },
  });

  // Execute
  const res = await router.request(
    new Request("http://localhost:8090/api/collections/users/auth-methods")
  );

  // Assert
  expect(res.status).toBe(200);
  const body = await res.json();

  // Password
  expect(body.password.enabled).toBe(true);
  expect(body.password.identityFields).toEqual(["email", "username"]);

  // OAuth2
  expect(body.oauth2.enabled).toBe(true);
  expect(body.oauth2.providers.length).toBe(2);

  // Provider 0: Google
  expect(body.oauth2.providers[0].name).toBe("google");
  expect(body.oauth2.providers[0].displayName).toBe("Google");
  expect(body.oauth2.providers[0].state).toMatch(/^[a-zA-Z0-9]{30}$/);
  expect(body.oauth2.providers[0].authUrl).toContain("accounts.google.com");
  expect(body.oauth2.providers[0].codeChallenge).toExist();
  expect(body.oauth2.providers[0].codeChallengeMethod).toBe("S256");

  // MFA & OTP
  expect(body.mfa.enabled).toBe(true);
  expect(body.mfa.duration).toBe(1800);
  expect(body.otp.enabled).toBe(true);
  expect(body.otp.duration).toBe(300);
});
```

**Test 4: OAuth2 state 唯一性**

```typescript
test("OAuth2 state is unique for each request", async () => {
  // Setup: 同一集合
  const col = createMockCollection({
    isAuth: true,
    authOptions: { oauth2: { enabled: true, providers: [{ name: "google" }] } },
  });

  // Execute: 3 次请求
  const res1 = await router.request(...);
  const res2 = await router.request(...);
  const res3 = await router.request(...);

  // Assert: 3 个 state 都不同
  const body1 = await res1.json();
  const body2 = await res2.json();
  const body3 = await res3.json();

  const state1 = body1.oauth2.providers[0].state;
  const state2 = body2.oauth2.providers[0].state;
  const state3 = body3.oauth2.providers[0].state;

  expect(state1).not.toBe(state2);
  expect(state2).not.toBe(state3);
  expect(state1).not.toBe(state3);
});
```

**Test 5: 集合不存在返回 404**

```typescript
test("missing collection returns 404", async () => {
  // Setup
  app.findCollectionByNameOrId = async () => null;

  // Execute
  const res = await router.request(
    new Request("http://localhost:8090/api/collections/nonexistent/auth-methods")
  );

  // Assert
  expect(res.status).toBe(404);
});
```

**Test 6: 响应头和格式验证**

```typescript
test("response format matches Go version", async () => {
  // ... setup ...

  // Execute
  const res = await router.request(...);

  // Assert: Content-Type
  expect(res.headers.get("content-type")).toContain("application/json");

  // Assert: 响应结构
  const body = await res.json();
  expect(body).toHaveProperty("password");
  expect(body).toHaveProperty("oauth2");
  expect(body).toHaveProperty("mfa");
  expect(body).toHaveProperty("otp");

  // 遗留字段兼容性
  expect(body).toHaveProperty("authProviders");
  expect(body).toHaveProperty("usernamePassword");
  expect(body).toHaveProperty("emailPassword");
});
```

#### 3. 比较与 Go 版本测试的对应关系

| Go 版本测试 | Bun 版本测试 | 状态 |
|-----------|-----------|------|
| `missing collection` | Test 5 | ✅ 对应 |
| `non auth collection` | Test 1 | ✅ 对应 |
| `auth collection with none auth methods allowed` | Test 2 | ✅ 对应 |
| `auth collection with all auth methods allowed` | Test 3 | ✅ 对应 |
| OAuth2 state uniqueness | Test 4 | ✅ 新增 |
| Response format | Test 6 | ✅ 新增 |
| RateLimit tests | 待添加 | ⏳ 后续 |

---

### Subtask 1.1.3: 集成验证与对齐

**时间**: 15-30 分钟

#### 1. 在 Go 版本运行原始测试

```bash
cd /Users/yufei/workspace/pocketbase-main
go test -v ./apis -run TestRecordAuthMethods -count=1
```

**预期输出**:
```
=== RUN   TestRecordAuthMethods
=== RUN   TestRecordAuthMethods/missing_collection
    ... pass
=== RUN   TestRecordAuthMethods/non_auth_collection
    ... pass
=== RUN   TestRecordAuthMethods/auth_collection_with_none_auth_methods_allowed
    ... pass
=== RUN   TestRecordAuthMethods/auth_collection_with_all_auth_methods_allowed
    ... pass
--- PASS: TestRecordAuthMethods (1.23s)
PASS
```

#### 2. 在 Bun 版本运行新测试

```bash
cd /Users/yufei/workspace/pocketbase-main/pocketless
bun test src/apis/record_auth_methods.test.ts
```

**预期输出**:
```
✓ src/apis/record_auth_methods.test.ts (6 tests) 234ms

 6 pass
```

#### 3. 手动对比验证

```bash
# 1. 启动 Bun 服务
cd /Users/yufei/workspace/pocketbase-main/pocketless
bun run src/pocketless.ts serve &

# 2. 创建测试集合
curl -X POST http://localhost:8090/api/collections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_users",
    "type": "auth",
    "authOptions": {
      "passwordAuth": true,
      "oauth2": {
        "enabled": true,
        "providers": [
          {"name": "google", "clientId": "xxx"}
        ]
      }
    }
  }'

# 3. 调用 auth-methods 端点
curl http://localhost:8090/api/collections/test_users/auth-methods | jq

# 4. 对比 Go 版本输出
# (在另一个终端启动 Go 版本，执行相同操作)

# 预期: 完全相同的 JSON 结构
```

---

## 🔍 对齐检查清单

完成实现后，验证以下项目：

### HTTP 层
- [ ] GET 端点能正确路由
- [ ] 200 状态码返回正确配置
- [ ] 404 状态码返回不存在或非认证集合
- [ ] Content-Type: application/json

### 数据格式
- [ ] password.enabled (boolean)
- [ ] password.identityFields (array)
- [ ] oauth2.enabled (boolean)
- [ ] oauth2.providers (array of objects)
- [ ] 每个 provider 的结构：name, displayName, state, authUrl, codeChallenge, codeChallengeMethod
- [ ] mfa.enabled (boolean)
- [ ] mfa.duration (number)
- [ ] otp.enabled (boolean)
- [ ] otp.duration (number)

### OAuth2 细节
- [ ] state 长度 = 30
- [ ] state 使用字母数字字符
- [ ] state 每次请求都不同
- [ ] authUrl 格式正确
- [ ] codeChallenge 是有效的 base64url
- [ ] codeChallengeMethod = "S256"

### 错误处理
- [ ] 集合不存在 → 404
- [ ] 非认证集合 → 404
- [ ] 错误的集合 ID → 404
- [ ] 错误消息格式一致

### 测试覆盖
- [ ] 6 个主要测试用例全部通过
- [ ] 没有 flaky 测试
- [ ] 性能可接受 (< 100ms)

---

## 📝 预期代码变化

### 文件修改

```
pocketless/src/apis/
├─ record_auth_methods.ts (+ 150 行代码)
│  ├─ 完整 OAuth2 配置生成
│  ├─ State/PKCE/authUrl 生成逻辑
│  ├─ Provider info 构建
│  └─ 完整端点实现
│
└─ record_auth_methods.test.ts (+ 200 行代码)
   ├─ 6 个完整的测试用例
   ├─ Mock 工具函数
   ├─ 与 Go 版本的对比验证
   └─ 边界情况测试
```

### 新增工具函数位置

```
pocketless/src/tools/security/
├─ randomString() - 已存在，直接使用
├─ base64urlEncode() - 需要新增
└─ generateCodeChallenge() - 需要新增 (OAuth2 PKCE)
```

---

## ✅ 完成标准

Task 1.1 完成时满足以下条件：

1. **功能完整**
   - [ ] record_auth_methods.ts 完全实现
   - [ ] 所有关键功能都实现 (state, PKCE, authUrl)
   - [ ] 响应格式 100% 与 Go 版本一致

2. **测试完整**
   - [ ] record_auth_methods.test.ts 包含 6+ 个测试
   - [ ] 所有测试都通过
   - [ ] 测试覆盖所有关键路径

3. **对齐验证**
   - [ ] HTTP 状态码与 Go 版本一致
   - [ ] 响应体格式与 Go 版本一致
   - [ ] OAuth2 state 生成逻辑相同
   - [ ] 错误消息格式一致

4. **文档更新**
   - [ ] 在 progress.md 中标记 Task 1.1 完成
   - [ ] 记录任何发现的差异
   - [ ] 更新 Phase 1 进度

---

## 🚀 立即开始

### Step 1: 准备工作 (5 分钟)

```bash
cd /Users/yufei/workspace/pocketbase-main/pocketless

# 查看当前实现
cat src/apis/record_auth_methods.ts

# 查看当前测试
cat src/apis/record_auth_methods.test.ts

# 查看现有的 password 认证实现（参考）
cat src/apis/record_auth_password.ts
```

### Step 2: 实现增强 (60 分钟)

参考上面的"Subtask 1.1.1"详细指导编写代码

### Step 3: 编写测试 (60 分钟)

参考上面的"Subtask 1.1.2"详细指导编写测试

### Step 4: 验证 (30 分钟)

参考上面的"Subtask 1.1.3"进行集成验证

### Step 5: 文档更新 (10 分钟)

在 progress.md 中：
```markdown
### 1.1 Record Auth Methods
- [x] Task 1.1.1: 增强实现
- [x] Task 1.1.2: 测试覆盖
- [x] Task 1.1.3: 对齐验证
- [x] 标记完成：2026-03-24
```

---

**预计完成时间**: 2-3 小时  
**下一个任务**: Task 1.2 - Record Auth Password (需补充)  

现在开始！👉 `cd pocketless && cat src/apis/record_auth_methods.ts`
