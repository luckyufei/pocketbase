/**
 * Auth-with-OAuth2 端点测试 — 对照 Go 版 apis/record_auth_with_oauth2_test.go
 * 使用 mock provider 避免真实 HTTP 调用
 */

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { CollectionModel, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_BASE } from "../core/collection_model";
import { RecordModel } from "../core/record_model";
import type { BaseApp } from "../core/base";
import { registerRecordAuthOAuth2Routes } from "./record_auth_oauth2";
import { toApiError } from "./errors";
import { Providers } from "../tools/auth/base_provider";
import { BaseProvider, type AuthUser } from "../tools/auth/base_provider";

// ─── Mock Provider ───

class MockOAuth2Provider extends BaseProvider {
  private mockUser: AuthUser;

  constructor(user?: Partial<AuthUser>) {
    super();
    this.setDisplayName("Mock");
    this.setAuthURL("https://mock.example.com/auth");
    this.setTokenURL("https://mock.example.com/token");
    this.setUserInfoURL("https://mock.example.com/userinfo");
    this.mockUser = {
      id: user?.id ?? "oauth_user_123",
      name: user?.name ?? "OAuth User",
      username: user?.username ?? "oauthuser",
      email: user?.email ?? "oauth@example.com",
      avatarURL: user?.avatarURL ?? "",
      accessToken: user?.accessToken ?? "mock_access_token",
      refreshToken: "",
      rawUser: user?.rawUser ?? {},
    };
  }

  async fetchAuthUser(_token: unknown): Promise<AuthUser> {
    return this.mockUser;
  }
}

// 注册 mock provider
Providers.set("mock_test", () => new MockOAuth2Provider());

// ─── Mock BaseApp ───

function createMockApp(options?: {
  collections?: CollectionModel[];
  records?: RecordModel[];
  externalAuths?: Array<{ collectionRef: string; recordRef: string; provider: string; providerId: string }>;
}): BaseApp {
  const collections = options?.collections ?? [];
  const records = options?.records ?? [];
  const externalAuths = options?.externalAuths ?? [];

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
    findFirstExternalAuth(filter: { collectionRef: string; provider: string; providerId: string }) {
      return Promise.resolve(
        externalAuths.find(
          (ea) =>
            ea.collectionRef === filter.collectionRef &&
            ea.provider === filter.provider &&
            ea.providerId === filter.providerId,
        ) ?? null,
      );
    },
    findRecordById(collectionNameOrId: string, id: string) {
      const col = collections.find(
        (c) => c.id === collectionNameOrId || c.name === collectionNameOrId,
      );
      if (!col) return Promise.resolve(null);
      return Promise.resolve(records.find((r) => r.id === id) ?? null);
    },
    async save(_model: unknown) {},
    async saveExternalAuth(_data: unknown) {},
  } as unknown as BaseApp;
}

/** 创建带 OAuth2 配置的 Auth 集合 */
function createOAuth2Collection(overrides?: {
  oauth2Enabled?: boolean;
  providers?: Array<{ name: string; clientId: string; clientSecret: string }>;
}): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_oauth_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    oauth2: {
      enabled: overrides?.oauth2Enabled ?? true,
      providers: overrides?.providers ?? [
        { name: "mock_test", clientId: "test_client", clientSecret: "test_secret" },
      ],
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
    { id: "f4", name: "verified", type: "bool", required: false, options: {} },
  ];
  return col;
}

function createApp(baseApp: BaseApp): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerRecordAuthOAuth2Routes(app, baseApp);
  return app;
}

const endpoint = "/api/collections/users/auth-with-oauth2";
const jsonHeaders = { "Content-Type": "application/json" };

// ─── 测试 ───

describe("POST /api/collections/:collection/auth-with-oauth2", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.id = "col_base";
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;

    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint.replace("users", "demo1"), {
      method: "POST",
      body: JSON.stringify({ provider: "mock_test", code: "abc", redirectURL: "https://example.com/callback" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(404);
  });

  test("disabled OAuth2 → 403", async () => {
    const col = createOAuth2Collection({ oauth2Enabled: false });
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({ provider: "mock_test", code: "abc", redirectURL: "https://example.com/callback" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(403);
  });

  test("empty body → 400", async () => {
    const col = createOAuth2Collection();
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({}),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("unknown provider → 400", async () => {
    const col = createOAuth2Collection();
    const baseApp = createMockApp({ collections: [col] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({ provider: "nonexistent", code: "abc", redirectURL: "https://example.com/callback" }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(400);
  });

  test("valid provider + existing user by email → 200 with token", async () => {
    const col = createOAuth2Collection();
    const user = new RecordModel(col);
    user.id = "rec_user_oauth";
    user.set("email", "oauth@example.com");
    user.set("tokenKey", "testTokenKey123");
    user.set("verified", true);
    user.set("emailVisibility", true);

    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({
        provider: "mock_test",
        code: "valid_code",
        redirectURL: "https://example.com/callback",
      }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toBeDefined();
    expect(body.record).toBeDefined();
    expect(body.meta).toBeDefined();

    const meta = body.meta as Record<string, unknown>;
    expect(meta.id).toBe("oauth_user_123");
    expect(meta.email).toBe("oauth@example.com");
  });

  test("valid provider + existing external auth → 200", async () => {
    const col = createOAuth2Collection();
    const user = new RecordModel(col);
    user.id = "rec_user_linked";
    user.set("email", "linked@example.com");
    user.set("tokenKey", "testTokenKey456");
    user.set("verified", true);
    user.set("emailVisibility", true);

    const baseApp = createMockApp({
      collections: [col],
      records: [user],
      externalAuths: [
        { collectionRef: col.id, recordRef: user.id, provider: "mock_test", providerId: "oauth_user_123" },
      ],
    });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({
        provider: "mock_test",
        code: "valid_code",
        redirectURL: "https://example.com/callback",
      }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toBeDefined();
    const record = body.record as Record<string, unknown>;
    expect(record.id).toBe("rec_user_linked");
  });

  test("new user (no existing record or external auth) → 200 with isNew", async () => {
    const col = createOAuth2Collection();
    // 没有任何已有记录
    const baseApp = createMockApp({ collections: [col], records: [] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({
        provider: "mock_test",
        code: "valid_code",
        redirectURL: "https://example.com/callback",
      }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toBeDefined();
    const meta = body.meta as Record<string, unknown>;
    expect(meta.isNew).toBe(true);
  });

  test("response should not contain password or tokenKey", async () => {
    const col = createOAuth2Collection();
    const user = new RecordModel(col);
    user.id = "rec_user_clean";
    user.set("email", "oauth@example.com");
    user.set("tokenKey", "secretTokenKey");
    user.set("password", "hashed_password");
    user.set("verified", true);
    user.set("emailVisibility", true);

    const baseApp = createMockApp({ collections: [col], records: [user] });
    const app = createApp(baseApp);

    const res = await app.request(endpoint, {
      method: "POST",
      body: JSON.stringify({
        provider: "mock_test",
        code: "valid_code",
        redirectURL: "https://example.com/callback",
      }),
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    const record = body.record as Record<string, unknown>;
    expect(record.password).toBeUndefined();
    expect(record.tokenKey).toBeUndefined();
  });
});
