/**
 * T042 — TxApp 测试
 * 对照 Go 版 core/base.go 的 runInTransaction / txApp 行为
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { BaseApp } from "./base";
import { BaseModel } from "./base_model";
import { SQLiteAdapter } from "./db_adapter_sqlite";
import { createTxApp } from "./tx_app";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-txapp-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;
  adapter.exec("CREATE TABLE IF NOT EXISTS test_models (id TEXT PRIMARY KEY, created TEXT, updated TEXT)");
  return { app, tmpDir };
}

describe("createTxApp", () => {
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

  test("isTransactional returns true", () => {
    const txApp = createTxApp(app, app.dbAdapter());
    expect(txApp.isTransactional()).toBe(true);
  });

  test("parent app isTransactional returns false", () => {
    expect(app.isTransactional()).toBe(false);
  });

  test("txApp shares hooks with parent", () => {
    let hookCalled = false;
    app.onModelCreate().bindFunc(async (e) => {
      hookCalled = true;
      await e.next();
    });
    const txApp = createTxApp(app, app.dbAdapter());
    // txApp 应该共享 parent 的 hook 实例
    expect(txApp.onModelCreate()).toBe(app.onModelCreate());
  });

  test("txApp.dbAdapter() returns transaction adapter", () => {
    const mockAdapter = app.dbAdapter();
    const txApp = createTxApp(app, mockAdapter);
    expect(txApp.dbAdapter()).toBe(mockAdapter);
  });

  test("nested runInTransaction reuses current transaction", async () => {
    const txApp = createTxApp(app, app.dbAdapter());
    let nestedTxApp: BaseApp | null = null;

    await txApp.runInTransaction(async (inner) => {
      nestedTxApp = inner;
      return 42;
    });

    // 嵌套事务应该直接复用 txApp（而不是创建新事务）
    expect(nestedTxApp).toBe(txApp);
  });
});

describe("BaseApp.runInTransaction", () => {
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

  test("transaction commits on success", async () => {
    await app.runInTransaction(async (txApp) => {
      txApp.dbAdapter().exec(
        "INSERT INTO test_models (id, created, updated) VALUES (?, ?, ?)",
        "tx-1", "2024-01-01", "2024-01-01",
      );
    });

    const row = app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", "tx-1");
    expect(row).not.toBeNull();
  });

  test("transaction rolls back on error", async () => {
    try {
      await app.runInTransaction(async (txApp) => {
        txApp.dbAdapter().exec(
          "INSERT INTO test_models (id, created, updated) VALUES (?, ?, ?)",
          "tx-2", "2024-01-01", "2024-01-01",
        );
        throw new Error("intentional rollback");
      });
    } catch {
      // expected
    }

    const row = app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", "tx-2");
    expect(row).toBeNull();
  });

  test("txApp received in callback is transactional", async () => {
    let isTransactional = false;

    await app.runInTransaction(async (txApp) => {
      isTransactional = txApp.isTransactional();
    });

    expect(isTransactional).toBe(true);
  });

  test("multiple operations in transaction are atomic", async () => {
    try {
      await app.runInTransaction(async (txApp) => {
        txApp.dbAdapter().exec(
          "INSERT INTO test_models (id, created, updated) VALUES (?, ?, ?)",
          "tx-3a", "2024-01-01", "2024-01-01",
        );
        txApp.dbAdapter().exec(
          "INSERT INTO test_models (id, created, updated) VALUES (?, ?, ?)",
          "tx-3b", "2024-01-01", "2024-01-01",
        );
        // 第三条将失败（主键冲突）
        txApp.dbAdapter().exec(
          "INSERT INTO test_models (id, created, updated) VALUES (?, ?, ?)",
          "tx-3a", "2024-01-01", "2024-01-01",
        );
      });
    } catch {
      // expected — 主键冲突
    }

    // 全部回滚
    const rowA = app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", "tx-3a");
    const rowB = app.dbAdapter().queryOne("SELECT * FROM test_models WHERE id = ?", "tx-3b");
    expect(rowA).toBeNull();
    expect(rowB).toBeNull();
  });
});
