/**
 * T046 — dbutils/index.test.ts
 * 对照 Go 版 tools/dbutils/index_test.go
 * 测试 SQL CREATE INDEX 语句的解析和构建
 */

import { describe, test, expect } from "bun:test";
import { parseIndex, type Index } from "./index";

describe("parseIndex", () => {
  test("empty string returns invalid index", () => {
    const idx = parseIndex("");
    expect(idx.isValid()).toBe(false);
  });

  test("invalid SQL returns invalid index", () => {
    const idx = parseIndex("NOT AN INDEX");
    expect(idx.isValid()).toBe(false);
  });

  test("simple index", () => {
    const idx = parseIndex("CREATE INDEX idx_test ON my_table (col1)");
    expect(idx.isValid()).toBe(true);
    expect(idx.indexName).toBe("idx_test");
    expect(idx.tableName).toBe("my_table");
    expect(idx.unique).toBe(false);
    expect(idx.optional).toBe(false);
    expect(idx.columns).toHaveLength(1);
    expect(idx.columns[0].name).toBe("col1");
  });

  test("unique index", () => {
    const idx = parseIndex("CREATE UNIQUE INDEX idx_unique ON tbl (col1)");
    expect(idx.unique).toBe(true);
    expect(idx.indexName).toBe("idx_unique");
  });

  test("IF NOT EXISTS", () => {
    const idx = parseIndex("CREATE INDEX IF NOT EXISTS idx_opt ON tbl (col1)");
    expect(idx.optional).toBe(true);
    expect(idx.indexName).toBe("idx_opt");
  });

  test("multiple columns", () => {
    const idx = parseIndex("CREATE INDEX idx_multi ON tbl (col1, col2, col3)");
    expect(idx.columns).toHaveLength(3);
    expect(idx.columns[0].name).toBe("col1");
    expect(idx.columns[1].name).toBe("col2");
    expect(idx.columns[2].name).toBe("col3");
  });

  test("column with sort order", () => {
    const idx = parseIndex("CREATE INDEX idx_sort ON tbl (col1 ASC, col2 DESC)");
    expect(idx.columns[0].name).toBe("col1");
    expect(idx.columns[0].sort).toBe("ASC");
    expect(idx.columns[1].name).toBe("col2");
    expect(idx.columns[1].sort).toBe("DESC");
  });

  test("column with collation", () => {
    const idx = parseIndex("CREATE INDEX idx_coll ON tbl (col1 COLLATE NOCASE)");
    expect(idx.columns[0].name).toBe("col1");
    expect(idx.columns[0].collate).toBe("NOCASE");
  });

  test("partial index with WHERE clause", () => {
    const idx = parseIndex("CREATE INDEX idx_partial ON tbl (col1) WHERE col1 != ''");
    expect(idx.where).toBe("col1 != ''");
    expect(idx.columns).toHaveLength(1);
  });

  test("schema-qualified names", () => {
    const idx = parseIndex("CREATE INDEX schema.idx_name ON schema.tbl_name (col1)");
    expect(idx.schemaName).toBe("schema");
    expect(idx.indexName).toBe("idx_name");
    expect(idx.tableName).toBe("tbl_name");
  });

  test("backtick-quoted identifiers", () => {
    const idx = parseIndex("CREATE INDEX `idx_name` ON `tbl_name` (`col 1`, `col 2`)");
    expect(idx.indexName).toBe("idx_name");
    expect(idx.tableName).toBe("tbl_name");
    expect(idx.columns[0].name).toBe("col 1");
    expect(idx.columns[1].name).toBe("col 2");
  });

  test("double-quoted identifiers", () => {
    const idx = parseIndex('CREATE INDEX "idx_name" ON "tbl_name" ("col 1")');
    expect(idx.indexName).toBe("idx_name");
    expect(idx.tableName).toBe("tbl_name");
    expect(idx.columns[0].name).toBe("col 1");
  });

  test("expression-based column", () => {
    const idx = parseIndex("CREATE INDEX idx_expr ON tbl (LOWER(col1))");
    expect(idx.columns[0].name).toBe("LOWER(col1)");
  });

  test("case insensitive parsing", () => {
    const idx = parseIndex("create unique index IF NOT EXISTS idx ON tbl (col1)");
    expect(idx.unique).toBe(true);
    expect(idx.optional).toBe(true);
    expect(idx.indexName).toBe("idx");
  });
});

describe("Index.build()", () => {
  test("simple index", () => {
    const idx = parseIndex("CREATE INDEX idx_test ON my_table (col1)");
    const sql = idx.build();
    expect(sql).toContain("CREATE INDEX");
    expect(sql).toContain("`idx_test`");
    expect(sql).toContain("`my_table`");
    expect(sql).toContain("`col1`");
  });

  test("unique index", () => {
    const idx = parseIndex("CREATE UNIQUE INDEX idx_u ON tbl (col1)");
    expect(idx.build()).toContain("UNIQUE");
  });

  test("IF NOT EXISTS", () => {
    const idx = parseIndex("CREATE INDEX IF NOT EXISTS idx ON tbl (col1)");
    expect(idx.build()).toContain("IF NOT EXISTS");
  });

  test("partial index with WHERE", () => {
    const idx = parseIndex("CREATE INDEX idx ON tbl (col1) WHERE col1 != ''");
    const sql = idx.build();
    expect(sql).toContain("WHERE");
    expect(sql).toContain("col1 != ''");
  });

  test("multiple columns with sort", () => {
    const idx = parseIndex("CREATE INDEX idx ON tbl (col1 ASC, col2 DESC)");
    const sql = idx.build();
    expect(sql).toContain("ASC");
    expect(sql).toContain("DESC");
  });

  test("expression column not quoted", () => {
    const idx = parseIndex("CREATE INDEX idx ON tbl (LOWER(col1))");
    const sql = idx.build();
    expect(sql).toContain("LOWER(col1)");
    // Expression columns should not be wrapped in backticks
    expect(sql).not.toContain("`LOWER(col1)`");
  });

  test("roundtrip: parse then build preserves semantics", () => {
    const original = "CREATE UNIQUE INDEX IF NOT EXISTS `idx_test` ON `my_table` (`col1` ASC, `col2` DESC) WHERE `col1` != ''";
    const idx = parseIndex(original);
    const rebuilt = idx.build();
    expect(rebuilt).toContain("UNIQUE");
    expect(rebuilt).toContain("IF NOT EXISTS");
    expect(rebuilt).toContain("`idx_test`");
    expect(rebuilt).toContain("`my_table`");
    expect(rebuilt).toContain("ASC");
    expect(rebuilt).toContain("DESC");
    expect(rebuilt).toContain("WHERE");
  });

  test("invalid index returns empty string", () => {
    const idx = parseIndex("");
    expect(idx.build()).toBe("");
  });
});

describe("findSingleColumnUniqueIndex", () => {
  // import at top level
  test("finds matching unique index", async () => {
    const { findSingleColumnUniqueIndex } = await import("./index");
    const indexes = [
      "CREATE INDEX idx1 ON tbl (col1)",
      "CREATE UNIQUE INDEX idx2 ON tbl (col2)",
      "CREATE UNIQUE INDEX idx3 ON tbl (col1, col2)",
    ];
    const result = findSingleColumnUniqueIndex(indexes, "col2");
    expect(result).not.toBeNull();
    expect(result!.indexName).toBe("idx2");
  });

  test("returns null when no match", async () => {
    const { findSingleColumnUniqueIndex } = await import("./index");
    const indexes = [
      "CREATE INDEX idx1 ON tbl (col1)",
      "CREATE UNIQUE INDEX idx2 ON tbl (col1, col2)",
    ];
    const result = findSingleColumnUniqueIndex(indexes, "col1");
    // idx1 is not unique, idx2 is multi-column
    expect(result).toBeNull();
  });
});
