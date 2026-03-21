/**
 * Impersonation 测试 — POST /api/collections/:col/impersonate/:id
 * 对照 Go 版 apis/record_auth_impersonate.go + record_auth_impersonate_test.go
 *
 * 仅 superuser 可调用，生成非刷新的 static auth token
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
import { registerImpersonateRoutes } from "./record_auth_impersonate";
import { toApiError } from "./errors";
import { hashPassword } from "../tools/security/password";

// ─── Mock ───

function createAuthCollection(): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_imp_123";
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
  record.id = "rec_target_user";
  record.set("email", "target@example.com");
  record.set("tokenKey", "targetTokenKey123");
  record.set("verified", true);
  record.set("emailVisibility", true);
  record.set("password", await hashPassword("Test123456"));
  return record;
}

function createMockApp(
  collections: CollectionModel[],
  records: RecordModel[],
  isSuperuser = false,
): BaseApp {
  return {
    findCollectionByNameOrId(nameOrId: string) {
      return Promise.resolve(
        collections.find((c) => c.id === nameOrId || c.name === nameOrId) ?? null,
      );
    },
    findRecordById(_collectionName: string, id: string) {
      return Promise.resolve(records.find((r) => r.id === id) ?? null);
    },
    isSuperuser() {
      return isSuperuser;
    },
  } as unknown as BaseApp;
}

function createApp(baseApp: BaseApp): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerImpersonateRoutes(app, baseApp);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── Tests ───

describe("POST /api/collections/:collection/impersonate/:id", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const app = createApp(createMockApp([col], [], true));

    const res = await app.request("/api/collections/demo1/impersonate/abc", {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("not superuser → 403", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const app = createApp(createMockApp([col], [user], false));

    const res = await app.request(
      `/api/collections/users/impersonate/${user.id}`,
      { method: "POST", headers: jsonHeaders },
    );
    expect(res.status).toBe(403);
  });

  test("record not found → 404", async () => {
    const col = createAuthCollection();
    const app = createApp(createMockApp([col], [], true));

    const res = await app.request(
      "/api/collections/users/impersonate/nonexistent",
      { method: "POST", headers: jsonHeaders },
    );
    expect(res.status).toBe(404);
  });

  test("superuser + valid record → 200 with token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const app = createApp(createMockApp([col], [user], true));

    const res = await app.request(
      `/api/collections/users/impersonate/${user.id}`,
      { method: "POST", headers: jsonHeaders },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.record).toBeDefined();

    // token 应是非刷新的
    const { decodeJwt } = await import("jose");
    const claims = decodeJwt(body.token as string);
    expect(claims.refreshable).toBe(false);
  });

  test("custom duration → token with custom exp", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const app = createApp(createMockApp([col], [user], true));

    const res = await app.request(
      `/api/collections/users/impersonate/${user.id}`,
      {
        method: "POST",
        body: JSON.stringify({ duration: 3600 }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const { decodeJwt } = await import("jose");
    const claims = decodeJwt(body.token as string);
    // exp - iat ≈ 3600
    const diff = (claims.exp as number) - (claims.iat as number);
    expect(diff).toBe(3600);
  });

  test("negative duration → 400", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const app = createApp(createMockApp([col], [user], true));

    const res = await app.request(
      `/api/collections/users/impersonate/${user.id}`,
      {
        method: "POST",
        body: JSON.stringify({ duration: -1 }),
        headers: jsonHeaders,
      },
    );
    expect(res.status).toBe(400);
  });

  test("response should exclude sensitive fields", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const app = createApp(createMockApp([col], [user], true));

    const res = await app.request(
      `/api/collections/users/impersonate/${user.id}`,
      { method: "POST", headers: jsonHeaders },
    );
    const body = (await res.json()) as Record<string, unknown>;
    const record = body.record as Record<string, unknown>;
    expect(record.tokenKey).toBeUndefined();
  });
});
