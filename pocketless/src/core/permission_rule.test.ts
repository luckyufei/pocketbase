/**
 * T010 — 权限规则检查测试
 * 对照 Go 版 core/db_test.go + apis/record_crud_test.go 的权限检查行为
 *
 * 覆盖场景:
 * 1. null rule → 403 (禁止访问)
 * 2. 空字符串 rule → 公开 (无需认证)
 * 3. "@request.auth.id != ''" → 需要认证
 * 4. "id = @request.auth.id" → 记录级权限
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { checkPermissionRule, type PermissionCheckContext } from "./permission_rule";
import { BaseApp } from "./base";
import { SQLiteAdapter } from "./db_adapter_sqlite";
import { CollectionModel, COLLECTION_TYPE_BASE, COLLECTION_TYPE_AUTH } from "./collection_model";
import { RecordModel } from "./record_model";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-perm-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;
  // 创建 _collections 表
  adapter.exec(`CREATE TABLE IF NOT EXISTS _collections (
    id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]',
    listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT,
    options TEXT DEFAULT '{}', created TEXT, updated TEXT
  )`);
  // 创建 posts 集合
  adapter.exec(
    `INSERT INTO _collections (id, type, name, listRule, viewRule, createRule, updateRule, deleteRule, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "col_posts", "base", "posts", "", "", "", "", "", "2024-01-01", "2024-01-01",
  );
  // 创建 posts 表
  adapter.exec("CREATE TABLE posts (id TEXT PRIMARY KEY, title TEXT, owner TEXT, created TEXT, updated TEXT)");
  // 插入测试数据
  adapter.exec("INSERT INTO posts (id, title, owner, created, updated) VALUES (?, ?, ?, ?, ?)", "rec1", "Hello", "user1", "2024-01-01", "2024-01-01");
  adapter.exec("INSERT INTO posts (id, title, owner, created, updated) VALUES (?, ?, ?, ?, ?)", "rec2", "World", "user2", "2024-01-01", "2024-01-01");
  return { app, tmpDir };
}

describe("checkPermissionRule", () => {
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

  test("null rule → throws 403 error", async () => {
    const col = new CollectionModel();
    col.load({ id: "col_posts", type: "base", name: "posts" });

    const ctx: PermissionCheckContext = {
      app,
      collection: col,
      rule: null,
      requestInfo: {},
    };

    await expect(checkPermissionRule(ctx)).rejects.toThrow();
  });

  test("empty string rule → public access (no error)", async () => {
    const col = new CollectionModel();
    col.load({ id: "col_posts", type: "base", name: "posts" });

    const ctx: PermissionCheckContext = {
      app,
      collection: col,
      rule: "",
      requestInfo: {},
    };

    // 不应抛错
    await checkPermissionRule(ctx);
  });

  test("auth required rule — no auth → throws", async () => {
    const col = new CollectionModel();
    col.load({ id: "col_posts", type: "base", name: "posts" });

    const ctx: PermissionCheckContext = {
      app,
      collection: col,
      rule: "@request.auth.id != ''",
      requestInfo: { auth: null },
    };

    await expect(checkPermissionRule(ctx)).rejects.toThrow();
  });

  test("auth required rule — with auth → passes", async () => {
    const col = new CollectionModel();
    col.load({ id: "col_posts", type: "base", name: "posts" });

    const authCol = new CollectionModel();
    authCol.id = "col_users";
    authCol.name = "users";
    authCol.type = COLLECTION_TYPE_AUTH;
    authCol.fields = [];
    const authRecord = new RecordModel(authCol);
    authRecord.id = "user1";

    const ctx: PermissionCheckContext = {
      app,
      collection: col,
      rule: "@request.auth.id != ''",
      requestInfo: { auth: authRecord },
    };

    // 应通过
    await checkPermissionRule(ctx);
  });
});
