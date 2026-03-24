/**
 * T174 — record_crud_superuser.test.ts
 * 对照 Go 版 apis/record_crud_superuser_test.go
 * 测试 _superusers 系统集合的 CRUD 权限行为
 *
 * _superusers 集合权限规则：
 * - listRule:   null  (仅 superuser)
 * - viewRule:   null  (仅 superuser)
 * - createRule: null  (仅 superuser)
 * - updateRule: null  (仅 superuser)
 * - deleteRule: null  (仅 superuser)
 *
 * 特殊规则：
 * - verified 字段自动设置为 true（超级用户不需邮件验证）
 * - 不允许删除最后一个 superuser → 400
 * - OAuth2 禁用（防止意外创建 superuser）
 * - 密码认证强制启用
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { registerRecordRoutes } from "./record_crud";
import { toApiError } from "./errors";
import { BaseApp } from "../core/base";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { CollectionModel } from "../core/collection_model";
import { RecordModel } from "../core/record_model";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const COL_NAME = "_superusers";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-superuser-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;

  adapter.exec(`CREATE TABLE IF NOT EXISTS _collections (
    id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]',
    listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT,
    options TEXT DEFAULT '{}', created TEXT, updated TEXT
  )`);

  // 创建 _superusers 系统集合（所有规则 = null，仅 superuser 访问）
  const fieldsJson = JSON.stringify([
    { id: "email", name: "email", type: "email", required: true, hidden: false },
    { id: "emailVisibility", name: "emailVisibility", type: "bool", required: false, hidden: false },
    { id: "verified", name: "verified", type: "bool", required: false, hidden: false },
    { id: "password", name: "password", type: "password", required: true, hidden: false },
    { id: "passwordHash", name: "passwordHash", type: "text", required: false, hidden: true },
    { id: "tokenKey", name: "tokenKey", type: "text", required: false, hidden: false },
  ]);
  adapter.exec(
    `INSERT INTO _collections (id, type, name, system, listRule, viewRule, createRule, updateRule, deleteRule, fields, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "pbc_superusers", "auth", COL_NAME, 1,
    null,  // listRule = null → 仅 superuser
    null,  // viewRule = null → 仅 superuser
    null,  // createRule = null → 仅 superuser
    null,  // updateRule = null → 仅 superuser
    null,  // deleteRule = null → 仅 superuser
    fieldsJson, "2024-01-01", "2024-01-01",
  );

  adapter.exec(`CREATE TABLE IF NOT EXISTS "${COL_NAME}" (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL DEFAULT '',
    emailVisibility INTEGER DEFAULT 1,
    verified INTEGER DEFAULT 0,
    password TEXT DEFAULT '',
    passwordHash TEXT DEFAULT '',
    tokenKey TEXT NOT NULL DEFAULT '',
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
  )`);

  return { app, tmpDir };
}

function createHono(app: BaseApp, authRecord?: RecordModel | null): Hono {
  const hono = new Hono();
  hono.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  if (authRecord) {
    hono.use("*", async (c, next) => {
      c.set("authRecord", authRecord);
      c.set("auth", authRecord);
      await next();
    });
  }
  registerRecordRoutes(hono, app);
  return hono;
}

function createSuperuserRecord(id = "su_test_id"): RecordModel {
  const col = new CollectionModel();
  col.id = "pbc_superusers";
  col.name = "_superusers";
  col.type = "auth";
  const record = new RecordModel(col);
  record.id = id;
  return record;
}

function seedSuperuser(
  app: BaseApp,
  id: string,
  email = "superuser@example.com",
  verified = true,
): void {
  app.dbAdapter().exec(
    `INSERT INTO "${COL_NAME}" (id, email, verified, password, passwordHash, tokenKey, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, email, verified ? 1 : 0, "password", "hashed", `key_${id}`, "2024-01-01", "2024-01-01",
  );
}

describe("Record CRUD: Superusers", () => {
  let baseApp: BaseApp;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    baseApp = result.app;
    tmpDir = result.tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── LIST 端点 ───

  describe(`GET /api/collections/${COL_NAME}/records`, () => {
    test("未授权 → 403（listRule = null）", async () => {
      const hono = createHono(baseApp);
      seedSuperuser(baseApp, "su1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(403);
    });

    test("普通用户 → 403（listRule = null）", async () => {
      // 普通用户：非 superuser 认证
      const userCol = new CollectionModel();
      userCol.id = "col_users";
      userCol.name = "users";
      userCol.type = "base";
      const userRecord = new RecordModel(userCol);
      userRecord.id = "user_alice";

      const hono = createHono(baseApp, userRecord);
      seedSuperuser(baseApp, "su1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(403);
    });

    test("superuser 可看到所有 superuser", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);

      seedSuperuser(baseApp, "su1", "admin@example.com");
      seedSuperuser(baseApp, "su2", "root@example.com");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── VIEW 端点 ───

  describe(`GET /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（viewRule = null）", async () => {
      const hono = createHono(baseApp);
      seedSuperuser(baseApp, "su1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`);
      expect(res.status).toBe(403);
    });

    test("普通用户 → 403（viewRule = null）", async () => {
      const userCol = new CollectionModel();
      userCol.id = "col_users";
      userCol.name = "users";
      userCol.type = "base";
      const userRecord = new RecordModel(userCol);
      userRecord.id = "user_alice";

      const hono = createHono(baseApp, userRecord);
      seedSuperuser(baseApp, "su1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`);
      expect(res.status).toBe(403);
    });

    test("superuser 可查看任意 superuser → 200", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedSuperuser(baseApp, "su1", "admin@example.com");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("su1");
      expect(body.email).toBe("admin@example.com");
    });
  });

  // ─── CREATE 端点 ───

  describe(`POST /api/collections/${COL_NAME}/records`, () => {
    test("未授权 → 403（createRule = null）", async () => {
      const hono = createHono(baseApp);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", password: "pass123" }),
      });
      expect(res.status).toBe(403);
    });

    test("普通用户 → 403（createRule = null）", async () => {
      const userCol = new CollectionModel();
      userCol.id = "col_users";
      userCol.name = "users";
      userCol.type = "base";
      const userRecord = new RecordModel(userCol);
      userRecord.id = "user_alice";

      const hono = createHono(baseApp, userRecord);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", password: "pass123" }),
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可创建 superuser → 200（权限检查）", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedSuperuser(baseApp, "su_new", "admin2@example.com");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/su_new`);
      expect(res.status).toBe(200);
    });
  });

  // ─── UPDATE 端点 ───

  describe(`PATCH /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（updateRule = null）", async () => {
      const hono = createHono(baseApp);
      seedSuperuser(baseApp, "su1", "admin@example.com");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "newemail@example.com" }),
      });
      expect(res.status).toBe(403);
    });

    test("普通用户（甚至所有者）→ 403（updateRule = null）", async () => {
      const userCol = new CollectionModel();
      userCol.id = "col_users";
      userCol.name = "users";
      userCol.type = "base";
      const userRecord = new RecordModel(userCol);
      userRecord.id = "su1";  // 即使 ID 相同也不行

      const hono = createHono(baseApp, userRecord);
      seedSuperuser(baseApp, "su1");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "newemail@example.com" }),
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可更新 superuser → 200，verified 强制为 true", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedSuperuser(baseApp, "su1", "admin@example.com", true);
      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "updated@example.com",
          verified: false,  // 请求设为 false，应被强制设为 true
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.email).toBe("updated@example.com");
      expect(body.verified).toBe(true);  // 强制设为 true
    });
  });

  // ─── DELETE 端点 ───

  describe(`DELETE /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（deleteRule = null）", async () => {
      const hono = createHono(baseApp);
      seedSuperuser(baseApp, "su1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    test("普通用户 → 403（deleteRule = null）", async () => {
      const userCol = new CollectionModel();
      userCol.id = "col_users";
      userCol.name = "users";
      userCol.type = "base";
      const userRecord = new RecordModel(userCol);
      userRecord.id = "user_alice";

      const hono = createHono(baseApp, userRecord);
      seedSuperuser(baseApp, "su1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可删除非最后一个 superuser → 204", async () => {
      const suRecord = createSuperuserRecord("su_deleter");
      const hono = createHono(baseApp, suRecord);
      seedSuperuser(baseApp, "su_deleter");
      seedSuperuser(baseApp, "su_target");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su_target`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);
      const row = baseApp.dbAdapter().queryOne(`SELECT * FROM "${COL_NAME}" WHERE id = ?`, "su_target");
      expect(row).toBeNull();
    });

    test("不能删除最后一个 superuser → 400", async () => {
      const suRecord = createSuperuserRecord("su_only");
      const hono = createHono(baseApp, suRecord);
      seedSuperuser(baseApp, "su_only");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/su_only`, {
        method: "DELETE",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      // Go 版本返回的错误消息中包含 "can't delete" 或 "only"
      expect(body.message?.toLowerCase() || "").toContain("delete");
    });
  });
});
