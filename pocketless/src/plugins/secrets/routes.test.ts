/**
 * Secrets Routes 集成测试
 * 对照 Go 版 plugins/secrets/routes_test.go
 *
 * 覆盖 5 个端点：
 * - GET /api/secrets
 * - POST /api/secrets
 * - GET /api/secrets/:key
 * - PUT /api/secrets/:key
 * - DELETE /api/secrets/:key
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerSecretsRoutes } from "./routes";
import { DBSecretsStore, MustRegister, type SecretsConfig } from "./register";
import { SQLiteAdapter } from "../../core/db_adapter_sqlite";

// 测试辅助：创建内存数据库并初始化 _secrets 表
// 注意：表结构必须与 register.ts 中的 DBSecretsStore 实现一致
function createTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _secrets (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      env TEXT NOT NULL DEFAULT 'global',
      description TEXT,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
  `);
  return db;
}

// 测试辅助：创建 Superuser auth 中间件
function createSuperuserAuthMiddleware(): any {
  return async (c: any, next: any) => {
    c.set("auth", { id: "su_1", collectionName: "_superusers" });
    await next();
  };
}

// 测试辅助：创建普通用户 auth 中间件
function createRegularUserAuthMiddleware(): any {
  return async (c: any, next: any) => {
    c.set("auth", { id: "user_1", collectionName: "users" });
    await next();
  };
}

describe("Secrets Routes", () => {
  let hono: Hono;
  let store: DBSecretsStore;
  let db: SQLiteAdapter;

  beforeEach(() => {
    db = createTestDB();
    // masterKey 必须是 32 字节
    const config: SecretsConfig = { enabled: true, masterKey: "12345678901234567890123456789012" };
    store = MustRegister({}, config, db) as DBSecretsStore;
    hono = new Hono();
    // 使用通配符路径匹配所有 /api/secrets 及其子路径
    hono.use("/api/secrets/*", createSuperuserAuthMiddleware());
    registerSecretsRoutes(hono, store);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/secrets
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/secrets returns empty list", async () => {
    const res = await hono.request("/api/secrets");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test("GET /api/secrets returns secrets list (values are encrypted)", async () => {
    await store.set("API_KEY", "secret123", { env: "production" });
    await store.set("DB_PASSWORD", "dbpass456", { env: "production" });

    const res = await hono.request("/api/secrets");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    // 列表中 value 应该是加密的（显示为密文或隐藏）
    expect(body.items[0].value).not.toBe("secret123");
  });

  test("GET /api/secrets filters by env", async () => {
    await store.set("KEY1", "val1", { env: "dev" });
    await store.set("KEY2", "val2", { env: "prod" });

    const res = await hono.request("/api/secrets?env=dev");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].key).toBe("KEY1");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/secrets
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/secrets creates new secret", async () => {
    const res = await hono.request("/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "NEW_KEY", value: "new_value", env: "staging" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toBe("NEW_KEY");
    expect(body.env).toBe("staging");
    expect(body.message).toBe("Secret created successfully.");
  });

  test("POST /api/secrets with default env", async () => {
    const res = await hono.request("/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "DEFAULT_KEY", value: "value" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Route defaults to "global" not "default"
    expect(body.env).toBe("global");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/secrets/:key
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/secrets/:key returns decrypted value", async () => {
    await store.set("SECRET_KEY", "decrypted_value", { env: "test" });

    const res = await hono.request("/api/secrets/SECRET_KEY");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Route returns { key, value } only
    expect(body.key).toBe("SECRET_KEY");
    expect(body.value).toBe("decrypted_value"); // 明文返回
  });

  test("GET /api/secrets/:key with env fallback", async () => {
    await store.set("FALLBACK_KEY", "default_val", { env: "global" });

    const res = await hono.request("/api/secrets/FALLBACK_KEY?env=production");
    expect(res.status).toBe(200);
    const body = await res.json();
    // 应该回退到 global env
    expect(body.value).toBe("default_val");
  });

  test("GET /api/secrets/:key returns 404 for non-existent key", async () => {
    const res = await hono.request("/api/secrets/NON_EXISTENT");
    expect(res.status).toBe(404);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PUT /api/secrets/:key
  // ─────────────────────────────────────────────────────────────────────────

  test("PUT /api/secrets/:key updates existing secret", async () => {
    await store.set("UPDATE_KEY", "old_value");

    const res = await hono.request("/api/secrets/UPDATE_KEY", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "new_value", env: "prod" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("UPDATE_KEY");
    expect(body.message).toBe("Secret updated successfully.");
  });

  test("PUT /api/secrets/:key creates if not exists", async () => {
    const res = await hono.request("/api/secrets/NEW_UPDATE_KEY", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "created_value" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("NEW_UPDATE_KEY");
    expect(body.message).toBe("Secret updated successfully.");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/secrets/:key
  // ─────────────────────────────────────────────────────────────────────────

  test("DELETE /api/secrets/:key removes secret", async () => {
    await store.set("DELETE_KEY", "value");

    const res = await hono.request("/api/secrets/DELETE_KEY", { method: "DELETE" });
    expect(res.status).toBe(204);

    const getRes = await hono.request("/api/secrets/DELETE_KEY");
    expect(getRes.status).toBe(404);
  });

  test("DELETE /api/secrets/:key returns 204 for non-existent key", async () => {
    const res = await hono.request("/api/secrets/NON_EXISTENT", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 权限测试
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/secrets without auth returns 401", async () => {
    const app = new Hono();
    registerSecretsRoutes(app, store);

    const res = await app.request("/api/secrets");
    expect(res.status).toBe(401);
  });

  test("GET /api/secrets with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/secrets/*", createRegularUserAuthMiddleware());
    registerSecretsRoutes(app, store);

    const res = await app.request("/api/secrets");
    expect(res.status).toBe(403);
  });

  test("POST /api/secrets with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/secrets/*", createRegularUserAuthMiddleware());
    registerSecretsRoutes(app, store);

    const res = await app.request("/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test", value: "val" }),
    });
    expect(res.status).toBe(403);
  });
});
