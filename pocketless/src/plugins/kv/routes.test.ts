/**
 * KV Routes 集成测试
 * 对照 Go 版 plugins/kv/routes_test.go
 *
 * 覆盖 16 个端点：get/set/delete/exists/ttl/incr/decr/hset/hget/hgetall/hdel/mset/mget/lock/unlock/keys
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerKVRoutes } from "./routes";
import { MustRegister, type KVConfig } from "./register";
import { SQLiteAdapter } from "../../core/db_adapter_sqlite";

// 测试辅助：创建内存数据库并初始化 _kv 表
// 注意：表结构必须与 register.ts 中的 DBKVStore 实现一致
function createTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _kv (
      key TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value TEXT,
      expireAt TEXT,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _kv_hash (
      key TEXT NOT NULL,
      field TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (key, field)
    )
  `);
  return db;
}

// 测试辅助：创建认证用户中间件
function createAuthMiddleware(): any {
  return async (c: any, next: any) => {
    c.set("auth", { id: "user_1", collectionName: "users" });
    await next();
  };
}

describe("KV Routes", () => {
  let hono: Hono;
  let store: ReturnType<typeof MustRegister>;
  let db: SQLiteAdapter;

  beforeEach(() => {
    db = createTestDB();
    const config: KVConfig = { enabled: true };
    store = MustRegister({}, config, db);
    hono = new Hono();
    hono.use("/api/kv/*", createAuthMiddleware());
    registerKVRoutes(hono, store);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/kv/get
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/kv/get returns found=false for missing key", async () => {
    const res = await hono.request("/api/kv/get?key=nonexistent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.value).toBeNull();
  });

  test("GET /api/kv/get returns value for existing key", async () => {
    await store.set("mykey", "myvalue");

    const res = await hono.request("/api/kv/get?key=mykey");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.value).toBe("myvalue");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/kv/set
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/kv/set stores value", async () => {
    const res = await hono.request("/api/kv/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "testkey", value: "testvalue" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const value = await store.get("testkey");
    expect(value).toBe("testvalue");
  });

  test("POST /api/kv/set with TTL", async () => {
    const res = await hono.request("/api/kv/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ttlkey", value: "ttlvalue", ttl: 3600 }),
    });
    expect(res.status).toBe(200);

    const ttl = await store.ttl("ttlkey");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/kv/delete
  // ─────────────────────────────────────────────────────────────────────────

  test("DELETE /api/kv/delete removes key", async () => {
    await store.set("deletekey", "value");

    const res = await hono.request("/api/kv/delete?key=deletekey", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const exists = await store.exists("deletekey");
    expect(exists).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/kv/exists
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/kv/exists returns true for existing key", async () => {
    await store.set("existskey", "value");

    const res = await hono.request("/api/kv/exists?key=existskey");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
  });

  test("GET /api/kv/exists returns false for missing key", async () => {
    const res = await hono.request("/api/kv/exists?key=nonexistent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/kv/ttl
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/kv/ttl returns -1 for key without TTL", async () => {
    await store.set("nottlkey", "value");

    const res = await hono.request("/api/kv/ttl?key=nottlkey");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.ttl).toBe(-1);
  });

  test("GET /api/kv/ttl returns -2 for non-existent key", async () => {
    const res = await hono.request("/api/kv/ttl?key=nonexistent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.ttl).toBe(-2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/kv/incr & decr
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/kv/incr increments value", async () => {
    await store.set("counter", 10);

    const res = await hono.request("/api/kv/incr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "counter" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.value).toBe(11);
  });

  test("POST /api/kv/decr decrements value", async () => {
    await store.set("counter", 10);

    const res = await hono.request("/api/kv/decr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "counter" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.value).toBe(9);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Hash operations: hset, hget, hgetall, hdel
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/kv/hset and GET /api/kv/hget", async () => {
    const res = await hono.request("/api/kv/hset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "hashkey", field: "field1", value: "value1" }),
    });
    expect(res.status).toBe(200);

    const getRes = await hono.request("/api/kv/hget?key=hashkey&field=field1");
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.found).toBe(true);
    expect(body.value).toBe("value1");
  });

  test("GET /api/kv/hgetall returns all hash fields", async () => {
    await store.hset("hashkey2", "field1", "value1");
    await store.hset("hashkey2", "field2", "value2");

    const res = await hono.request("/api/kv/hgetall?key=hashkey2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.field1).toBe("value1");
    expect(body.field2).toBe("value2");
  });

  test("POST /api/kv/hdel removes hash field", async () => {
    await store.hset("hashkey3", "field1", "value1");

    const res = await hono.request("/api/kv/hdel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "hashkey3", field: "field1" }),
    });
    expect(res.status).toBe(200);

    const value = await store.hget("hashkey3", "field1");
    expect(value).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/kv/mset & mget
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/kv/mset stores multiple keys", async () => {
    const res = await hono.request("/api/kv/mset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs: { key1: "val1", key2: "val2", key3: "val3" } }),
    });
    expect(res.status).toBe(200);

    const val1 = await store.get("key1");
    const val2 = await store.get("key2");
    expect(val1).toBe("val1");
    expect(val2).toBe("val2");
  });

  test("POST /api/kv/mget retrieves multiple keys", async () => {
    await store.set("key1", "val1");
    await store.set("key2", "val2");

    const res = await hono.request("/api/kv/mget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: ["key1", "key2", "key3"] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // mget returns an array, not an object
    expect(body).toBeInstanceOf(Array);
    expect(body[0]).toBe("val1");
    expect(body[1]).toBe("val2");
    expect(body[2]).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/kv/lock & unlock
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/kv/lock acquires lock", async () => {
    const res = await hono.request("/api/kv/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "lockkey", ttl: 60 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locked).toBe(true);
  });

  test("POST /api/kv/lock returns false if already locked", async () => {
    await store.lock("lockkey2", 60);

    const res = await hono.request("/api/kv/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "lockkey2", ttl: 60 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locked).toBe(false);
  });

  test("POST /api/kv/unlock releases lock", async () => {
    await store.lock("lockkey3", 60);

    const res = await hono.request("/api/kv/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "lockkey3" }),
    });
    expect(res.status).toBe(200);

    // Can lock again after unlock
    const locked = await store.lock("lockkey3", 60);
    expect(locked).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/kv/keys
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/kv/keys returns matching keys", async () => {
    await store.set("user:123", "data1");
    await store.set("user:456", "data2");
    await store.set("order:789", "data3");

    const res = await hono.request("/api/kv/keys?pattern=user:*");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keys).toContain("user:123");
    expect(body.keys).toContain("user:456");
    expect(body.keys).not.toContain("order:789");
  });

  test("GET /api/kv/keys with default pattern returns all keys", async () => {
    await store.set("key1", "val1");
    await store.set("key2", "val2");

    const res = await hono.request("/api/kv/keys");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keys.length).toBeGreaterThanOrEqual(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 权限测试
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/kv/get without auth returns 401", async () => {
    const app = new Hono();
    registerKVRoutes(app, store);

    const res = await app.request("/api/kv/get?key=test");
    expect(res.status).toBe(401);
  });

  test("POST /api/kv/set without auth returns 401", async () => {
    const app = new Hono();
    registerKVRoutes(app, store);

    const res = await app.request("/api/kv/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test", value: "value" }),
    });
    expect(res.status).toBe(401);
  });
});
