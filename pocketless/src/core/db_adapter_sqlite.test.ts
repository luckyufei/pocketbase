/**
 * T163 — db_adapter_sqlite.test.ts
 * 对照 Go 版数据库适配器测试
 * 使用 :memory: 数据库测试 SQLiteAdapter 完整功能
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { SQLiteAdapter } from "./db_adapter_sqlite";

describe("SQLiteAdapter", () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter(":memory:");
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe("type", () => {
    test("returns 'sqlite'", () => {
      expect(adapter.type()).toBe("sqlite");
    });
  });

  describe("boolValue", () => {
    test("true → true", () => expect(adapter.boolValue(true)).toBe(true));
    test("1 → true", () => expect(adapter.boolValue(1)).toBe(true));
    test("'1' → true", () => expect(adapter.boolValue("1")).toBe(true));
    test("'true' → true", () => expect(adapter.boolValue("true")).toBe(true));
    test("'yes' → true", () => expect(adapter.boolValue("yes")).toBe(true));

    test("false → false", () => expect(adapter.boolValue(false)).toBe(false));
    test("0 → false", () => expect(adapter.boolValue(0)).toBe(false));
    test("'0' → false", () => expect(adapter.boolValue("0")).toBe(false));
    test("'false' → false", () => expect(adapter.boolValue("false")).toBe(false));
    test("null → false", () => expect(adapter.boolValue(null)).toBe(false));
    test("undefined → false", () => expect(adapter.boolValue(undefined)).toBe(false));
    test("'' → false", () => expect(adapter.boolValue("")).toBe(false));
  });

  describe("formatBool", () => {
    test("true → 1", () => expect(adapter.formatBool(true)).toBe(1));
    test("false → 0", () => expect(adapter.formatBool(false)).toBe(0));
  });

  describe("formatTime", () => {
    test("formats Date to SQLite datetime string", () => {
      const d = new Date("2024-06-15T12:30:45.123Z");
      const result = adapter.formatTime(d);
      // 格式：YYYY-MM-DD HH:mm:ss.SSSZ
      expect(result).toBe("2024-06-15 12:30:45.123Z");
    });

    test("always ends with Z", () => {
      const result = adapter.formatTime(new Date());
      expect(result.endsWith("Z")).toBe(true);
    });

    test("contains space separator instead of T", () => {
      const result = adapter.formatTime(new Date("2024-01-01T00:00:00Z"));
      expect(result).not.toContain("T");
      expect(result).toContain(" ");
    });
  });

  describe("jsonExtract", () => {
    test("generates SQLite JSON_EXTRACT expression", () => {
      expect(adapter.jsonExtract("data", "name")).toBe("JSON_EXTRACT(data, '$.name')");
    });

    test("nested path", () => {
      expect(adapter.jsonExtract("meta", "user.email")).toBe("JSON_EXTRACT(meta, '$.user.email')");
    });
  });

  describe("jsonArrayLength", () => {
    test("generates SQLite JSON_ARRAY_LENGTH expression", () => {
      expect(adapter.jsonArrayLength("tags")).toBe("JSON_ARRAY_LENGTH(tags)");
    });
  });

  describe("noCaseCollation", () => {
    test("returns COLLATE NOCASE", () => {
      expect(adapter.noCaseCollation()).toBe("COLLATE NOCASE");
    });
  });

  describe("isUniqueViolation", () => {
    test("detects UNIQUE constraint error", () => {
      expect(adapter.isUniqueViolation(new Error("UNIQUE constraint failed: users.email"))).toBe(true);
    });

    test("non-unique error returns false", () => {
      expect(adapter.isUniqueViolation(new Error("some other error"))).toBe(false);
    });
  });

  describe("isForeignKeyViolation", () => {
    test("detects FOREIGN KEY constraint error", () => {
      expect(adapter.isForeignKeyViolation(new Error("FOREIGN KEY constraint failed"))).toBe(true);
    });

    test("non-FK error returns false", () => {
      expect(adapter.isForeignKeyViolation(new Error("some other error"))).toBe(false);
    });
  });

  describe("rawDB", () => {
    test("returns Database instance", () => {
      const raw = adapter.rawDB();
      expect(raw).toBeDefined();
      expect(typeof raw).toBe("object");
    });
  });

  describe("exec / query / queryOne", () => {
    test("exec creates table and inserts data", () => {
      adapter.exec("CREATE TABLE test (id TEXT PRIMARY KEY, name TEXT)");
      adapter.exec("INSERT INTO test (id, name) VALUES (?, ?)", "1", "Alice");
      const rows = adapter.query<{ id: string; name: string }>("SELECT * FROM test");
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Alice");
    });

    test("query returns all rows", () => {
      adapter.exec("CREATE TABLE items (id TEXT, val INTEGER)");
      adapter.exec("INSERT INTO items VALUES (?, ?)", "a", 10);
      adapter.exec("INSERT INTO items VALUES (?, ?)", "b", 20);
      adapter.exec("INSERT INTO items VALUES (?, ?)", "c", 30);
      const rows = adapter.query<{ id: string; val: number }>("SELECT * FROM items ORDER BY id");
      expect(rows).toHaveLength(3);
      expect(rows[0].id).toBe("a");
      expect(rows[2].val).toBe(30);
    });

    test("query with params", () => {
      adapter.exec("CREATE TABLE items (id TEXT, val INTEGER)");
      adapter.exec("INSERT INTO items VALUES ('a', 10)");
      adapter.exec("INSERT INTO items VALUES ('b', 20)");
      const rows = adapter.query<{ id: string; val: number }>(
        "SELECT * FROM items WHERE val > ?", 15,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("b");
    });

    test("queryOne returns first matching row", () => {
      adapter.exec("CREATE TABLE items (id TEXT, val INTEGER)");
      adapter.exec("INSERT INTO items VALUES ('a', 10)");
      const row = adapter.queryOne<{ id: string; val: number }>("SELECT * FROM items WHERE id = ?", "a");
      expect(row).not.toBeNull();
      expect(row!.val).toBe(10);
    });

    test("queryOne returns null for no match", () => {
      adapter.exec("CREATE TABLE items (id TEXT)");
      const row = adapter.queryOne("SELECT * FROM items WHERE id = ?", "missing");
      expect(row).toBeNull();
    });

    test("query returns empty array for no matches", () => {
      adapter.exec("CREATE TABLE items (id TEXT)");
      const rows = adapter.query("SELECT * FROM items");
      expect(rows).toEqual([]);
    });
  });

  describe("transaction", () => {
    test("commits successful transaction", () => {
      adapter.exec("CREATE TABLE items (id TEXT PRIMARY KEY, val INTEGER)");
      adapter.transaction(() => {
        adapter.exec("INSERT INTO items VALUES ('a', 1)");
        adapter.exec("INSERT INTO items VALUES ('b', 2)");
      });
      const rows = adapter.query("SELECT * FROM items");
      expect(rows).toHaveLength(2);
    });

    test("rolls back on error", () => {
      adapter.exec("CREATE TABLE items (id TEXT PRIMARY KEY, val INTEGER)");
      try {
        adapter.transaction(() => {
          adapter.exec("INSERT INTO items VALUES ('a', 1)");
          throw new Error("rollback!");
        });
      } catch {
        // expected
      }
      const rows = adapter.query("SELECT * FROM items");
      expect(rows).toHaveLength(0);
    });

    test("returns value from transaction", () => {
      adapter.exec("CREATE TABLE items (id TEXT, val INTEGER)");
      const result = adapter.transaction(() => {
        adapter.exec("INSERT INTO items VALUES ('a', 42)");
        return 42;
      });
      expect(result).toBe(42);
    });
  });

  describe("PRAGMA settings", () => {
    test("WAL mode is set (memory DB falls back to 'memory')", () => {
      const row = adapter.queryOne<{ journal_mode: string }>("PRAGMA journal_mode");
      // :memory: 数据库无法使用 WAL，返回 "memory"
      expect(["wal", "memory"]).toContain(row!.journal_mode);
    });

    test("foreign_keys is ON", () => {
      const row = adapter.queryOne<{ foreign_keys: number }>("PRAGMA foreign_keys");
      expect(row!.foreign_keys).toBe(1);
    });

    test("synchronous is NORMAL", () => {
      // synchronous: NORMAL = 1
      const row = adapter.queryOne<{ synchronous: number }>("PRAGMA synchronous");
      expect(row!.synchronous).toBe(1);
    });
  });

  describe("close", () => {
    test("close does not throw", async () => {
      await adapter.close();
      // 重新创建以避免 afterEach 错误
      adapter = new SQLiteAdapter(":memory:");
    });
  });
});
