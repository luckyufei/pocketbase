/**
 * MigrateCmd 插件 — 迁移 CLI 集成
 * 对照 Go 版 plugins/migratecmd/
 *
 * 功能: migrate 命令、自动迁移检测、迁移模板生成、迁移记录管理
 */

export type TemplateLang = "ts" | "js";

export interface MigrateCmdConfig {
  dir: string;
  automigrate: boolean;
  templateLang: TemplateLang;
}

export function defaultConfig(): MigrateCmdConfig {
  return {
    dir: "pb_migrations",
    automigrate: true,
    templateLang: "ts",
  };
}

/**
 * 从环境变量覆盖配置（不修改原对象）
 * PB_MIGRATECMD_DIR          — 迁移目录
 * PB_MIGRATECMD_AUTOMIGRATE  — "true"/"false"
 * PB_MIGRATECMD_TEMPLATE_LANG — "ts"/"js"
 */
export function applyEnvOverrides(config: MigrateCmdConfig): MigrateCmdConfig {
  const result = { ...config };

  const dir = process.env.PB_MIGRATECMD_DIR;
  if (dir !== undefined) result.dir = dir;

  const automigrate = process.env.PB_MIGRATECMD_AUTOMIGRATE;
  if (automigrate !== undefined) result.automigrate = automigrate === "true";

  const templateLang = process.env.PB_MIGRATECMD_TEMPLATE_LANG;
  if (templateLang === "ts" || templateLang === "js") {
    result.templateLang = templateLang;
  }

  return result;
}

// ---------- Migration 记录 ----------

/** 一条迁移记录 */
export interface Migration {
  /** 迁移名称，通常是文件名（不含后缀）*/
  name: string;
  /** 执行 up 时运行的函数 */
  up: () => void | Promise<void>;
  /** 执行 down 时运行的函数（回滚）*/
  down: () => void | Promise<void>;
  /** 已应用的时间戳，未应用时为 undefined */
  appliedAt?: Date;
}

// ---------- 模板生成 ----------

/**
 * 生成迁移文件内容（不写入磁盘，仅返回字符串）
 * 对照 Go 版 migratecmd/templates.go
 */
export function generateTemplate(name: string, lang: TemplateLang): string {
  if (lang === "js") {
    return [
      `/// <reference path="../pb_data/types.d.ts" />`,
      `migrate((app) => {`,
      `  // TODO: implement up migration for "${name}"`,
      `}, (app) => {`,
      `  // TODO: implement down migration for "${name}"`,
      `});`,
      ``,
    ].join("\n");
  }

  // TypeScript 默认
  return [
    `import PocketBase from "pocketbase";`,
    ``,
    `export async function up(app: PocketBase): Promise<void> {`,
    `  // TODO: implement up migration for "${name}"`,
    `}`,
    ``,
    `export async function down(app: PocketBase): Promise<void> {`,
    `  // TODO: implement down migration for "${name}"`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * 生成迁移文件名（带时间戳前缀）
 * 格式: <unix_timestamp>_<name>.<ext>
 * 对照 Go 版 migratecmd/filename.go
 */
export function getMigrationFilename(
  name: string,
  lang: TemplateLang,
  now: Date = new Date(),
): string {
  const ts = Math.floor(now.getTime() / 1000);
  const ext = lang === "js" ? "js" : "ts";
  // 将空格和特殊字符转换为下划线
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${ts}_${safeName}.${ext}`;
}

// ---------- Plugin 接口 ----------

export interface MigrateCmdPlugin {
  getConfig(): MigrateCmdConfig;
  isAutoMigrateEnabled(): boolean;
  /** 添加迁移记录 */
  addMigration(migration: Migration): void;
  /** 列出所有迁移（按注册顺序）*/
  listMigrations(): Migration[];
  /** 获取未应用的迁移 */
  getPending(): Migration[];
  /** 获取已应用的迁移 */
  getApplied(): Migration[];
  /** 按顺序执行迁移（up/down）*/
  run(migrations: Migration[], direction: "up" | "down"): Promise<void>;
  /** 回滚最后一条已应用的迁移 */
  rollback(): Promise<void>;
}

// ---------- 内存实现 ----------

class MigrateCmdPluginImpl implements MigrateCmdPlugin {
  private config: MigrateCmdConfig;
  /** 按添加顺序存储所有迁移 */
  private migrations: Migration[] = [];

  constructor(config: MigrateCmdConfig) {
    this.config = config;
  }

  getConfig(): MigrateCmdConfig {
    return { ...this.config };
  }

  isAutoMigrateEnabled(): boolean {
    return this.config.automigrate;
  }

  addMigration(migration: Migration): void {
    // 同名迁移替换（保持位置不变）
    const idx = this.migrations.findIndex((m) => m.name === migration.name);
    if (idx >= 0) {
      this.migrations[idx] = migration;
    } else {
      this.migrations.push(migration);
    }
  }

  listMigrations(): Migration[] {
    // 返回副本，防止外部修改顺序
    return [...this.migrations];
  }

  getPending(): Migration[] {
    return this.migrations.filter((m) => m.appliedAt === undefined);
  }

  getApplied(): Migration[] {
    return this.migrations.filter((m) => m.appliedAt !== undefined);
  }

  async run(migrations: Migration[], direction: "up" | "down"): Promise<void> {
    if (direction === "up") {
      for (const m of migrations) {
        await m.up();
        m.appliedAt = new Date();
      }
    } else {
      // down: 逆序执行
      const reversed = [...migrations].reverse();
      for (const m of reversed) {
        await m.down();
        m.appliedAt = undefined;
      }
    }
  }

  async rollback(): Promise<void> {
    const applied = this.getApplied();
    if (applied.length === 0) return;

    // 回滚最后一条（applied 按注册顺序，取最后一个已应用的）
    const last = applied[applied.length - 1];
    await last.down();
    last.appliedAt = undefined;
  }
}

// ---------- 注册函数 ----------

export function MustRegister(
  _app: unknown,
  _rootCmd: unknown,
  config: MigrateCmdConfig = defaultConfig(),
): MigrateCmdPlugin {
  return new MigrateCmdPluginImpl(config);
}
