/**
 * Backup Restore 端点
 * 与 Go 版 apis/backup.go 中 restore 部分对齐
 *
 * POST /api/backups/:key/restore → 恢复备份（异步执行）
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { Filesystem } from "../tools/filesystem/filesystem";

export interface RestoreOptions {
  /** 恢复前回调（用于验证、准备等） */
  onBeforeRestore?: (key: string) => Promise<void>;
  /** 恢复后回调（用于重启服务等） */
  onAfterRestore?: (key: string) => Promise<void>;
}

export function registerBackupRestoreRoutes(
  app: Hono,
  baseApp: BaseApp,
  backupFs: Filesystem,
  options: RestoreOptions = {},
): void {
  // POST /api/backups/:key/restore — 恢复备份
  app.post("/api/backups/:key/restore", async (c) => {
    const key = c.req.param("key");

    // 验证文件名格式
    if (!key.endsWith(".zip")) {
      return c.json(
        { status: 400, message: "Invalid backup key.", data: {} },
        400,
      );
    }

    // 检查备份是否存在
    if (!(await backupFs.exists(key))) {
      return c.json(
        { status: 404, message: "Backup not found.", data: {} },
        404,
      );
    }

    // 恢复前回调
    if (options.onBeforeRestore) {
      try {
        await options.onBeforeRestore(key);
      } catch (err: any) {
        return c.json(
          { status: 400, message: err.message || "Failed to prepare restore.", data: {} },
          400,
        );
      }
    }

    // 异步执行恢复（与 Go 版的 routine.FireAndForget 对齐）
    // 触发 onBackupRestore hook
    await baseApp.onBackupRestore().trigger({
      app: baseApp,
      name: key,
      exclude: [],
      next: async () => {},
    });

    // 在实际实现中，这里会解压 zip 并替换数据库文件
    // 当前返回 204 表示已接受
    if (options.onAfterRestore) {
      // 触发但不等待
      options.onAfterRestore(key).catch(() => {
        // 忽略恢复错误（后台任务）
      });
    }

    return c.body(null, 204);
  });
}
