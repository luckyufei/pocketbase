/**
 * collection_query.test.ts — T155 移植 Go 版 core/collection_query_test.go
 * 对照 Go 版：findCollectionByNameOrId、findAllCollections、countCollectionRecords
 */
import { describe, test, expect } from "bun:test";
import { findCollectionByNameOrId, findAllCollections, countCollectionRecords } from "./collection_query";
import { Database } from "bun:sqlite";

// ─── 创建测试数据库 ───

function createMockApp() {
  const db = new Database(":memory:");

  // 创建 _collections 表
  db.run(`
    CREATE TABLE _collections (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'base',
      name TEXT NOT NULL,
      system INTEGER DEFAULT 0,
      fields TEXT DEFAULT '[]',
      indexes TEXT DEFAULT '[]',
      listRule TEXT,
      viewRule TEXT,
      createRule TEXT,
      updateRule TEXT,
      deleteRule TEXT,
      options TEXT DEFAULT '{}',
      created TEXT DEFAULT '',
      updated TEXT DEFAULT ''
    )
  `);

  // 插入测试集合
  db.run("INSERT INTO _collections (id, type, name, created) VALUES (?, ?, ?, ?)",
    ["col_base1", "base", "posts", "2024-01-01"]);
  db.run("INSERT INTO _collections (id, type, name, created) VALUES (?, ?, ?, ?)",
    ["col_base2", "base", "comments", "2024-01-02"]);
  db.run("INSERT INTO _collections (id, type, name, created) VALUES (?, ?, ?, ?)",
    ["col_auth1", "auth", "users", "2024-01-03"]);
  db.run("INSERT INTO _collections (id, type, name, created) VALUES (?, ?, ?, ?)",
    ["col_view1", "view", "stats", "2024-01-04"]);

  // 创建记录表
  db.run("CREATE TABLE posts (id TEXT PRIMARY KEY, title TEXT, created TEXT, updated TEXT)");
  db.run("INSERT INTO posts (id, title) VALUES ('p1', 'Hello')");
  db.run("INSERT INTO posts (id, title) VALUES ('p2', 'World')");
  db.run("INSERT INTO posts (id, title) VALUES ('p3', 'Test')");

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

// ============================================================
// TestFindCollectionByNameOrId
// ============================================================
describe("findCollectionByNameOrId", () => {
  test("find by name", async () => {
    const app = createMockApp();
    const col = await findCollectionByNameOrId(app as any, "posts");
    expect(col).not.toBeNull();
    expect(col!.id).toBe("col_base1");
    expect(col!.name).toBe("posts");
    expect(col!.type).toBe("base");
  });

  test("find by id", async () => {
    const app = createMockApp();
    const col = await findCollectionByNameOrId(app as any, "col_auth1");
    expect(col).not.toBeNull();
    expect(col!.name).toBe("users");
    expect(col!.type).toBe("auth");
  });

  test("not found returns null", async () => {
    const app = createMockApp();
    const col = await findCollectionByNameOrId(app as any, "nonexistent");
    expect(col).toBeNull();
  });

  test("found collection is not new (isNew=false)", async () => {
    const app = createMockApp();
    const col = await findCollectionByNameOrId(app as any, "posts");
    expect(col).not.toBeNull();
    expect(col!.isNew()).toBe(false);
  });

  test("find auth collection", async () => {
    const app = createMockApp();
    const col = await findCollectionByNameOrId(app as any, "users");
    expect(col).not.toBeNull();
    expect(col!.isAuth()).toBe(true);
    expect(col!.isBase()).toBe(false);
    expect(col!.isView()).toBe(false);
  });

  test("find view collection", async () => {
    const app = createMockApp();
    const col = await findCollectionByNameOrId(app as any, "stats");
    expect(col).not.toBeNull();
    expect(col!.isView()).toBe(true);
  });
});

// ============================================================
// TestFindAllCollections
// ============================================================
describe("findAllCollections", () => {
  test("no filter — returns all", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any);
    expect(cols).toHaveLength(4);
  });

  test("filter by type — base", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any, "base");
    expect(cols).toHaveLength(2);
    expect(cols.every(c => c.type === "base")).toBe(true);
  });

  test("filter by type — auth", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any, "auth");
    expect(cols).toHaveLength(1);
    expect(cols[0].name).toBe("users");
  });

  test("filter by type — view", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any, "view");
    expect(cols).toHaveLength(1);
    expect(cols[0].name).toBe("stats");
  });

  test("filter by type — unknown → empty", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any, "unknown");
    expect(cols).toHaveLength(0);
  });

  test("filter by multiple types", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any, "base", "view");
    expect(cols).toHaveLength(3);
  });

  test("returned collections are marked as not new", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any);
    for (const c of cols) {
      expect(c.isNew()).toBe(false);
    }
  });

  test("results ordered by created ASC", async () => {
    const app = createMockApp();
    const cols = await findAllCollections(app as any);
    expect(cols[0].name).toBe("posts");
    expect(cols[1].name).toBe("comments");
    expect(cols[2].name).toBe("users");
    expect(cols[3].name).toBe("stats");
  });
});

// ============================================================
// TestCountCollectionRecords
// ============================================================
describe("countCollectionRecords", () => {
  test("count all records in collection", async () => {
    const app = createMockApp();
    const count = await countCollectionRecords(app as any, "posts");
    expect(count).toBe(3);
  });

  test("count with filter", async () => {
    const app = createMockApp();
    const count = await countCollectionRecords(app as any, "posts", "title = 'Hello'");
    expect(count).toBe(1);
  });

  test("count for missing collection → 0", async () => {
    const app = createMockApp();
    const count = await countCollectionRecords(app as any, "nonexistent");
    expect(count).toBe(0);
  });
});
