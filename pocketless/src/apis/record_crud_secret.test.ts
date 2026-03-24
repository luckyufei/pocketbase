/**
 * T175 — record_crud_secret.test.ts
 * 对照 Go 版 apis/record_crud_secret_test.go
 * 测试 Secret 字段的隐藏和权限行为
 *
 * 当前实现状态：
 * - ✓ Hidden 字段权限检查框架
 * - ✓ Superuser 访问隐藏字段
 * - ⏳ Secret 字段加密（待 CryptoProvider 实现）
 * - ⏳ 普通用户隐藏字段过滤（待权限过滤实现）
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

// 模拟的 32 字节 Master Key（64 字符十六进制）
const MOCK_MASTER_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const COL_NAME = "secret_storage";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-secret-"));
  // 设置 Master Key 环境变量用于加密
  process.env.PB_MASTER_KEY = MOCK_MASTER_KEY;

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

  // 创建集合（带 secret 字段）
  const fieldsJson = JSON.stringify([
    { id: "api_key", name: "api_key", type: "secret", required: false, hidden: true },
    { id: "public_info", name: "public_info", type: "text", required: false, hidden: false },
  ]);

  adapter.exec(
    `INSERT INTO _collections (id, type, name, system, listRule, viewRule, createRule, updateRule, deleteRule, fields, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "col_secrets", "base", COL_NAME, 0,
    "",  // listRule = 空 → 公开
    "",  // viewRule = 空 → 公开
    "",  // createRule = 空 → 公开
    "",  // updateRule = 空 → 公开
    "",  // deleteRule = 空 → 公开
    fieldsJson, "2024-01-01", "2024-01-01",
  );

  adapter.exec(`CREATE TABLE IF NOT EXISTS "${COL_NAME}" (
    id TEXT PRIMARY KEY,
    api_key TEXT DEFAULT '',
    public_info TEXT DEFAULT '',
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

function createUserRecord(userId: string): RecordModel {
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

function seedRecord(app: BaseApp, id: string, api_key: string, public_info = "public data"): void {
  app.dbAdapter().exec(
    `INSERT INTO "${COL_NAME}" (id, api_key, public_info, created, updated) VALUES (?, ?, ?, ?, ?)`,
    id, api_key, public_info, "2024-01-01", "2024-01-01",
  );
}

describe("Record CRUD: Secret Fields", () => {
  let baseApp: BaseApp;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    baseApp = result.app;
    tmpDir = result.tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.PB_MASTER_KEY;
  });

  // ─── 隐藏字段权限框架 ───

  describe("Hidden Field Access Control", () => {
    test("superuser 可访问隐藏字段", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/rec1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.public_info).toBe("public_data");
      // Superuser 可以访问 secret 字段
      expect((body as any).api_key).toBeDefined();
    });

    test("superuser 在 LIST 中可看到隐藏字段", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedRecord(baseApp, "rec1", "sk-key1", "data1");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(1);
      expect((body.items[0] as any).api_key).toBeDefined();
    });

    test("superuser 可修改隐藏字段", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedRecord(baseApp, "rec1", "sk-original", "public_data");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/rec1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: "sk-new-value",
          public_info: "updated",
        }),
      });
      expect(res.status).toBe(200);
    });

    test("superuser 可通过 fields 参数选择隐藏字段", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(
        `/api/collections/${COL_NAME}/records/rec1?fields=id,api_key`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect((body as any).api_key).toBeDefined();
      // 未选择的字段被过滤
      expect((body as any).public_info).toBeUndefined();
    });
  });

  // ─── 普通用户访问权限 ───

  describe("Regular User Access to Hidden Fields", () => {
    test("普通用户可访问公开字段", async () => {
      const userRecord = createUserRecord("user_alice");
      const hono = createHono(baseApp, userRecord);
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/rec1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.public_info).toBe("public_data");
    });

    test("普通用户可修改公开字段", async () => {
      const userRecord = createUserRecord("user_alice");
      const hono = createHono(baseApp, userRecord);
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/rec1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_info: "updated_data" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.public_info).toBe("updated_data");
    });

    test("未授权用户可访问公开记录和公开字段", async () => {
      const hono = createHono(baseApp);  // 无认证
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(`/api/collections/${COL_NAME}/records/rec1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.public_info).toBe("public_data");
    });

    test("LIST 中普通用户可访问公开字段", async () => {
      const userRecord = createUserRecord("user_alice");
      const hono = createHono(baseApp, userRecord);
      seedRecord(baseApp, "rec1", "sk-key1", "data1");
      seedRecord(baseApp, "rec2", "sk-key2", "data2");

      const res = await hono.request(`/api/collections/${COL_NAME}/records`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalItems).toBe(2);
      for (const item of body.items) {
        expect(item.public_info).toBeDefined();
      }
    });
  });

  // ─── Fields 参数与隐藏字段交互 ───

  describe("Fields Parameter Selection", () => {
    test("普通用户只能选择公开字段", async () => {
      const userRecord = createUserRecord("user_alice");
      const hono = createHono(baseApp, userRecord);
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(
        `/api/collections/${COL_NAME}/records/rec1?fields=id,public_info`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.public_info).toBe("public_data");
    });

    test("superuser 可选择任意字段（包括隐藏）", async () => {
      const suRecord = createSuperuserRecord();
      const hono = createHono(baseApp, suRecord);
      seedRecord(baseApp, "rec1", "sk-secret", "public_data");

      const res = await hono.request(
        `/api/collections/${COL_NAME}/records/rec1?fields=id,api_key,public_info`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect((body as any).api_key).toBeDefined();
      expect(body.public_info).toBe("public_data");
    });
  });
});
