/**
 * T157 — db.test.ts
 * 对照 Go 版 core/db_test.go
 * 测试 modelSave、modelDelete、modelValidate + Hook 链触发
 * 使用真实 bun:sqlite 内存数据库
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { modelSave, modelDelete, modelValidate } from "./db";
import { BaseModel } from "./base_model";
import { BaseApp } from "./base";
import { SQLiteAdapter } from "./db_adapter_sqlite";
import { CollectionModel } from "./collection_model";
import { RecordModel } from "./record_model";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * 创建最小化 BaseApp 实例（使用临时目录）
 */
function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-test-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  // 手动初始化 SQLite 以跳过 bootstrap（不需要完整的 migration）
  const adapter = new SQLiteAdapter(":memory:");
  // 注入适配器到 app（使用 private 字段访问）
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;
  // 创建必要的表
  adapter.exec("CREATE TABLE IF NOT EXISTS test_models (id TEXT PRIMARY KEY, created TEXT, updated TEXT)");
  adapter.exec(`CREATE TABLE IF NOT EXISTS _collections (
    id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]',
    listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT,
    options TEXT DEFAULT '{}', created TEXT, updated TEXT
  )`);
  return { app, tmpDir };
}

describe("modelValidate", () => {
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

  test("valid model — no error", async () => {
    const model = new BaseModel("test_models");
    await modelValidate(app, model);
    // 不抛错即为成功
  });

  test("model without ID — throws error", async () => {
    const model = new BaseModel("test_models");
    model.id = "";
    await expect(modelValidate(app, model)).rejects.toThrow("model ID is required");
  });

  test("onModelValidate hook is triggered", async () => {
    let hookCalled = false;
    app.onModelValidate().bindFunc(async (e) => {
      hookCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelValidate(app, model);
    expect(hookCalled).toBe(true);
  });

  test("onModelValidate hook can reject", async () => {
    app.onModelValidate().bindFunc(async () => {
      throw new Error("validation rejected by hook");
    });
    const model = new BaseModel("test_models");
    await expect(modelValidate(app, model)).rejects.toThrow("validation rejected by hook");
  });
});

describe("modelSave — create (new model)", () => {
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

  test("inserts new model into DB", async () => {
    const model = new BaseModel("test_models");
    expect(model.isNew()).toBe(true);
    await modelSave(app, model);
    expect(model.isNew()).toBe(false);
    // 验证数据库中存在
    const row = app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", model.id);
    expect(row).not.toBeNull();
  });

  test("sets timestamps on create", async () => {
    const model = new BaseModel("test_models");
    expect(model.created).toBe("");
    await modelSave(app, model);
    expect(model.created).not.toBe("");
    expect(model.updated).not.toBe("");
  });

  test("onModelCreate hook is triggered", async () => {
    let hookCalled = false;
    app.onModelCreate().bindFunc(async (e) => {
      hookCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    expect(hookCalled).toBe(true);
  });

  test("onModelCreateExecute hook is triggered", async () => {
    let executeCalled = false;
    app.onModelCreateExecute().bindFunc(async (e) => {
      executeCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    expect(executeCalled).toBe(true);
  });

  test("onModelAfterCreateSuccess hook is triggered", async () => {
    let successCalled = false;
    app.onModelAfterCreateSuccess().bindFunc(async (e) => {
      successCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    expect(successCalled).toBe(true);
  });

  test("hook chain order: Create → Validate → Execute → AfterSuccess", async () => {
    const order: string[] = [];
    app.onModelCreate().bindFunc(async (e) => {
      order.push("onCreate");
      await e.next();
    });
    app.onModelValidate().bindFunc(async (e) => {
      order.push("onValidate");
      await e.next();
    });
    app.onModelCreateExecute().bindFunc(async (e) => {
      order.push("onExecute");
      await e.next();
    });
    app.onModelAfterCreateSuccess().bindFunc(async (e) => {
      order.push("onAfterSuccess");
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    expect(order).toEqual(["onCreate", "onValidate", "onExecute", "onAfterSuccess"]);
  });
});

describe("modelSave — update (existing model)", () => {
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

  test("updates existing model in DB", async () => {
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    const origCreated = model.created;
    // 现在更新
    await modelSave(app, model);
    const row = app.dbAdapter().queryOne<{ created: string; updated: string }>(
      "SELECT * FROM test_models WHERE id = ?", model.id,
    );
    expect(row).not.toBeNull();
    expect(row!.created).toBe(origCreated);
  });

  test("onModelUpdate hook is triggered", async () => {
    let hookCalled = false;
    app.onModelUpdate().bindFunc(async (e) => {
      hookCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model); // create first
    await modelSave(app, model); // update
    expect(hookCalled).toBe(true);
  });

  test("onModelAfterUpdateSuccess hook is triggered", async () => {
    let successCalled = false;
    app.onModelAfterUpdateSuccess().bindFunc(async (e) => {
      successCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    await modelSave(app, model);
    expect(successCalled).toBe(true);
  });
});

describe("modelDelete", () => {
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

  test("deletes model from DB", async () => {
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    // 验证存在
    expect(app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", model.id)).not.toBeNull();
    // 删除
    await modelDelete(app, model);
    expect(app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", model.id)).toBeNull();
  });

  test("onModelDelete hook is triggered", async () => {
    let hookCalled = false;
    app.onModelDelete().bindFunc(async (e) => {
      hookCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    await modelDelete(app, model);
    expect(hookCalled).toBe(true);
  });

  test("onModelDeleteExecute hook is triggered", async () => {
    let executeCalled = false;
    app.onModelDeleteExecute().bindFunc(async (e) => {
      executeCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    await modelDelete(app, model);
    expect(executeCalled).toBe(true);
  });

  test("onModelAfterDeleteSuccess hook is triggered", async () => {
    let successCalled = false;
    app.onModelAfterDeleteSuccess().bindFunc(async (e) => {
      successCalled = true;
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    await modelDelete(app, model);
    expect(successCalled).toBe(true);
  });

  test("hook chain order: Delete → Execute → AfterSuccess", async () => {
    const order: string[] = [];
    app.onModelDelete().bindFunc(async (e) => {
      order.push("onDelete");
      await e.next();
    });
    app.onModelDeleteExecute().bindFunc(async (e) => {
      order.push("onExecute");
      await e.next();
    });
    app.onModelAfterDeleteSuccess().bindFunc(async (e) => {
      order.push("onAfterSuccess");
      await e.next();
    });
    const model = new BaseModel("test_models");
    await modelSave(app, model);
    order.length = 0; // 清除 create 阶段的记录
    await modelDelete(app, model);
    expect(order).toEqual(["onDelete", "onExecute", "onAfterSuccess"]);
  });
});

describe("modelSave with Record — triggers Record hooks", () => {
  let app: BaseApp;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    tmpDir = result.tmpDir;
    // 插入测试 collection
    app.dbAdapter().exec(
      "INSERT INTO _collections (id, type, name, created, updated) VALUES (?, ?, ?, ?, ?)",
      "col1", "base", "posts", "2024-01-01", "2024-01-01",
    );
    // 创建对应的记录表
    app.dbAdapter().exec("CREATE TABLE posts (id TEXT PRIMARY KEY, created TEXT, updated TEXT)");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("create Record triggers onRecordAfterCreateSuccess", async () => {
    let recordHookCalled = false;
    (app.onRecordAfterCreateSuccess("posts", "col1") as any).bindFunc(async (e: any) => {
      recordHookCalled = true;
      await e.next();
    });
    const col = new CollectionModel();
    col.load({ id: "col1", type: "base", name: "posts" });
    const record = new RecordModel(col);
    await modelSave(app, record);
    expect(recordHookCalled).toBe(true);
  });
});

// ═══ T002-T004: Error Hook Tests ═══

describe("modelCreate — error hook (T002)", () => {
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

  test("onModelAfterCreateError triggered on INSERT failure", async () => {
    let errorHookCalled = false;
    let capturedError: Error | null = null;
    app.onModelAfterCreateError().bindFunc(async (e: any) => {
      errorHookCalled = true;
      capturedError = e.error;
      await e.next();
    });

    // 使 INSERT 失败：先插入，再插入同 ID
    const model1 = new BaseModel("test_models");
    await modelSave(app, model1);
    const model2 = new BaseModel("test_models");
    model2.id = model1.id; // 重复 ID → 唯一约束冲突
    await expect(modelSave(app, model2)).rejects.toThrow();
    expect(errorHookCalled).toBe(true);
    expect(capturedError).not.toBeNull();
  });

  test("model is reset to 'new' state on create failure", async () => {
    const model = new BaseModel("test_models");
    const existingModel = new BaseModel("test_models");
    await modelSave(app, existingModel);
    model.id = existingModel.id; // 重复 ID
    expect(model.isNew()).toBe(true);
    await expect(modelSave(app, model)).rejects.toThrow();
    expect(model.isNew()).toBe(true); // 被重置
  });

  test("onModelAfterCreateError hook error is joined with save error", async () => {
    app.onModelAfterCreateError().bindFunc(async () => {
      throw new Error("hook error");
    });
    const model1 = new BaseModel("test_models");
    await modelSave(app, model1);
    const model2 = new BaseModel("test_models");
    model2.id = model1.id;
    try {
      await modelSave(app, model2);
      expect(true).toBe(false); // 不应到达
    } catch (err: any) {
      expect(err.message).toContain("hook error");
    }
  });
});

describe("modelUpdate — error hook (T003)", () => {
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

  test("onModelAfterUpdateError triggered on UPDATE failure", async () => {
    let errorHookCalled = false;
    app.onModelAfterUpdateError().bindFunc(async (e: any) => {
      errorHookCalled = true;
      await e.next();
    });

    // 使 UPDATE 失败：通过 hook 拦截 execute 抛错
    app.onModelUpdateExecute().bindFunc(async () => {
      throw new Error("update execute failed");
    });

    const model = new BaseModel("test_models");
    await modelSave(app, model); // create OK

    // 此时再 update 会触发拦截的 execute hook
    app.onModelUpdateExecute().reset(); // 先清除
    app.onModelUpdateExecute().bindFunc(async () => {
      throw new Error("update execute failed");
    });

    await expect(modelSave(app, model)).rejects.toThrow("update execute failed");
    expect(errorHookCalled).toBe(true);
  });
});

describe("modelDelete — error hook (T004)", () => {
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

  test("onModelAfterDeleteError triggered on DELETE failure", async () => {
    let errorHookCalled = false;
    app.onModelAfterDeleteError().bindFunc(async (e: any) => {
      errorHookCalled = true;
      await e.next();
    });

    app.onModelDeleteExecute().bindFunc(async () => {
      throw new Error("delete execute failed");
    });

    const model = new BaseModel("test_models");
    await modelSave(app, model);

    await expect(modelDelete(app, model)).rejects.toThrow("delete execute failed");
    expect(errorHookCalled).toBe(true);
  });
});

// ═══ T005: Record-level 前置 Hook Tests ═══

describe("Record-level 前置 hooks (T005)", () => {
  let app: BaseApp;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    tmpDir = result.tmpDir;
    app.dbAdapter().exec(
      "INSERT INTO _collections (id, type, name, created, updated) VALUES (?, ?, ?, ?, ?)",
      "col1", "base", "posts", "2024-01-01", "2024-01-01",
    );
    app.dbAdapter().exec("CREATE TABLE posts (id TEXT PRIMARY KEY, created TEXT, updated TEXT)");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("onRecordCreate hook is triggered before model create", async () => {
    const order: string[] = [];
    (app.onRecordCreate("posts", "col1") as any).bindFunc(async (e: any) => {
      order.push("onRecordCreate");
      await e.next();
    });
    app.onModelCreate().bindFunc(async (e: any) => {
      order.push("onModelCreate");
      await e.next();
    });

    const col = new CollectionModel();
    col.load({ id: "col1", type: "base", name: "posts" });
    const record = new RecordModel(col);
    await modelSave(app, record);
    expect(order).toEqual(["onRecordCreate", "onModelCreate"]);
  });

  test("onRecordUpdate hook is triggered before model update", async () => {
    const col = new CollectionModel();
    col.load({ id: "col1", type: "base", name: "posts" });
    const record = new RecordModel(col);
    await modelSave(app, record);

    const order: string[] = [];
    (app.onRecordUpdate("posts", "col1") as any).bindFunc(async (e: any) => {
      order.push("onRecordUpdate");
      await e.next();
    });
    app.onModelUpdate().bindFunc(async (e: any) => {
      order.push("onModelUpdate");
      await e.next();
    });

    await modelSave(app, record);
    expect(order).toEqual(["onRecordUpdate", "onModelUpdate"]);
  });

  test("onRecordDelete hook is triggered before model delete", async () => {
    const col = new CollectionModel();
    col.load({ id: "col1", type: "base", name: "posts" });
    const record = new RecordModel(col);
    await modelSave(app, record);

    const order: string[] = [];
    (app.onRecordDelete("posts", "col1") as any).bindFunc(async (e: any) => {
      order.push("onRecordDelete");
      await e.next();
    });
    app.onModelDelete().bindFunc(async (e: any) => {
      order.push("onModelDelete");
      await e.next();
    });

    await modelDelete(app, record);
    expect(order).toEqual(["onRecordDelete", "onModelDelete"]);
  });

  test("onRecordCreateExecute hook is triggered", async () => {
    let executeHookCalled = false;
    (app.onRecordCreateExecute("posts", "col1") as any).bindFunc(async (e: any) => {
      executeHookCalled = true;
      await e.next();
    });

    const col = new CollectionModel();
    col.load({ id: "col1", type: "base", name: "posts" });
    const record = new RecordModel(col);
    await modelSave(app, record);
    expect(executeHookCalled).toBe(true);
  });
});
