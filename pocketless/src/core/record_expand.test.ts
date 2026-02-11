/**
 * T166 — record_expand.test.ts
 * 对照 Go 版 core/record_expand_test.go
 * 测试 expandRecords：单层/嵌套展开、空记录、深度限制
 * 使用真实 bun:sqlite 内存数据库
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { expandRecords } from "./record_expand";
import { CollectionModel } from "./collection_model";
import { RecordModel } from "./record_model";
import { SQLiteAdapter } from "./db_adapter_sqlite";
import type { BaseApp } from "./base";

/**
 * 创建 mock BaseApp，只实现 expandRecords 需要的方法
 */
function createMockApp(adapter: SQLiteAdapter): BaseApp & { _registerCollection: (col: CollectionModel) => void } {
  const collections = new Map<string, CollectionModel>();

  return {
    dbAdapter: () => adapter,
    findCollectionByNameOrId: async (nameOrId: string) => {
      if (collections.has(nameOrId)) return collections.get(nameOrId)!;
      for (const col of collections.values()) {
        if (col.name === nameOrId) return col;
      }
      return null;
    },
    _registerCollection: (col: CollectionModel) => {
      collections.set(col.id, col);
    },
  } as any;
}

describe("expandRecords", () => {
  let adapter: SQLiteAdapter;
  let app: ReturnType<typeof createMockApp>;

  let postsCol: CollectionModel;
  let authorsCol: CollectionModel;
  let commentsCol: CollectionModel;

  beforeEach(() => {
    adapter = new SQLiteAdapter(":memory:");

    // 创建 authors 表
    adapter.exec("CREATE TABLE authors (id TEXT PRIMARY KEY, created TEXT, updated TEXT, name TEXT)");
    adapter.exec("INSERT INTO authors VALUES ('a1', '2024-01-01', '2024-01-01', 'Alice')");
    adapter.exec("INSERT INTO authors VALUES ('a2', '2024-01-01', '2024-01-01', 'Bob')");

    // 创建 comments 表
    adapter.exec("CREATE TABLE comments (id TEXT PRIMARY KEY, created TEXT, updated TEXT, text TEXT, author TEXT)");
    adapter.exec("INSERT INTO comments VALUES ('cm1', '2024-01-01', '2024-01-01', 'Great!', 'a1')");
    adapter.exec("INSERT INTO comments VALUES ('cm2', '2024-01-01', '2024-01-01', 'Thanks!', 'a2')");

    // 创建 posts 表
    adapter.exec("CREATE TABLE posts (id TEXT PRIMARY KEY, created TEXT, updated TEXT, title TEXT, author TEXT, comments TEXT)");
    adapter.exec(`INSERT INTO posts VALUES ('p1', '2024-01-01', '2024-01-01', 'Hello', 'a1', '["cm1","cm2"]')`);

    // 创建 collection models
    authorsCol = new CollectionModel();
    authorsCol.load({
      id: "col_authors",
      type: "base",
      name: "authors",
      fields: JSON.stringify([
        { id: "f_name", name: "name", type: "text", required: false, options: {} },
      ]),
    });

    commentsCol = new CollectionModel();
    commentsCol.load({
      id: "col_comments",
      type: "base",
      name: "comments",
      fields: JSON.stringify([
        { id: "f_text", name: "text", type: "text", required: false, options: {} },
        { id: "f_author", name: "author", type: "relation", required: false, options: { collectionId: "col_authors", maxSelect: 1 } },
      ]),
    });

    postsCol = new CollectionModel();
    postsCol.load({
      id: "col_posts",
      type: "base",
      name: "posts",
      fields: JSON.stringify([
        { id: "f_title", name: "title", type: "text", required: false, options: {} },
        { id: "f_author", name: "author", type: "relation", required: false, options: { collectionId: "col_authors", maxSelect: 1 } },
        { id: "f_comments", name: "comments", type: "relation", required: false, options: { collectionId: "col_comments", maxSelect: 10 } },
      ]),
    });

    app = createMockApp(adapter);
    app._registerCollection(authorsCol);
    app._registerCollection(commentsCol);
    app._registerCollection(postsCol);
  });

  test("empty expandStr — no-op", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", title: "Hello", author: "a1" });
    await expandRecords(app as any, [record], "");
    const expand = record.getExpand();
    expect(Object.keys(expand)).toHaveLength(0);
  });

  test("empty records array — no-op", async () => {
    await expandRecords(app as any, [], "author");
    // 不应抛错
  });

  test("single relation expand", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", title: "Hello", author: "a1" });
    await expandRecords(app as any, [record], "author");
    const expand = record.getExpand();
    expect(expand.author).toBeDefined();
    expect((expand.author as any).id).toBe("a1");
  });

  test("multi relation expand", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", title: "Hello", comments: ["cm1", "cm2"] });
    await expandRecords(app as any, [record], "comments");
    const expand = record.getExpand();
    expect(expand.comments).toBeDefined();
    expect(Array.isArray(expand.comments)).toBe(true);
    expect((expand.comments as any[]).length).toBe(2);
  });

  test("expand non-relation field — ignored", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", title: "Hello" });
    await expandRecords(app as any, [record], "title");
    const expand = record.getExpand();
    expect(expand.title).toBeUndefined();
  });

  test("expand non-existent field — ignored", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1" });
    await expandRecords(app as any, [record], "nonexistent");
    const expand = record.getExpand();
    expect(expand.nonexistent).toBeUndefined();
  });

  test("expand with empty relation value — no expand set", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", author: "" });
    await expandRecords(app as any, [record], "author");
    const expand = record.getExpand();
    expect(expand.author).toBeUndefined();
  });

  test("expand with missing related records — no expand set", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", author: "nonexistent_id" });
    await expandRecords(app as any, [record], "author");
    const expand = record.getExpand();
    expect(expand.author).toBeUndefined();
  });

  test("maxDepth 0 — no expansion", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", author: "a1" });
    await expandRecords(app as any, [record], "author", 0);
    const expand = record.getExpand();
    expect(expand.author).toBeUndefined();
  });

  test("nested expand: comments.author", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", comments: ["cm1"] });
    await expandRecords(app as any, [record], "comments.author");
    const expand = record.getExpand();
    expect(expand.comments).toBeDefined();
    expect(Array.isArray(expand.comments)).toBe(true);
    expect((expand.comments as any[]).length).toBe(1);
  });

  test("multiple expand paths", async () => {
    const record = new RecordModel(postsCol);
    record.load({ id: "p1", author: "a1", comments: ["cm1"] });
    await expandRecords(app as any, [record], "author,comments");
    const expand = record.getExpand();
    expect(expand.author).toBeDefined();
    expect(expand.comments).toBeDefined();
  });

  test("multiple records — batch expand", async () => {
    const r1 = new RecordModel(postsCol);
    r1.load({ id: "p1", author: "a1" });
    const r2 = new RecordModel(postsCol);
    r2.load({ id: "p2", author: "a2" });
    await expandRecords(app as any, [r1, r2], "author");
    expect((r1.getExpand().author as any).id).toBe("a1");
    expect((r2.getExpand().author as any).id).toBe("a2");
  });
});
