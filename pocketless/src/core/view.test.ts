/**
 * View 集合测试 — T039
 * 覆盖 saveView / deleteView / createViewFields / 字段类型推断
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { saveView, deleteView, createViewFields } from "./view";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteAdapter } from "./db_adapter_sqlite";

/**
 * 创建最小化的 app-like 对象（只需 dbAdapter）
 */
function createTestApp() {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-view-"));
  const adapter = new SQLiteAdapter(join(tmpDir, "data.db"));
  return {
    dbAdapter: () => adapter,
  };
}

describe("View 集合支持 (T039)", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();

    // 创建测试用的 base 表
    app.dbAdapter().exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT DEFAULT '',
        body TEXT DEFAULT '',
        views INTEGER DEFAULT 0,
        created TEXT DEFAULT '',
        updated TEXT DEFAULT ''
      )
    `);

    // 插入测试数据
    app.dbAdapter().exec(`
      INSERT INTO posts (id, title, body, views, created, updated)
      VALUES ('rec1', 'Hello', 'World', 10, '2024-01-01', '2024-01-02')
    `);
    app.dbAdapter().exec(`
      INSERT INTO posts (id, title, body, views, created, updated)
      VALUES ('rec2', 'Foo', 'Bar', 20, '2024-01-03', '2024-01-04')
    `);
  });

  // ─── saveView ───

  test("saveView — 创建 SQL 视图", () => {
    saveView(app, "posts_summary", "SELECT id, title, views FROM posts");

    // 验证视图存在且可以查询
    const rows = app.dbAdapter().query<{ id: string; title: string; views: number }>(
      "SELECT * FROM posts_summary"
    );
    expect(rows.length).toBe(2);
    expect(rows[0].title).toBe("Hello");
    expect(rows[0].views).toBe(10);
  });

  test("saveView — 更新已有视图", () => {
    saveView(app, "posts_summary", "SELECT id, title FROM posts");

    const rows = app.dbAdapter().query<{ id: string; title: string }>(
      "SELECT * FROM posts_summary"
    );
    expect(rows.length).toBe(2);

    // 不再包含 views 列
    expect((rows[0] as any).views).toBeUndefined();
  });

  test("saveView — 无效 SQL 抛出错误", () => {
    expect(() => {
      saveView(app, "bad_view", "INVALID SQL QUERY");
    }).toThrow();
  });

  // ─── deleteView ───

  test("deleteView — 删除已有视图", () => {
    saveView(app, "to_delete", "SELECT id, title FROM posts");
    deleteView(app, "to_delete");

    // 查询已删除的视图应该失败
    expect(() => {
      app.dbAdapter().query("SELECT * FROM to_delete");
    }).toThrow();
  });

  test("deleteView — 删除不存在的视图不报错", () => {
    expect(() => {
      deleteView(app, "nonexistent_view");
    }).not.toThrow();
  });

  // ─── createViewFields ───

  test("createViewFields — 从 SELECT 推断字段", () => {
    const fields = createViewFields(app, "SELECT id, title, views FROM posts");

    expect(fields.length).toBeGreaterThanOrEqual(3);

    const idField = fields.find(f => f.name === "id");
    expect(idField).toBeDefined();

    const titleField = fields.find(f => f.name === "title");
    expect(titleField).toBeDefined();
    expect(titleField!.type).toBe("text");

    const viewsField = fields.find(f => f.name === "views");
    expect(viewsField).toBeDefined();
    expect(viewsField!.type).toBe("number");
  });

  test("createViewFields — COUNT 聚合推断为 number", () => {
    const fields = createViewFields(app, "SELECT id, COUNT(*) as total FROM posts GROUP BY id");

    const totalField = fields.find(f => f.name === "total");
    expect(totalField).toBeDefined();
    expect(totalField!.type).toBe("number");
  });

  test("createViewFields — 需要 id 列", () => {
    expect(() => {
      createViewFields(app, "SELECT title, views FROM posts");
    }).toThrow(/id/i);
  });
});
