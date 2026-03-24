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
import type { MFAStore } from "./record_auth_mfa";

// ─── Mock ───

function createOTPCollection(
  otpEnabled = true,
  mfaEnabled = true,
): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_otp_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    otp: { enabled: otpEnabled, duration: 180, length: 8 },
    mfa: { enabled: mfaEnabled, duration: 600 },
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

function createApp(baseApp: BaseApp, otpStore?: OTPStore, mfaStore?: MFAStore): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerOTPRoutes(app, baseApp, otpStore, mfaStore);
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

  test("multiple requests generate unique otpIds", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();
    const app = createApp(createMockApp([col], [user]), store);

    const otpIds = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/api/collections/users/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: jsonHeaders,
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { otpId: string };
      expect(body.otpId).toBeDefined();
      otpIds.add(body.otpId);
    }
    // All 5 should be unique
    expect(otpIds.size).toBe(5);
  });

  test("existing auth record with < 9 non-expired OTPs creates new", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    // Pre-populate store with 8 valid OTPs
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      const otpId = `otp_${i}`;
      store.set(otpId, {
        id: otpId,
        collectionRef: col.id,
        recordRef: user.id,
        password: "123456",
        sentTo: "test@example.com",
        createdAt: now - 100000,
        expiresAt: now + 100000,
      });
    }

    const app = createApp(createMockApp([col], [user]), store);

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { otpId: string };
    // Should be a new OTP (not one of the pre-populated ones)
    expect(!body.otpId.startsWith("otp_")).toBeTruthy();
  });

  test("existing auth record with >= 10 non-expired OTPs reuses oldest", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    // Pre-populate store with 10 valid OTPs
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const otpId = `otp_${i}`;
      store.set(otpId, {
        id: otpId,
        collectionRef: col.id,
        recordRef: user.id,
        password: "123456",
        sentTo: "test@example.com",
        createdAt: now - 100000,
        expiresAt: now + 100000,
      });
    }

    const app = createApp(createMockApp([col], [user]), store);

    const res = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { otpId: string };
    // Should reuse the last (otp_9)
    expect(body.otpId).toBe("otp_9");
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

  test("field length validation - otpId > 255 chars → 400", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({
        otpId: "a".repeat(256),
        password: "123456",
      }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("field length validation - password > 72 chars → 400", async () => {
    const col = createOTPCollection();
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({
        otpId: "test",
        password: "a".repeat(73),
      }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("OTP from different collection → 400", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    // Create OTP entry for a different collection
    const otpId = "different_col_otp";
    store.set(otpId, {
      id: otpId,
      collectionRef: "different_collection_id",
      recordRef: user.id,
      password: "123456",
      sentTo: "test@example.com",
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000000,
    });

    const app = createApp(createMockApp([col], [user]), store);

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("expired OTP → 400", async () => {
    const col = createOTPCollection();
    const user = await createTestUser(col);
    const store: OTPStore = new Map();

    // Create expired OTP
    const otpId = "expired_otp";
    store.set(otpId, {
      id: otpId,
      collectionRef: col.id,
      recordRef: user.id,
      password: "123456",
      sentTo: "test@example.com",
      createdAt: Date.now() - 1000000,
      expiresAt: Date.now() - 100000, // 已过期
    });

    const app = createApp(createMockApp([col], [user]), store);

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    // 已过期的 OTP 应该被删除
    expect(store.has(otpId)).toBe(false);
  });

  test("valid OTP + MFA enabled → 401 with mfaId", async () => {
    const col = createOTPCollection(true, true); // MFA enabled
    const user = await createTestUser(col);
    const store: OTPStore = new Map();
    const mfaStore: MFAStore = new Map();

    const app = createApp(createMockApp([col], [user]), store, mfaStore);

    // 请求 OTP
    const reqRes = await app.request("/api/collections/users/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    const { otpId } = await reqRes.json() as { otpId: string };
    const otpEntry = store.get(otpId)!;

    // 验证 OTP 时触发 MFA
    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: otpEntry.password }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.mfaId).toBeDefined();
    expect(typeof body.mfaId).toBe("string");
  });

  test("valid OTP + MFA disabled → 200 with token and record", async () => {
    const col = createOTPCollection(true, false); // MFA disabled
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

    // 验证 OTP
    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: otpEntry.password }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(body.record).toBeDefined();
    expect((body.record as Record<string, unknown>).email).toBe("test@example.com");

    // Hidden fields should not be exposed
    expect(body.record).not.toHaveProperty("password");
    expect(body.record).not.toHaveProperty("tokenKey");
  });

  test("OTP with empty sentTo + MFA disabled → user stays unverified", async () => {
    const col = createOTPCollection(true, false);
    const user = await createTestUser(col);
    user.set("verified", false); // Initially unverified
    const store: OTPStore = new Map();

    // Create OTP with empty sentTo
    const otpId = "otp_empty_sentto";
    store.set(otpId, {
      id: otpId,
      collectionRef: col.id,
      recordRef: user.id,
      password: "123456",
      sentTo: "", // Empty (not matching email)
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000000,
    });

    const app = createApp(createMockApp([col], [user]), store);

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);

    // User should remain unverified because sentTo != email
    expect(user.get("verified")).toBe(false);
  });

  test("OTP with sentTo = email + MFA disabled → user marked verified", async () => {
    const col = createOTPCollection(true, false);
    const user = await createTestUser(col);
    user.set("verified", false); // Initially unverified
    const store: OTPStore = new Map();

    // Create OTP with sentTo = email
    const otpId = "otp_matching_email";
    store.set(otpId, {
      id: otpId,
      collectionRef: col.id,
      recordRef: user.id,
      password: "123456",
      sentTo: "test@example.com", // Matches email
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000000,
    });

    const app = createApp(createMockApp([col], [user]), store);

    const res = await app.request("/api/collections/users/auth-with-otp", {
      method: "POST",
      body: JSON.stringify({ otpId, password: "123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);

    // User should now be verified because sentTo == email
    expect(user.get("verified")).toBe(true);
  });
});
