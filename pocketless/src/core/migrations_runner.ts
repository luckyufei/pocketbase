/**
 * MigrationsRunner — 迁移系统
 * 与 Go 版 core/migrations_runner.go + plugins/migratecmd 对齐
 *
 * 功能:
 * - _migrations 表管理
 * - 迁移文件模板生成
 * - Up/Down 执行
 * - History-sync
 * - Auto-migration 检测
 */

import { writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join, basename } from "node:path";

/** 迁移表名 */
export const DEFAULT_MIGRATIONS_TABLE = "_migrations";

/** 迁移函数类型 */
export type MigrationFn = (app: MigrationApp) => Promise<void>;

/** 迁移定义 */
export interface Migration {
  file: string;
  up?: MigrationFn;
  down?: MigrationFn;
  reapplyCondition?: (app: MigrationApp, runner: MigrationsRunner, fileName: string) => Promise<boolean>;
}

/** 迁移应用接口（简化） */
export interface MigrationApp {
  execute(sql: string, ...params: unknown[]): Promise<void>;
  queryAll(sql: string, ...params: unknown[]): Promise<Record<string, unknown>[]>;
  queryOne(sql: string, ...params: unknown[]): Promise<Record<string, unknown> | null>;
}

/** 已应用的迁移记录 */
interface AppliedMigration {
  file: string;
  applied: number; // UnixMicro
}

/** 迁移列表 */
export class MigrationsList {
  private items: Migration[] = [];

  /** 注册迁移（按文件名排序） */
  register(migration: Migration): void {
    this.items.push(migration);
    this.items.sort((a, b) => a.file.localeCompare(b.file));
  }

  /** 添加迁移（别名） */
  add(up: MigrationFn | undefined, down: MigrationFn | undefined, file: string): void {
    this.register({ file, up, down });
  }

  /** 获取所有迁移 */
  all(): Migration[] {
    return [...this.items];
  }

  /** 按文件名查找 */
  findByFile(file: string): Migration | undefined {
    return this.items.find((m) => m.file === file);
  }

  /** 清空 */
  clear(): void {
    this.items = [];
  }

  /** 迁移数量 */
  get length(): number {
    return this.items.length;
  }
}

/** 全局迁移列表 */
export const SystemMigrations = new MigrationsList();
export const AppMigrations = new MigrationsList();

/**
 * MigrationsRunner — 迁移执行器
 */
export class MigrationsRunner {
  private app: MigrationApp;
  private tableName: string;
  private migrationsList: MigrationsList;

  constructor(
    app: MigrationApp,
    migrationsList: MigrationsList,
    tableName: string = DEFAULT_MIGRATIONS_TABLE,
  ) {
    this.app = app;
    this.migrationsList = migrationsList;
    this.tableName = tableName;
  }

  /** 确保迁移表存在 */
  async initTable(): Promise<void> {
    await this.app.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        file    VARCHAR(255) PRIMARY KEY NOT NULL,
        applied BIGINT NOT NULL
      )
    `);
  }

  /** 应用所有待执行的迁移 */
  async up(): Promise<string[]> {
    await this.initTable();

    const applied: string[] = [];
    const migrations = this.migrationsList.all();

    for (const m of migrations) {
      const isApplied = await this.isMigrationApplied(m.file);

      if (isApplied) {
        // 检查是否需要重新执行
        if (m.reapplyCondition) {
          const shouldReapply = await m.reapplyCondition(this.app, this, m.file);
          if (!shouldReapply) continue;
        } else {
          continue;
        }
      }

      if (m.up) {
        await m.up(this.app);
      }

      await this.saveAppliedMigration(m.file);
      applied.push(m.file);
    }

    return applied;
  }

  /** 回退最后 N 个迁移 */
  async down(count: number = 1): Promise<string[]> {
    await this.initTable();

    const reverted: string[] = [];
    const appliedRecords = await this.getAppliedMigrations();

    // 按 applied 时间降序排列，取最后 N 个
    appliedRecords.sort((a, b) => b.applied - a.applied);
    const toRevert = appliedRecords.slice(0, count);

    for (const record of toRevert) {
      const migration = this.migrationsList.findByFile(record.file);

      if (migration?.down) {
        await migration.down(this.app);
      }

      await this.saveRevertedMigration(record.file);
      reverted.push(record.file);
    }

    return reverted;
  }

  /**
   * History-sync — 移除不再存在的迁移记录
   * 即 _migrations 表中有记录，但代码中已不存在的迁移
   */
  async historySync(): Promise<string[]> {
    await this.initTable();

    const appliedRecords = await this.getAppliedMigrations();
    const removed: string[] = [];

    for (const record of appliedRecords) {
      if (!this.migrationsList.findByFile(record.file)) {
        await this.saveRevertedMigration(record.file);
        removed.push(record.file);
      }
    }

    return removed;
  }

  /** 获取所有已应用的迁移 */
  async getAppliedMigrations(): Promise<AppliedMigration[]> {
    try {
      const rows = await this.app.queryAll(
        `SELECT file, applied FROM ${this.tableName} ORDER BY applied ASC`,
      );
      return rows.map((row) => ({
        file: row.file as string,
        applied: row.applied as number,
      }));
    } catch {
      return [];
    }
  }

  /** 检查迁移是否已应用 */
  async isMigrationApplied(file: string): Promise<boolean> {
    try {
      const row = await this.app.queryOne(
        `SELECT file FROM ${this.tableName} WHERE file = ?`,
        file,
      );
      return row !== null;
    } catch {
      return false;
    }
  }

  /** 记录已应用的迁移 */
  private async saveAppliedMigration(file: string): Promise<void> {
    const appliedMicro = Date.now() * 1000; // UnixMicro
    await this.app.execute(
      `INSERT INTO ${this.tableName} (file, applied) VALUES (?, ?) ON CONFLICT (file) DO UPDATE SET applied = ?`,
      file,
      appliedMicro,
      appliedMicro,
    );
  }

  /** 移除迁移记录 */
  private async saveRevertedMigration(file: string): Promise<void> {
    await this.app.execute(
      `DELETE FROM ${this.tableName} WHERE file = ?`,
      file,
    );
  }
}

// ============================================================
// 迁移模板生成
// ============================================================

/**
 * 生成时间戳前缀
 * 格式: YYYYMMDDHHMMSS（与 Go 版 time.Format("20060102150405") 对齐）
 */
export function generateMigrationTimestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

/**
 * 将名称转为 snake_case
 */
function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "_$1")
    .replace(/[-\s]+/g, "_")
    .replace(/^_/, "")
    .toLowerCase()
    .replace(/__+/g, "_");
}

/**
 * 生成空白迁移模板 (TypeScript)
 */
export function blankMigrationTemplate(timestamp: string, name: string): {
  filename: string;
  content: string;
} {
  const snakeName = toSnakeCase(name);
  const filename = `${timestamp}_${snakeName}.ts`;

  const content = `import type { MigrationApp } from "../src/core/migrations_runner";

export const up = async (app: MigrationApp): Promise<void> => {
  // 添加迁移逻辑...
};

export const down = async (app: MigrationApp): Promise<void> => {
  // 添加回退逻辑...
};
`;

  return { filename, content };
}

/**
 * 生成 Collection 创建迁移模板
 */
export function createCollectionTemplate(
  timestamp: string,
  collectionName: string,
  collectionJSON: string,
): { filename: string; content: string } {
  const filename = `${timestamp}_created_${toSnakeCase(collectionName)}.ts`;

  const content = `import type { MigrationApp } from "../src/core/migrations_runner";

const collectionData = ${collectionJSON};

export const up = async (app: MigrationApp): Promise<void> => {
  // 创建 collection
  await app.execute(\`INSERT INTO _collections (id, name, type, schema, system) VALUES (?, ?, ?, ?, ?)\`,
    collectionData.id, collectionData.name, collectionData.type,
    JSON.stringify(collectionData.schema), collectionData.system ? 1 : 0);
};

export const down = async (app: MigrationApp): Promise<void> => {
  await app.execute(\`DELETE FROM _collections WHERE name = ?\`, "${collectionName}");
  await app.execute(\`DROP TABLE IF EXISTS "${collectionName}"\`);
};
`;

  return { filename, content };
}

/**
 * 生成 Collection 删除迁移模板
 */
export function deleteCollectionTemplate(
  timestamp: string,
  collectionName: string,
  collectionJSON: string,
): { filename: string; content: string } {
  const filename = `${timestamp}_deleted_${toSnakeCase(collectionName)}.ts`;

  const content = `import type { MigrationApp } from "../src/core/migrations_runner";

const collectionData = ${collectionJSON};

export const up = async (app: MigrationApp): Promise<void> => {
  await app.execute(\`DELETE FROM _collections WHERE name = ?\`, "${collectionName}");
  await app.execute(\`DROP TABLE IF EXISTS "${collectionName}"\`);
};

export const down = async (app: MigrationApp): Promise<void> => {
  // 重新创建 collection
  await app.execute(\`INSERT INTO _collections (id, name, type, schema, system) VALUES (?, ?, ?, ?, ?)\`,
    collectionData.id, collectionData.name, collectionData.type,
    JSON.stringify(collectionData.schema), collectionData.system ? 1 : 0);
};
`;

  return { filename, content };
}

/**
 * 将迁移模板写入 pb_migrations 目录
 */
export async function writeMigrationFile(
  migrationsDir: string,
  filename: string,
  content: string,
): Promise<string> {
  await mkdir(migrationsDir, { recursive: true });
  const filePath = join(migrationsDir, filename);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * 从 pb_migrations 目录加载所有迁移文件
 */
export async function loadMigrationFiles(
  migrationsDir: string,
): Promise<string[]> {
  try {
    const files = await readdir(migrationsDir);
    return files
      .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
      .sort();
  } catch {
    return [];
  }
}
