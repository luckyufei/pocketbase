/**
 * T168 — record_crud.test.ts
 * 对照 Go 版 apis/record_crud_test.go
 * 测试 Record CRUD 5 个路由端点
 * 使用真实 bun:sqlite 内存数据库
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { registerRecordRoutes } from "./record_crud";
import { toApiError } from "./errors";
import { BaseApp } from "../core/base";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { CollectionModel } from "../core/collection_model";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; hono: Hono; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-rec-"));
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
  registerRecordRoutes(hono, app);
  return { app, hono, tmpDir };
}

function seedCollectionAndTable(app: BaseApp, name: string, fields: { name: string; type: string }[] = []): CollectionModel {
  const col = new CollectionModel();
  col.name = name;
  col.type = "base";
  col.fields = fields.map((f) => ({ ...f })) as any;
  // 默认所有规则为 "" (公开访问)，与 Go 默认行为一致
  col.listRule = "";
  col.viewRule = "";
  col.createRule = "";
  col.updateRule = "";
  col.deleteRule = "";
  col.refreshTimestamps();

  const row = col.toDBRow();
  const keys = Object.keys(row);
  const placeholders = keys.map(() => "?").join(", ");
  app.dbAdapter().exec(
    `INSERT INTO _collections (${keys.join(", ")}) VALUES (${placeholders})`,
    ...keys.map((k) => row[k]),
  );

  // 创建数据表
  const columns = ["id TEXT PRIMARY KEY", "created TEXT DEFAULT ''", "updated TEXT DEFAULT ''"];
  for (const f of fields) {
    const typeMap: Record<string, string> = {
      text: "TEXT DEFAULT ''",
      number: "NUMERIC DEFAULT 0",
      bool: "BOOLEAN DEFAULT FALSE",
    };
    columns.push(`${f.name} ${typeMap[f.type] || "TEXT DEFAULT ''"}`);
  }
  app.dbAdapter().exec(`CREATE TABLE IF NOT EXISTS ${name} (${columns.join(", ")})`);
  col.markAsNotNew();
  return col;
}

function seedRecord(app: BaseApp, tableName: string, data: Record<string, unknown>): void {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => "?").join(", ");
  app.dbAdapter().exec(
    `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`,
    ...keys.map((k) => data[k]),
  );
}

describe("Record CRUD API", () => {
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

  // ─── GET /api/collections/:col/records （列表）───

  describe("GET records list", () => {
    test("empty collection returns empty items", async () => {
      seedCollectionAndTable(baseApp, "posts");
      const res = await hono.request("/api/collections/posts/records");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(body.page).toBe(1);
    });

    test("returns seeded records", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Hello" });
      seedRecord(baseApp, "posts", { id: "r2", title: "World" });

      const res = await hono.request("/api/collections/posts/records");
      const body = await res.json();
      expect(body.items.length).toBe(2);
      expect(body.totalItems).toBe(2);
    });

    test("nonexistent collection → 404", async () => {
      const res = await hono.request("/api/collections/nope/records");
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/collections/:col/records/:id （查看）───

  describe("GET record by id", () => {
    test("returns record", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      seedRecord(baseApp, "posts", { id: "rec123", title: "Test" });

      const res = await hono.request("/api/collections/posts/records/rec123");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("rec123");
      expect(body.title).toBe("Test");
    });

    test("nonexistent record → 404", async () => {
      seedCollectionAndTable(baseApp, "posts");
      const res = await hono.request("/api/collections/posts/records/nope");
      expect(res.status).toBe(404);
    });

    test("nonexistent collection → 404", async () => {
      const res = await hono.request("/api/collections/nope/records/r1");
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/collections/:col/records （创建）───

  describe("POST create record", () => {
    test("creates record with auto-generated ID", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      const res = await hono.request("/api/collections/posts/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Post" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.id.length).toBe(15);
      expect(body.title).toBe("New Post");
    });

    test("creates record with custom ID", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      const res = await hono.request("/api/collections/posts/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "custom_id_12345", title: "Custom" }),
      });
      const body = await res.json();
      expect(body.id).toBe("custom_id_12345");
    });

    test("nonexistent collection → 404", async () => {
      const res = await hono.request("/api/collections/nope/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/collections/:col/records/:id （更新）───

  describe("PATCH update record", () => {
    test("updates record fields", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Old" });

      const res = await hono.request("/api/collections/posts/records/r1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("New");
    });

    test("nonexistent record → 404", async () => {
      seedCollectionAndTable(baseApp, "posts");
      const res = await hono.request("/api/collections/posts/records/nope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/collections/:col/records/:id （删除）───

  describe("DELETE record", () => {
    test("deletes record", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Delete me" });

      const res = await hono.request("/api/collections/posts/records/r1", { method: "DELETE" });
      expect(res.status).toBe(204);

      // 确认已删除
      const row = baseApp.dbAdapter().queryOne("SELECT * FROM posts WHERE id = ?", "r1");
      expect(row).toBeNull();
    });

    test("nonexistent record → 404", async () => {
      seedCollectionAndTable(baseApp, "posts");
      const res = await hono.request("/api/collections/posts/records/nope", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  // ═══ T011: 权限检查集成测试 ═══

  describe("Permission rules (T011)", () => {
    function seedProtectedCollection(
      app: BaseApp,
      rules: { listRule?: string | null; viewRule?: string | null; createRule?: string | null; updateRule?: string | null; deleteRule?: string | null },
    ) {
      // 手动插入带权限规则的集合
      app.dbAdapter().exec(
        `INSERT INTO _collections (id, type, name, listRule, viewRule, createRule, updateRule, deleteRule, fields, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        "col_secret", "base", "secrets",
        rules.listRule ?? null,
        rules.viewRule ?? null,
        rules.createRule ?? null,
        rules.updateRule ?? null,
        rules.deleteRule ?? null,
        "[]",
        "2024-01-01", "2024-01-01",
      );
      app.dbAdapter().exec("CREATE TABLE secrets (id TEXT PRIMARY KEY, title TEXT, created TEXT, updated TEXT)");
      app.dbAdapter().exec("INSERT INTO secrets (id, title, created, updated) VALUES (?, ?, ?, ?)", "s1", "Top Secret", "2024-01-01", "2024-01-01");
    }

    test("listRule = null → 403", async () => {
      seedProtectedCollection(baseApp, { listRule: null, viewRule: "", createRule: "", updateRule: "", deleteRule: "" });
      const res = await hono.request("/api/collections/secrets/records");
      expect(res.status).toBe(403);
    });

    test("listRule = '' → public access (200)", async () => {
      seedProtectedCollection(baseApp, { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" });
      const res = await hono.request("/api/collections/secrets/records");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items.length).toBe(1);
    });

    test("viewRule = null → 403", async () => {
      seedProtectedCollection(baseApp, { listRule: "", viewRule: null, createRule: "", updateRule: "", deleteRule: "" });
      const res = await hono.request("/api/collections/secrets/records/s1");
      expect(res.status).toBe(403);
    });

    test("createRule = null → 403", async () => {
      seedProtectedCollection(baseApp, { listRule: "", viewRule: "", createRule: null, updateRule: "", deleteRule: "" });
      const res = await hono.request("/api/collections/secrets/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New" }),
      });
      expect(res.status).toBe(403);
    });

    test("updateRule = null → 403", async () => {
      seedProtectedCollection(baseApp, { listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: "" });
      const res = await hono.request("/api/collections/secrets/records/s1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(403);
    });

    test("deleteRule = null → 403", async () => {
      seedProtectedCollection(baseApp, { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: null });
      const res = await hono.request("/api/collections/secrets/records/s1", {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });
  });

  // ═══ T034: onRecordEnrich hook 测试 ═══

  describe("onRecordEnrich hook (T034)", () => {
    test("GET record triggers onRecordEnrich hook", async () => {
      seedCollectionAndTable(baseApp, "posts", [{ name: "title", type: "text" }]);
      seedRecord(baseApp, "posts", { id: "enrich1", title: "Original" });

      let hookCalled = false;
      baseApp.onRecordEnrich().bindFunc(async (e) => {
        hookCalled = true;
        await e.next();
      });

      const res = await hono.request("/api/collections/posts/records/enrich1");
      expect(res.status).toBe(200);
      expect(hookCalled).toBe(true);
    });

    test("POST create triggers onRecordEnrich hook", async () => {
      seedCollectionAndTable(baseApp, "items", [{ name: "name", type: "text" }]);

      let hookCalled = false;
      baseApp.onRecordEnrich().bindFunc(async (e) => {
        hookCalled = true;
        await e.next();
      });

      const res = await hono.request("/api/collections/items/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Enriched" }),
      });
      expect(res.status).toBe(200);
      expect(hookCalled).toBe(true);
    });

    test("PATCH update triggers onRecordEnrich hook", async () => {
      seedCollectionAndTable(baseApp, "notes", [{ name: "body", type: "text" }]);
      seedRecord(baseApp, "notes", { id: "n1", body: "Old" });

      let hookCalled = false;
      baseApp.onRecordEnrich().bindFunc(async (e) => {
        hookCalled = true;
        await e.next();
      });

      const res = await hono.request("/api/collections/notes/records/n1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "New" }),
      });
      expect(res.status).toBe(200);
      expect(hookCalled).toBe(true);
    });
  });

  // ═══ T064: ?fields= 查询参数支持 ═══

  describe("fields query parameter (T064)", () => {
    test("GET list with ?fields=id,title returns only selected fields", async () => {
      seedCollectionAndTable(baseApp, "posts", [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
      ]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Hello", body: "World" });

      const res = await hono.request("/api/collections/posts/records?fields=id,title");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      const item = json.items[0];
      expect(item.id).toBe("r1");
      expect(item.title).toBe("Hello");
      expect(item.body).toBeUndefined();
    });

    test("GET list with ?fields= empty returns all fields", async () => {
      seedCollectionAndTable(baseApp, "posts", [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
      ]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Hello", body: "World" });

      const res = await hono.request("/api/collections/posts/records?fields=");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items[0].title).toBe("Hello");
      expect(json.items[0].body).toBe("World");
    });

    test("GET view with ?fields=id returns only id", async () => {
      seedCollectionAndTable(baseApp, "posts", [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
      ]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Hello", body: "World" });

      const res = await hono.request("/api/collections/posts/records/r1?fields=id");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("r1");
      expect(json.title).toBeUndefined();
      expect(json.body).toBeUndefined();
    });

    test("POST create with ?fields=id,title returns only selected fields", async () => {
      seedCollectionAndTable(baseApp, "posts", [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
      ]);

      const res = await hono.request("/api/collections/posts/records?fields=id,title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New", body: "Content" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBeDefined();
      expect(json.title).toBe("New");
      expect(json.body).toBeUndefined();
    });

    test("PATCH update with ?fields=id returns only id", async () => {
      seedCollectionAndTable(baseApp, "posts", [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
      ]);
      seedRecord(baseApp, "posts", { id: "r1", title: "Old", body: "Old body" });

      const res = await hono.request("/api/collections/posts/records/r1?fields=id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("r1");
      expect(json.title).toBeUndefined();
      expect(json.body).toBeUndefined();
    });

    test("fields with nested/wildcard works on list items", async () => {
      seedCollectionAndTable(baseApp, "posts", [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
      ]);
      seedRecord(baseApp, "posts", { id: "r1", title: "A", body: "B" });

      // 使用 * 通配符（但只有根级别的字段）
      const res = await hono.request("/api/collections/posts/records?fields=*");
      expect(res.status).toBe(200);
      const json = await res.json();
      // * 应该保留所有字段
      expect(json.items[0].id).toBe("r1");
      expect(json.items[0].title).toBe("A");
      expect(json.items[0].body).toBe("B");
    });
  });
});
