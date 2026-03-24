/**
 * Email Change 测试
 * 对照 Go 版 apis/record_auth_email_change_request_test.go + _confirm_test.go
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
import { registerEmailChangeRoutes } from "./record_auth_email_change";
import { toApiError } from "./errors";
import { hashPassword } from "../tools/security/password";
import { newEmailChangeToken } from "../core/tokens";

// ─── Mock ───

function createAuthCollection(): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_ec_123";
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

async function createTestUser(col: CollectionModel): Promise<RecordModel> {
  const record = new RecordModel(col);
  record.id = "rec_user_ec";
  record.set("email", "old@example.com");
  record.set("tokenKey", "testTokenKey123");
  record.set("verified", true);
  record.set("emailVisibility", true);
  record.set("password", await hashPassword("Test123456"));
  return record;
}

function createMockApp(
  collections: CollectionModel[],
  records: RecordModel[],
  authUser?: RecordModel | null,
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
    getAuthUser() {
      return authUser ?? null;
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
  registerEmailChangeRoutes(app, baseApp);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── request-email-change ───

describe("POST /api/collections/:collection/request-email-change", () => {
  test("not authenticated → 401", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], [], null);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "new@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(401);
  });

  test("not an auth collection → 401 (no auth context)", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const { app: mockApp } = createMockApp([col], [], null);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/demo1/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "new@example.com" }),
      headers: jsonHeaders,
    });
    // Go returns 401 since no auth token present
    expect(res.status).toBe(401);
  });

  test("auth user from different collection → 403", async () => {
    const col = createAuthCollection();

    // Create user from a different collection
    const otherCol = new CollectionModel();
    otherCol.id = "other_col_456";
    otherCol.name = "clients";
    otherCol.type = COLLECTION_TYPE_AUTH;
    otherCol.options = col.options;
    otherCol.fields = col.fields;

    const otherUser = new RecordModel(otherCol);
    otherUser.id = "rec_other_user";
    otherUser.set("email", "other@example.com");
    otherUser.set("tokenKey", "otherTokenKey");
    // collectionId is derived from _collection.id — already "other_col_456" ≠ col.id ("col_test_123")

    const { app: mockApp } = createMockApp([col, otherCol], [otherUser], otherUser);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "new@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(403);
  });

  test("invalid JSON body → 400", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user], user);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: `{"newEmail`,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("empty body → 400 with validation_required", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user], user);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: ``,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.newEmail as Record<string, string>)?.code).toBe("validation_required");
  });

  test("empty newEmail → 400", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user], user);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("same email as current → 400", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user], user);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "old@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("newEmail already taken → 400 with validation_invalid_new_email", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);

    // Create another user with the target email
    const otherUser = new RecordModel(col);
    otherUser.id = "rec_other";
    otherUser.set("email", "taken@example.com");
    otherUser.set("tokenKey", "otherKey");

    const { app: mockApp } = createMockApp([col], [user, otherUser], user);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "taken@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.newEmail as Record<string, string>)?.code).toBe("validation_invalid_new_email");
  });

  test("valid newEmail → 204", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user], user);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: "new@example.com" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);
  });
});

// ─── confirm-email-change ───

describe("POST /api/collections/:collection/confirm-email-change", () => {
  test("not an auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/demo1/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token: "any", password: "Test123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("empty body → 400 with token + password required", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: ``,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data?.token).toBeDefined();
    expect(data?.password).toBeDefined();
  });

  test("invalid JSON body → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: `{"token`,
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("empty token → 400", async () => {
    const col = createAuthCollection();
    const { app: mockApp } = createMockApp([col], []);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token: "", password: "Test123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("non-email-change token type → 400 with validation_invalid_token_payload", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);

    // Use a password-reset token (wrong type)
    const { newPasswordResetToken } = await import("../core/tokens");
    const wrongTypeToken = await newPasswordResetToken(user);

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token: wrongTypeToken, password: "Test123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.token as Record<string, string>)?.code).toBe("validation_invalid_token_payload");
  });

  test("valid token + correct password → 204, updates email", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp, savedRecords } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newEmailChangeToken(user, "new@example.com");

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token, password: "Test123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(204);

    expect(savedRecords.length).toBe(1);
    expect(savedRecords[0].getEmail()).toBe("new@example.com");
    expect(savedRecords[0].get("verified")).toBe(true);
  });

  test("valid token + wrong password → 400 with validation_invalid_password", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const { app: mockApp } = createMockApp([col], [user]);
    const app = createApp(mockApp);
    const token = await newEmailChangeToken(user, "new@example.com");

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token, password: "WrongPassword" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.password as Record<string, string>)?.code).toBe("validation_invalid_password");
  });

  test("token for different collection → 400 with validation_token_collection_mismatch", async () => {
    const col = createAuthCollection();

    // Token claims collectionId = "clients_col"
    const otherCol = new CollectionModel();
    otherCol.id = "clients_col";
    otherCol.name = "clients";
    otherCol.type = COLLECTION_TYPE_AUTH;
    otherCol.options = col.options;
    otherCol.fields = col.fields;

    const otherUser = new RecordModel(otherCol);
    otherUser.id = "rec_user_ec";
    otherUser.set("email", "old@example.com");
    otherUser.set("tokenKey", "testTokenKey123");
    otherUser.set("password", await hashPassword("Test123456"));

    const token = await newEmailChangeToken(otherUser, "new@example.com");

    // Request to "users" collection but token has collectionId="clients_col"
    const { app: mockApp } = createMockApp([col, otherCol], [otherUser]);
    const app = createApp(mockApp);

    const res = await app.request("/api/collections/users/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token, password: "Test123456" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect((data?.token as Record<string, string>)?.code).toBe("validation_token_collection_mismatch");
  });
});
