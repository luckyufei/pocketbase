/**
 * Metrics HTTP 路由
 * 对照 Go 版 plugins/metrics/routes.go
 *
 * GET /api/system/metrics         — 历史数据查询（分页）
 * GET /api/system/metrics/current — 当前最新快照
 *
 * 权限：所有端点需要 Superuser
 */

import type { Hono } from "hono";
import { requireSuperuserMiddleware } from "../../apis/middlewares";
import type { MetricsCollector } from "./register";

export function registerMetricsRoutes(app: Hono, collector: MetricsCollector): void {
  const requireSuperuser = requireSuperuserMiddleware();

  /**
   * GET /api/system/metrics/current
   * 返回当前最新的系统快照（必须在 /api/system/metrics 之前注册，避免路径冲突）
   */
  app.get("/api/system/metrics/current", requireSuperuser, async (c) => {
    const snapshot = await collector.getLatest();
    if (!snapshot) {
      return c.json({ message: "No metrics data available yet." }, 200);
    }
    return c.json(snapshot);
  });

  /**
   * GET /api/system/metrics
   * 历史数据查询
   * Query: hours?(1-168, default 24), limit?(1-1000, default 100)
   */
  app.get("/api/system/metrics", requireSuperuser, async (c) => {
    const hours = Math.min(168, Math.max(1, parseInt(c.req.query("hours") || "24", 10) || 24));
    const limit = Math.min(1000, Math.max(1, parseInt(c.req.query("limit") || "100", 10) || 100));

    const items = await collector.getHistory(hours, limit);
    return c.json({ items, total: items.length, hours, limit });
  });
}
