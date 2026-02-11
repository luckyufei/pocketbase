/**
 * MFA 流程测试 — 两阶段认证
 * 对照 Go 版 apis/record_helpers.go checkMFA() + apis/record_helpers_test.go
 *
 * MFA 设计：
 * 1. 第一次认证（无 mfaId）→ 201 MFA record → 401 + {mfaId}
 * 2. 第二次认证（带 mfaId）→ 验证方法不同 → 200 + {token, record}
 */

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import {
  CollectionModel,
  COLLECTION_TYPE_AUTH,
  COLLECTION_TYPE_BASE,
} from "../core/collection_model";
import { RecordModel } from "../core/record_model";
import type { BaseApp } from "../core/base";
import { registerRecordAuthRoutes } from "./record_auth_password";
import { registerOTPRoutes, type OTPStore } from "./record_auth_otp";
import {
  type MFAStore,
  MFA_METHOD_PASSWORD,
  MFA_METHOD_OTP,
} from "./record_auth_mfa";
import { toApiError } from "./errors";
import { hashPassword } from "../tools/security/password";

// ─── Mock 数据 ───

function createMFACollection(mfaEnabled = true, otpEnabled = true): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_mfa_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    mfa: { enabled: mfaEnabled, duration: 1800 },
    otp: { enabled: otpEnabled, duration: 180, length: 8 },
    passwordAuth: { enabled: true, identityFields: ["email"] },
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
  record.id = "rec_user_mfa";
  record.set("email", "test@example.com");
  record.set("tokenKey", "testTokenKey123");
  record.set("verified", true);
  record.set("emailVisibility", true);
  record.set("password", await hashPassword("Test123456"));
  return record;
}

function createMockApp(
  collections: CollectionModel[],
  records: RecordModel[],
): BaseApp {
  return {
    findCollectionByNameOrId(nameOrId: string) {
      return Promise.resolve(
        collections.find((c) => c.id === nameOrId || c.name === nameOrId) ??
          null,
      );
    },
    findAuthRecordByEmail(_colId: string, email: string) {
      return Promise.resolve(
        records.find((r) => r.getEmail() === email) ?? null,
      );
    },
    findRecordById(_collectionName: string, id: string) {
      return Promise.resolve(records.find((r) => r.id === id) ?? null);
    },
    findRecordByIdentityField(
      _col: CollectionModel,
      field: string,
      value: string,
    ) {
      return Promise.resolve(
        records.find((r) => r.get(field) === value) ?? null,
      );
    },
  } as unknown as BaseApp;
}

function createApp(
  baseApp: BaseApp,
  mfaStore: MFAStore,
  otpStore?: OTPStore,
): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  // 注册 password auth（注入 MFA store）
  registerRecordAuthRoutes(app, baseApp, mfaStore);
  // 注册 OTP auth（注入 MFA store + OTP store）
  registerOTPRoutes(app, baseApp, otpStore, mfaStore);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── Phase 1: 首次密码认证触发 MFA ───

describe("MFA Phase 1: password auth → 401 + mfaId", () => {
  test("MFA enabled, password auth → 401 with mfaId", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();

    const app = createApp(createMockApp([col], [user]), mfaStore);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({
          identity: "test@example.com",
          password: "Test123456",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.mfaId).toBeDefined();
    expect(typeof body.mfaId).toBe("string");
    expect((body.mfaId as string).length).toBeGreaterThan(0);

    // MFA record 应该已存储
    expect(mfaStore.size).toBe(1);
    const mfaEntry = mfaStore.get(body.mfaId as string);
    expect(mfaEntry).toBeDefined();
    expect(mfaEntry!.method).toBe(MFA_METHOD_PASSWORD);
    expect(mfaEntry!.recordRef).toBe("rec_user_mfa");
  });

  test("MFA disabled, password auth → 200 (normal auth)", async () => {
    const col = createMFACollection(false);
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();

    const app = createApp(createMockApp([col], [user]), mfaStore);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({
          identity: "test@example.com",
          password: "Test123456",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(body.record).toBeDefined();
    // 不应有 mfaId
    expect(body.mfaId).toBeUndefined();
  });

  test("invalid credentials, MFA enabled → 400 (before MFA check)", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();

    const app = createApp(createMockApp([col], [user]), mfaStore);

    const res = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({
          identity: "test@example.com",
          password: "WrongPassword",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(400);
    // MFA store 不应有任何记录
    expect(mfaStore.size).toBe(0);
  });
});

// ─── Phase 2: 第二次认证（不同方法）完成 MFA ───

describe("MFA Phase 2: second auth with different method → 200", () => {
  test("password → OTP (different method) → 200 with token", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();
    const otpStore: OTPStore = new Map();

    const app = createApp(createMockApp([col], [user]), mfaStore, otpStore);

    // Phase 1: 密码认证 → 401 + mfaId
    const res1 = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({
          identity: "test@example.com",
          password: "Test123456",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res1.status).toBe(401);
    const { mfaId } = (await res1.json()) as { mfaId: string };
    expect(mfaId).toBeDefined();

    // 请求 OTP
    const otpRes = await app.request(
      "/api/collections/users/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: jsonHeaders,
      },
    );
    expect(otpRes.status).toBe(200);
    const { otpId } = (await otpRes.json()) as { otpId: string };
    const otpEntry = otpStore.get(otpId)!;
    expect(otpEntry).toBeDefined();

    // Phase 2: OTP 认证 + mfaId → 200
    const res2 = await app.request(
      "/api/collections/users/auth-with-otp",
      {
        method: "POST",
        body: JSON.stringify({
          otpId,
          password: otpEntry.password,
          mfaId,
        }),
        headers: jsonHeaders,
      },
    );
    expect(res2.status).toBe(200);
    const body = (await res2.json()) as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(body.record).toBeDefined();

    // MFA record 应被删除
    expect(mfaStore.has(mfaId)).toBe(false);
  });

  test("same method twice → 400", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();

    const app = createApp(createMockApp([col], [user]), mfaStore);

    // Phase 1: 密码认证 → 401 + mfaId
    const res1 = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({
          identity: "test@example.com",
          password: "Test123456",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res1.status).toBe(401);
    const { mfaId } = (await res1.json()) as { mfaId: string };

    // Phase 2: 再次用密码认证 + mfaId → 400（方法相同）
    const res2 = await app.request(
      "/api/collections/users/auth-with-password",
      {
        method: "POST",
        body: JSON.stringify({
          identity: "test@example.com",
          password: "Test123456",
          mfaId,
        }),
        headers: jsonHeaders,
      },
    );
    expect(res2.status).toBe(400);
    const body = (await res2.json()) as Record<string, unknown>;
    expect(body.message).toContain("different");
  });

  test("expired mfaId → 400", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();

    // 手动创建一个已过期的 MFA record
    mfaStore.set("expired_mfa_id", {
      id: "expired_mfa_id",
      collectionRef: col.id,
      recordRef: user.id,
      method: MFA_METHOD_PASSWORD,
      createdAt: Date.now() - 3600_000, // 1小时前
      expiresAt: Date.now() - 1000,     // 已过期
    });

    const otpStore: OTPStore = new Map();
    const app = createApp(createMockApp([col], [user]), mfaStore, otpStore);

    // 请求 OTP
    const otpRes = await app.request(
      "/api/collections/users/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: jsonHeaders,
      },
    );
    const { otpId } = (await otpRes.json()) as { otpId: string };
    const otpEntry = otpStore.get(otpId)!;

    // 用过期的 mfaId 进行 OTP 认证 → 400
    const res = await app.request(
      "/api/collections/users/auth-with-otp",
      {
        method: "POST",
        body: JSON.stringify({
          otpId,
          password: otpEntry.password,
          mfaId: "expired_mfa_id",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(400);

    // 过期的 MFA 应被删除
    expect(mfaStore.has("expired_mfa_id")).toBe(false);
  });

  test("non-existent mfaId → 400", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();
    const otpStore: OTPStore = new Map();

    const app = createApp(createMockApp([col], [user]), mfaStore, otpStore);

    // 请求 OTP
    const otpRes = await app.request(
      "/api/collections/users/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: jsonHeaders,
      },
    );
    const { otpId } = (await otpRes.json()) as { otpId: string };
    const otpEntry = otpStore.get(otpId)!;

    // 用不存在的 mfaId → 400
    const res = await app.request(
      "/api/collections/users/auth-with-otp",
      {
        method: "POST",
        body: JSON.stringify({
          otpId,
          password: otpEntry.password,
          mfaId: "nonexistent_mfa_id",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(400);
  });

  test("mfaId for different record → 400", async () => {
    const col = createMFACollection();
    const user = await createTestUser(col);
    const mfaStore: MFAStore = new Map();

    // MFA record 关联的是另一个用户
    mfaStore.set("other_mfa_id", {
      id: "other_mfa_id",
      collectionRef: col.id,
      recordRef: "some_other_user_id",
      method: MFA_METHOD_PASSWORD,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1800_000,
    });

    const otpStore: OTPStore = new Map();
    const app = createApp(createMockApp([col], [user]), mfaStore, otpStore);

    // 请求 OTP
    const otpRes = await app.request(
      "/api/collections/users/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: jsonHeaders,
      },
    );
    const { otpId } = (await otpRes.json()) as { otpId: string };
    const otpEntry = otpStore.get(otpId)!;

    // 用另一个用户的 mfaId → 400
    const res = await app.request(
      "/api/collections/users/auth-with-otp",
      {
        method: "POST",
        body: JSON.stringify({
          otpId,
          password: otpEntry.password,
          mfaId: "other_mfa_id",
        }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(400);
  });
});
