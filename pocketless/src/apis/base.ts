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
// 插件路由
import { registerTraceRoutes } from "../plugins/trace/routes";
import { registerMetricsRoutes } from "../plugins/metrics/routes";
import { registerJobsRoutes } from "../plugins/jobs/routes";
import { registerKVRoutes } from "../plugins/kv/routes";
import { registerSecretsRoutes } from "../plugins/secrets/routes";
import { registerAnalyticsRoutes } from "../plugins/analytics/routes";
// 插件类型
import type { Tracer } from "../plugins/trace/register";
import type { MetricsCollector } from "../plugins/metrics/register";
import type { JobsStore } from "../plugins/jobs/register";
import type { KVStore } from "../plugins/kv/register";
import type { SecretsStore } from "../plugins/secrets/register";
import type { Analytics } from "../plugins/analytics/register";

/**
 * 可选插件 store 注入接口。
 * 调用方（如 examples/base/main.ts）先通过各插件的 MustRegister() 创建 store 实例，
 * 然后传入此结构，由 createRouter 负责挂载对应的 HTTP 路由。
 */
export interface PluginStores {
  tracer?: Tracer;
  metricsCollector?: MetricsCollector;
  jobsStore?: JobsStore;
  kvStore?: KVStore;
  secretsStore?: SecretsStore;
  analytics?: Analytics;
}

export function createRouter(baseApp: BaseApp, plugins?: PluginStores): Hono {
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

  // 注册插件路由（仅当 store 实例被传入时才注册对应路由）
  if (plugins?.tracer) registerTraceRoutes(app, plugins.tracer);
  if (plugins?.metricsCollector) registerMetricsRoutes(app, plugins.metricsCollector);
  if (plugins?.jobsStore) registerJobsRoutes(app, plugins.jobsStore);
  if (plugins?.kvStore) registerKVRoutes(app, plugins.kvStore);
  if (plugins?.secretsStore) registerSecretsRoutes(app, plugins.secretsStore);
  if (plugins?.analytics) registerAnalyticsRoutes(app, plugins.analytics);

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
