/**
 * serve 命令 — 启动 HTTP 服务
 */

import type { Command } from "commander";
import type PocketLess from "../pocketless";
import { BaseApp } from "../core/base";
import { startServe } from "../apis/serve";

export function registerServeCommand(program: Command, pl: PocketLess): void {
  program
    .command("serve [domains...]")
    .description("启动 HTTP 服务")
    .action(async (domains: string[], _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);

      console.log(`Pocketless v0.1.0`);

      // 创建并引导 BaseApp
      const app = new BaseApp({
        dataDir: pl.dataDir,
        isDev: pl.isDev,
        pgDSN: pl.pgDSN || undefined,
        encryptionEnv: pl.encryptionEnv || undefined,
        queryTimeout: pl.queryTimeout,
      });

      pl.setApp(app as any);

      try {
        await app.bootstrap();
        console.log(`Database initialized at ${pl.dataDir}`);

        // 启动 HTTP 服务
        await startServe(app, {
          httpAddr: pl.httpAddr,
          isDev: pl.isDev,
        });
      } catch (err) {
        console.error("Failed to start:", err);
        process.exit(1);
      }
    });
}
