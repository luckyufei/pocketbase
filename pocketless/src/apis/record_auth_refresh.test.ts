/**
 * Auth Refresh 测试
 * 对照 Go 版 apis/record_auth_refresh.go
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
import { registerAuthRefreshRoutes } from "./record_auth_refresh";
import { toApiError } from "./errors";
import { hashPassword } from "../tools/security/password";
import { newAuthToken, newStaticAuthToken } from "../core/tokens";

// ─── Mock ───

function createAuthCollection(): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_ref_123";
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
  record.id = "rec_user_ref";
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
  authUser?: RecordModel | null,
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
    getAuthUser() {
      return authUser ?? null;
    },
  } as unknown as BaseApp;
}

function createApp(baseApp: BaseApp): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerAuthRefreshRoutes(app, baseApp);
  return app;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ─── Tests ───

describe("POST /api/collections/:collection/auth-refresh", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const app = createApp(createMockApp([col], []));

    const res = await app.request("/api/collections/demo1/auth-refresh", {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("not authenticated → 401", async () => {
    const col = createAuthCollection();
    const app = createApp(createMockApp([col], [], null));

    const res = await app.request("/api/collections/users/auth-refresh", {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(401);
  });

  test("refreshable token → 200 with new token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const originalToken = await newAuthToken(user);
    const app = createApp(createMockApp([col], [user], user));

    const res = await app.request("/api/collections/users/auth-refresh", {
      method: "POST",
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${originalToken}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.record).toBeDefined();

    // 验证返回的 token 是可刷新的
    const { decodeJwt } = await import("jose");
    const claims = decodeJwt(body.token as string);
    expect(claims.refreshable).toBe(true);
    expect(claims.type).toBe("auth");
  });

  test("non-refreshable (static) token → 200, reuses same token", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const staticToken = await newStaticAuthToken(user, 3600);
    const app = createApp(createMockApp([col], [user], user));

    const res = await app.request("/api/collections/users/auth-refresh", {
      method: "POST",
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${staticToken}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // 静态 token 应该被复用
    expect(body.token).toBe(staticToken);
  });

  test("response should exclude sensitive fields", async () => {
    const col = createAuthCollection();
    const user = await createTestUser(col);
    const token = await newAuthToken(user);
    const app = createApp(createMockApp([col], [user], user));

    const res = await app.request("/api/collections/users/auth-refresh", {
      method: "POST",
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    });
    const body = (await res.json()) as Record<string, unknown>;
    const record = body.record as Record<string, unknown>;
    expect(record.tokenKey).toBeUndefined();
  });
});
