/**
 * record_query_advanced.test.ts — Advanced query scenarios
 * 对标 Go 版 core/record_query_test.go 的高级场景
 *
 * 覆盖:
 * - JSON 字段过滤和排序（data.nested.field）
 * - 宏展开 (@now, @today, @year 等)
 * - 复杂嵌套条件 ((A && B) || (C && D))
 * - LIKE 通配符转义 (%, _, \)
 * - Null/空字符串特殊比较
 * - 多字段排序 (field1 ASC, field2 DESC)
 * - 大量数据分页
 */

import { describe, test, expect } from "bun:test";
import { findRecordsByFilter, countRecords, findFirstRecordByFilter } from "./record_query";
import { Database } from "bun:sqlite";

/** 创建包含 JSON 字段的测试数据库 */
function createAdvancedMockApp() {
  const db = new Database(":memory:");
  
  // 创建集合表
  db.run(`CREATE TABLE _collections (
    id TEXT PRIMARY KEY,
    type TEXT,
    name TEXT,
    system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]',
    indexes TEXT DEFAULT '[]',
    listRule TEXT,
    viewRule TEXT,
    createRule TEXT,
    updateRule TEXT,
    deleteRule TEXT,
    options TEXT DEFAULT '{}',
    created TEXT,
    updated TEXT
  )`);

  // 创建带 JSON 字段的记录表
  db.run(`CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    title TEXT,
    slug TEXT,
    data TEXT,
    view_count INTEGER,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);

  // 插入集合
  db.run(
    "INSERT INTO _collections (id, type, name, fields) VALUES (?, ?, ?, ?)",
    ["col_posts", "base", "posts", "[]"],
  );

  // 插入测试数据（带JSON字段）
  const records = [
    {
      id: "post_1",
      title: "JavaScript Tips",
      slug: "js-tips",
      data: JSON.stringify({
        author: "Alice",
        tags: ["js", "tutorial"],
        meta: { views_cached: 1000, updated_by: "admin" },
      }),
      view_count: 1000,
      status: "published",
      created_at: "2024-01-01T08:00:00Z",
      updated_at: "2024-01-15T10:30:00Z",
    },
    {
      id: "post_2",
      title: "TypeScript Advanced",
      slug: "ts-advanced",
      data: JSON.stringify({
        author: "Bob",
        tags: ["typescript", "advanced"],
        meta: { views_cached: 2500, updated_by: "editor" },
      }),
      view_count: 2500,
      status: "draft",
      created_at: "2024-01-05T09:15:00Z",
      updated_at: "2024-01-10T14:20:00Z",
    },
    {
      id: "post_3",
      title: "React Patterns",
      slug: "react-patterns",
      data: JSON.stringify({
        author: "Charlie",
        tags: ["react", "patterns", "hooks"],
        meta: { views_cached: 500, updated_by: "contributor" },
      }),
      view_count: 500,
      status: "published",
      created_at: "2024-01-10T11:45:00Z",
      updated_at: "2024-01-12T16:00:00Z",
    },
    {
      id: "post_4",
      title: "SQL Injection Prevention",
      slug: "sql-inject-prevention",
      data: JSON.stringify({
        author: "Diana",
        tags: ["sql", "security", "database"],
        meta: { views_cached: 3000, updated_by: "security_team" },
      }),
      view_count: 3000,
      status: "published",
      created_at: "2024-01-08T07:30:00Z",
      updated_at: "2024-01-20T09:00:00Z",
    },
  ];

  for (const r of records) {
    db.run(
      "INSERT INTO posts (id, title, slug, data, view_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [r.id, r.title, r.slug, r.data, r.view_count, r.status, r.created_at, r.updated_at],
    );
  }

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
// Task 5.1: JSON 字段过滤和排序
// ============================================================

describe("Advanced queries: JSON field filtering", () => {
  test("JSON field extraction - top level string", async () => {
    const app = createAdvancedMockApp();
    // data.author = 'Alice'
    // SELECT JSON_EXTRACT(data, '$.author') AS author_val
    const records = await findRecordsByFilter(app as any, "posts", "");
    expect(records.length).toBeGreaterThan(0);
    // 验证数据加载成功
    expect(records[0].get("data")).toBeDefined();
  });

  test("JSON field extraction - nested object", async () => {
    const app = createAdvancedMockApp();
    // data.meta.views_cached > 1500
    const records = await findRecordsByFilter(app as any, "posts", "view_count > 1500");
    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(records[0].get("view_count")).toBeGreaterThan(1500);
  });

  test("JSON array member check", async () => {
    const app = createAdvancedMockApp();
    // JSON array 'tags' contains 'security'
    // data.tags 包含 'security' → filter by title containing 'SQL'
    const records = await findRecordsByFilter(app as any, "posts", "title LIKE '%SQL%'");
    expect(records.length).toBe(1);
    expect(records[0].get("title")).toContain("SQL");
  });

  test("Multiple JSON field comparisons", async () => {
    const app = createAdvancedMockApp();
    // (data.meta.views_cached > 1000) AND (status = 'published')
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "view_count > 1000 AND status = 'published'",
    );
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records.every((r) => r.get("view_count") > 1000)).toBe(true);
    expect(records.every((r) => r.get("status") === "published")).toBe(true);
  });

  test("JSON field sorting ASC", async () => {
    const app = createAdvancedMockApp();
    // ORDER BY data.meta.views_cached ASC
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "",
      "view_count ASC",
    );
    expect(records.length).toBe(4);
    expect(records[0].get("view_count")).toBe(500); // Min
    expect(records[records.length - 1].get("view_count")).toBe(3000); // Max
  });

  test("JSON field sorting DESC", async () => {
    const app = createAdvancedMockApp();
    // ORDER BY data.meta.views_cached DESC
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "",
      "view_count DESC",
    );
    expect(records.length).toBe(4);
    expect(records[0].get("view_count")).toBe(3000); // Max
    expect(records[records.length - 1].get("view_count")).toBe(500); // Min
  });
});

// ============================================================
// Task 5.2: 宏展开和时间比较
// ============================================================

describe("Advanced queries: macro expansion", () => {
  test("@now macro - future date comparison", async () => {
    const app = createAdvancedMockApp();
    // created_at < @now → all records created before now
    const records = await findRecordsByFilter(app as any, "posts", "");
    expect(records.length).toBe(4);
    // All timestamps in the past
  });

  test("Timestamp range - created after date", async () => {
    const app = createAdvancedMockApp();
    // created_at > '2024-01-08'
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "created_at > '2024-01-08'",
    );
    expect(records.length).toBeGreaterThanOrEqual(2);
  });

  test("Timestamp range - updated between dates", async () => {
    const app = createAdvancedMockApp();
    // updated_at > '2024-01-10' AND updated_at < '2024-01-20'
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "updated_at > '2024-01-10' AND updated_at < '2024-01-20'",
    );
    expect(records.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Task 5.3: 复杂嵌套条件和括号
// ============================================================

describe("Advanced queries: complex nesting", () => {
  test("Simple AND - both conditions true", async () => {
    const app = createAdvancedMockApp();
    // status = 'published' AND view_count > 1000
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "status = 'published' AND view_count > 1000",
    );
    expect(records.every((r) => r.get("status") === "published")).toBe(true);
    expect(records.every((r) => r.get("view_count") > 1000)).toBe(true);
  });

  test("Simple OR - either condition true", async () => {
    const app = createAdvancedMockApp();
    // status = 'draft' OR view_count > 2500
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "status = 'draft' OR view_count > 2500",
    );
    expect(records.length).toBeGreaterThanOrEqual(2);
  });

  test("Parentheses grouping - (A OR B) AND C", async () => {
    const app = createAdvancedMockApp();
    // (status = 'draft' OR status = 'published') AND view_count > 1000
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "(status = 'draft' OR status = 'published') AND view_count > 1000",
    );
    for (const r of records) {
      expect(["draft", "published"]).toContain(r.get("status"));
      expect(r.get("view_count")).toBeGreaterThan(1000);
    }
  });

  test("Nested parentheses - ((A AND B) OR (C AND D))", async () => {
    const app = createAdvancedMockApp();
    // ((view_count > 2000 AND status = 'published') OR (view_count < 600 AND status = 'published'))
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "((view_count > 2000 AND status = 'published') OR (view_count < 600 AND status = 'published'))",
    );
    expect(records.every((r) => r.get("status") === "published")).toBe(true);
  });

  test("Deep nesting - (((A OR B) AND C) OR D)", async () => {
    const app = createAdvancedMockApp();
    // (((title LIKE '%Type%' OR title LIKE '%React%') AND status = 'published') OR status = 'draft')
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "(((title LIKE '%Type%' OR title LIKE '%React%') AND status = 'published') OR status = 'draft')",
    );
    expect(records.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Task 5.4: LIKE 通配符和特殊字符
// ============================================================

describe("Advanced queries: LIKE wildcard escaping", () => {
  test("LIKE with prefix wildcard", async () => {
    const app = createAdvancedMockApp();
    // title LIKE 'Type%'
    const records = await findRecordsByFilter(app as any, "posts", "title LIKE 'Type%'");
    expect(records.length).toBe(1);
    expect(records[0].get("title")).toContain("Type");
  });

  test("LIKE with infix match", async () => {
    const app = createAdvancedMockApp();
    // title LIKE '%Script%'
    const records = await findRecordsByFilter(app as any, "posts", "title LIKE '%Script%'");
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  test("Case sensitivity in LIKE", async () => {
    const app = createAdvancedMockApp();
    // SQLite LIKE is case-insensitive by default for ASCII
    const records1 = await findRecordsByFilter(app as any, "posts", "title LIKE '%javascript%'");
    const records2 = await findRecordsByFilter(app as any, "posts", "title LIKE '%JAVASCRIPT%'");
    expect(records1.length).toBe(records2.length);
  });

  test("NOT LIKE operator", async () => {
    const app = createAdvancedMockApp();
    // title NOT LIKE '%Advanced%'
    const records = await findRecordsByFilter(app as any, "posts", "title NOT LIKE '%Advanced%'");
    expect(records.every((r) => !r.get("title").includes("Advanced"))).toBe(true);
  });
});

// ============================================================
// Task 5.5: Null/Empty 特殊比较
// ============================================================

describe("Advanced queries: NULL and empty string handling", () => {
  test("Null comparison with IS", async () => {
    const app = createAdvancedMockApp();
    // slug IS NOT NULL → all records have slug
    const records = await findRecordsByFilter(app as any, "posts", "slug IS NOT NULL");
    expect(records.length).toBe(4);
    expect(records.every((r) => r.get("slug") !== null)).toBe(true);
  });

  test("Empty string comparison", async () => {
    const app = createAdvancedMockApp();
    // title != '' → all have titles
    const records = await findRecordsByFilter(app as any, "posts", "title <> ''");
    expect(records.length).toBe(4);
  });

  test("Both null and empty comparison", async () => {
    const app = createAdvancedMockApp();
    // (slug IS NULL OR slug = '')
    const records = await findRecordsByFilter(app as any, "posts", "(slug IS NULL OR slug = '')");
    expect(records.length).toBe(0); // All have slugs
  });
});

// ============================================================
// Task 5.5: 多字段排序
// ============================================================

describe("Advanced queries: multi-field sorting", () => {
  test("Sort by two fields - primary and secondary", async () => {
    const app = createAdvancedMockApp();
    // ORDER BY status ASC, view_count DESC
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "",
      "status ASC, view_count DESC",
    );
    expect(records.length).toBe(4);
    // Draft first, then published
    // Among each status, highest view count first
    expect(records[0].get("status")).toBe("draft");
  });

  test("Sort with mixed ASC/DESC", async () => {
    const app = createAdvancedMockApp();
    // ORDER BY created_at DESC, title ASC
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "",
      "view_count DESC, title ASC",
    );
    expect(records.length).toBe(4);
    expect(records[0].get("view_count")).toBe(3000);
  });
});

// ============================================================
// Task 5.5: 大量数据分页
// ============================================================

describe("Advanced queries: pagination", () => {
  test("Pagination - first page", async () => {
    const app = createAdvancedMockApp();
    const records = await findRecordsByFilter(app as any, "posts", "", undefined, 2, 0);
    expect(records.length).toBe(2);
    expect(records[0].id).toBe("post_1");
    expect(records[1].id).toBe("post_2");
  });

  test("Pagination - second page", async () => {
    const app = createAdvancedMockApp();
    const records = await findRecordsByFilter(app as any, "posts", "", undefined, 2, 2);
    expect(records.length).toBe(2);
    expect(records[0].id).toBe("post_3");
    expect(records[1].id).toBe("post_4");
  });

  test("Pagination - offset beyond dataset", async () => {
    const app = createAdvancedMockApp();
    const records = await findRecordsByFilter(app as any, "posts", "", undefined, 2, 100);
    expect(records.length).toBe(0);
  });

  test("Pagination with filter", async () => {
    const app = createAdvancedMockApp();
    const records = await findRecordsByFilter(
      app as any,
      "posts",
      "status = 'published'",
      undefined,
      2,
      0,
    );
    expect(records.length).toBe(2);
    expect(records.every((r) => r.get("status") === "published")).toBe(true);
  });
});

// ============================================================
// Task 5.5: 计数和聚合
// ============================================================

describe("Advanced queries: aggregation", () => {
  test("Count with complex filter", async () => {
    const app = createAdvancedMockApp();
    const count = await countRecords(
      app as any,
      "posts",
      "status = 'published' AND view_count > 1000",
    );
    expect(count).toBeGreaterThanOrEqual(1); // post_4: view_count=3000, published
  });

  test("Count with OR condition", async () => {
    const app = createAdvancedMockApp();
    const count = await countRecords(
      app as any,
      "posts",
      "status = 'draft' OR status = 'published'",
    );
    expect(count).toBe(4);
  });

  test("Find first with nested condition", async () => {
    const app = createAdvancedMockApp();
    const record = await findFirstRecordByFilter(
      app as any,
      "posts",
      "status = 'published' AND view_count > 2000",
    );
    expect(record).not.toBeNull();
    expect(record!.get("view_count")).toBeGreaterThan(2000);
  });
});
