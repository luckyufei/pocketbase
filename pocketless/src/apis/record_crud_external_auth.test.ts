/**
 * T171 — record_crud_external_auth.test.ts
 * 对照 Go 版 apis/record_crud_external_auth_test.go
 * 测试 _externalAuths 系统集合的 CRUD 权限行为
 *
 * _externalAuths 集合权限规则：
 * - listRule:   "recordRef = @request.auth.id"  (仅看自己的)
 * - viewRule:   "recordRef = @request.auth.id"  (仅看自己的)
 * - createRule: null                             (仅 superuser)
 * - updateRule: null                             (仅 superuser)
 * - deleteRule: "recordRef = @request.auth.id"  (owner 可删除)
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

const COL_NAME = "_externalAuths";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-extauth-"));
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

  // 创建 _externalAuths 系统集合（权限规则与 Go 版一致）
  adapter.exec(
    `INSERT INTO _collections (id, type, name, system, listRule, viewRule, createRule, updateRule, deleteRule, fields, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "sys_extauth", "base", COL_NAME, 1,
    "recordRef = @request.auth.id",  // listRule
    "recordRef = @request.auth.id",  // viewRule
    null,                             // createRule = 仅 superuser
    null,                             // updateRule = 仅 superuser
    "recordRef = @request.auth.id",  // deleteRule = owner 可删除
    "[]", "2024-01-01", "2024-01-01",
  );

  adapter.exec(`CREATE TABLE IF NOT EXISTS "${COL_NAME}" (
    id TEXT PRIMARY KEY,
    recordRef TEXT NOT NULL DEFAULT '',
    collectionRef TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    providerId TEXT NOT NULL DEFAULT '',
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
  )`);

  return { app, tmpDir };
}

/** 创建带有指定 auth 上下文的 Hono 实例 */
function createHono(
  app: BaseApp,
  authRecord?: RecordModel | null,
): Hono {
  const hono = new Hono();
  hono.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  if (authRecord) {
    hono.use("*", async (c, next) => {
      // record_crud.ts 用 "authRecord" 提取 auth 并检查 isSuperuser()
      c.set("authRecord", authRecord);
      c.set("auth", authRecord);
      await next();
    });
  }
  registerRecordRoutes(hono, app);
  return hono;
}

/** 创建 mock 普通用户 RecordModel */
function createUserRecord(app: BaseApp, colName: string, userId: string): RecordModel {
  // 从数据库读取集合配置
  const row = app.dbAdapter().queryOne<Record<string, unknown>>(
    "SELECT * FROM _collections WHERE name = ?", colName,
  );
  let col: CollectionModel;
  if (row) {
    col = new CollectionModel();
    col.load(row);
  } else {
    // 创建临时集合
    col = new CollectionModel();
    col.id = `col_${colName}`;
    col.name = colName;
    col.type = "base";
  }
  const record = new RecordModel(col);
  record.id = userId;
  return record;
}

/** 创建 superuser RecordModel */
function createSuperuserRecord(app: BaseApp): RecordModel {
  // 尝试从数据库读取 _superusers 集合
  const row = app.dbAdapter().queryOne<Record<string, unknown>>(
    "SELECT * FROM _collections WHERE name = '_superusers'",
  );
  let col: CollectionModel;
  if (row) {
    col = new CollectionModel();
    col.load(row);
  } else {
    col = new CollectionModel();
    col.id = "pbc_superusers";
    col.name = "_superusers";
    col.type = "auth";
  }
  const record = new RecordModel(col);
  record.id = "su_test_id";
  return record;
}

function seedExternalAuth(
  app: BaseApp,
  id: string,
  recordRef: string,
  provider = "github",
  providerId = "gh_123",
): void {
  app.dbAdapter().exec(
    `INSERT INTO "${COL_NAME}" (id, recordRef, collectionRef, provider, providerId, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, recordRef, "col_users", provider, providerId, "2024-01-01", "2024-01-01",
  );
}

describe("Record CRUD: ExternalAuths", () => {
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
    test("未授权访客 → 200 空列表（listRule 过滤无匹配）", async () => {
      const hono = createHono(baseApp);
      seedExternalAuth(baseApp, "ea1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      // listRule 非 null，无 auth.id 匹配，返回空列表
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(0);
      expect(body.items).toEqual([]);
    });

    test("普通用户只看到自己的外部认证记录", async () => {
      const userRecord = createUserRecord(baseApp, "users", "user_alice");
      const hono = createHono(baseApp, userRecord);

      seedExternalAuth(baseApp, "ea_alice", "user_alice", "github", "gh_alice");
      seedExternalAuth(baseApp, "ea_bob", "user_bob", "google", "g_bob");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(1);
      expect(body.items[0].id).toBe("ea_alice");
    });

    test("普通用户无外部认证记录 → 空列表", async () => {
      const userRecord = createUserRecord(baseApp, "users", "user_nobody");
      const hono = createHono(baseApp, userRecord);
      seedExternalAuth(baseApp, "ea_alice", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });

    test("superuser 可看到所有记录", async () => {
      const suRecord = createSuperuserRecord(baseApp);
      const hono = createHono(baseApp, suRecord);

      seedExternalAuth(baseApp, "ea1", "user_alice");
      seedExternalAuth(baseApp, "ea2", "user_bob");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(2);
    });
  });

  // ─── VIEW 端点 ───

  describe(`GET /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（viewRule 表达式不满足）", async () => {
      const hono = createHono(baseApp);
      seedExternalAuth(baseApp, "ea1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`);
      // viewRule 非空但 auth 为 null，checkPermissionRule → forbiddenError → 403
      expect(res.status).toBe(403);
    });

    test("非 owner 无法查看他人记录 → 403", async () => {
      const bobRecord = createUserRecord(baseApp, "users", "user_bob");
      const hono = createHono(baseApp, bobRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`);
      expect(res.status).toBe(403);
    });

    test("owner 可查看自己的记录 → 200", async () => {
      const aliceRecord = createUserRecord(baseApp, "users", "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice", "github", "gh_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("ea1");
      expect(body.provider).toBe("github");
      expect(body.recordRef).toBe("user_alice");
    });

    test("superuser 可查看任意记录 → 200", async () => {
      const suRecord = createSuperuserRecord(baseApp);
      const hono = createHono(baseApp, suRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("ea1");
    });
  });

  // ─── CREATE 端点 ───

  describe(`POST /api/collections/${COL_NAME}/records`, () => {
    test("未授权 → 403（createRule = null）", async () => {
      const hono = createHono(baseApp);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordRef: "u1", collectionRef: "c1", provider: "github", providerId: "gh1" }),
      });
      expect(res.status).toBe(403);
    });

    test("普通用户 → 403（createRule = null）", async () => {
      const userRecord = createUserRecord(baseApp, "users", "user_alice");
      const hono = createHono(baseApp, userRecord);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordRef: "user_alice", collectionRef: "c1", provider: "github", providerId: "gh1" }),
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可创建记录 → 200", async () => {
      const suRecord = createSuperuserRecord(baseApp);
      const hono = createHono(baseApp, suRecord);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordRef: "user_alice",
          collectionRef: "col_users",
          provider: "github",
          providerId: "gh_alice_123",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.provider).toBe("github");
      expect(body.recordRef).toBe("user_alice");
    });
  });

  // ─── UPDATE 端点 ───

  describe(`PATCH /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（updateRule = null）", async () => {
      const hono = createHono(baseApp);
      seedExternalAuth(baseApp, "ea1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });
      expect(res.status).toBe(403);
    });

    test("普通用户（含 owner）→ 403（updateRule = null）", async () => {
      const aliceRecord = createUserRecord(baseApp, "users", "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可更新记录 → 200", async () => {
      const suRecord = createSuperuserRecord(baseApp);
      const hono = createHono(baseApp, suRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice", "github", "old_id");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: "new_gh_id" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.providerId).toBe("new_gh_id");
    });
  });

  // ─── DELETE 端点 ───

  describe(`DELETE /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（deleteRule 不满足，无 auth）", async () => {
      const hono = createHono(baseApp);
      seedExternalAuth(baseApp, "ea1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`, {
        method: "DELETE",
      });
      expect([403, 404]).toContain(res.status);
    });

    test("非 owner 无法删除他人记录 → 403", async () => {
      const bobRecord = createUserRecord(baseApp, "users", "user_bob");
      const hono = createHono(baseApp, bobRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    test("owner 可删除自己的记录 → 204", async () => {
      const aliceRecord = createUserRecord(baseApp, "users", "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      seedExternalAuth(baseApp, "ea1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);

      const row = baseApp.dbAdapter().queryOne(`SELECT * FROM "${COL_NAME}" WHERE id = ?`, "ea1");
      expect(row).toBeNull();
    });

    test("superuser 可删除任意记录 → 204", async () => {
      const suRecord = createSuperuserRecord(baseApp);
      const hono = createHono(baseApp, suRecord);
      seedExternalAuth(baseApp, "ea2", "user_bob");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ea2`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);
    });
  });
});
