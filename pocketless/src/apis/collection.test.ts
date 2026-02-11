/**
 * T167 — collection.test.ts
 * 对照 Go 版 apis/collection_test.go
 * 测试 Collection CRUD 7 个路由端点
 * 使用真实 bun:sqlite 内存数据库
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { registerCollectionRoutes } from "./collection";
import { toApiError } from "./errors";
import { BaseApp } from "../core/base";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { CollectionModel } from "../core/collection_model";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; hono: Hono; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-col-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;

  // 创建 _collections 系统表
  adapter.exec(`CREATE TABLE IF NOT EXISTS _collections (
    id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]',
    listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT,
    options TEXT DEFAULT '{}', created TEXT, updated TEXT
  )`);

  const hono = new Hono();
  hono.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerCollectionRoutes(hono, app);
  return { app, hono, tmpDir };
}

function seedCollection(
  app: BaseApp,
  name: string,
  opts: { id?: string; type?: string; system?: boolean; fields?: any[] } = {},
): CollectionModel {
  const col = new CollectionModel();
  if (opts.id) col.id = opts.id;
  col.name = name;
  col.type = opts.type || "base";
  col.system = opts.system || false;
  col.fields = opts.fields || [];
  col.refreshTimestamps();

  const row = col.toDBRow();
  const keys = Object.keys(row);
  const placeholders = keys.map(() => "?").join(", ");
  app.dbAdapter().exec(
    `INSERT INTO _collections (${keys.join(", ")}) VALUES (${placeholders})`,
    ...keys.map((k) => row[k]),
  );

  // 创建对应数据表
  app.dbAdapter().exec(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, created TEXT, updated TEXT)`);
  col.markAsNotNew();
  return col;
}

describe("Collection API", () => {
  let baseApp: BaseApp;
  let hono: Hono;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    baseApp = result.app;
    hono = result.hono;
    tmpDir = result.tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── GET /api/collections （列表）───

  describe("GET /api/collections", () => {
    test("empty list returns empty items", async () => {
      const res = await hono.request("/api/collections");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(body.page).toBe(1);
      expect(body.perPage).toBe(30);
      expect(body.totalItems).toBe(0);
      expect(body.totalPages).toBe(1);
    });

    test("returns seeded collections", async () => {
      seedCollection(baseApp, "posts");
      seedCollection(baseApp, "users");
      const res = await hono.request("/api/collections");
      const body = await res.json();
      expect(body.items.length).toBe(2);
      expect(body.totalItems).toBe(2);
    });

    test("pagination works", async () => {
      for (let i = 0; i < 5; i++) seedCollection(baseApp, `col_${i}`);
      const res = await hono.request("/api/collections?page=2&perPage=2");
      const body = await res.json();
      expect(body.page).toBe(2);
      expect(body.perPage).toBe(2);
      expect(body.items.length).toBe(2);
      expect(body.totalItems).toBe(5);
      expect(body.totalPages).toBe(3);
    });

    test("perPage bounds: min=1, max=500", async () => {
      seedCollection(baseApp, "test");
      // perPage=0 → clamped to 1
      const res1 = await hono.request("/api/collections?perPage=0");
      const body1 = await res1.json();
      expect(body1.perPage).toBe(1);

      // perPage=9999 → clamped to 500
      const res2 = await hono.request("/api/collections?perPage=9999");
      const body2 = await res2.json();
      expect(body2.perPage).toBe(500);
    });

    test("skipTotal returns -1 for totals", async () => {
      seedCollection(baseApp, "posts");
      const res = await hono.request("/api/collections?skipTotal=true");
      const body = await res.json();
      expect(body.totalItems).toBe(-1);
      expect(body.totalPages).toBe(-1);
    });

    test("sort parameter works", async () => {
      seedCollection(baseApp, "aaa");
      seedCollection(baseApp, "zzz");
      const res = await hono.request("/api/collections?sort=-name");
      const body = await res.json();
      expect(body.items[0].name).toBe("zzz");
      expect(body.items[1].name).toBe("aaa");
    });
  });

  // ─── GET /api/collections/:idOrName （查看）───

  describe("GET /api/collections/:idOrName", () => {
    test("by name", async () => {
      seedCollection(baseApp, "posts");
      const res = await hono.request("/api/collections/posts");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("posts");
    });

    test("by id", async () => {
      const col = seedCollection(baseApp, "posts", { id: "test_id_123456" });
      const res = await hono.request(`/api/collections/${col.id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(col.id);
    });

    test("not found → 404", async () => {
      const res = await hono.request("/api/collections/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/collections （创建）───

  describe("POST /api/collections", () => {
    test("create collection", async () => {
      const res = await hono.request("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "articles",
          type: "base",
          fields: [{ name: "title", type: "text" }],
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("articles");
      expect(body.id).toBeDefined();
      expect(body.id.length).toBe(15);
    });

    test("missing name → 400", async () => {
      const res = await hono.request("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "base" }),
      });
      expect(res.status).toBe(400);
    });

    test("creates data table", async () => {
      await hono.request("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "new_table",
          type: "base",
          fields: [{ name: "title", type: "text" }],
        }),
      });
      // 验证表被创建
      const rows = baseApp.dbAdapter().query("SELECT name FROM sqlite_master WHERE type='table' AND name='new_table'");
      expect(rows.length).toBe(1);
    });

    test("collection with fields creates proper columns", async () => {
      await hono.request("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "with_fields",
          type: "base",
          fields: [
            { name: "title", type: "text" },
            { name: "count", type: "number" },
            { name: "active", type: "bool" },
          ],
        }),
      });
      // 插入一行测试列存在
      baseApp.dbAdapter().exec(
        "INSERT INTO with_fields (id, title, count, active) VALUES (?, ?, ?, ?)",
        "test1", "hello", 42, true,
      );
      const row = baseApp.dbAdapter().queryOne<any>("SELECT * FROM with_fields WHERE id = ?", "test1");
      expect(row).toBeDefined();
      expect(row!.title).toBe("hello");
    });
  });

  // ─── PATCH /api/collections/:idOrName （更新）───

  describe("PATCH /api/collections/:idOrName", () => {
    test("update collection name", async () => {
      seedCollection(baseApp, "old_name");
      const res = await hono.request("/api/collections/old_name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "new_name" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("new_name");
    });

    test("not found → 404", async () => {
      const res = await hono.request("/api/collections/nope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      });
      expect(res.status).toBe(404);
    });

    test("partial update preserves unchanged fields", async () => {
      const col = seedCollection(baseApp, "mytest", { type: "base" });
      const res = await hono.request(`/api/collections/${col.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listRule: "@request.auth.id != ''" }),
      });
      const body = await res.json();
      expect(body.name).toBe("mytest");
      expect(body.type).toBe("base");
      expect(body.listRule).toBe("@request.auth.id != ''");
    });
  });

  // ─── DELETE /api/collections/:idOrName （删除）───

  describe("DELETE /api/collections/:idOrName", () => {
    test("delete collection", async () => {
      seedCollection(baseApp, "to_delete");
      const res = await hono.request("/api/collections/to_delete", { method: "DELETE" });
      expect(res.status).toBe(204);
      // 确认已删除
      const check = await baseApp.findCollectionByNameOrId("to_delete");
      expect(check).toBeNull();
    });

    test("not found → 404", async () => {
      const res = await hono.request("/api/collections/nope", { method: "DELETE" });
      expect(res.status).toBe(404);
    });

    test("system collection → 400", async () => {
      seedCollection(baseApp, "_system_col", { system: true });
      const res = await hono.request("/api/collections/_system_col", { method: "DELETE" });
      expect(res.status).toBe(400);
    });

    test("drops data table", async () => {
      seedCollection(baseApp, "drop_me");
      await hono.request("/api/collections/drop_me", { method: "DELETE" });
      const tables = baseApp.dbAdapter().query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='drop_me'",
      );
      expect(tables.length).toBe(0);
    });
  });

  // ─── DELETE /api/collections/:idOrName/truncate （清空）───

  describe("DELETE /api/collections/:idOrName/truncate", () => {
    test("truncate collection records", async () => {
      seedCollection(baseApp, "truncate_me");
      baseApp.dbAdapter().exec("INSERT INTO truncate_me (id) VALUES (?)", "r1");
      baseApp.dbAdapter().exec("INSERT INTO truncate_me (id) VALUES (?)", "r2");
      const before = baseApp.dbAdapter().query("SELECT * FROM truncate_me");
      expect(before.length).toBe(2);

      const res = await hono.request("/api/collections/truncate_me/truncate", { method: "DELETE" });
      expect(res.status).toBe(204);

      const after = baseApp.dbAdapter().query("SELECT * FROM truncate_me");
      expect(after.length).toBe(0);
    });

    test("not found → 404", async () => {
      const res = await hono.request("/api/collections/nope/truncate", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/collections/import （导入）───

  describe("PUT /api/collections/import", () => {
    test("import creates new collections", async () => {
      const res = await hono.request("/api/collections/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: [
            { name: "imported1", type: "base", fields: [] },
            { name: "imported2", type: "base", fields: [] },
          ],
        }),
      });
      expect(res.status).toBe(204);

      const all = await baseApp.findAllCollections();
      expect(all.length).toBe(2);
    });

    test("import updates existing collections", async () => {
      const col = seedCollection(baseApp, "existing");
      const res = await hono.request("/api/collections/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: [
            { id: col.id, name: "existing", type: "auth" },
          ],
        }),
      });
      expect(res.status).toBe(204);

      const updated = await baseApp.findCollectionByNameOrId(col.id);
      expect(updated!.type).toBe("auth");
    });

    test("deleteMissing removes non-imported non-system collections", async () => {
      seedCollection(baseApp, "keep_me");
      seedCollection(baseApp, "delete_me");
      seedCollection(baseApp, "_system", { system: true });

      const res = await hono.request("/api/collections/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: [{ name: "keep_me", type: "base", fields: [] }],
          deleteMissing: true,
        }),
      });
      expect(res.status).toBe(204);

      const all = await baseApp.findAllCollections();
      const names = all.map((c) => c.name);
      expect(names).toContain("keep_me");
      expect(names).toContain("_system");
      expect(names).not.toContain("delete_me");
    });

    test("invalid data → 400", async () => {
      const res = await hono.request("/api/collections/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections: "not an array" }),
      });
      expect(res.status).toBe(400);
    });
  });
});
