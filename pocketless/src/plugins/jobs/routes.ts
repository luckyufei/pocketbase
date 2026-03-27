/**
 * Jobs HTTP 路由
 * 对照 Go 版 plugins/jobs/routes.go
 *
 * POST   /api/jobs/enqueue      — 入队新任务
 * GET    /api/jobs              — 列表查询
 * GET    /api/jobs/stats        — 各状态统计
 * GET    /api/jobs/:id          — 任务详情
 * POST   /api/jobs/:id/requeue  — 重新入队（仅 failed）
 * DELETE /api/jobs/:id          — 删除（仅 pending/failed）
 *
 * 权限：所有端点需要 Superuser
 */

import type { Hono } from "hono";
import { requireSuperuserMiddleware } from "../../apis/middlewares";
import { badRequestError, notFoundError } from "../../apis/errors";
import type { JobsStore, JobStatus } from "./register";

export function registerJobsRoutes(app: Hono, store: JobsStore): void {
  const requireSuperuser = requireSuperuserMiddleware();

  /**
   * POST /api/jobs/enqueue
   * Body: {topic: string, payload?: unknown, runAt?: string (ISO 8601), maxRetries?: number}
   * 返回创建的 Job 对象
   */
  app.post("/api/jobs/enqueue", requireSuperuser, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const topic = body.topic as string | undefined;
    if (!topic) throw badRequestError("Missing required field: topic");

    const payload = body.payload ?? null;
    const runAt = body.runAt ? new Date(body.runAt as string) : undefined;
    const maxRetries = body.maxRetries !== undefined
      ? parseInt(String(body.maxRetries), 10)
      : undefined;

    const job = await store.enqueue(topic, payload, { runAt, maxRetries });
    return c.json(job, 201);
  });

  /**
   * GET /api/jobs/stats
   * 返回各状态数量统计（必须在 /api/jobs/:id 之前注册避免路径冲突）
   */
  app.get("/api/jobs/stats", requireSuperuser, async (c) => {
    const stats = await store.stats();
    return c.json(stats);
  });

  /**
   * GET /api/jobs
   * 列表查询
   * Query: topic?, status?, limit?(1-1000, default 30), offset?(default 0)
   */
  app.get("/api/jobs", requireSuperuser, async (c) => {
    const topic = c.req.query("topic") || undefined;
    const statusRaw = c.req.query("status") as JobStatus | undefined;
    const validStatuses: JobStatus[] = ["pending", "processing", "completed", "failed"];
    const status = statusRaw && validStatuses.includes(statusRaw) ? statusRaw : undefined;
    const limit = Math.min(1000, Math.max(1, parseInt(c.req.query("limit") || "30", 10) || 30));
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);

    const result = await store.list({ topic, status, limit, offset });
    return c.json(result);
  });

  /**
   * POST /api/jobs/:id/requeue
   * 重新入队（仅 failed 状态允许）
   */
  app.post("/api/jobs/:id/requeue", requireSuperuser, async (c) => {
    const id = c.req.param("id");
    const job = await store.requeue(id).catch((err: Error) => {
      throw badRequestError(err.message);
    });
    return c.json(job);
  });

  /**
   * GET /api/jobs/:id
   * 任务详情
   */
  app.get("/api/jobs/:id", requireSuperuser, async (c) => {
    const id = c.req.param("id");
    const job = await store.get(id).catch(() => null);
    if (!job) throw notFoundError();
    return c.json(job);
  });

  /**
   * DELETE /api/jobs/:id
   * 删除任务（仅 pending/failed 状态允许）
   */
  app.delete("/api/jobs/:id", requireSuperuser, async (c) => {
    const id = c.req.param("id");
    await store.delete(id).catch((err: Error) => {
      throw badRequestError(err.message);
    });
    return c.body(null, 204);
  });
}
