import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { LocalFilesystem } from "../tools/filesystem/local";
import { registerBackupRestoreRoutes } from "./backup_restore";
import { BaseApp } from "../core/base";

let testDir: string;
let backupFs: LocalFilesystem;
let app: Hono;
let baseApp: BaseApp;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "pocketless-restore-"));
  backupFs = new LocalFilesystem(testDir);
  const tmpDir2 = mkdtempSync(join(tmpdir(), "pb-rst-"));
  baseApp = new BaseApp({ dataDir: tmpDir2, isDev: true });
  app = new Hono();
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("Backup Restore", () => {
  test("POST /api/backups/:key/restore — 成功恢复返回 204", async () => {
    await backupFs.upload(new Uint8Array([1, 2, 3]), "test_backup.zip");
    registerBackupRestoreRoutes(app, baseApp, backupFs);

    const res = await app.request("/api/backups/test_backup.zip/restore", {
      method: "POST",
    });

    expect(res.status).toBe(204);
  });

  test("POST /api/backups/:key/restore — 不存在返回 404", async () => {
    registerBackupRestoreRoutes(app, baseApp, backupFs);

    const res = await app.request("/api/backups/missing.zip/restore", {
      method: "POST",
    });

    expect(res.status).toBe(404);
  });

  test("POST /api/backups/:key/restore — 无效 key 返回 400", async () => {
    registerBackupRestoreRoutes(app, baseApp, backupFs);

    const res = await app.request("/api/backups/invalid_name/restore", {
      method: "POST",
    });

    expect(res.status).toBe(400);
  });

  test("POST /api/backups/:key/restore — 触发 onBeforeRestore 回调", async () => {
    await backupFs.upload(new Uint8Array([1]), "callback.zip");
    let beforeCalled = false;

    registerBackupRestoreRoutes(app, baseApp, backupFs, {
      onBeforeRestore: async () => {
        beforeCalled = true;
      },
    });

    const res = await app.request("/api/backups/callback.zip/restore", {
      method: "POST",
    });

    expect(res.status).toBe(204);
    expect(beforeCalled).toBe(true);
  });

  test("POST /api/backups/:key/restore — onBeforeRestore 失败返回 400", async () => {
    await backupFs.upload(new Uint8Array([1]), "fail.zip");

    registerBackupRestoreRoutes(app, baseApp, backupFs, {
      onBeforeRestore: async () => {
        throw new Error("Not ready");
      },
    });

    const res = await app.request("/api/backups/fail.zip/restore", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toContain("Not ready");
  });

  test("POST /api/backups/:key/restore triggers onBackupRestore hook", async () => {
    await backupFs.upload(new Uint8Array([1]), "restore_hook.zip");
    let hookCalled = false;
    let capturedName = "";

    baseApp.onBackupRestore().bindFunc(async (e) => {
      hookCalled = true;
      capturedName = (e as any).name;
      await e.next();
    });

    registerBackupRestoreRoutes(app, baseApp, backupFs);

    const res = await app.request("/api/backups/restore_hook.zip/restore", {
      method: "POST",
    });

    expect(res.status).toBe(204);
    expect(hookCalled).toBe(true);
    expect(capturedName).toBe("restore_hook.zip");
  });
});
