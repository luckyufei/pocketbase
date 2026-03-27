/**
 * Trace HTTP 路由
 * 对照 Go 版 plugins/trace/routes.go
 *
 * GET    /api/_/trace/spans              — 分页列表（支持多条件过滤）
 * GET    /api/_/trace/spans/:traceId     — 按 traceId 获取所有 span
 * DELETE /api/_/trace/spans/:traceId     — 删除整条 trace
 *
 * 权限：所有端点需要 Superuser
 */

import type { Hono } from "hono";
import { requireSuperuserMiddleware } from "../../apis/middlewares";
import { notFoundError } from "../../apis/errors";
import type { Tracer, SpanStatus } from "./register";

export function registerTraceRoutes(app: Hono, tracer: Tracer): void {
  const requireSuperuser = requireSuperuserMiddleware();

  /**
   * GET /api/_/trace/spans
   * 分页列表，支持多条件过滤
   * Query: limit?(1-1000), offset?, traceId?, name?, status?(ok/error/unset), minDuration?(ms), maxDuration?(ms)
   */
  app.get("/api/_/trace/spans", requireSuperuser, async (c) => {
    const limit = Math.min(1000, Math.max(1, parseInt(c.req.query("limit") || "50", 10) || 50));
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
    const traceId = c.req.query("traceId") || undefined;
    const name = c.req.query("name") || undefined;
    const statusRaw = c.req.query("status") || undefined;
    const status = (statusRaw === "ok" || statusRaw === "error" || statusRaw === "unset")
      ? statusRaw as SpanStatus
      : undefined;
    const minDurationRaw = c.req.query("minDuration");
    const maxDurationRaw = c.req.query("maxDuration");
    const minDuration = minDurationRaw !== undefined ? parseInt(minDurationRaw, 10) : undefined;
    const maxDuration = maxDurationRaw !== undefined ? parseInt(maxDurationRaw, 10) : undefined;

    // DBTracer 才有 listSpans；MemoryTracer / NoopTracer 没有 DB 方法
    if (!("listSpans" in tracer)) {
      return c.json({ items: [], total: 0, limit, offset });
    }
    const spans = (tracer as unknown as {
      listSpans(opts: object): unknown[]
    }).listSpans({ limit, offset, traceId, name, status, minDuration, maxDuration });

    return c.json({ items: spans, total: spans.length, limit, offset });
  });

  /**
   * GET /api/_/trace/spans/:traceId
   * 按 traceId 获取所有 Span
   * Query: limit?(default 200)
   */
  app.get("/api/_/trace/spans/:traceId", requireSuperuser, async (c) => {
    const traceId = c.req.param("traceId");
    if (!traceId) throw notFoundError();

    const limit = Math.min(1000, Math.max(1, parseInt(c.req.query("limit") || "200", 10) || 200));

    if (!("getSpansByTraceId" in tracer)) {
      return c.json([]);
    }
    const spans = (tracer as unknown as {
      getSpansByTraceId(id: string, limit: number): unknown[]
    }).getSpansByTraceId(traceId, limit);

    return c.json(spans);
  });

  /**
   * DELETE /api/_/trace/spans/:traceId
   * 删除整条 trace（该 traceId 的所有 span）
   */
  app.delete("/api/_/trace/spans/:traceId", requireSuperuser, async (c) => {
    const traceId = c.req.param("traceId");
    if (!traceId) throw notFoundError();

    if ("deleteByTraceId" in tracer) {
      (tracer as unknown as { deleteByTraceId(id: string): void }).deleteByTraceId(traceId);
    }

    return c.body(null, 204);
  });
}
