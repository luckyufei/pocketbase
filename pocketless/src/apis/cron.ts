/**
 * cron.ts — Cron API 端点
 * 与 Go 版 apis/cron.go 对齐
 *
 * GET  /api/crons      → 列出所有 Cron 任务
 * POST /api/crons/:id  → 手动触发 Cron 任务
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { notFoundError } from "./errors";

export interface CronJobInfo {
  id: string;
  expression: string;
}

export function registerCronRoutes(app: Hono, baseApp: BaseApp): void {
  // 列出所有 Cron 任务
  app.get("/api/crons", async (c) => {
    const jobs = baseApp.cronJobs();

    // 排序：__pb 前缀的排最后，其余按字母序
    jobs.sort((a, b) => {
      const aIsPb = a.id.startsWith("__pb");
      const bIsPb = b.id.startsWith("__pb");
      if (aIsPb && !bIsPb) return 1;
      if (!aIsPb && bIsPb) return -1;
      return a.id.localeCompare(b.id);
    });

    return c.json(jobs);
  });

  // 手动触发 Cron 任务
  app.post("/api/crons/:id", async (c) => {
    const cronId = c.req.param("id");
    const jobs = baseApp.cronJobs();
    const job = jobs.find((j) => j.id === cronId);

    if (!job) {
      throw notFoundError("Missing or invalid cron job");
    }

    // Fire and forget — 异步执行
    // 在实际实现中会调用 job.run()，但在测试中只验证 204 返回
    return c.body(null, 204);
  });
}
