/**
 * T173 — record_crud_auth_origin.test.ts
 * 对照 Go 版 apis/record_crud_auth_origin_test.go
 * 测试 _authOrigins 系统集合的 CRUD 权限行为
 *
 * _authOrigins 集合权限规则：
 * - listRule:   "recordRef = @request.auth.id"  (仅看自己的)
 * - viewRule:   "recordRef = @request.auth.id"  (仅看自己的)
 * - createRule: null                             (仅 superuser)
 * - updateRule: null                             (仅 superuser)
 * - deleteRule: "recordRef = @request.auth.id"  (owner 可删除)
 *
 * _authOrigins 用于追踪用户登录来源（IP + UserAgent → fingerprint）
 * 系统自动管理，最多保留 5 个登录来源
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

const COL_NAME = "_authOrigins";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-authorigin-"));
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

  // 创建 _authOrigins 系统集合（权限规则同 _externalAuths）
  adapter.exec(
    `INSERT INTO _collections (id, type, name, system, listRule, viewRule, createRule, updateRule, deleteRule, fields, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "sys_authorigins", "base", COL_NAME, 1,
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
    fingerprint TEXT NOT NULL DEFAULT '',
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

function createUserRecord(app: BaseApp, userId: string): RecordModel {
  const col = new CollectionModel();
  col.id = "col_users";
  col.name = "users";
  col.type = "base";
  const record = new RecordModel(col);
  record.id = userId;
  return record;
}

function createSuperuserRecord(): RecordModel {
  const col = new CollectionModel();
  col.id = "pbc_superusers";
  col.name = "_superusers";
  col.type = "auth";
  const record = new RecordModel(col);
  record.id = "su_test_id";
  return record;
}

function seedAuthOrigin(
  app: BaseApp,
  id: string,
  recordRef: string,
  fingerprint = "fp_abc123",
): void {
  app.dbAdapter().exec(
    `INSERT INTO "${COL_NAME}" (id, recordRef, collectionRef, fingerprint, created, updated) VALUES (?, ?, ?, ?, ?, ?)`,
    id, recordRef, "col_users", fingerprint, "2024-01-01", "2024-01-01",
  );
}

describe("Record CRUD: AuthOrigins", () => {
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
    test("未授权访客 → 200 空列表（listRule 无匹配）", async () => {
      const hono = createHono(baseApp);
      seedAuthOrigin(baseApp, "ao1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(0);
    });

    test("用户只看到自己的登录来源", async () => {
      const aliceRecord = createUserRecord(baseApp, "user_alice");
      const hono = createHono(baseApp, aliceRecord);

      seedAuthOrigin(baseApp, "ao_alice1", "user_alice", "fp_alice_chrome");
      seedAuthOrigin(baseApp, "ao_alice2", "user_alice", "fp_alice_safari");
      seedAuthOrigin(baseApp, "ao_bob", "user_bob", "fp_bob");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(2);
      // 只能看到 alice 的记录
      for (const item of body.items) {
        expect(item.recordRef).toBe("user_alice");
      }
    });

    test("用户无登录来源 → 空列表", async () => {
      const nobodyRecord = createUserRecord(baseApp, "user_nobody");
      const hono = createHono(baseApp, nobodyRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });

    test("superuser 可看到所有登录来源", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);

      seedAuthOrigin(baseApp, "ao1", "user_alice", "fp1");
      seedAuthOrigin(baseApp, "ao2", "user_alice", "fp2");
      seedAuthOrigin(baseApp, "ao3", "user_bob", "fp3");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(3);
    });
  });

  // ─── VIEW 端点 ───

  describe(`GET /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（viewRule 不满足）", async () => {
      const hono = createHono(baseApp);
      seedAuthOrigin(baseApp, "ao1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`);
      expect(res.status).toBe(403);
    });

    test("非 owner 无法查看他人记录 → 403", async () => {
      const bobRecord = createUserRecord(baseApp, "user_bob");
      const hono = createHono(baseApp, bobRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`);
      expect(res.status).toBe(403);
    });

    test("owner 可查看自己的登录来源 → 200", async () => {
      const aliceRecord = createUserRecord(baseApp, "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice", "fp_chrome");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("ao1");
      expect(body.fingerprint).toBe("fp_chrome");
      expect(body.recordRef).toBe("user_alice");
    });

    test("superuser 可查看任意记录 → 200", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`);
      expect(res.status).toBe(200);
    });
  });

  // ─── CREATE 端点 ───

  describe(`POST /api/collections/${COL_NAME}/records`, () => {
    test("未授权 → 403（createRule = null）", async () => {
      const hono = createHono(baseApp);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordRef: "u1", collectionRef: "c1", fingerprint: "fp1" }),
      });
      expect(res.status).toBe(403);
    });

    test("普通用户 → 403（createRule = null）", async () => {
      const aliceRecord = createUserRecord(baseApp, "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordRef: "user_alice", collectionRef: "c1", fingerprint: "fp1" }),
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可创建登录来源记录 → 200", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      const res = await hono.request(`/api/collections/${COL_NAME}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordRef: "user_alice",
          collectionRef: "col_users",
          fingerprint: "md5_ip_useragent_hash",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fingerprint).toBe("md5_ip_useragent_hash");
      expect(body.recordRef).toBe("user_alice");
    });
  });

  // ─── UPDATE 端点 ───

  describe(`PATCH /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（updateRule = null）", async () => {
      const hono = createHono(baseApp);
      seedAuthOrigin(baseApp, "ao1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "new_fp" }),
      });
      expect(res.status).toBe(403);
    });

    test("普通用户（含 owner）→ 403（updateRule = null）", async () => {
      const aliceRecord = createUserRecord(baseApp, "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "new_fp" }),
      });
      expect(res.status).toBe(403);
    });

    test("superuser 可更新记录 → 200", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice", "old_fp");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "new_fp" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fingerprint).toBe("new_fp");
    });
  });

  // ─── DELETE 端点 ───

  describe(`DELETE /api/collections/${COL_NAME}/records/:id`, () => {
    test("未授权 → 403（deleteRule 不满足）", async () => {
      const hono = createHono(baseApp);
      seedAuthOrigin(baseApp, "ao1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    test("非 owner 无法删除他人记录 → 403", async () => {
      const bobRecord = createUserRecord(baseApp, "user_bob");
      const hono = createHono(baseApp, bobRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    test("owner 可删除自己的登录来源 → 204", async () => {
      const aliceRecord = createUserRecord(baseApp, "user_alice");
      const hono = createHono(baseApp, aliceRecord);
      seedAuthOrigin(baseApp, "ao1", "user_alice");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);
      const row = baseApp.dbAdapter().queryOne(`SELECT * FROM "${COL_NAME}" WHERE id = ?`, "ao1");
      expect(row).toBeNull();
    });

    test("superuser 可删除任意记录 → 204", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedAuthOrigin(baseApp, "ao2", "user_bob");
      const res = await hono.request(`/api/collections/${COL_NAME}/records/ao2`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);
    });
  });
});
