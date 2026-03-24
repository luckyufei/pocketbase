/**
 * Router Base — 创建 Hono 路由并注册所有 API 路由组
 */

import { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { registerHealthRoutes } from "./health";
import { registerCollectionRoutes } from "./collection";
import { registerRecordRoutes } from "./record_crud";
import { registerRecordAuthRoutes } from "./record_auth_password";
import { registerBatchRoutes } from "./batch";
import { registerSettingsRoutes } from "./settings";
import { registerLogsRoutes } from "./logs";
import { registerAdminUIRoutes } from "./admin_ui";
import { toApiError } from "./errors";
import { authLoadingMiddleware } from "./middlewares";
import { join } from "node:path";

export function createRouter(baseApp: BaseApp): Hono {
  const app = new Hono();

  // 全局错误处理（与 Go 版对齐：{status, message, data}）
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });

  // Global middleware: auth loading (aligns with Go version)
  app.use("*", authLoadingMiddleware(baseApp));

  // 注册路由
  registerHealthRoutes(app, baseApp);
  registerSettingsRoutes(app, baseApp);
  registerLogsRoutes(app, baseApp);
  registerCollectionRoutes(app, baseApp);
  registerRecordRoutes(app, baseApp);
  registerRecordAuthRoutes(app, baseApp);
  registerBatchRoutes(app, baseApp);

  // 注册 Admin UI 路由（必须在 notFound 前）
  const distDir = join(import.meta.dir, "../../../webui/dist");
  registerAdminUIRoutes(app, distDir);

  // 404 处理（最后注册）
  app.notFound((c) => {
    return c.json(
      {
        status: 404,
        message: "The requested resource wasn't found.",
        data: {},
      },
      404,
    );
  });

  return app;
}
