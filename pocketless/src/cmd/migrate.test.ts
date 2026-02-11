/**
 * migrate 命令测试 — 子命令注册 + 执行逻辑
 * T055: 覆盖 up/down/create/collections/history-sync 子命令的实际执行场景
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerMigrateCommand } from "./migrate";
import { BaseApp } from "../core/base";
import { existsSync, rmSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// 子命令注册测试（已有）
// ============================================================

describe("registerMigrateCommand", () => {
  test("注册 migrate 命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const cmd = program.commands.find((c) => c.name() === "migrate");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe("数据库迁移管理");
  });

  test("包含 5 个子命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const mig = program.commands.find((c) => c.name() === "migrate")!;
    expect(mig.commands.length).toBe(5);
  });

  test("up 子命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const mig = program.commands.find((c) => c.name() === "migrate")!;
    expect(mig.commands.find((c) => c.name() === "up")).toBeDefined();
  });

  test("down 子命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const mig = program.commands.find((c) => c.name() === "migrate")!;
    expect(mig.commands.find((c) => c.name() === "down")).toBeDefined();
  });

  test("create 子命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const mig = program.commands.find((c) => c.name() === "migrate")!;
    expect(mig.commands.find((c) => c.name() === "create")).toBeDefined();
  });

  test("collections 子命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const mig = program.commands.find((c) => c.name() === "migrate")!;
    expect(mig.commands.find((c) => c.name() === "collections")).toBeDefined();
  });

  test("history-sync 子命令", () => {
    const program = new Command();
    registerMigrateCommand(program, { parseGlobalOptions: () => {} } as any);
    const mig = program.commands.find((c) => c.name() === "migrate")!;
    expect(mig.commands.find((c) => c.name() === "history-sync")).toBeDefined();
  });
});

// ============================================================
// T055: 执行逻辑单元测试
// ============================================================

describe("migrate 执行逻辑 (T055)", () => {
  let app: BaseApp;
  let dataDir: string;
  let migrationsDir: string;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `pb_test_mig_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    migrationsDir = join(dataDir, "pb_migrations");
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(migrationsDir, { recursive: true });
    app = new BaseApp({ dataDir, isDev: true });
    await app.bootstrap();
  });

  afterEach(async () => {
    await app.shutdown();
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  // --- up ---

  test("migrateUp — 无待执行迁移时返回空", async () => {
    const { migrateUp } = await import("./migrate");
    const result = await migrateUp(app, migrationsDir);
    expect(result.applied).toEqual([]);
  });

  test("migrateUp — 执行待执行的迁移", async () => {
    // 写入一个简单的迁移文件
    const migContent = `
export const up = async (app) => {
  await app.execute("CREATE TABLE IF NOT EXISTS test_up_table (id TEXT PRIMARY KEY, name TEXT)");
};
export const down = async (app) => {
  await app.execute("DROP TABLE IF EXISTS test_up_table");
};
`;
    await writeFile(join(migrationsDir, "20260101000000_test_create.ts"), migContent);

    const { migrateUp } = await import("./migrate");
    const result = await migrateUp(app, migrationsDir);
    expect(result.applied.length).toBe(1);
    expect(result.applied[0]).toContain("test_create");
  });

  // --- down ---

  test("migrateDown — 回滚最后一个迁移", async () => {
    // 先 up 一个迁移
    const migContent = `
export const up = async (app) => {
  await app.execute("CREATE TABLE IF NOT EXISTS test_down_table (id TEXT PRIMARY KEY)");
};
export const down = async (app) => {
  await app.execute("DROP TABLE IF EXISTS test_down_table");
};
`;
    await writeFile(join(migrationsDir, "20260101000000_test_down.ts"), migContent);

    const { migrateUp, migrateDown } = await import("./migrate");
    await migrateUp(app, migrationsDir);

    const result = await migrateDown(app, migrationsDir, 1);
    expect(result.reverted.length).toBe(1);
  });

  // --- create ---

  test("migrateCreate — 生成迁移模板文件", async () => {
    const { migrateCreate } = await import("./migrate");
    const result = await migrateCreate(migrationsDir, "add_users");

    expect(result.filename).toMatch(/^\d{14}_add_users\.ts$/);
    expect(result.filePath).toContain(migrationsDir);

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("export const up");
    expect(content).toContain("export const down");
  });

  // --- collections ---

  test("migrateCollections — 生成集合快照迁移", async () => {
    const { migrateCollections } = await import("./migrate");
    const result = await migrateCollections(app, migrationsDir);

    expect(result.filename).toBeTruthy();
    expect(result.filePath).toContain(migrationsDir);

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("export const up");
  });

  // --- history-sync ---

  test("migrateHistorySync — 清除无效迁移记录", async () => {
    const { migrateUp, migrateHistorySync } = await import("./migrate");

    // 先 up 一个迁移
    const migContent = `
export const up = async (app) => {};
export const down = async (app) => {};
`;
    await writeFile(join(migrationsDir, "20260101000000_test_sync.ts"), migContent);
    await migrateUp(app, migrationsDir);

    // 删除迁移文件
    rmSync(join(migrationsDir, "20260101000000_test_sync.ts"));

    // history-sync 应清除失效记录
    const result = await migrateHistorySync(app, migrationsDir);
    expect(result.removed.length).toBe(1);
  });
});
