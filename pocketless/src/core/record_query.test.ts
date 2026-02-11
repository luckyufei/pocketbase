/**
 * record_query.test.ts — T154 移植 Go 版 core/record_query_test.go
 * 对照 Go 版：findRecordById、findRecordsByFilter、countRecords
 * 注意: 这些函数依赖 BaseApp + DBAdapter，这里测试函数签名和基本逻辑
 */
import { describe, test, expect } from "bun:test";
import { findRecordById, findRecordsByFilter, countRecords, findFirstRecordByFilter } from "./record_query";
import { CollectionModel, COLLECTION_TYPE_BASE } from "./collection_model";

// ─── Mock BaseApp ───
// 由于 record_query 函数需要 BaseApp.dbAdapter()，这里创建一个最小 mock
// 注意: 按 spec 应该用真实 SQLite，但 record_query 接口需要完整 BaseApp
// 这里先验证函数存在性和参数类型

describe("record_query function signatures", () => {
  test("findRecordById is a function with correct params", () => {
    expect(typeof findRecordById).toBe("function");
    expect(findRecordById.length).toBeGreaterThanOrEqual(2);
  });

  test("findRecordsByFilter is a function with correct params", () => {
    expect(typeof findRecordsByFilter).toBe("function");
    expect(findRecordsByFilter.length).toBeGreaterThanOrEqual(2);
  });

  test("countRecords is a function with correct params", () => {
    expect(typeof countRecords).toBe("function");
    expect(countRecords.length).toBeGreaterThanOrEqual(1);
  });

  test("findFirstRecordByFilter is a function with correct params", () => {
    expect(typeof findFirstRecordByFilter).toBe("function");
    expect(findFirstRecordByFilter.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 以下使用内存 SQLite 进行集成测试 ───
import { Database } from "bun:sqlite";

/** 创建最小 mock dbAdapter */
function createMockApp() {
  const db = new Database(":memory:");
  db.run("CREATE TABLE _collections (id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0, fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]', listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT, options TEXT DEFAULT '{}', created TEXT, updated TEXT)");
  db.run("CREATE TABLE test_records (id TEXT PRIMARY KEY, title TEXT, count INTEGER, created TEXT, updated TEXT)");

  // 插入一个测试集合
  db.run(
    "INSERT INTO _collections (id, type, name, fields) VALUES (?, ?, ?, ?)",
    ["col_1", "base", "test_records", "[]"],
  );

  // 插入测试记录
  db.run("INSERT INTO test_records (id, title, count, created, updated) VALUES (?, ?, ?, ?, ?)",
    ["rec_1", "Hello", 10, "2024-01-01", "2024-01-01"]);
  db.run("INSERT INTO test_records (id, title, count, created, updated) VALUES (?, ?, ?, ?, ?)",
    ["rec_2", "World", 20, "2024-01-02", "2024-01-02"]);
  db.run("INSERT INTO test_records (id, title, count, created, updated) VALUES (?, ?, ?, ?, ?)",
    ["rec_3", "Test", 30, "2024-01-03", "2024-01-03"]);

  const adapter = {
    type: () => "sqlite" as const,
    queryOne: <T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null => {
      const stmt = db.prepare(sql);
      return stmt.get(...params) as T | null;
    },
    query: (sql: string, ...params: unknown[]): Record<string, unknown>[] => {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as Record<string, unknown>[];
    },
  };

  return {
    dbAdapter: () => adapter,
    _db: db,
  };
}

describe("record_query with bun:sqlite", () => {
  test("findRecordById — existing record", async () => {
    const app = createMockApp();
    const record = await findRecordById(app as any, "test_records", "rec_1");
    expect(record).not.toBeNull();
    expect(record!.id).toBe("rec_1");
    expect(record!.get("title")).toBe("Hello");
    expect(record!.get("count")).toBe(10);
  });

  test("findRecordById — missing record", async () => {
    const app = createMockApp();
    const record = await findRecordById(app as any, "test_records", "missing");
    expect(record).toBeNull();
  });

  test("findRecordById — missing collection", async () => {
    const app = createMockApp();
    const record = await findRecordById(app as any, "nonexistent", "rec_1");
    expect(record).toBeNull();
  });

  test("findRecordsByFilter — returns matching records", async () => {
    const app = createMockApp();
    const records = await findRecordsByFilter(app as any, "test_records", "count > 15");
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("rec_2");
    expect(records[1].id).toBe("rec_3");
  });

  test("findRecordsByFilter — empty filter returns all", async () => {
    const app = createMockApp();
    const records = await findRecordsByFilter(app as any, "test_records", "");
    expect(records).toHaveLength(3);
  });

  test("findRecordsByFilter — with limit", async () => {
    const app = createMockApp();
    const records = await findRecordsByFilter(app as any, "test_records", "", undefined, 2);
    expect(records).toHaveLength(2);
  });

  test("findRecordsByFilter — with sort", async () => {
    const app = createMockApp();
    const records = await findRecordsByFilter(app as any, "test_records", "", "count DESC");
    expect(records[0].get("count")).toBe(30);
    expect(records[2].get("count")).toBe(10);
  });

  test("findRecordsByFilter — missing collection", async () => {
    const app = createMockApp();
    const records = await findRecordsByFilter(app as any, "nonexistent", "1=1");
    expect(records).toEqual([]);
  });

  test("countRecords — all", async () => {
    const app = createMockApp();
    const count = await countRecords(app as any, "test_records");
    expect(count).toBe(3);
  });

  test("countRecords — with filter", async () => {
    const app = createMockApp();
    const count = await countRecords(app as any, "test_records", "count >= 20");
    expect(count).toBe(2);
  });

  test("countRecords — missing collection", async () => {
    const app = createMockApp();
    const count = await countRecords(app as any, "nonexistent");
    expect(count).toBe(0);
  });

  test("findFirstRecordByFilter — found", async () => {
    const app = createMockApp();
    const record = await findFirstRecordByFilter(app as any, "test_records", "title = 'World'");
    expect(record).not.toBeNull();
    expect(record!.id).toBe("rec_2");
  });

  test("findFirstRecordByFilter — not found", async () => {
    const app = createMockApp();
    const record = await findFirstRecordByFilter(app as any, "test_records", "title = 'Missing'");
    expect(record).toBeNull();
  });
});
