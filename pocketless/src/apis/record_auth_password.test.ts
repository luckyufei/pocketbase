/**
 * Auth-with-password 端点测试 — 对照 Go 版 apis/record_auth_with_password_test.go
 * TDD RED phase
 *
 * 测试使用 Hono 的 app.request() 进行无服务器 HTTP 测试
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Hono } from "hono";
import { CollectionModel, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_BASE } from "../core/collection_model";
import { RecordModel } from "../core/record_model";
import type { BaseApp } from "../core/base";
import { registerRecordAuthRoutes } from "./record_auth_password";
import { toApiError } from "./errors";
import { decodeToken } from "../tools/security/jwt";

// ─── Mock BaseApp ───

function createMockApp(options?: {
  collections?: CollectionModel[];
  records?: RecordModel[];
  passwordAuthEnabled?: boolean;
}): BaseApp {
  const collections = options?.collections ?? [];
  const records = options?.records ?? [];

  return {
    findCollectionByNameOrId(nameOrId: string) {
      return Promise.resolve(
        collections.find((c) => c.id === nameOrId || c.name === nameOrId) ?? null,
      );
    },
    findAuthRecordByEmail(collectionNameOrId: string, email: string) {
      const col = collections.find(
        (c) => c.id === collectionNameOrId || c.name === collectionNameOrId,
      );
      if (!col) return Promise.resolve(null);
      return Promise.resolve(
        records.find(
          (r) => r.collectionId === col.id && r.getEmail() === email,
        ) ?? null,
      );
    },
    findRecordByIdentityField(
      collection: CollectionModel,
      field: string,
      value: unknown,
    ) {
      return Promise.resolve(
        records.find(
          (r) =>
            r.collectionId === collection.id &&
            r.get(field) === value,
        ) ?? null,
      );
    },
  } as unknown as BaseApp;
}

/** 创建带 PasswordAuth 配置的 Auth 集合 */
function createTestAuthCollection(overrides?: {
  enabled?: boolean;
  identityFields?: string[];
}): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_users_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    passwordAuth: {
      enabled: overrides?.enabled ?? true,
      identityFields: overrides?.identityFields ?? ["email"],
    },
    authToken: {
      secret: "a".repeat(50),
      duration: 604800,
    },
    verificationToken: { secret: "b".repeat(50), duration: 259200 },
    passwordResetToken: { secret: "c".repeat(50), duration: 1800 },
    emailChangeToken: { secret: "d".repeat(50), duration: 1800 },
    fileToken: { secret: "e".repeat(50), duration: 180 },
  };
  col.fields = [
    { id: "f1", name: "email", type: "email", required: true, options: {} },
    { id: "f2", name: "password", type: "password", required: true, options: {} },
    { id: "f3", name: "tokenKey", type: "text", required: false, options: {} },
    { id: "f4", name: "username", type: "text", required: false, options: {} },
    { id: "f5", name: "emailVisibility", type: "bool", required: false, options: {} },
    { id: "f6", name: "verified", type: "bool", required: false, options: {} },
  ];
  return col;
}

/** 创建测试用户 Record（带已哈希密码） */
async function createTestUserRecord(
  collection: CollectionModel,
  data?: {
    email?: string;
    password?: string;
    tokenKey?: string;
    username?: string;
    verified?: boolean;
  },
): Promise<RecordModel> {
  const { hashPassword } = await import("../tools/security/password");

  const record = new RecordModel(collection);
  record.id = "rec_user_" + Math.random().toString(36).slice(2, 8);
  record.set("email", data?.email ?? "test@example.com");
  record.set("tokenKey", data?.tokenKey ?? "testTokenKey123");
  record.set("username", data?.username ?? "testuser");
  record.set("verified", data?.verified ?? true);
  record.set("emailVisibility", true);

  // 哈希密码
  const hash = await hashPassword(data?.password ?? "Test123456");
  record.set("password", hash);

  return record;
}

function createApp(baseApp: BaseApp): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerRecordAuthRoutes(app, baseApp);
  return app;
}

// ─── 基础验证测试（对照 Go TestRecordAuthWithPassword） ───

describe("POST /api/collections/:collection/auth-with-password", () => {
  // 非 auth 集合应返回 404
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.id = "col_base";
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;

    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/demo1/auth-with-password",
      { method: "POST", body: JSON.stringify({ identity: "a", password: "b" }), headers: { "Content-Type": "application/json" } },
    );
    expect(res.status).toBe(404);
  });

  // 不存在的集合 → 404
  test("missing collection → 404", async () => {
    const baseApp = createMockApp({ collections: [] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/nonexistent/auth-with-password",
      { method: "POST", body: JSON.stringify({ identity: "a", password: "b" }), headers: { "Content-Type": "application/json" } },
    );
    expect(res.status).toBe(404);
  });

  // 密码认证被禁用 → 403
  test("disabled password auth → 403", async () => {
    const col = createTestAuthCollection({ enabled: false });
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      { method: "POST", body: JSON.stringify({ identity: "test@example.com", password: "Test123456" }), headers: { "Content-Type": "application/json" } },
    );
    expect(res.status).toBe(403);
  });

  // 空 body → 400（验证错误）
  test("empty body → 400", async () => {
    const col = createTestAuthCollection();
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } },
    );
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.data).toBeDefined();
  });

  // 有效 identity + 错误密码 → 400
  test("valid identity + invalid password → 400", async () => {
    const col = createTestAuthCollection();
    const user = await createTestUserRecord(col);
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test@example.com", password: "wrongpassword" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain("Failed to authenticate");
  });

  // 有效 email + 有效密码 → 200
  test("valid email + valid password → 200 with token", async () => {
    const col = createTestAuthCollection();
    const user = await createTestUserRecord(col, { email: "test@example.com", password: "Test123456" });
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test@example.com", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.record).toBeDefined();

    // 验证 token claims
    const claims = decodeToken(body.token as string);
    expect(claims.type).toBe("auth");
    expect(claims.id).toBe(user.id);
    expect(claims.collectionId).toBe(col.id);
    expect(claims.refreshable).toBe(true);
  });

  // 有效 email + 有效密码 → record 不包含 password 和 tokenKey
  test("response record should not contain password or tokenKey", async () => {
    const col = createTestAuthCollection();
    const user = await createTestUserRecord(col);
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test@example.com", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    const record = body.record as Record<string, unknown>;
    expect(record.password).toBeUndefined();
    expect(record.tokenKey).toBeUndefined();
  });

  // 不存在的用户 → 400
  test("non-existing user → 400", async () => {
    const col = createTestAuthCollection();
    const baseApp = createMockApp({ collections: [col], records: [] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "nonexist@example.com", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(400);
  });

  // identity 过长 → 400
  test("identity too long → 400", async () => {
    const col = createTestAuthCollection();
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "a".repeat(256), password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(400);
  });
});

// ─── IdentityField 显式指定测试 ───

describe("auth-with-password identityField", () => {
  test("valid username identityField → 200", async () => {
    const col = createTestAuthCollection({ identityFields: ["email", "username"] });
    const user = await createTestUserRecord(col, { username: "myuser", email: "test@example.com" });
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "myuser", password: "Test123456", identityField: "username" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(200);
  });

  test("unknown identityField → 400", async () => {
    const col = createTestAuthCollection({ identityFields: ["email"] });
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test", password: "Test123456", identityField: "unknownField" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(400);
  });

  test("mismatched identityField (username field but email value) → 400", async () => {
    const col = createTestAuthCollection({ identityFields: ["email", "username"] });
    const user = await createTestUserRecord(col, { email: "test@example.com", username: "myuser" });
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test@example.com", password: "Test123456", identityField: "username" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(400);
  });
});

// ─── 多 identityField 自动检测测试 ───

describe("auth-with-password auto identity field detection", () => {
  test("email-like identity should try email field first", async () => {
    const col = createTestAuthCollection({ identityFields: ["username", "email"] });
    const user = await createTestUserRecord(col, { email: "test@example.com", username: "testuser" });
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test@example.com", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(200);
  });

  test("non-email identity should try other fields", async () => {
    const col = createTestAuthCollection({ identityFields: ["email", "username"] });
    const user = await createTestUserRecord(col, { email: "test@example.com", username: "myuser" });
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "myuser", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(200);
  });

  // 当 identity 不是邮箱格式时，应跳过 email 字段
  test("non-email identity should skip email field lookup", async () => {
    const col = createTestAuthCollection({ identityFields: ["email", "username"] });
    // 没有匹配 username 的用户
    const baseApp = createMockApp({ collections: [col], records: [] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "someuser", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(400);
  });
});

// ─── Auth Response 格式测试 ───

describe("auth response format", () => {
  test("response should match Go version format", async () => {
    const col = createTestAuthCollection();
    const user = await createTestUserRecord(col);
    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({ identity: "test@example.com", password: "Test123456" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;

    // Go 版响应结构：{ token, record }
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("record");

    const record = body.record as Record<string, unknown>;
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("collectionId");
    expect(record).toHaveProperty("collectionName");
    expect(record).toHaveProperty("email");
    expect(record).toHaveProperty("created");
    expect(record).toHaveProperty("updated");
  });
});
