/**
 * SearchProvider 测试 — 对照 Go 版 provider_test.go
 * 覆盖分页、排序、过滤、skipTotal
 */

import { describe, test, expect } from "bun:test";
import {
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  DEFAULT_FILTER_EXPR_LIMIT,
  DEFAULT_SORT_EXPR_LIMIT,
  MAX_FILTER_LENGTH,
  MAX_SORT_FIELD_LENGTH,
  type SearchResult,
  execSearch,
  type SearchProviderOptions,
} from "./provider";
import { SimpleFieldResolver } from "./filter_resolver";
import type { DBAdapter } from "../../core/db_adapter";

// ─── Mock DBAdapter ───

interface MockRow {
  [key: string]: unknown;
}

/**
 * 创建一个简单的内存 mock DBAdapter 用于测试
 * 只实现 query 和 queryOne 方法
 */
function createMockDB(rows: MockRow[]): DBAdapter & { calledQueries: string[] } {
  const calledQueries: string[] = [];

  return {
    calledQueries,
    type() {
      return "sqlite" as const;
    },
    query(sql: string, ..._params: unknown[]): unknown[] {
      calledQueries.push(sql);
      // 简单的 OFFSET/LIMIT 解析
      const limitMatch = sql.match(/LIMIT (\d+)/);
      const offsetMatch = sql.match(/OFFSET (\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1]) : rows.length;
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
      return rows.slice(offset, offset + limit);
    },
    queryOne(sql: string, ..._params: unknown[]): unknown {
      calledQueries.push(sql);
      // COUNT 查询返回总数
      if (sql.includes("COUNT")) {
        return { count: rows.length };
      }
      return rows[0] ?? null;
    },
    exec(sql: string, ..._params: unknown[]): void {
      calledQueries.push(sql);
    },
    boolValue(val: boolean): unknown {
      return val ? 1 : 0;
    },
    formatBool(val: boolean): string {
      return val ? "1" : "0";
    },
    formatTime(date: Date): string {
      return date.toISOString();
    },
    jsonExtract(column: string, path: string): string {
      return `JSON_EXTRACT(${column}, '$.${path}')`;
    },
    jsonArrayLength(column: string): string {
      return `JSON_ARRAY_LENGTH(${column})`;
    },
    noCaseCollation(): string {
      return "COLLATE NOCASE";
    },
    isUniqueViolation(err: Error): boolean {
      return err.message.includes("UNIQUE");
    },
    isForeignKeyViolation(err: Error): boolean {
      return err.message.includes("FOREIGN KEY");
    },
  };
}

// ─── 常量测试 ───

describe("Provider: constants", () => {
  test("DEFAULT_PER_PAGE = 30", () => {
    expect(DEFAULT_PER_PAGE).toBe(30);
  });

  test("MAX_PER_PAGE = 1000", () => {
    expect(MAX_PER_PAGE).toBe(1000);
  });

  test("DEFAULT_FILTER_EXPR_LIMIT = 200", () => {
    expect(DEFAULT_FILTER_EXPR_LIMIT).toBe(200);
  });

  test("DEFAULT_SORT_EXPR_LIMIT = 8", () => {
    expect(DEFAULT_SORT_EXPR_LIMIT).toBe(8);
  });

  test("MAX_FILTER_LENGTH = 3500", () => {
    expect(MAX_FILTER_LENGTH).toBe(3500);
  });

  test("MAX_SORT_FIELD_LENGTH = 255", () => {
    expect(MAX_SORT_FIELD_LENGTH).toBe(255);
  });
});

// ─── 分页 ───

describe("Provider: pagination", () => {
  const testRows = [
    { id: 1, name: "row1" },
    { id: 2, name: "row2" },
    { id: 3, name: "row3" },
    { id: 4, name: "row4" },
    { id: 5, name: "row5" },
  ];

  function makeOptions(rows: MockRow[]): SearchProviderOptions {
    return {
      fieldResolver: new SimpleFieldResolver(["id", "name"]),
      dbAdapter: createMockDB(rows),
      tableName: "test",
    };
  }

  test("默认分页参数", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      {},
    );
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(DEFAULT_PER_PAGE);
  });

  test("page 标准化: 负值 → 1", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { page: "-1" },
    );
    expect(result.page).toBe(1);
  });

  test("perPage 标准化: 0 → DEFAULT_PER_PAGE", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { perPage: "0" },
    );
    expect(result.perPage).toBe(DEFAULT_PER_PAGE);
  });

  test("perPage 上限: 超大值 → MAX_PER_PAGE", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { perPage: "9999" },
    );
    expect(result.perPage).toBe(MAX_PER_PAGE);
  });

  test("指定 page 和 perPage", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { page: "2", perPage: "2" },
    );
    expect(result.page).toBe(2);
    expect(result.perPage).toBe(2);
  });
});

// ─── totalItems / totalPages ───

describe("Provider: total counting", () => {
  const testRows = [
    { id: 1, name: "row1" },
    { id: 2, name: "row2" },
  ];

  test("计算 totalItems", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      {},
    );
    expect(result.totalItems).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  test("totalPages 计算正确", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { perPage: "1" },
    );
    expect(result.totalPages).toBe(2);
  });

  test("skipTotal 跳过计数", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { skipTotal: "true" },
    );
    expect(result.totalItems).toBe(-1);
    expect(result.totalPages).toBe(-1);
  });

  test("skipTotal 少执行一条 COUNT 查询", () => {
    const db = createMockDB(testRows);
    execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { skipTotal: "true" },
    );
    // skipTotal=true 时只有数据查询，没有 COUNT 查询
    const countQueries = db.calledQueries.filter((q) => q.includes("COUNT"));
    expect(countQueries).toHaveLength(0);
  });

  test("非 skipTotal 执行 COUNT 查询", () => {
    const db = createMockDB(testRows);
    execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      {},
    );
    const countQueries = db.calledQueries.filter((q) => q.includes("COUNT"));
    expect(countQueries).toHaveLength(1);
  });
});

// ─── 排序 ───

describe("Provider: sorting", () => {
  const testRows = [{ id: 1 }, { id: 2 }];

  test("默认排序", () => {
    const db = createMockDB(testRows);
    execSearch(
      {
        fieldResolver: new SimpleFieldResolver(["id", "name"]),
        dbAdapter: db,
        tableName: "test",
        defaultSort: "-id",
      },
      {},
    );
    const dataQuery = db.calledQueries.find((q) => !q.includes("COUNT"));
    expect(dataQuery).toContain("ORDER BY");
    expect(dataQuery).toContain("DESC");
  });

  test("用户排序覆盖默认", () => {
    const db = createMockDB(testRows);
    execSearch(
      {
        fieldResolver: new SimpleFieldResolver(["id", "name"]),
        dbAdapter: db,
        tableName: "test",
        defaultSort: "-id",
      },
      { sort: "+name" },
    );
    const dataQuery = db.calledQueries.find((q) => !q.includes("COUNT"));
    expect(dataQuery).toContain("ORDER BY");
  });

  test("排序表达式过长抛出错误", () => {
    const db = createMockDB(testRows);
    const longSort = "a".repeat(MAX_SORT_FIELD_LENGTH + 1);
    expect(() =>
      execSearch(
        { fieldResolver: new SimpleFieldResolver(["id"]), dbAdapter: db, tableName: "test" },
        { sort: longSort },
      ),
    ).toThrow("sort expression is too long");
  });
});

// ─── 过滤 ───

describe("Provider: filtering", () => {
  const testRows = [
    { id: 1, name: "alice" },
    { id: 2, name: "bob" },
  ];

  test("有效过滤", () => {
    const db = createMockDB(testRows);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
      { filter: "name = 'alice'" },
    );
    // 查询应包含 WHERE
    const dataQuery = db.calledQueries.find((q) => !q.includes("COUNT"));
    expect(dataQuery).toContain("WHERE");
  });

  test("无效过滤抛出错误", () => {
    const db = createMockDB(testRows);
    expect(() =>
      execSearch(
        { fieldResolver: new SimpleFieldResolver(["id", "name"]), dbAdapter: db, tableName: "test" },
        { filter: "(invalid" },
      ),
    ).toThrow();
  });

  test("过滤表达式过长抛出错误", () => {
    const db = createMockDB(testRows);
    const longFilter = "a".repeat(MAX_FILTER_LENGTH + 1);
    expect(() =>
      execSearch(
        { fieldResolver: new SimpleFieldResolver(["id"]), dbAdapter: db, tableName: "test" },
        { filter: longFilter },
      ),
    ).toThrow("filter expression is too long");
  });
});

// ─── extraWhere ───

describe("Provider: extraWhere", () => {
  const testRows = [{ id: 1 }];

  test("extraWhere 被添加到查询", () => {
    const db = createMockDB(testRows);
    execSearch(
      {
        fieldResolver: new SimpleFieldResolver(["id"]),
        dbAdapter: db,
        tableName: "test",
        extraWhere: "id > 0",
      },
      {},
    );
    const dataQuery = db.calledQueries.find((q) => !q.includes("COUNT"));
    expect(dataQuery).toContain("WHERE");
    expect(dataQuery).toContain("id > 0");
  });

  test("extraWhere + filter 合并", () => {
    const db = createMockDB(testRows);
    execSearch(
      {
        fieldResolver: new SimpleFieldResolver(["id", "name"]),
        dbAdapter: db,
        tableName: "test",
        extraWhere: "id > 0",
      },
      { filter: "name = 'test'" },
    );
    const dataQuery = db.calledQueries.find((q) => !q.includes("COUNT"));
    expect(dataQuery).toContain("AND");
  });
});

// ─── 返回结果格式 ───

describe("Provider: result format", () => {
  test("零结果", () => {
    const db = createMockDB([]);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id"]), dbAdapter: db, tableName: "test" },
      {},
    );
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
    expect(result.totalPages).toBeGreaterThanOrEqual(0);
  });

  test("结果包含所有必需字段", () => {
    const db = createMockDB([{ id: 1 }]);
    const result = execSearch(
      { fieldResolver: new SimpleFieldResolver(["id"]), dbAdapter: db, tableName: "test" },
      {},
    );
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("perPage");
    expect(result).toHaveProperty("totalItems");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("items");
  });
});
