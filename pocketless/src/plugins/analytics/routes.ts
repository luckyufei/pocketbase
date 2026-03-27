/**
 * Analytics HTTP 路由
 * 对照 Go 版 plugins/analytics/routes.go
 *
 * POST /api/analytics/events       — 批量上报事件（无需认证）
 * GET  /api/analytics/stats        — 按日期统计 PV/UV（Superuser）
 * GET  /api/analytics/top-pages    — 热门页面排行（Superuser）
 * GET  /api/analytics/top-sources  — 流量来源统计（Superuser）
 * GET  /api/analytics/devices      — 设备统计（Superuser）
 *
 * 权限：事件上报无需认证（客户端可直接调用）；查询接口需 Superuser
 */

import type { Hono } from "hono";
import { requireSuperuserMiddleware } from "../../apis/middlewares";
import { badRequestError } from "../../apis/errors";
import type { Analytics, EventInput } from "./register";

export function registerAnalyticsRoutes(app: Hono, analytics: Analytics): void {
  const requireSuperuser = requireSuperuserMiddleware();

  /**
   * POST /api/analytics/events
   * 批量上报事件（无需认证，客户端可直接调用）
   * Body: EventInput | EventInput[]
   *   EventInput: {name, path?, source?, browser?, os?, visitorId?, duration?, properties?, timestamp?}
   */
  app.post("/api/analytics/events", async (c) => {
    const raw = await c.req.json() as unknown;
    let events: EventInput[];

    if (Array.isArray(raw)) {
      events = raw as EventInput[];
    } else if (raw && typeof raw === "object" && "name" in raw) {
      events = [raw as EventInput];
    } else {
      throw badRequestError("Body must be an EventInput object or an array of EventInput objects.");
    }

    // 验证每个事件的 name 字段
    for (const e of events) {
      if (!e.name) throw badRequestError("Each event must have a 'name' field.");
    }

    if (analytics.isEnabled()) {
      analytics.track(events);
    }
    return c.json({ accepted: events.length });
  });

  /**
   * GET /api/analytics/stats
   * 按日期/路径统计 PV/UV
   * Query: startDate?(YYYY-MM-DD), endDate?(YYYY-MM-DD)
   */
  app.get("/api/analytics/stats", requireSuperuser, async (c) => {
    const startDate = c.req.query("startDate") || undefined;
    const endDate = c.req.query("endDate") || undefined;
    const stats = await analytics.getStats(startDate, endDate);
    return c.json(stats);
  });

  /**
   * GET /api/analytics/top-pages
   * 热门页面排行（按 PV 降序）
   * Query: date?(YYYY-MM-DD, default today), limit?(default 10)
   */
  app.get("/api/analytics/top-pages", requireSuperuser, async (c) => {
    const date = c.req.query("date") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "10", 10) || 10));
    const pages = await analytics.getTopPages(date, limit);
    return c.json(pages);
  });

  /**
   * GET /api/analytics/top-sources
   * 流量来源统计（按 UV 降序）
   * Query: date?(YYYY-MM-DD, default today), limit?(default 10)
   */
  app.get("/api/analytics/top-sources", requireSuperuser, async (c) => {
    const date = c.req.query("date") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "10", 10) || 10));
    const sources = await analytics.getTopSources(date, limit);
    return c.json(sources);
  });

  /**
   * GET /api/analytics/devices
   * 设备统计（按 browser+os 分组）
   * Query: date?(YYYY-MM-DD, default today)
   */
  app.get("/api/analytics/devices", requireSuperuser, async (c) => {
    const date = c.req.query("date") || undefined;
    const devices = await analytics.getDeviceStats(date);
    return c.json(devices);
  });
}
