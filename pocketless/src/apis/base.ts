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
import { toApiError } from "./errors";

export function createRouter(baseApp: BaseApp): Hono {
  const app = new Hono();

  // 全局错误处理（与 Go 版对齐：{status, message, data}）
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });

  // 404 处理
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

  // 注册路由
  registerHealthRoutes(app, baseApp);
  registerCollectionRoutes(app, baseApp);
  registerRecordRoutes(app, baseApp);
  registerRecordAuthRoutes(app, baseApp);
  registerBatchRoutes(app, baseApp);

  return app;
}
