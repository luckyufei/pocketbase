# 测试对齐方法论

**目的**: 建立 PocketLess 与 PocketBase 单测对齐的标准化方法论  
**适用范围**: 本项目的所有测试对齐工作  
**最后更新**: 2026-03-24

---

## 1. 对齐过程（5 步法）

### Step 1: 分析 Go 版本测试文件

**耗时**: 15-20 分钟 / 文件

```bash
# 1.1 定位测试文件
find /Users/yufei/workspace/pocketbase-main -name "xxx_test.go" -path "*/apis/*"

# 1.2 分析文件内容
# - 阅读所有 test functions
# - 提取关键测试场景
# - 记录预期行为和断言
# - 识别 HTTP 端点、参数、响应格式
```

**输出**: "关键测试场景清单"

**示例**:
```
文件: record_auth_password_test.go
场景 1: POST /auth-with-password - 正确凭证 (200 + token)
场景 2: POST /auth-with-password - 错误密码 (400 + error)
场景 3: POST /auth-with-password - 启用 MFA (200 + mfaId)
场景 4: POST /auth-refresh - 有效 token (200 + new token)
场景 5: POST /auth-refresh - 过期 token (401)
...
```

### Step 2: 对比 PocketLess 现状

**耗时**: 10-15 分钟 / 文件

```bash
# 2.1 检查测试文件是否存在
ls -la pocketless/src/apis/*.test.ts | grep xxx

# 2.2 如果存在，分析现有测试
# - 运行测试查看输出
# - 对比测试场景覆盖率
# - 识别缺失的测试场景

bun test pocketless/src/apis/xxx.test.ts

# 2.3 分析代码质量
# - 是否遵循 Bun test API
# - 是否有足够的断言
# - 是否覆盖边界情况
```

**输出**: "对齐差异报告"

**示例**:
```
Existing Tests vs Go Version
✓ 正确凭证场景已覆盖
✗ 错误密码场景缺失
✓ MFA 场景已覆盖（部分）
✗ 密码重置场景完全缺失
✗ 邮箱变更场景完全缺失
---
覆盖率: 35% (2/6 场景)
```

### Step 3: 设计 Bun 测试实现

**耗时**: 20-30 分钟 / 模块

```typescript
// 3.1 理解 Bun Test API
// https://bun.sh/docs/test/writing

import { test, expect, describe, beforeAll, afterAll } from "bun:test";

// 3.2 编写测试框架
describe("Module Name", () => {
  // Setup
  beforeAll(async () => {
    // 初始化 app, db, test data
  });

  // Individual tests
  test("scenario description", async () => {
    // Arrange
    // Act
    // Assert
  });

  // Teardown
  afterAll(async () => {
    // Cleanup
  });
});
```

**关键注意事项**:

```typescript
// ✓ 正确方式：明确的断言
expect(response.status).toBe(200);
expect(response.json.token).toExist();
expect(response.json.record.id).toMatch(/^[a-z0-9]{15}$/);

// ✗ 错误方式：模糊的断言
expect(response).toExist();
expect(response.json).toExist();

// ✓ 正确方式：测试错误消息
expect(response.status).toBe(400);
expect(response.json.message).toContain("password");

// ✗ 错误方式：忽略错误细节
expect(response.status).not.toBe(200);
```

### Step 4: 实现与验证

**耗时**: 1-3 小时 / 模块

```bash
# 4.1 实现测试
# - 编写完整的测试用例
# - 确保每个测试场景都已覆盖
# - 添加边界情况测试

# 4.2 本地验证
bun test pocketless/src/apis/xxx.test.ts

# 4.3 与 Go 版本对比
# - 在 Go 版本运行对应测试
go test -v ./apis -run TestXxx

# 4.4 检查一致性
# - HTTP 状态码是否一致
# - 响应体结构是否一致
# - 错误消息是否一致
# - Token 格式是否一致
```

### Step 5: 文档与规范更新

**耗时**: 5-10 分钟 / 模块

```markdown
# 在规范文件中更新进度

- [ ] 测试文件存在
- [x] 所有场景已实现
- [x] 所有测试通过
- [x] 与 Go 版一致性验证通过
- [x] 代码审查完成
```

---

## 2. 测试对齐的关键检查点

### 2.1 HTTP 层一致性

```typescript
// ✓ 验证端点路径
expect(request.url).toBe("/api/collections/users/auth-with-password");

// ✓ 验证 HTTP 方法
expect(request.method).toBe("POST");

// ✓ 验证请求体格式
const body = {
  identity: "user@example.com",  // 可以是 email 或 username
  password: "password123"
};

// ✓ 验证响应状态码
// - 200 成功
// - 400 输入错误
// - 401 认证失败
// - 403 权限不足
// - 404 资源不存在
// - 429 限流
// - 500 服务器错误

// ✓ 验证响应头
expect(response.headers.get("content-type")).toContain("application/json");

// ✓ 验证 CORS 头
expect(response.headers.get("access-control-allow-origin")).toBe("*");
```

### 2.2 数据格式一致性

```typescript
// ✓ JWT Token 格式
const token = response.json.token;
expect(token).toMatch(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

// ✓ 解析 JWT Claims (不验证签名)
const parts = token.split(".");
const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

expect(payload.sub).toExist();      // 用户 ID
expect(payload.email).toExist();    // 邮箱
expect(payload.type).toBe("authToken");  // Token 类型
expect(payload.exp).toBeGreaterThan(Date.now() / 1000);  // 过期时间

// ✓ Record 格式
const record = response.json.record;
expect(record.id).toMatch(/^[a-z0-9]{15}$/);       // 15 字符 ID
expect(record.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);  // ISO 8601
expect(record.updated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
expect(record.email).toBe("user@example.com");
```

### 2.3 错误处理一致性

```typescript
// ✓ 错误响应格式 (PocketBase 标准)
const errorResponse = {
  code: 400,
  message: "Invalid request",
  data: {
    // 字段级错误 (可选)
    password: {
      code: "validation_required",
      message: "Password is required"
    }
  }
};

// ✓ 验证错误响应
expect(response.status).toBe(400);
expect(response.json.code).toBe(400);
expect(response.json.message).toExist();
expect(typeof response.json.data).toBe("object");

// ✓ 特定错误消息
// Go 版本已定义的错误消息应完全一致
expect(response.json.message).toContain("password");  // 不是 "Password"
```

### 2.4 业务逻辑一致性

```typescript
// ✓ 字段验证
// 如果 Go 版本要求 email 格式，Bun 版本也必须要求
test("invalid email format is rejected", async () => {
  const response = await app.request(new Request(
    "http://localhost:8090/api/collections/users/auth-with-password",
    {
      method: "POST",
      body: JSON.stringify({
        identity: "not-an-email",
        password: "password123"
      })
    }
  ));
  expect(response.status).toBe(400);
});

// ✓ 状态机一致性
// 如果密码重置需要 3 步，两个版本都必须是 3 步
test("password reset requires all 3 steps", async () => {
  // Step 1: Request reset
  // Step 2: Verify token
  // Step 3: Confirm new password
});

// ✓ 时间约束一致性
// Token 过期时间、邮件链接过期时间等必须一致
test("reset token expires after 30 minutes", async () => {
  // Go 版本：30 minutes
  // Bun 版本：30 minutes
});
```

### 2.5 边界情况一致性

```typescript
// ✓ SQL 注入防御
test("SQL injection attempt is blocked", async () => {
  const response = await app.request(new Request(
    "http://localhost:8090/api/collections/users/auth-with-password",
    {
      method: "POST",
      body: JSON.stringify({
        identity: "' OR '1'='1",
        password: "' OR '1'='1"
      })
    }
  ));
  expect(response.status).toBe(400);
});

// ✓ Unicode 处理
test("Unicode characters in email are handled correctly", async () => {
  // 中文、表情符号等
});

// ✓ 并发请求
test("concurrent identical requests are handled safely", async () => {
  const promises = Array(10).fill(null).map(() =>
    app.request(/* request */)
  );
  const results = await Promise.all(promises);
  // 验证只有一次成功
});

// ✓ 大小限制
test("extremely long password is rejected", async () => {
  const longPassword = "a".repeat(10000);
  expect(response.status).toBe(400);
});
```

---

## 3. 对齐验证工具

### 3.1 自动化对齐检查脚本

```bash
#!/bin/bash
# compare-tests.sh

# 比较 Go 版本和 Bun 版本的测试覆盖率

GO_TESTS=$(grep -r "^func Test" apis/record_auth_*.go | wc -l)
BUN_TESTS=$(grep -r "test(" pocketless/src/apis/record_auth*.test.ts | wc -l)

echo "Go version tests: $GO_TESTS"
echo "Bun version tests: $BUN_TESTS"
echo "Coverage: $(($BUN_TESTS * 100 / $GO_TESTS))%"

if [ $BUN_TESTS -lt $GO_TESTS ]; then
  echo "❌ Bun version is missing $((GO_TESTS - BUN_TESTS)) tests"
  exit 1
else
  echo "✅ All tests implemented"
fi
```

### 3.2 快速验证清单

```markdown
# Phase X 完成检查清单

## 文件创建
- [ ] 所有需要的 .test.ts 文件已创建
- [ ] 所有需要的 .ts 实现文件已创建

## 测试实现
- [ ] 所有关键场景都有测试
- [ ] 所有边界情况都有测试
- [ ] 所有错误路径都有测试

## 代码质量
- [ ] 没有 linting 错误
- [ ] 没有 TypeScript 错误
- [ ] 代码格式一致

## 功能验证
- [ ] 所有测试都通过
- [ ] 没有 flaky 测试
- [ ] 性能是可接受的

## 对齐验证
- [ ] HTTP 状态码与 Go 版一致
- [ ] 响应体格式与 Go 版一致
- [ ] 错误消息与 Go 版一致
- [ ] 业务逻辑与 Go 版一致

## 文档
- [ ] 规范文档已更新
- [ ] 关键决策已记录
- [ ] 发现的 Bug/差异已记录
```

---

## 4. 常见对齐问题与解决方案

### 问题 1: Token 格式不一致

**现象**: JWT token 格式不同

**诊断**:
```typescript
// Go 版本
const goToken = response.json.token;  // 包含 3 个 base64 字符串，用 . 分隔

// Bun 版本
const bunToken = response.json.token;  // 不同格式

// 对比
console.log("Go:", goToken);
console.log("Bun:", bunToken);
```

**解决方案**:
- 确保使用相同的 JWT 库（Go: `github.com/golang-jwt/jwt`, Bun: `jose`)
- 确保 Claims 结构相同
- 确保签名密钥相同
- 确保过期时间计算相同

### 问题 2: 时间戳格式不一致

**现象**: `created`, `updated` 时间戳格式不同

**诊断**:
```
Go: 2026-03-24T10:30:45.123Z
Bun: 2026-03-24T10:30:45.123456Z  // 微秒精度
Bun: 1711270245000                 // 毫秒时间戳
```

**解决方案**:
- 强制使用 ISO 8601 格式（秒级精度）
- 使用库函数标准化时间戳

### 问题 3: 字段验证规则不一致

**现象**: Go 版本拒绝的输入，Bun 版本接受了（反之亦然）

**诊断**:
```typescript
// Go 版本
POST /auth-with-password
{ identity: "", password: "test" }
-> 400 "identity is required"

// Bun 版本
POST /auth-with-password
{ identity: "", password: "test" }
-> 200 OK (错误！)
```

**解决方案**:
- 列出所有 Go 版本的字段验证规则
- 在 Bun 版本中逐一实现相同的规则
- 添加对应的测试用例

### 问题 4: 并发安全性

**现象**: Go 版本在并发情况下工作正常，Bun 版本失败

**诊断**:
```typescript
// 同时发送 10 个相同的请求
const promises = Array(10).fill(null).map(() =>
  sendAuthRequest()
);
const results = await Promise.all(promises);
// Go 版本：9 个 409/400，1 个 200
// Bun 版本：10 个 200（错误！）
```

**解决方案**:
- 使用适当的锁或事务确保并发安全
- 添加并发测试用例

---

## 5. 对齐完成标准

每个模块的对齐工作完成条件：

1. **测试覆盖率 ≥ 100%**
   - 所有 Go 版本的测试场景都在 Bun 版本中
   - 可能的补充测试（如 Bun 特有的边界情况）

2. **功能正确性 100%**
   - 所有测试都通过
   - 没有已知的 Bug 差异

3. **性能可接受**
   - 单个请求响应时间 < 100ms（不含 I/O）
   - 没有明显的性能退化

4. **文档完整**
   - 关键决策已记录
   - 发现的差异已记录
   - 规范已更新

---

**版本**: 1.0  
**最后更新**: 2026-03-24
