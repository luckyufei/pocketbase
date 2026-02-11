/**
 * Auth Methods 端点测试
 * GET /api/collections/:col/auth-methods
 * 对照 Go 版 apis/record_auth_methods.go
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
    mfa: { enabled: false, duration: 1800 },
    otp: { enabled: true, duration: 300 },
    ...opts,
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

describe("GET /api/collections/:collection/auth-methods", () => {
  test("non-auth collection → 404", async () => {
    const col = new CollectionModel();
    col.name = "demo1";
    col.type = COLLECTION_TYPE_BASE;
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/demo1/auth-methods");
    expect(res.status).toBe(404);
  });

  test("returns full auth methods config", async () => {
    const col = createAuthCollection();
    const app = createApp(createMockApp([col]));

    const res = await app.request("/api/collections/users/auth-methods");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    // password
    const pw = body.password as Record<string, unknown>;
    expect(pw.enabled).toBe(true);
    expect(pw.identityFields).toEqual(["email", "username"]);

    // oauth2
    const oauth = body.oauth2 as Record<string, unknown>;
    expect(oauth.enabled).toBe(true);
    const providers = oauth.providers as Array<Record<string, unknown>>;
    expect(providers.length).toBe(2);
    expect(providers[0].name).toBe("google");
    expect(providers[1].name).toBe("github");

    // mfa
    const mfa = body.mfa as Record<string, unknown>;
    expect(mfa.enabled).toBe(false);
    expect(mfa.duration).toBe(1800);

    // otp
    const otp = body.otp as Record<string, unknown>;
    expect(otp.enabled).toBe(true);
    expect(otp.duration).toBe(300);
  });

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

    const body = (await res.json()) as Record<string, unknown>;
    expect((body.password as Record<string, unknown>).enabled).toBe(false);
    expect((body.oauth2 as Record<string, unknown>).enabled).toBe(false);
    expect((body.mfa as Record<string, unknown>).enabled).toBe(false);
    expect((body.otp as Record<string, unknown>).enabled).toBe(false);
  });
});
