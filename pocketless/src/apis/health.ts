/**
 * Health Check 端点
 * GET /api/health → {code: 200, message: "API is healthy.", data: {canBackup: bool}}
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";

export function registerHealthRoutes(app: Hono, baseApp: BaseApp): void {
  app.get("/api/health", (c) => {
    return c.json({
      code: 200,
      message: "API is healthy.",
      data: {
        canBackup: baseApp.dbAdapter().type() === "sqlite",
      },
    });
  });
}
