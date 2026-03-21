/**
 * migrate 命令 — 数据库迁移管理
 * 与 Go 版 plugins/migratecmd 对齐
 */

import type { Command } from "commander";
import type PocketLess from "../pocketless";
import type { BaseApp } from "../core/base";
import {
  MigrationsList,
  MigrationsRunner,
  AppMigrations,
  generateMigrationTimestamp,
  blankMigrationTemplate,
  writeMigrationFile,
  loadMigrationFiles,
  type MigrationApp,
} from "../core/migrations_runner";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * 创建 MigrationApp 适配器 — 将 BaseApp 的 DBAdapter 包装为 MigrationApp 接口
 */
function createMigrationApp(app: BaseApp): MigrationApp {
  const adapter = app.dbAdapter();
  return {
    async execute(sql: string, ...params: unknown[]): Promise<void> {
      adapter.exec(sql, ...params);
    },
    async queryAll(sql: string, ...params: unknown[]): Promise<Record<string, unknown>[]> {
      return adapter.query(sql, ...params);
    },
    async queryOne(sql: string, ...params: unknown[]): Promise<Record<string, unknown> | null> {
      return adapter.queryOne(sql, ...params);
    },
  };
}

/**
 * 加载用户迁移文件到 MigrationsList
 */
async function loadUserMigrations(migrationsDir: string): Promise<MigrationsList> {
  const list = new MigrationsList();
  const files = await loadMigrationFiles(migrationsDir);

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    try {
      const mod = await import(filePath);
      list.register({
        file,
        up: mod.up,
        down: mod.down,
      });
    } catch {
      // 跳过无法加载的迁移文件
    }
  }

  return list;
}

/** 用户迁移使用独立的表名，避免与系统迁移冲突 */
const APP_MIGRATIONS_TABLE = "_app_migrations";

/**
 * 执行所有未应用的迁移
 */
export async function migrateUp(
  app: BaseApp,
  migrationsDir: string,
): Promise<{ applied: string[] }> {
  const migrationApp = createMigrationApp(app);
  const list = await loadUserMigrations(migrationsDir);
  const runner = new MigrationsRunner(migrationApp, list, APP_MIGRATIONS_TABLE);
  const applied = await runner.up();
  return { applied };
}

/**
 * 回滚最后 N 个迁移
 */
export async function migrateDown(
  app: BaseApp,
  migrationsDir: string,
  count: number = 1,
): Promise<{ reverted: string[] }> {
  const migrationApp = createMigrationApp(app);
  const list = await loadUserMigrations(migrationsDir);
  const runner = new MigrationsRunner(migrationApp, list, APP_MIGRATIONS_TABLE);
  const reverted = await runner.down(count);
  return { reverted };
}

/**
 * 创建新迁移文件模板
 */
export async function migrateCreate(
  migrationsDir: string,
  name: string,
): Promise<{ filename: string; filePath: string }> {
  const timestamp = generateMigrationTimestamp();
  const { filename, content } = blankMigrationTemplate(timestamp, name);
  const filePath = await writeMigrationFile(migrationsDir, filename, content);
  return { filename, filePath };
}

/**
 * 从当前集合生成迁移快照
 */
export async function migrateCollections(
  app: BaseApp,
  migrationsDir: string,
): Promise<{ filename: string; filePath: string }> {
  const collections = await app.findAllCollections();
  const timestamp = generateMigrationTimestamp();
  const filename = `${timestamp}_collections_snapshot.ts`;

  const collectionsJSON = JSON.stringify(
    collections.map((c) => c.toJSON()),
    null,
    2,
  );

  const content = `import type { MigrationApp } from "../src/core/migrations_runner";

const collections = ${collectionsJSON};

export const up = async (app: MigrationApp): Promise<void> => {
  for (const col of collections) {
    const existing = await app.queryOne("SELECT id FROM _collections WHERE id = ?", col.id);
    if (!existing) {
      await app.execute(
        "INSERT INTO _collections (id, type, name, system, fields, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        col.id, col.type, col.name, col.system ? 1 : 0,
        JSON.stringify(col.fields), col.created, col.updated,
      );
    }
  }
};

export const down = async (app: MigrationApp): Promise<void> => {
  // 集合快照回退需要手动处理
};
`;

  const filePath = await writeMigrationFile(migrationsDir, filename, content);
  return { filename, filePath };
}

/**
 * 同步迁移历史 — 清除不再存在的迁移记录
 */
export async function migrateHistorySync(
  app: BaseApp,
  migrationsDir: string,
): Promise<{ removed: string[] }> {
  const migrationApp = createMigrationApp(app);
  const list = await loadUserMigrations(migrationsDir);
  const runner = new MigrationsRunner(migrationApp, list, APP_MIGRATIONS_TABLE);
  const removed = await runner.historySync();
  return { removed };
}

// ─── CLI 命令注册 ───

export function registerMigrateCommand(program: Command, pl: PocketLess): void {
  const migrate = program.command("migrate").description("数据库迁移管理");

  migrate
    .command("up")
    .description("执行所有未应用的迁移")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const migrationsDir = join(pl.dataDir, "pb_migrations");
        const result = await migrateUp(app, migrationsDir);
        if (result.applied.length === 0) {
          console.log("No pending migrations.");
        } else {
          console.log(`Applied ${result.applied.length} migration(s):`);
          for (const f of result.applied) console.log(`  - ${f}`);
        }
      } finally {
        await app.shutdown();
      }
    });

  migrate
    .command("down [count]")
    .description("回滚迁移")
    .action(async (count: string | undefined, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const migrationsDir = join(pl.dataDir, "pb_migrations");
        const result = await migrateDown(app, migrationsDir, parseInt(count || "1", 10));
        if (result.reverted.length === 0) {
          console.log("No migrations to revert.");
        } else {
          console.log(`Reverted ${result.reverted.length} migration(s):`);
          for (const f of result.reverted) console.log(`  - ${f}`);
        }
      } finally {
        await app.shutdown();
      }
    });

  migrate
    .command("create <name>")
    .description("创建新迁移文件")
    .action(async (name: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const migrationsDir = join(pl.dataDir, "pb_migrations");
      const result = await migrateCreate(migrationsDir, name);
      console.log(`Created migration: ${result.filePath}`);
    });

  migrate
    .command("collections")
    .description("从集合生成迁移")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const migrationsDir = join(pl.dataDir, "pb_migrations");
        const result = await migrateCollections(app, migrationsDir);
        console.log(`Created collections snapshot: ${result.filePath}`);
      } finally {
        await app.shutdown();
      }
    });

  migrate
    .command("history-sync")
    .description("同步迁移历史")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const migrationsDir = join(pl.dataDir, "pb_migrations");
        const result = await migrateHistorySync(app, migrationsDir);
        if (result.removed.length === 0) {
          console.log("Migration history is already in sync.");
        } else {
          console.log(`Removed ${result.removed.length} stale migration record(s):`);
          for (const f of result.removed) console.log(`  - ${f}`);
        }
      } finally {
        await app.shutdown();
      }
    });
}

async function bootstrapApp(pl: PocketLess): Promise<BaseApp> {
  const { BaseApp } = await import("../core/base");
  const app = new BaseApp({
    dataDir: pl.dataDir,
    isDev: pl.isDev,
    pgDSN: pl.pgDSN || undefined,
    encryptionEnv: pl.encryptionEnv || undefined,
    queryTimeout: pl.queryTimeout,
  });
  await app.bootstrap();
  return app;
}
