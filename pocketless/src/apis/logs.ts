/**
 * logs.ts — Logs API 端点
 * 与 Go 版 apis/logs.go 对齐
 *
 * GET /api/logs       → 日志列表（分页）
 * GET /api/logs/stats → 日志统计（按小时分组）
 * GET /api/logs/:id   → 日志详情
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { notFoundError, badRequestError } from "./errors";
import { LogQueryHelper, type Log, type LogsStatsItem } from "../core/log_query";

export function registerLogsRoutes(app: Hono, baseApp: BaseApp): void {
  // 日志列表
  app.get("/api/logs", async (c) => {
    const page = parseInt(c.req.query("page") || "1", 10);
    const perPage = parseInt(c.req.query("perPage") || "30", 10);
    const filter = c.req.query("filter") || "";
    const sort = c.req.query("sort") || "-created";

    const helper = getLogHelper(baseApp);
    const result = helper.list({ page, perPage, filter, sort });

    return c.json(result);
  });

  // 日志统计
  app.get("/api/logs/stats", async (c) => {
    const filter = c.req.query("filter") || "";
    const helper = getLogHelper(baseApp);
    const stats = helper.stats(filter || undefined);
    return c.json(stats);
  });

  // 日志详情
  app.get("/api/logs/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) throw notFoundError();

    const helper = getLogHelper(baseApp);
    const log = helper.findById(id);
    if (!log) throw notFoundError();

    return c.json(log);
  });
}

function getLogHelper(baseApp: BaseApp): LogQueryHelper {
  // 从 store 获取或创建 LogQueryHelper
  const store = baseApp.store();
  let helper = store.get("__logQueryHelper") as LogQueryHelper | undefined;
  if (!helper) {
    helper = new LogQueryHelper();
    store.set("__logQueryHelper", helper);
  }
  return helper;
}
