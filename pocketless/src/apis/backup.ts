/**
 * Backup API 端点
 * 与 Go 版 apis/backup.go 对齐
 *
 * GET    /api/backups         → 列出备份
 * POST   /api/backups         → 创建备份
 * GET    /api/backups/:key    → 下载备份
 * DELETE /api/backups/:key    → 删除备份
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { Filesystem } from "../tools/filesystem/filesystem";

/** 备份文件名验证正则（与 Go 版一致） */
const BACKUP_NAME_REGEX = /^[a-z0-9_-]+\.zip$/;

export function registerBackupRoutes(
  app: Hono,
  baseApp: BaseApp,
  backupFs: Filesystem,
): void {
  // GET /api/backups — 列出所有备份
  app.get("/api/backups", async (c) => {
    const files = await backupFs.list("");
    const backups = [];

    for (const file of files) {
      if (!file.endsWith(".zip")) continue;
      try {
        const attrs = await backupFs.attributes(file);
        backups.push({
          key: file,
          size: attrs.size,
          modified: attrs.modTime.toISOString(),
        });
      } catch {
        // 跳过无法读取的文件
      }
    }

    return c.json(backups);
  });

  // POST /api/backups — 创建备份
  app.post("/api/backups", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    let name = (body.name as string) || "";

    // 自动生成名称
    if (!name) {
      const now = new Date();
      name = `pb_backup_${now.toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15)}.zip`;
    }

    // 验证名称格式
    if (!BACKUP_NAME_REGEX.test(name)) {
      return c.json(
        { status: 400, message: "Invalid backup name. Must match ^[a-z0-9_-]+\\.zip$.", data: {} },
        400,
      );
    }

    // 检查是否已存在
    if (await backupFs.exists(name)) {
      return c.json(
        { status: 400, message: "A backup with the same name already exists.", data: {} },
        400,
      );
    }

    // 创建备份（这里创建一个占位 zip 文件；实际实现需要打包数据库）
    // 注意：真正的备份创建逻辑会异步执行，这里返回 204 表示已接受

    // 触发 onBackupCreate hook
    await baseApp.onBackupCreate().trigger({
      app: baseApp,
      name,
      exclude: [],
      next: async () => {},
    });

    await backupFs.upload(new Uint8Array(0), name);

    return c.body(null, 204);
  });

  // GET /api/backups/:key — 下载备份
  app.get("/api/backups/:key", async (c) => {
    const key = c.req.param("key");

    if (!(await backupFs.exists(key))) {
      return c.json(
        { status: 404, message: "Backup not found.", data: {} },
        404,
      );
    }

    return backupFs.serve(key, key);
  });

  // DELETE /api/backups/:key — 删除备份
  app.delete("/api/backups/:key", async (c) => {
    const key = c.req.param("key");

    if (!(await backupFs.exists(key))) {
      return c.json(
        { status: 404, message: "Backup not found.", data: {} },
        404,
      );
    }

    await backupFs.delete(key);
    return c.body(null, 204);
  });
}
