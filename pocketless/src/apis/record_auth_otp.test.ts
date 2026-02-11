/**
 * OTP 流程测试 — request-otp + auth-with-otp
 * 对照 Go 版 apis/record_auth_otp_request.go + apis/record_auth_with_otp.go
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { CollectionModel, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_BASE } from "../core/collection_model";
import { RecordModel } from "../core/record_model";
import type { BaseApp } from "../core/base";
import { registerOTPRoutes, type OTPStore } from "./record_auth_otp";
import { toApiError } from "./errors";
import { hashPassword } from "../tools/security/password";

// ─── Mock ───

function createOTPCollection(otpEnabled = true): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_otp_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    otp: { enabled: otpEnabled, duration: 180, length: 8 },
    authToken: { secret: "a".repeat(50), duration: 604800 },
    verificationToken: { secret: "b".repeat(50), duration: 259200 },
    passwordResetToken: { secret: "c".repeat(50), duration: 1800 },
    emailChangeToken: { secret: "d".repeat(50), duration: 1800 },
    fileToken: { secret: "e".repeat(50), duration: 180 },
  };
  col.fields = [
    { id: "f1", name: "email", type: "email", required: true, options: {} },
    { id: "f2", name: "password", type: "password", required: true, options: {} },
    { id: "f3", name: "tokenKey", type: "text", required: false, options: {} },
    { id: "f4", name: "verified", type: "bool", required: false, options: {} },
    { id: "f5", name: "emailVisibility", type: "bool", required: false, options: {} },
  ];
  return col;
}

async function createTestUser(col: CollectionModel): Promise<RecordModel> {
  const record = new RecordModel(col);
  record.id = "rec_user_otp";
  record.set("email", "test@example.com");
  record.set("tokenKey", "testTokenKey123");
  record.set("verified", true);
  record.set("emailVisibility", true);
  record.set("password", await hashPassword("Test123456"));
  return record;
}

function createMockApp(collections: CollectionModel[], records: RecordModel[]): BaseApp {
  return {
    findCollectionByNameOrId(nameOrId: string) {
      return Promise.resolve(collections.find((c) => c.id === nameOrId || c.name === nameOrId) ?? null);
    },
    findAuthRecordByEmail(_colId: string, email: string) {
      return Promise.resolve(records.find((r) => r.getEmail() === email) ?? null);
    },
    findRecordById(_collectionName: string, id: string) {
      return Promise.resolve(records.find((r) => r.id === id) ?? null);
    },
  } as unknown as BaseApp;
}

function createApp(baseApp: BaseApp, otpStore?: OTPStore): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerOTPRoutes(app, baseApp, otpStore);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── request-otp 测试 ───

describe("POST /api/collections/:collection/request-otp", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/demo1/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("OTP disabled → 403", async () => {
    const col = createOTPCollection(false);
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(403);
  });

  test("empty email → 400", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("invalid email format → 400", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("non-existing email → 200 (enumeration protection)", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "nonexist@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.otpId).toBeDefined();
    expect(typeof body.otpId).toBe("string");
  });

  test("valid email → 200 with otpId", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const app = createApp(createMockApp([col], [user]));

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.otpId).toBeDefined();
    expect(typeof body.otpId).toBe("string");
    expect((body.otpId as string).length).toBeGreaterThan(0);
  });
});

// ─── auth-with-otp 测试 ───

describe("POST /api/collections/:collection/auth-with-otp", () => {
  test("OTP disabled → 403", async () => {
    const col = createOTPCollection(false);
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId: "some_id", password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(403);
  });

  test("empty otpId → 400", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId: "", password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("invalid/expired otpId → 400", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId: "nonexistent", password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("valid otpId + wrong password → 400", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    const app = createApp(createMockApp([col], [user]), store);

    // 先请求 OTP
    const reqRes = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    const { otpId } = await reqRes.json() as { otpId: string };

    // 用错误密码验证
    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: "wrongpassword" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("valid otpId + correct password → 200 with token", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    const app = createApp(createMockApp([col], [user]), store);

    // 先请求 OTP
    const reqRes = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    const { otpId } = await reqRes.json() as { otpId: string };

    // 从 store 获取 OTP 密码
    const otpEntry = store.get(otpId);
    expect(otpEntry).toBeDefined();

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: otpEntry!.password }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(body.record).toBeDefined();
  });

  test("OTP should be deleted after successful use", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    const app = createApp(createMockApp([col], [user]), store);

    // 请求 OTP
    const reqRes = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    const { otpId } = await reqRes.json() as { otpId: string };
    const otpEntry = store.get(otpId)!;

    // 使用 OTP
    await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: otpEntry.password }),
      headers: jsonHeaders,
    });

    // 验证 OTP 已删除
    expect(store.has(otpId)).toBe(false);

    // 再次使用应该失败
    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: otpEntry.password }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });
});
