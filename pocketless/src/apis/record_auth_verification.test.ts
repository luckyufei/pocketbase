/**
 * Email Verification 测试
 * 对照 Go 版 apis/record_auth_verification_request.go + _confirm.go
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
import { registerVerificationRoutes } from "./record_auth_verification";
import { toApiError } from "./errors";
import { hashPassword } from "../tools/security/password";
import { newVerificationToken, TOKEN_TYPE_PASSWORD_RESET } from "../core/tokens";
import { signToken, buildSigningKey } from "../tools/security/jwt";

// ─── Mock ───

function createAuthCollection(): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_ver_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
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
  record.id = "rec_user_ver";
  record.set("email", "test@example.com");
  record.set("tokenKey", "testTokenKey123");
  record.set("verified", verified);
  record.set("emailVisibility", true);
  record.set("password", await hashPassword("Test123456"));
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
  registerVerificationRoutes(app, baseApp);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── request-verification ───

describe("POST /api/collections/:collection/request-verification", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/demo1/request-verification", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("empty data → 400 with validation_required", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: JSON.stringify({}),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.email?.code).toBe("validation_required");
  });

  test("invalid JSON body → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: `{"invalid json`,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("empty email → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: JSON.stringify({ email: "" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("invalid email format → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: JSON.stringify({ email: "not-email" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("missing auth record → 204 (anti-enumeration, no email sent)", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
  });

  test("already verified auth record → 204 (no email sent)", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col, true); // 已验证
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
  });

  test("existing unverified auth record → 204 (email would be sent)", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col, false); // 未验证
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
  });
});

// ─── confirm-verification ───

describe("POST /api/collections/:collection/confirm-verification", () => {
  test("empty data → 400 with validation_required on token", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({}),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.token?.code).toBe("validation_required");
  });

  test("invalid JSON body → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: `{"invalid json`,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("empty token → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: "" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("expired token → 400 with validation_invalid_token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // 生成过期 token (exp in past)
    const expiredClaims = {
      type: "verification",
      id: user.id,
      collectionId: col.id,
      email: user.getEmail(),
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const tokenConfig = col.options.verificationToken as { secret: string };
    const signingKey = buildSigningKey(user.getTokenKey(), tokenConfig.secret);
    const expiredToken = await signToken(expiredClaims, signingKey, 0);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: expiredToken }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.token?.code).toBe("validation_invalid_token");
  });

  test("non-verification token type → 400 with validation_invalid_token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // 生成 password reset token 而不是 verification token
    const wrongClaims = {
      type: TOKEN_TYPE_PASSWORD_RESET,
      id: user.id,
      collectionId: col.id,
      email: user.getEmail(),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const tokenConfig = col.options.passwordResetToken as { secret: string };
    const signingKey = buildSigningKey(user.getTokenKey(), tokenConfig.secret);
    const wrongToken = await signToken(wrongClaims, signingKey, 0);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: wrongToken }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.token?.code).toBe("validation_invalid_token");
  });

  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/demo1/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: "any.jwt.token" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("token from different auth collection → 400 with validation_invalid_token (record not found)", async () => {
    const col = createAuthCollection();
    const col2 = new CollectionModel();
    col2.id = "col_other_456";
    col2.name = "clients";
    col2.type = COLLECTION_TYPE_AUTH;
    col2.options = col.options; // 共享 token config
    col2.fields = col.fields;

    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col, col2], [user]);
    const app = createApp(mockApp);

    // 生成针对 col2 但 id 指向 col user 的 token
    const wrongCollClaims = {
      type: "verification",
      id: user.id,
      collectionId: col2.id, // 不同的集合
      email: user.getEmail(),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const tokenConfig = col.options.verificationToken as { secret: string };
    const signingKey = buildSigningKey(user.getTokenKey(), tokenConfig.secret);
    const wrongCollToken = await signToken(wrongCollClaims, signingKey, 0);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: wrongCollToken }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.token?.code).toBe("validation_invalid_token");
  });

  test("valid token → 204, sets verified=true", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col, false); // 未验证
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // 生成有效的 verification token
    const token = await newVerificationToken(user);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);

    // 应调用 save
    expect(savedRecords.length).toBe(1);
    expect(savedRecords[0].get("verified")).toBe(true);
  });

  test("valid token (already verified) → 204, no update (already true)", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col, true); // 已验证
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // 生成有效的 verification token
    const token = await newVerificationToken(user);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);

    // 即使已验证，仍调用 save（设置 verified=true）
    expect(savedRecords.length).toBe(1);
  });

  test("invalid token signature → 400 with validation_invalid_token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // 生成使用错误的签名密钥的 token
    const badClaims = {
      type: "verification",
      id: user.id,
      collectionId: col.id,
      email: user.getEmail(),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const badSigningKey = buildSigningKey("wrongTokenKey", "wrongSecret");
    const badToken = await signToken(badClaims, badSigningKey, 0);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: badToken }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.token?.code).toBe("validation_invalid_token");
  });

  test("email mismatch in token → 400 with validation_invalid_token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // 生成带有不同 email 的 token
    const wrongEmailClaims = {
      type: "verification",
      id: user.id,
      collectionId: col.id,
      email: "different@example.com", // 与 record 不匹配
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const tokenConfig = col.options.verificationToken as { secret: string };
    const signingKey = buildSigningKey(user.getTokenKey(), tokenConfig.secret);
    const wrongEmailToken = await signToken(wrongEmailClaims, signingKey, 0);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: wrongEmailToken }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.data?.token?.code).toBe("validation_invalid_token");
  });
});
