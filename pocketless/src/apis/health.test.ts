/**
 * T170 — health.test.ts
 * 对照 Go 版 apis/health_test.go
 * 测试 GET /api/health 端点
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { registerHealthRoutes } from "./health";
import { BaseApp } from "../core/base";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-health-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  return { app, tmpDir };
}

describe("Health API", () => {
  let baseApp: BaseApp;
  let hono: Hono;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    baseApp = result.app;
    tmpDir = result.tmpDir;
    hono = new Hono();
    registerHealthRoutes(hono, baseApp);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("GET /api/health returns 200", async () => {
    const res = await hono.request("/api/health");
    expect(res.status).toBe(200);
  });

  test("response has correct structure", async () => {
    const res = await hono.request("/api/health");
    const body = await res.json();
    expect(body.code).toBe(200);
    expect(body.message).toBe("API is healthy.");
    expect(body.data).toBeDefined();
  });

  test("canBackup is true for SQLite adapter", async () => {
    const res = await hono.request("/api/health");
    const body = await res.json();
    expect(body.data.canBackup).toBe(true);
  });

  test("canBackup is false for non-SQLite adapter", async () => {
    // 模拟 PostgreSQL adapter
    (baseApp as any)._adapter = {
      type: () => "postgres",
    };
    const res = await hono.request("/api/health");
    const body = await res.json();
    expect(body.data.canBackup).toBe(false);
  });
});
