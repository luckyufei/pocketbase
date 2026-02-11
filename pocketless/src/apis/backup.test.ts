import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalFilesystem } from "../tools/filesystem/local";
import { registerBackupRoutes } from "./backup";
import { BaseApp } from "../core/base";
import { mkdtempSync } from "node:fs";

let testDir: string;
let backupFs: LocalFilesystem;
let app: Hono;
let baseApp: BaseApp;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "pocketless-backup-"));
  backupFs = new LocalFilesystem(testDir);
  const tmpDir2 = mkdtempSync(join(tmpdir(), "pb-bk-"));
  baseApp = new BaseApp({ dataDir: tmpDir2, isDev: true });
  app = new Hono();
  registerBackupRoutes(app, baseApp, backupFs);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("Backup Endpoints", () => {
  test("GET /api/backups — 空时返回空数组", async () => {
    const res = await app.request("/api/backups", { method: "GET" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  test("GET /api/backups — 列出备份文件", async () => {
    await backupFs.upload(new Uint8Array([1, 2, 3]), "backup1.zip");
    await backupFs.upload(new Uint8Array([4, 5]), "backup2.zip");

    const res = await app.request("/api/backups", { method: "GET" });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(data.length).toBe(2);
    expect(data[0].key).toBeTruthy();
    expect(data[0].size).toBeGreaterThanOrEqual(0);
    expect(data[0].modified).toBeTruthy();
  });

  test("POST /api/backups — 创建备份", async () => {
    const res = await app.request("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "my_backup.zip" }),
    });

    expect(res.status).toBe(204);
    expect(await backupFs.exists("my_backup.zip")).toBe(true);
  });

  test("POST /api/backups — 无效名称返回 400", async () => {
    const res = await app.request("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "INVALID NAME.zip" }),
    });

    expect(res.status).toBe(400);
  });

  test("POST /api/backups — 重复名称返回 400", async () => {
    await backupFs.upload(new Uint8Array(0), "existing.zip");

    const res = await app.request("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "existing.zip" }),
    });

    expect(res.status).toBe(400);
  });

  test("GET /api/backups/:key — 下载备份", async () => {
    await backupFs.upload(new Uint8Array([1, 2, 3, 4, 5]), "download.zip");

    const res = await app.request("/api/backups/download.zip", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const data = await res.arrayBuffer();
    expect(data.byteLength).toBe(5);
  });

  test("GET /api/backups/:key — 不存在返回 404", async () => {
    const res = await app.request("/api/backups/missing.zip", {
      method: "GET",
    });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/backups/:key — 删除备份", async () => {
    await backupFs.upload(new Uint8Array(0), "todelete.zip");

    const res = await app.request("/api/backups/todelete.zip", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(await backupFs.exists("todelete.zip")).toBe(false);
  });

  test("DELETE /api/backups/:key — 不存在返回 404", async () => {
    const res = await app.request("/api/backups/missing.zip", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

// ─── T027: Backup Hook 触发测试 ───

describe("Backup Hook triggers (T027)", () => {
  test("POST /api/backups triggers onBackupCreate hook", async () => {
    let hookCalled = false;
    let capturedName = "";
    baseApp.onBackupCreate().bindFunc(async (e) => {
      hookCalled = true;
      capturedName = (e as any).name;
      await e.next();
    });

    const honoApp = new Hono();
    const bkTestDir = await mkdtemp(join(tmpdir(), "pocketless-backup-hook-"));
    const bkFs = new LocalFilesystem(bkTestDir);
    registerBackupRoutes(honoApp, baseApp, bkFs);

    const res = await honoApp.request("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hook_test.zip" }),
    });

    expect(res.status).toBe(204);
    expect(hookCalled).toBe(true);
    expect(capturedName).toBe("hook_test.zip");

    await rm(bkTestDir, { recursive: true, force: true });
  });
});
