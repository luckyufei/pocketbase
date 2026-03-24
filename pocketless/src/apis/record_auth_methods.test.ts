/**
 * Auth Methods 端点测试
 * GET /api/collections/:col/auth-methods
 * 对照 Go 版 apis/record_auth_methods_test.go (TestRecordAuthMethodsList)
 */

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import {
  CollectionModel,
  COLLECTION_TYPE_AUTH,
  COLLECTION_TYPE_BASE,
} from "../core/collection_model";
import type { BaseApp } from "../core/base";
import { registerAuthMethodsRoutes } from "./record_auth_methods";
import { toApiError } from "./errors";

// ─── Test Helpers ───

function createAuthCollection(opts?: Partial<Record<string, unknown>>): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_am_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    passwordAuth: { enabled: true, identityFields: ["email", "username"] },
    oauth2: {
      enabled: true,
      providers: [
        { name: "google", clientId: "gid", clientSecret: "gsecret" },
        { name: "github", clientId: "ghid", clientSecret: "ghsecret" },
      ],
    },
    mfa: { enabled: true, duration: 1800 },
    otp: { enabled: true, duration: 300 },
    ...opts,
  };
  col.fields = [];
  return col;
}

/** Go 版 "nologin" 集合：所有认证方式禁用 */
function createNoLoginCollection(): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_nologin";
  col.name = "nologin";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    passwordAuth: { enabled: false, identityFields: [] },
    oauth2: { enabled: false, providers: [] },
    mfa: { enabled: false, duration: 0 },
    otp: { enabled: false, duration: 0 },
  };
  col.fields = [];
  return col;
}

function createMockApp(collections: CollectionModel[]): BaseApp {
  return {
    findCollectionByNameOrId(nameOrId: string) {
      return Promise.resolve(
        collections.find((c) => c.id === nameOrId || c.name === nameOrId) ?? null,
      );
    },
  } as unknown as BaseApp;
}

function createApp(baseApp: BaseApp): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerAuthMethodsRoutes(app, baseApp);
  return app;
}

// ─── 错误格式辅助 ───

interface ApiErrorBody {
  code: number;
  message: string;
  data: Record<string, unknown>;
}

// ─── Tests ───

describe("GET /api/collections/:collection/auth-methods", () => {

  // ─── Go 场景 1: missing collection ───
  test("missing collection → 404 with data:{}", async () => {
    const app = createApp(createMockApp([]));

    const res = await app.request("/api/collections/missing/auth-methods");
    expect(res.status).toBe(404);

    const body = await res.json() as ApiErrorBody;
    expect(body.data).toEqual({});
  });

  // ─── Go 场景 2: non auth collection ───
  test("non-auth collection → 404 with data:{}", async () => {
    const col = new CollectionModel();
    col.id = "col_demo1";
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/demo1/auth-methods");
    expect(res.status).toBe(404);

    const body = await res.json() as ApiErrorBody;
    expect(body.data).toEqual({});
  });

  // ─── Go 场景 3: auth collection with none auth methods allowed ───
  test("auth collection with none auth methods → disabled flags + empty providers", async () => {
    const col = createNoLoginCollection();
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/nologin/auth-methods");
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;

    // 与 Go 版 ExpectedContent 对齐:
    // "password":{"identityFields":[],"enabled":false}
    const pw = body.password as Record<string, unknown>;
    expect(pw.identityFields).toEqual([]);
    expect(pw.enabled).toBe(false);

    // "oauth2":{"providers":[],"enabled":false}
    const oauth2 = body.oauth2 as Record<string, unknown>;
    expect(oauth2.providers).toEqual([]);
    expect(oauth2.enabled).toBe(false);

    // "mfa":{"enabled":false,"duration":0}
    const mfa = body.mfa as Record<string, unknown>;
    expect(mfa.enabled).toBe(false);
    expect(mfa.duration).toBe(0);

    // "otp":{"enabled":false,"duration":0}
    const otp = body.otp as Record<string, unknown>;
    expect(otp.enabled).toBe(false);
    expect(otp.duration).toBe(0);
  });

  // ─── Go 场景 4: auth collection with all auth methods allowed ───
  test("auth collection with all auth methods → full config with OAuth2 details", async () => {
    const col = createAuthCollection();
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;

    // 与 Go 版 ExpectedContent 对齐:
    // "password":{"identityFields":["email","username"],"enabled":true}
    const pw = body.password as Record<string, unknown>;
    expect(pw.identityFields).toEqual(["email", "username"]);
    expect(pw.enabled).toBe(true);

    // "mfa":{"enabled":true,"duration":1800}
    const mfa = body.mfa as Record<string, unknown>;
    expect(mfa.enabled).toBe(true);
    expect(mfa.duration).toBe(1800);

    // "otp":{"enabled":true,"duration":300}
    const otp = body.otp as Record<string, unknown>;
    expect(otp.enabled).toBe(true);
    expect(otp.duration).toBe(300);

    // oauth2 providers 存在
    const oauth2 = body.oauth2 as Record<string, unknown>;
    expect(oauth2.enabled).toBe(true);
    const providers = oauth2.providers as Array<Record<string, unknown>>;
    expect(providers.length).toBe(2);
    expect(providers[0].name).toBe("google");
    expect(providers[1].name).toBe("github");

    // 每个 provider 必须包含 Go 版 ExpectedContent 的所有字段:
    // "state":, "displayName":, "codeVerifier":, "codeChallenge":, "codeChallengeMethod":, "authURL":
    for (const p of providers) {
      expect(typeof p.state).toBe("string");
      expect((p.state as string).length).toBeGreaterThan(0);

      expect(typeof p.displayName).toBe("string");
      expect((p.displayName as string).length).toBeGreaterThan(0);

      // authURL 和遗留的 authUrl 都必须存在
      expect(typeof p.authURL).toBe("string");
      expect(typeof p.authUrl).toBe("string");

      // authURL 末尾必须是 &redirect_uri= 或包含 redirect_uri=（Go 版行为）
      expect(p.authURL as string).toContain("redirect_uri=");

      // codeVerifier, codeChallenge, codeChallengeMethod 必须存在（支持 PKCE 的 provider）
      // google 支持 PKCE，github 不支持：但 Go 版始终返回这些字段（不支持时为空字符串）
      expect(typeof p.codeVerifier).toBe("string");
      expect(typeof p.codeChallenge).toBe("string");
      expect(typeof p.codeChallengeMethod).toBe("string");
    }

    // google 支持 PKCE，必须有非空的 codeVerifier/codeChallenge
    const googleProvider = providers[0];
    expect((googleProvider.codeVerifier as string).length).toBeGreaterThan(0);
    expect((googleProvider.codeChallenge as string).length).toBeGreaterThan(0);
    expect(googleProvider.codeChallengeMethod).toBe("S256");

    // github 不支持 PKCE，codeVerifier/codeChallenge 应为空字符串
    const githubProvider = providers[1];
    expect(githubProvider.codeVerifier).toBe("");
    expect(githubProvider.codeChallenge).toBe("");
    expect(githubProvider.codeChallengeMethod).toBe("");
  });

  // ─── 新增: OAuth2 state 唯一性 ───
  test("each request generates unique OAuth2 state", async () => {
    const col = createAuthCollection();
    const mockApp = createMockApp([col]);
    const app = createApp(mockApp);

    const states: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/api/collections/users/auth-methods");
      const body = await res.json() as Record<string, unknown>;
      const oauth2 = body.oauth2 as Record<string, unknown>;
      const providers = oauth2.providers as Array<Record<string, unknown>>;
      states.push(providers[0].state as string);
    }

    // 所有 state 都必须不同（随机性验证）
    const uniqueStates = new Set(states);
    expect(uniqueStates.size).toBe(5);

    // state 长度应为 30（与 Go 版 security.RandomString(30) 对齐）
    for (const s of states) {
      expect(s.length).toBe(30);
    }
  });

  // ─── 新增: 遗留字段对齐 (v0.22 兼容) ───
  test("legacy fields are present and correct", async () => {
    const col = createAuthCollection();
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    const body = await res.json() as Record<string, unknown>;

    // authProviders 应与 oauth2.providers 相同（Go 版 fillLegacyFields）
    const oauth2Providers = (body.oauth2 as Record<string, unknown>).providers;
    expect(body.authProviders).toEqual(oauth2Providers);

    // emailPassword: password.enabled && identityFields 包含 "email"
    expect(body.emailPassword).toBe(true);

    // usernamePassword: password.enabled && identityFields 包含 "username"
    expect(body.usernamePassword).toBe(true);
  });

  test("legacy fields correct when oauth2 disabled", async () => {
    const col = createAuthCollection({
      oauth2: { enabled: false, providers: [] },
    });
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    const body = await res.json() as Record<string, unknown>;

    // oauth2 禁用时 authProviders 应为空数组（Go 版 fillLegacyFields）
    expect(body.authProviders).toEqual([]);
  });

  test("legacy emailPassword/usernamePassword reflect identityFields", async () => {
    // 只有 email 的情况
    const col = createAuthCollection({
      passwordAuth: { enabled: true, identityFields: ["email"] },
      oauth2: { enabled: false, providers: [] },
    });
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    const body = await res.json() as Record<string, unknown>;

    expect(body.emailPassword).toBe(true);
    expect(body.usernamePassword).toBe(false);
  });

  // ─── 新增: 未注册 provider 被跳过 ───
  test("unknown OAuth2 provider is skipped gracefully", async () => {
    const col = createAuthCollection({
      oauth2: {
        enabled: true,
        providers: [
          { name: "google", clientId: "gid", clientSecret: "gsecret" },
          { name: "unknown_provider_xyz", clientId: "uid", clientSecret: "usecret" },
        ],
      },
    });
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    const oauth2 = body.oauth2 as Record<string, unknown>;
    const providers = oauth2.providers as Array<Record<string, unknown>>;

    // 只有 google 被包含，unknown_provider_xyz 被跳过
    expect(providers.length).toBe(1);
    expect(providers[0].name).toBe("google");
  });

  // ─── 新增: 响应格式验证 ───
  test("response has correct Content-Type", async () => {
    const col = createNoLoginCollection();
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/nologin/auth-methods");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("response structure contains all required top-level fields", async () => {
    const col = createNoLoginCollection();
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/nologin/auth-methods");
    const body = await res.json() as Record<string, unknown>;

    // 所有 Go 版顶层字段都必须存在
    expect(body).toHaveProperty("password");
    expect(body).toHaveProperty("oauth2");
    expect(body).toHaveProperty("mfa");
    expect(body).toHaveProperty("otp");
    // 遗留字段
    expect(body).toHaveProperty("authProviders");
    expect(body).toHaveProperty("emailPassword");
    expect(body).toHaveProperty("usernamePassword");
  });

  // ─── 原有测试（保留兼容）───
  test("all disabled → returns disabled flags", async () => {
    const col = createAuthCollection({
      passwordAuth: { enabled: false, identityFields: [] },
      oauth2: { enabled: false, providers: [] },
      mfa: { enabled: false, duration: 0 },
      otp: { enabled: false, duration: 0 },
    });
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect((body.password as Record<string, unknown>).enabled).toBe(false);
    expect((body.oauth2 as Record<string, unknown>).enabled).toBe(false);
    expect((body.mfa as Record<string, unknown>).enabled).toBe(false);
    expect((body.otp as Record<string, unknown>).enabled).toBe(false);
  });
});
