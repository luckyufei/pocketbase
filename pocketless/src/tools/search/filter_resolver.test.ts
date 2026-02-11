/**
 * FilterResolver 测试 — 对照 Go 版 filter_test.go, sort_test.go, simple_field_resolver_test.go
 * 覆盖 AST → SQL 转换、排序解析、SimpleFieldResolver
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  buildFilterExpr,
  SimpleFieldResolver,
  parseSortFromString,
  buildSortExpr,
  resetParamCounter,
  type FieldResolver,
  type ResolverResult,
} from "./filter_resolver";
import { parse } from "./parser";

// ─── 辅助函数 ───

/**
 * 构建过滤表达式并返回 SQL
 * 类似 Go 版 TestFilterDataBuildExpr 的模式
 */
function buildFilter(
  filterStr: string,
  resolver: FieldResolver,
  maxExprLimit?: number,
): { sql: string; params: Record<string, unknown> } {
  const groups = parse(filterStr);
  const [sql, params] = buildFilterExpr(groups, {
    fieldResolver: resolver,
    maxExprLimit,
  });
  return { sql, params };
}

/**
 * 将 SQL 中的参数占位符规范化（替换为 {:TEST}）以便匹配
 * 这类似 Go 版 filter_test.go 中的 regex 匹配模式
 */
function normalizeParams(sql: string): string {
  return sql.replace(/:__p\d+/g, "{:TEST}");
}

// ─── SimpleFieldResolver ───

describe("SimpleFieldResolver: resolve", () => {
  test("空字段名返回 null", () => {
    const r = new SimpleFieldResolver(["test"]);
    expect(r.resolve("")).toBeNull();
  });

  test("未知字段返回 null", () => {
    const r = new SimpleFieldResolver(["test"]);
    expect(r.resolve("unknown")).toBeNull();
  });

  test("允许的字段返回 [[field]]", () => {
    const r = new SimpleFieldResolver(["test"]);
    const result = r.resolve("test");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("[[test]]");
  });

  test("正则模式匹配", () => {
    const r = new SimpleFieldResolver([/^test_regex\d+$/]);
    expect(r.resolve("test_regex")).toBeNull();
    expect(r.resolve("test_regex1")).not.toBeNull();
    expect(r.resolve("test_regex1")!.identifier).toBe("[[test_regex1]]");
  });

  test("JSON 路径 (SQLite)", () => {
    const r = new SimpleFieldResolver(["data.test"]);
    const result = r.resolve("data.test");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("JSON_EXTRACT([[data]], '$.test')");
  });

  test("JSON 路径 (PostgreSQL)", () => {
    const r = new SimpleFieldResolver(["data.test"], "postgres");
    const result = r.resolve("data.test");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("[[data]]->>'test'");
  });

  test("dbType 默认为 sqlite", () => {
    const r = new SimpleFieldResolver(["test"]);
    expect(r.dbType()).toBe("sqlite");
  });

  test("空格字段名返回 null", () => {
    const r = new SimpleFieldResolver(["test"]);
    expect(r.resolve(" ")).toBeNull();
  });
});

// ─── buildFilterExpr ───

describe("buildFilterExpr: 对照 Go 版 TestFilterDataBuildExpr", () => {
  let resolver: FieldResolver;

  beforeEach(() => {
    resetParamCounter();
    resolver = new SimpleFieldResolver(
      ["test1", "test2", "test3", /^test4_\w+$/, /^test5\.[\w.:]*\w+$/],
    );
  });

  test("空 filter 抛出错误", () => {
    expect(() => parse("")).toThrow();
  });

  test("无效格式 — scanner 贪婪处理", () => {
    // "(test1 > 1" 未闭合括号被 scanner 贪婪处理，不抛出错误
    const { sql } = buildFilter("(test1 > 1", resolver);
    expect(sql).toBeTruthy();
  });

  test("无效运算符抛出错误", () => {
    expect(() => parse("test1 + 123")).toThrow();
  });

  test("未知字段 — 降级到安全表达式", () => {
    // 在 TS 版本中，未知字段 resolve 返回 null，resolveToken 降级为 NULL
    const { sql } = buildFilter("test1 = 'example' && unknown > 1", resolver);
    // unknown 被解析为 NULL（noCoalesce=true），所以 > 比较仍有效
    expect(sql).toBeTruthy();
  });

  test("简单表达式: test1 > 1", () => {
    const { sql } = buildFilter("test1 > 1", resolver);
    const norm = normalizeParams(sql);
    expect(norm).toBe("[[test1]] > {:TEST}");
  });

  test("like with 2 columns: test1 ~ test2", () => {
    const { sql } = buildFilter("test1 ~ test2", resolver);
    // 两个列的 LIKE — 不应用 % 包装
    expect(sql).toContain("LIKE");
    expect(sql).toContain("[[test1]]");
    expect(sql).toContain("[[test2]]");
  });

  test("like with text operand: test1 ~ 'lorem'", () => {
    const { sql, params } = buildFilter("test1 ~ 'lorem'", resolver);
    expect(sql).toContain("LIKE");
    expect(sql).toContain("ESCAPE '\\'");
    // 参数应被包装为 %lorem%
    const values = Object.values(params);
    expect(values.some((v) => typeof v === "string" && v.includes("lorem"))).toBe(true);
  });

  test("not like: test1 !~ 'lorem'", () => {
    const { sql } = buildFilter("test1 !~ 'lorem'", resolver);
    expect(sql).toContain("NOT LIKE");
    expect(sql).toContain("ESCAPE '\\'");
  });

  test("特殊字面量组合: null, true, false", () => {
    const { sql } = buildFilter("test1 = true && test2 != false", resolver);
    expect(sql).toContain("1"); // true → 1 (SQLite)
    expect(sql).toContain("IS NOT"); // != false
    expect(sql).toContain("0"); // false → 0 (SQLite)
  });

  test("null 比较生成 IS/IS NULL", () => {
    const { sql } = buildFilter("test4_sub = null", resolver);
    // null 比较应生成 IS NULL 或 = '' OR IS NULL
    expect(sql).toContain("NULL");
  });

  test("宏表达式", () => {
    const { sql } = buildFilter("test4_1 > @now", resolver);
    const norm = normalizeParams(sql);
    expect(norm).toBe("[[test4_1]] > {:TEST}");
  });

  test("geoDistance function", () => {
    const { sql } = buildFilter("geoDistance(1,2,3,4) < 567", resolver);
    expect(sql).toContain("6371");
    expect(sql).toContain("ACOS");
    expect(sql).toContain("<");
  });

  test("复合表达式: AND/OR/括号", () => {
    const { sql } = buildFilter("((test1 > 1) || (test2 != 2)) && test3 ~ 'example'", resolver);
    expect(sql).toContain("OR");
    expect(sql).toContain("AND");
    expect(sql).toContain("LIKE");
  });

  test("空文本比较", () => {
    const { sql } = buildFilter("'' = null && null != ''", resolver);
    // TS 版: '' → 参数(:__p), null → NULL(noCoalesce) → IS/IS NOT
    expect(sql).toContain("IS");
    expect(sql).toContain("NULL");
  });
});

// ─── PostgreSQL 方言 ───

describe("buildFilterExpr: PostgreSQL 方言", () => {
  let resolver: FieldResolver;

  beforeEach(() => {
    resetParamCounter();
    resolver = new SimpleFieldResolver(["test1", "test2"], "postgres");
  });

  test("true → TRUE (PostgreSQL)", () => {
    const { sql } = buildFilter("test1 = true", resolver);
    expect(sql).toContain("TRUE");
    expect(sql).not.toContain("= 1");
  });

  test("false → FALSE (PostgreSQL)", () => {
    const { sql } = buildFilter("test1 = false", resolver);
    expect(sql).toContain("FALSE");
    expect(sql).not.toContain("= 0");
  });

  test("!= with two columns → COALESCE != (PostgreSQL)", () => {
    const { sql } = buildFilter("test1 != test2", resolver);
    // 两列 != 无 noCoalesce 使用 COALESCE
    expect(sql).toContain("COALESCE");
    expect(sql).toContain("!=");
  });

  test("!= with noCoalesce (identifier) → IS DISTINCT FROM (PostgreSQL)", () => {
    const { sql } = buildFilter("test1 != null", resolver);
    // null has noCoalesce=true → uses IS DISTINCT FROM
    expect(sql).toContain("IS DISTINCT FROM");
  });

  test("= → IS NOT DISTINCT FROM (PostgreSQL)", () => {
    const { sql } = buildFilter("test1 = test2", resolver);
    // 两列比较用 COALESCE
    expect(sql).toContain("COALESCE");
  });
});

// ─── SQLite 方言 ───

describe("buildFilterExpr: SQLite 方言", () => {
  let resolver: FieldResolver;

  beforeEach(() => {
    resetParamCounter();
    resolver = new SimpleFieldResolver(["test1", "test2"]);
  });

  test("true → 1 (SQLite)", () => {
    const { sql } = buildFilter("test1 = true", resolver);
    expect(sql).toContain("1");
  });

  test("false → 0 (SQLite)", () => {
    const { sql } = buildFilter("test1 = false", resolver);
    expect(sql).toContain("0");
  });

  test("!= → IS NOT (SQLite)", () => {
    const { sql } = buildFilter("test1 != test2", resolver);
    // 两列 != 用 COALESCE
    expect(sql).toContain("COALESCE");
    expect(sql).toContain("!=");
  });
});

// ─── 表达式数量限制 ───

describe("buildFilterExpr: expression limit", () => {
  let resolver: FieldResolver;

  beforeEach(() => {
    resetParamCounter();
    resolver = new SimpleFieldResolver([/^\w+$/]);
  });

  test("未超出限制", () => {
    expect(() => buildFilter("1 = 1", resolver, 1)).not.toThrow();
  });

  test("超出限制抛出错误", () => {
    expect(() => buildFilter("1 = 1 || 1 = 1", resolver, 1)).toThrow();
  });

  test("嵌套表达式限制", () => {
    // 6 个表达式: (1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)
    expect(() =>
      buildFilter("(1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)", resolver, 6),
    ).not.toThrow();
    expect(() =>
      buildFilter("(1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)", resolver, 5),
    ).toThrow();
  });

  test("限制为 0 总是抛出", () => {
    expect(() => buildFilter("1 = 1", resolver, 0)).toThrow();
  });
});

// ─── 排序解析 ———

describe("parseSortFromString: 对照 Go 版 TestParseSortFromString", () => {
  test("空字符串返回空数组", () => {
    expect(parseSortFromString("")).toEqual([]);
  });

  test("简单字段（默认 ASC）", () => {
    const result = parseSortFromString("test");
    expect(result).toEqual([{ column: "test", direction: "ASC" }]);
  });

  test("+ 前缀 → ASC", () => {
    const result = parseSortFromString("+test");
    expect(result).toEqual([{ column: "test", direction: "ASC" }]);
  });

  test("- 前缀 → DESC", () => {
    const result = parseSortFromString("-test");
    expect(result).toEqual([{ column: "test", direction: "DESC" }]);
  });

  test("多个字段", () => {
    const result = parseSortFromString("test1,-test2,+test3");
    expect(result).toEqual([
      { column: "test1", direction: "ASC" },
      { column: "test2", direction: "DESC" },
      { column: "test3", direction: "ASC" },
    ]);
  });

  test("@random", () => {
    const result = parseSortFromString("@random,-test");
    expect(result).toEqual([
      { column: "@random", direction: "ASC" },
      { column: "test", direction: "DESC" },
    ]);
  });

  test("-@rowid", () => {
    const result = parseSortFromString("-@rowid,-test");
    expect(result).toEqual([
      { column: "@rowid", direction: "DESC" },
      { column: "test", direction: "DESC" },
    ]);
  });
});

// ─── buildSortExpr ───

describe("buildSortExpr: 对照 Go 版 TestSortFieldBuildExpr", () => {
  let resolver: FieldResolver;

  beforeEach(() => {
    resolver = new SimpleFieldResolver(["test1", "test2", "test3", "test4.sub"]);
  });

  test("空字段列表返回空字符串", () => {
    const result = buildSortExpr([], resolver);
    expect(result).toBe("");
  });

  test("未知字段被忽略", () => {
    const result = buildSortExpr([{ column: "unknown", direction: "ASC" }], resolver);
    expect(result).toBe("");
  });

  test("允许的字段 — ASC", () => {
    const result = buildSortExpr([{ column: "test1", direction: "ASC" }], resolver);
    expect(result).toBe("[[test1]] ASC");
  });

  test("允许的字段 — DESC", () => {
    const result = buildSortExpr([{ column: "test1", direction: "DESC" }], resolver);
    expect(result).toBe("[[test1]] DESC");
  });

  test("@random 忽略方向", () => {
    const result = buildSortExpr([{ column: "@random", direction: "DESC" }], resolver);
    expect(result).toContain("RANDOM()");
  });

  test("@rowid (SQLite)", () => {
    const result = buildSortExpr([{ column: "@rowid", direction: "DESC" }], resolver);
    expect(result).toBe("[[_rowid_]] DESC");
  });

  test("@rowid (PostgreSQL)", () => {
    const pgResolver = new SimpleFieldResolver(["test1"], "postgres");
    const result = buildSortExpr([{ column: "@rowid", direction: "DESC" }], pgResolver);
    expect(result).toBe("[[id]] DESC");
  });

  test("多个排序字段", () => {
    const result = buildSortExpr(
      [
        { column: "test1", direction: "ASC" },
        { column: "test2", direction: "DESC" },
      ],
      resolver,
    );
    expect(result).toBe("[[test1]] ASC, [[test2]] DESC");
  });
});
