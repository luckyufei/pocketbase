/**
 * T020 — collection_record_table_sync.test.ts
 * 对照 Go 版 core/collection_record_table_sync_test.go
 * 测试集合表结构同步
 * TDD: 先写测试（红灯），再实现
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { BaseApp } from "./base";
import { CollectionModel } from "./collection_model";
import { SQLiteAdapter } from "./db_adapter_sqlite";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-sync-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;

  adapter.exec(`CREATE TABLE IF NOT EXISTS _collections (
    id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]',
    listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT,
    options TEXT DEFAULT '{}', created TEXT, updated TEXT
  )`);

  return { app, tmpDir };
}

function newCollection(name: string, fields: Array<{ id: string; name: string; type: string }>): CollectionModel {
  const col = new CollectionModel();
  col.name = name;
  col.type = "base";
  col.fields = fields.map((f) => ({ ...f, required: false, options: {} }));
  return col;
}

function getTableColumns(app: BaseApp, tableName: string): string[] {
  try {
    const rows = app.dbAdapter().query(`PRAGMA table_info(${tableName})`);
    return rows.map((r: any) => r.name);
  } catch {
    return [];
  }
}

function tableExists(app: BaseApp, tableName: string): boolean {
  const row = app.dbAdapter().queryOne(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    tableName,
  );
  return !!row;
}

function getIndexNames(app: BaseApp, tableName: string): string[] {
  const rows = app.dbAdapter().query(
    `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? AND name NOT LIKE 'sqlite_%'`,
    tableName,
  );
  return rows.map((r: any) => r.name);
}

describe("syncRecordTableSchema", () => {
  let app: BaseApp;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    tmpDir = result.tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── 创建新表 ───

  test("creates new table for new collection", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");
    const col = newCollection("posts", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
      { id: "f2", name: "body", type: "text" },
    ]);

    await syncRecordTableSchema(app, col, null);

    expect(tableExists(app, "posts")).toBe(true);
    const columns = getTableColumns(app, "posts");
    expect(columns).toContain("id");
    expect(columns).toContain("title");
    expect(columns).toContain("body");
  });

  test("creates table with correct column types", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");
    const col = newCollection("typed", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "count", type: "number" },
      { id: "f2", name: "active", type: "bool" },
      { id: "f3", name: "data", type: "json" },
    ]);

    await syncRecordTableSchema(app, col, null);

    expect(tableExists(app, "typed")).toBe(true);
    const columns = getTableColumns(app, "typed");
    expect(columns).toContain("count");
    expect(columns).toContain("active");
    expect(columns).toContain("data");
  });

  test("creates indexes on new table", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");
    const col = newCollection("indexed", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);
    col.indexes = ["CREATE INDEX idx_indexed_title ON indexed (title)"];

    await syncRecordTableSchema(app, col, null);

    const indexes = getIndexNames(app, "indexed");
    expect(indexes).toContain("idx_indexed_title");
  });

  // ─── 添加列 ───

  test("adds new column when field is added", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");

    const oldCol = newCollection("evolve", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);
    await syncRecordTableSchema(app, oldCol, null);
    oldCol.markAsNotNew();

    const newCol = newCollection("evolve", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
      { id: "f2", name: "body", type: "text" },
    ]);

    await syncRecordTableSchema(app, newCol, oldCol);

    const columns = getTableColumns(app, "evolve");
    expect(columns).toContain("body");
  });

  // ─── 删除列 ───

  test("drops column when field is removed", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");

    const oldCol = newCollection("shrink", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
      { id: "f2", name: "body", type: "text" },
    ]);
    await syncRecordTableSchema(app, oldCol, null);
    oldCol.markAsNotNew();

    const newCol = newCollection("shrink", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);

    await syncRecordTableSchema(app, newCol, oldCol);

    const columns = getTableColumns(app, "shrink");
    expect(columns).not.toContain("body");
  });

  // ─── 重命名列 ───

  test("renames column when field name changes (same id)", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");

    const oldCol = newCollection("rename_test", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "old_name", type: "text" },
    ]);
    await syncRecordTableSchema(app, oldCol, null);
    oldCol.markAsNotNew();

    // 插入数据验证重命名保留数据
    app.dbAdapter().exec(
      "INSERT INTO rename_test (id, old_name) VALUES (?, ?)",
      "r1", "preserved_value",
    );

    const newCol = newCollection("rename_test", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "new_name", type: "text" },
    ]);

    await syncRecordTableSchema(app, newCol, oldCol);

    const columns = getTableColumns(app, "rename_test");
    expect(columns).not.toContain("old_name");
    expect(columns).toContain("new_name");

    // 验证数据保留
    const row = app.dbAdapter().queryOne("SELECT new_name FROM rename_test WHERE id = ?", "r1") as any;
    expect(row?.new_name).toBe("preserved_value");
  });

  // ─── 索引管理 ───

  test("adds new indexes on update", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");

    const oldCol = newCollection("idx_add", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);
    await syncRecordTableSchema(app, oldCol, null);
    oldCol.markAsNotNew();

    const newCol = newCollection("idx_add", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);
    newCol.indexes = ["CREATE INDEX idx_add_title ON idx_add (title)"];

    await syncRecordTableSchema(app, newCol, oldCol);

    const indexes = getIndexNames(app, "idx_add");
    expect(indexes).toContain("idx_add_title");
  });

  test("drops removed indexes on update", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");

    const oldCol = newCollection("idx_drop", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);
    oldCol.indexes = ["CREATE INDEX idx_drop_title ON idx_drop (title)"];
    await syncRecordTableSchema(app, oldCol, null);
    oldCol.markAsNotNew();

    const newCol = newCollection("idx_drop", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "title", type: "text" },
    ]);
    newCol.indexes = [];

    await syncRecordTableSchema(app, newCol, oldCol);

    const indexes = getIndexNames(app, "idx_drop");
    expect(indexes).not.toContain("idx_drop_title");
  });

  // ─── 综合场景 ───

  test("handles multiple changes at once (add + remove + rename)", async () => {
    const { syncRecordTableSchema } = await import("./collection_record_table_sync");

    const oldCol = newCollection("multi", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "keep_me", type: "text" },
      { id: "f2", name: "remove_me", type: "text" },
      { id: "f3", name: "rename_me", type: "text" },
    ]);
    await syncRecordTableSchema(app, oldCol, null);
    oldCol.markAsNotNew();

    app.dbAdapter().exec(
      "INSERT INTO multi (id, keep_me, remove_me, rename_me) VALUES (?, ?, ?, ?)",
      "r1", "kept", "removed", "renamed_val",
    );

    const newCol = newCollection("multi", [
      { id: "f_id", name: "id", type: "text" },
      { id: "f1", name: "keep_me", type: "text" },
      { id: "f3", name: "renamed", type: "text" },
      { id: "f4", name: "new_field", type: "number" },
    ]);

    await syncRecordTableSchema(app, newCol, oldCol);

    const columns = getTableColumns(app, "multi");
    expect(columns).toContain("keep_me");
    expect(columns).not.toContain("remove_me");
    expect(columns).not.toContain("rename_me");
    expect(columns).toContain("renamed");
    expect(columns).toContain("new_field");

    const row = app.dbAdapter().queryOne("SELECT keep_me, renamed FROM multi WHERE id = ?", "r1") as any;
    expect(row?.keep_me).toBe("kept");
    expect(row?.renamed).toBe("renamed_val");
  });
});
