/**
 * HTTP Serve — Bun.serve() 启动
 * CORS、静态文件服务、TLS/autocert、优雅关闭
 */

import type { BaseApp } from "../core/base";
import { createRouter } from "./base";

export interface ServeOptions {
  httpAddr: string;
  isDev: boolean;
}

export async function startServe(baseApp: BaseApp, options: ServeOptions): Promise<void> {
  const router = createRouter(baseApp);

  const [host, portStr] = options.httpAddr.split(":");
  const port = parseInt(portStr || "8090", 10);

  const server = Bun.serve({
    hostname: host || "127.0.0.1",
    port,
    fetch: router.fetch,
    development: options.isDev,
  });

  console.log(`Server started at http://${server.hostname}:${server.port}`);
  if (options.isDev) {
    console.log(`  ➜ Admin UI: http://${server.hostname}:${server.port}/_/`);
  }

  // 触发 onServe Hook
  await baseApp.onServe().trigger({
    app: baseApp,
    server,
    router,
    next: async () => {},
  });

  // 优雅关闭
  const shutdown = async () => {
    console.log("\nShutting down...");
    server.stop();
    await baseApp.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
