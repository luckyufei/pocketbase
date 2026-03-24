/**
 * Password Reset 测试
 * 对照 Go 版 apis/record_auth_password_reset_request.go + _confirm.go
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
import { registerPasswordResetRoutes } from "./record_auth_password_reset";
import { toApiError } from "./errors";
import { hashPassword, verifyPassword } from "../tools/security/password";
import { newPasswordResetToken } from "../core/tokens";

// ─── Mock ───

function createAuthCollection(passwordAuthEnabled = true): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_pr_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    passwordAuth: { enabled: passwordAuthEnabled, identityFields: ["email"] },
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

async function createTestUser(col: CollectionModel, verified = false): Promise<RecordModel> {
  const record = new RecordModel(col);
  record.id = "rec_user_pr";
  record.set("email", "test@example.com");
  record.set("tokenKey", "testTokenKey123");
  record.set("verified", verified);
  record.set("emailVisibility", true);
  record.set("password", await hashPassword("OldPassword123"));
  return record;
}

function createMockApp(
  collections: CollectionModel[],
  records: RecordModel[],
): { app: BaseApp; savedRecords: RecordModel[] } {
  const savedRecords: RecordModel[] = [];
  const app = {
    findCollectionByNameOrId(nameOrId: string) {
      return Promise.resolve(
        collections.find((c) => c.id === nameOrId || c.name === nameOrId) ?? null,
      );
    },
    findAuthRecordByEmail(_colId: string, email: string) {
      return Promise.resolve(records.find((r) => r.getEmail() === email) ?? null);
    },
    findRecordById(_collectionName: string, id: string) {
      return Promise.resolve(records.find((r) => r.id === id) ?? null);
    },
    save(record: RecordModel) {
      savedRecords.push(record);
      return Promise.resolve();
    },
  } as unknown as BaseApp;
  return { app, savedRecords };
}

function createApp(baseApp: BaseApp): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerPasswordResetRoutes(app, baseApp);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── request-password-reset ───

describe("POST /api/collections/:collection/request-password-reset", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/demo1/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("empty body (no email key) → 400 with validation_required", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: ``,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect((body.data as Record<string, unknown>)?.email).toBeDefined();
    expect(((body.data as Record<string, unknown>).email as Record<string, string>).code).toBe("validation_required");
  });

  test("invalid JSON body → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: `{"email`,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("empty email → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("password auth disabled → 400", async () => {
    const col = createAuthCollection(false); // disabled
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("non-existing email → 204 (anti-enumeration)", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
  });

  test("valid email → 204", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
  });
});

// ─── confirm-password-reset ───

describe("POST /api/collections/:collection/confirm-password-reset", () => {
  test("empty body → 400 with all three fields required", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: ``,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data?.token).toBeDefined();
    expect(data?.password).toBeDefined();
    expect(data?.passwordConfirm).toBeDefined();
  });

  test("invalid JSON body → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: `{"password`,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("empty token → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token: "", password: "New123456", passwordConfirm: "New123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("password too short (< 8 chars) → 400 with validation_length_out_of_range", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newPasswordResetToken(user);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "1234567", passwordConfirm: "1234567" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data?.password).toBeDefined();
  });

  test("password mismatch → 400 with validation_values_mismatch", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newPasswordResetToken(user);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "New123456", passwordConfirm: "Different" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.passwordConfirm as Record<string, string>)?.code).toBe("validation_values_mismatch");
  });

  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/demo1/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token: "any", password: "New123456!", passwordConfirm: "New123456!" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("token for wrong type (non-password-reset) → 400 with validation_invalid_token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // Use a verification token (wrong type) instead of password reset
    const { newVerificationToken } = await import("../core/tokens");
    const wrongTypeToken = await newVerificationToken(user);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token: wrongTypeToken, password: "New12345!", passwordConfirm: "New12345!" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.token as Record<string, string>)?.code).toBe("validation_invalid_token");
  });

  test("valid token + matching passwords → 204, updates password", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newPasswordResetToken(user);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "NewPassword789", passwordConfirm: "NewPassword789" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);

    // 应保存
    expect(savedRecords.length).toBe(1);
    // 密码应更新（是新的 bcrypt hash）
    const newHash = savedRecords[0].getPasswordHash();
    expect(newHash).toBeDefined();
    const ok = await verifyPassword("NewPassword789", newHash);
    expect(ok).toBe(true);
  });

  test("valid token + unverified user with matching email → auto-verified", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col, false); // verified=false
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newPasswordResetToken(user);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "NewPassword789", passwordConfirm: "NewPassword789" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
    // 应该自动验证（token email == record email）
    expect(savedRecords[0].get("verified")).toBe(true);
  });

  test("valid token + unverified user with different email → stays unverified", async () => {
    const col = createAuthCollection();
    // User starts with original email
    const user = await createTestUser(col, false);
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    // Token is generated with original email "test@example.com"
    const token = await newPasswordResetToken(user);
    // Now change the user's email so it won't match the token's email
    user.set("email", "changed@example.com");

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "NewPassword789", passwordConfirm: "NewPassword789" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
    // token email "test@example.com" != record email "changed@example.com" → stays unverified
    expect(savedRecords[0].get("verified")).toBe(false);
  });

  test("valid token + already verified user → stays verified after reset", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col, true); // already verified
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newPasswordResetToken(user);

    const res = await app.request("/api/collections/users/confirm-password-reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "NewPassword789", passwordConfirm: "NewPassword789" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
    // 已验证用户依然保持已验证
    expect(savedRecords[0].get("verified")).toBe(true);
  });
});
