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
import { newVerificationToken } from "../core/tokens";

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

  test("invalid email → 400", async () => {
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

  test("non-existing email → 204 (anti-enumeration)", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-verification", {
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

  test("invalid token → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-verification", {
      method: "POST",
      body: JSON.stringify({ token: "invalid.jwt.token" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
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
});
