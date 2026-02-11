/**
 * T172 — base.test.ts
 * 对照 Go 版 apis/base.go
 * 测试 createRouter：全局错误处理 + 404 处理 + 路由组注册
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createRouter } from "./base";
import { ApiError } from "./errors";
import { BaseApp } from "../core/base";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-base-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;
  // 创建 _collections 表（registerCollectionRoutes 需要）
  adapter.exec(`CREATE TABLE IF NOT EXISTS _collections (
    id TEXT PRIMARY KEY, type TEXT, name TEXT, system INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]', indexes TEXT DEFAULT '[]',
    listRule TEXT, viewRule TEXT, createRule TEXT, updateRule TEXT, deleteRule TEXT,
    options TEXT DEFAULT '{}', created TEXT, updated TEXT
  )`);
  return { app, tmpDir };
}

describe("createRouter", () => {
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

  test("returns a Hono instance", () => {
    const router = createRouter(baseApp);
    expect(router).toBeDefined();
    expect(typeof router.fetch).toBe("function");
  });

  test("404 handler returns correct JSON", async () => {
    const router = createRouter(baseApp);
    const res = await router.request("/nonexistent-path");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe(404);
    expect(body.message).toBe("The requested resource wasn't found.");
    expect(body.data).toEqual({});
  });

  test("health route is registered", async () => {
    const router = createRouter(baseApp);
    const res = await router.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(200);
    expect(body.message).toBe("API is healthy.");
  });

  test("collections route is registered", async () => {
    const router = createRouter(baseApp);
    const res = await router.request("/api/collections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("page");
  });

  test("error handler converts ApiError to JSON", async () => {
    const router = createRouter(baseApp);
    // 请求一个会抛 notFoundError 的路由
    const res = await router.request("/api/collections/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe(404);
    expect(body.message).toBe("The requested resource wasn't found.");
  });
});
