/**
 * PocketLess — Bun.js 版 PocketBase
 * 入口点：PocketLess 类封装 CLI、BaseApp、自动检测开发模式
 */

import { Command } from "commander";
import type { App } from "./core/app";

export class PocketLess {
  private program: Command;
  private _app: App | null = null;
  private _isDev: boolean = false;
  private _dataDir: string = "./pb_data";
  private _httpAddr: string = "127.0.0.1:8090";
  private _pgDSN: string = "";
  private _encryptionEnv: string = "";
  private _queryTimeout: number = 30;

  constructor() {
    // 自动检测开发模式（通过 bun run 或 --dev 标志）
    this._isDev = this.detectDevMode();
    this.program = new Command();
    this.program
      .name("pocketless")
      .description("PocketBase-compatible backend in Bun.js")
      .version("0.1.0");
  }

  /** 获取 App 实例 */
  get app(): App | null {
    return this._app;
  }

  /** 是否为开发模式 */
  get isDev(): boolean {
    return this._isDev;
  }

  /** 数据目录 */
  get dataDir(): string {
    return this._dataDir;
  }

  /** 启动应用（解析 CLI 参数并执行） */
  async start(): Promise<void> {
    // 注册全局选项
    this.program
      .option("--dir <path>", "数据目录", "./pb_data")
      .option("--dev", "开发模式", false)
      .option("--pg <dsn>", "PostgreSQL DSN")
      .option("--encryptionEnv <name>", "加密密钥环境变量名")
      .option("--queryTimeout <seconds>", "查询超时（秒）", "30")
      .option("--http <addr>", "监听地址", "127.0.0.1:8090");

    // 延迟导入 CLI 命令以避免循环依赖
    const { registerServeCommand } = await import("./cmd/serve");
    const { registerSuperuserCommand } = await import("./cmd/superuser");
    const { registerMigrateCommand } = await import("./cmd/migrate");

    registerServeCommand(this.program, this);
    registerSuperuserCommand(this.program, this);
    registerMigrateCommand(this.program, this);

    await this.program.parseAsync(process.argv);
  }

  /** 解析全局选项 */
  parseGlobalOptions(opts: Record<string, unknown>): void {
    if (opts.dir) this._dataDir = opts.dir as string;
    if (opts.dev) this._isDev = true;
    if (opts.pg) this._pgDSN = opts.pg as string;
    if (opts.encryptionEnv) this._encryptionEnv = opts.encryptionEnv as string;
    if (opts.queryTimeout) this._queryTimeout = parseInt(opts.queryTimeout as string, 10);
    if (opts.http) this._httpAddr = opts.http as string;
  }

  get httpAddr(): string {
    return this._httpAddr;
  }

  get pgDSN(): string {
    return this._pgDSN || process.env.PB_POSTGRES_DSN || "";
  }

  get encryptionEnv(): string {
    return this._encryptionEnv;
  }

  get queryTimeout(): number {
    return this._queryTimeout;
  }

  /** 设置 App 实例 */
  setApp(app: App): void {
    this._app = app;
  }

  /** 自动检测开发模式 */
  private detectDevMode(): boolean {
    // 通过 bun run 运行时
    if (process.env.BUN_ENV === "development") return true;
    // 通过 PB_DEV 环境变量
    if (process.env.PB_DEV === "true" || process.env.PB_DEV === "1") return true;
    // 检查是否非编译模式运行（dev 环境下通常 import.meta.main）
    return false;
  }
}

// CLI 入口
if (import.meta.main) {
  const pl = new PocketLess();
  pl.start().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

export default PocketLess;
