/**
 * migrations_runner.test.ts — 对照 Go 版 core/migrations_runner_test.go + migrations_list_test.go
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MigrationsList,
  MigrationsRunner,
  SystemMigrations,
  AppMigrations,
  DEFAULT_MIGRATIONS_TABLE,
  generateMigrationTimestamp,
  blankMigrationTemplate,
  createCollectionTemplate,
  deleteCollectionTemplate,
  writeMigrationFile,
  loadMigrationFiles,
  type MigrationApp,
  type MigrationFn,
} from "./migrations_runner";

// ============================================================
// Mock MigrationApp — 使用内存中的 Map 模拟数据库
// ============================================================

class MockMigrationApp implements MigrationApp {
  /** 存储迁移记录 file -> applied(UnixMicro) */
  private _migrations: Map<string, number> = new Map();
  /** 是否已创建表 */
  private _tableCreated = false;
  /** 执行日志 */
  executionLog: string[] = [];

  async execute(sql: string, ...params: unknown[]): Promise<void> {
    const trimmed = sql.replace(/\s+/g, " ").trim();

    // CREATE TABLE
    if (trimmed.startsWith("CREATE TABLE IF NOT EXISTS")) {
      this._tableCreated = true;
      return;
    }

    // INSERT ... ON CONFLICT
    if (trimmed.includes("INSERT INTO")) {
      const file = params[0] as string;
      const applied = params[1] as number;
      this._migrations.set(file, applied);
      return;
    }

    // DELETE
    if (trimmed.includes("DELETE FROM")) {
      const file = params[0] as string;
      this._migrations.delete(file);
      return;
    }

    // 记录通用 SQL
    this.executionLog.push(`execute: ${trimmed} [${params.join(",")}]`);
  }

  async queryAll(
    _sql: string,
    ..._params: unknown[]
  ): Promise<Record<string, unknown>[]> {
    if (!this._tableCreated) return [];
    return Array.from(this._migrations.entries())
      .map(([file, applied]) => ({ file, applied }))
      .sort((a, b) => (a.applied as number) - (b.applied as number));
  }

  async queryOne(
    _sql: string,
    ...params: unknown[]
  ): Promise<Record<string, unknown> | null> {
    const file = params[0] as string;
    if (this._migrations.has(file)) {
      return { file };
    }
    return null;
  }

  /** 测试辅助：预插入已应用的迁移 */
  insertApplied(file: string, appliedMicro: number): void {
    this._tableCreated = true;
    this._migrations.set(file, appliedMicro);
  }

  /** 测试辅助：检查是否已应用 */
  isApplied(file: string): boolean {
    return this._migrations.has(file);
  }

  /** 测试辅助：获取已应用迁移数 */
  get appliedCount(): number {
    return this._migrations.size;
  }
}

// ============================================================
// MigrationsList 测试 — 对照 Go 版 TestMigrationsList
// ============================================================

describe("MigrationsList", () => {
  test("register 按文件名排序", () => {
    const list = new MigrationsList();
    list.register({ file: "5_test.ts" });
    list.register({ file: "3_test.ts" });
    list.register({ file: "1_test.ts" });
    list.register({ file: "2_test.ts" });

    const items = list.all();
    expect(items.length).toBe(4);
    expect(items.map((m) => m.file)).toEqual([
      "1_test.ts",
      "2_test.ts",
      "3_test.ts",
      "5_test.ts",
    ]);
  });

  test("add 是 register 的别名", () => {
    const list = new MigrationsList();
    const up: MigrationFn = async () => {};
    const down: MigrationFn = async () => {};

    list.add(up, down, "b_migration.ts");
    list.add(undefined, undefined, "a_migration.ts");

    const items = list.all();
    expect(items.length).toBe(2);
    expect(items[0].file).toBe("a_migration.ts");
    expect(items[0].up).toBeUndefined();
    expect(items[1].file).toBe("b_migration.ts");
    expect(items[1].up).toBe(up);
    expect(items[1].down).toBe(down);
  });

  test("findByFile 找到/未找到", () => {
    const list = new MigrationsList();
    list.register({ file: "1_test.ts" });
    list.register({ file: "2_test.ts" });

    expect(list.findByFile("1_test.ts")).toBeDefined();
    expect(list.findByFile("1_test.ts")!.file).toBe("1_test.ts");
    expect(list.findByFile("nonexistent.ts")).toBeUndefined();
  });

  test("clear 清空所有", () => {
    const list = new MigrationsList();
    list.register({ file: "1_test.ts" });
    list.register({ file: "2_test.ts" });
    expect(list.length).toBe(2);

    list.clear();
    expect(list.length).toBe(0);
    expect(list.all()).toEqual([]);
  });

  test("all 返回浅拷贝", () => {
    const list = new MigrationsList();
    list.register({ file: "1_test.ts" });

    const items1 = list.all();
    const items2 = list.all();

    // 不同数组引用
    expect(items1).not.toBe(items2);
    // 但内容相同
    expect(items1).toEqual(items2);
  });

  test("length 属性", () => {
    const list = new MigrationsList();
    expect(list.length).toBe(0);

    list.register({ file: "1_test.ts" });
    expect(list.length).toBe(1);

    list.register({ file: "2_test.ts" });
    expect(list.length).toBe(2);
  });
});

// ============================================================
// 全局迁移列表
// ============================================================

describe("全局迁移列表", () => {
  test("SystemMigrations 和 AppMigrations 是独立的实例", () => {
    expect(SystemMigrations).not.toBe(AppMigrations);
    expect(SystemMigrations).toBeInstanceOf(MigrationsList);
    expect(AppMigrations).toBeInstanceOf(MigrationsList);
  });

  test("DEFAULT_MIGRATIONS_TABLE 是 _migrations", () => {
    expect(DEFAULT_MIGRATIONS_TABLE).toBe("_migrations");
  });
});

// ============================================================
// MigrationsRunner 测试 — 对照 Go 版 TestMigrationsRunnerUpAndDown
// ============================================================

describe("MigrationsRunner", () => {
  let app: MockMigrationApp;

  beforeEach(() => {
    app = new MockMigrationApp();
  });

  test("initTable 创建迁移表", async () => {
    const list = new MigrationsList();
    const runner = new MigrationsRunner(app, list);

    await runner.initTable();

    // initTable 执行后应可查询
    const records = await runner.getAppliedMigrations();
    expect(records).toEqual([]);
  });

  test("up 应用所有待执行的迁移", async () => {
    const callsOrder: string[] = [];

    const list = new MigrationsList();
    list.register({
      file: "2_test",
      up: async () => {
        callsOrder.push("up2");
      },
      down: async () => {
        callsOrder.push("down2");
      },
    });
    list.register({
      file: "3_test",
      up: async () => {
        callsOrder.push("up3");
      },
      down: async () => {
        callsOrder.push("down3");
      },
    });
    list.register({
      file: "1_test",
      up: async () => {
        callsOrder.push("up1");
      },
      down: async () => {
        callsOrder.push("down1");
      },
    });
    list.register({
      file: "4_test",
      up: async () => {
        callsOrder.push("up4");
      },
      down: async () => {
        callsOrder.push("down4");
      },
    });

    const runner = new MigrationsRunner(app, list);

    // 全新数据库，所有迁移都应该执行
    const applied = await runner.up();
    expect(applied).toEqual(["1_test", "2_test", "3_test", "4_test"]);
    expect(callsOrder).toEqual(["up1", "up2", "up3", "up4"]);
  });

  test("up 跳过已应用的迁移（对照 Go 版 partially out-of-order）", async () => {
    const callsOrder: string[] = [];

    const list = new MigrationsList();
    list.register({
      file: "2_test",
      up: async () => {
        callsOrder.push("up2");
      },
      down: async () => {
        callsOrder.push("down2");
      },
    });
    list.register({
      file: "3_test",
      up: async () => {
        callsOrder.push("up3");
      },
      down: async () => {
        callsOrder.push("down3");
      },
    });
    list.register({
      file: "1_test",
      up: async () => {
        callsOrder.push("up1");
      },
      down: async () => {
        callsOrder.push("down1");
      },
    });
    list.register({
      file: "4_test",
      up: async () => {
        callsOrder.push("up4");
      },
      down: async () => {
        callsOrder.push("down4");
      },
    });
    list.register({
      file: "5_test",
      up: async () => {
        callsOrder.push("up5");
      },
      down: async () => {
        callsOrder.push("down5");
      },
      reapplyCondition: async () => true,
    });

    // 模拟部分已应用的迁移（乱序）
    const now = Date.now() * 1000;
    app.insertApplied("4_test", now - 2);
    app.insertApplied("5_test", now - 1);
    app.insertApplied("2_test", now);

    const runner = new MigrationsRunner(app, list);
    const applied = await runner.up();

    // up1, up3 尚未应用需要执行
    // up5 已应用但有 reapplyCondition 返回 true，需要重新执行
    // up2, up4 已应用且无 reapplyCondition，跳过
    expect(applied).toEqual(["1_test", "3_test", "5_test"]);
    expect(callsOrder).toEqual(["up1", "up3", "up5"]);
  });

  test("up 中 reapplyCondition 返回 false 则跳过", async () => {
    const callsOrder: string[] = [];

    const list = new MigrationsList();
    list.register({
      file: "1_test",
      up: async () => {
        callsOrder.push("up1");
      },
      reapplyCondition: async () => false,
    });

    app.insertApplied("1_test", Date.now() * 1000);

    const runner = new MigrationsRunner(app, list);
    const applied = await runner.up();

    expect(applied).toEqual([]);
    expect(callsOrder).toEqual([]);
  });

  test("up 无 up 函数的迁移仍然记录", async () => {
    const list = new MigrationsList();
    list.register({ file: "1_test" }); // 无 up/down

    const runner = new MigrationsRunner(app, list);
    const applied = await runner.up();

    expect(applied).toEqual(["1_test"]);
    expect(app.isApplied("1_test")).toBe(true);
  });

  test("down 回退最后 N 个迁移（对照 Go 版）", async () => {
    const callsOrder: string[] = [];

    const list = new MigrationsList();
    list.register({
      file: "1_test",
      down: async () => {
        callsOrder.push("down1");
      },
    });
    list.register({
      file: "2_test",
      down: async () => {
        callsOrder.push("down2");
      },
    });
    list.register({
      file: "3_test",
      down: async () => {
        callsOrder.push("down3");
      },
    });
    list.register({
      file: "5_test",
      down: async () => {
        callsOrder.push("down5");
      },
    });

    // 模拟已应用（按时间顺序）
    const now = Date.now() * 1000;
    app.insertApplied("1_test", now - 4);
    app.insertApplied("2_test", now - 3);
    app.insertApplied("3_test", now - 2);
    app.insertApplied("5_test", now - 1);

    // 还有一个来自不同列表的迁移
    app.insertApplied("from_different_list", now);

    const runner = new MigrationsRunner(app, list);
    const reverted = await runner.down(2);

    // 应按 applied 降序回退最后 2 个
    // from_different_list 最新但不在 list 中（无 down 函数）
    // 5_test 次新 → down5
    // 3_test 第三新 → down3
    expect(reverted).toEqual(["from_different_list", "5_test"]);
    expect(callsOrder).toEqual(["down5"]);

    // from_different_list 和 5_test 应被移除
    expect(app.isApplied("from_different_list")).toBe(false);
    expect(app.isApplied("5_test")).toBe(false);

    // 其余仍在
    expect(app.isApplied("1_test")).toBe(true);
    expect(app.isApplied("2_test")).toBe(true);
    expect(app.isApplied("3_test")).toBe(true);
  });

  test("down 默认回退 1 个", async () => {
    const list = new MigrationsList();
    list.register({
      file: "1_test",
      down: async () => {},
    });
    list.register({
      file: "2_test",
      down: async () => {},
    });

    const now = Date.now() * 1000;
    app.insertApplied("1_test", now - 1);
    app.insertApplied("2_test", now);

    const runner = new MigrationsRunner(app, list);
    const reverted = await runner.down();

    expect(reverted).toEqual(["2_test"]);
    expect(app.isApplied("1_test")).toBe(true);
    expect(app.isApplied("2_test")).toBe(false);
  });

  test("down 无 down 函数的迁移仍然移除记录", async () => {
    const list = new MigrationsList();
    list.register({ file: "1_test" }); // 无 down

    app.insertApplied("1_test", Date.now() * 1000);

    const runner = new MigrationsRunner(app, list);
    const reverted = await runner.down(1);

    expect(reverted).toEqual(["1_test"]);
    expect(app.isApplied("1_test")).toBe(false);
  });

  test("historySync 移除不存在的迁移记录（对照 Go 版 TestMigrationsRunnerRemoveMissingAppliedMigrations）", async () => {
    // 插入 3 个已应用的迁移
    const now = Date.now() * 1000;
    app.insertApplied("1_test", now - 2);
    app.insertApplied("2_test", now - 1);
    app.insertApplied("3_test", now);

    expect(app.isApplied("2_test")).toBe(true);

    // 创建只有 1_test 和 3_test 的列表（模拟 2_test 已被删除）
    const list = new MigrationsList();
    list.register({ file: "1_test" });
    list.register({ file: "3_test" });

    const runner = new MigrationsRunner(app, list);
    const removed = await runner.historySync();

    expect(removed).toEqual(["2_test"]);
    expect(app.isApplied("2_test")).toBe(false);
    expect(app.isApplied("1_test")).toBe(true);
    expect(app.isApplied("3_test")).toBe(true);
  });

  test("historySync 无孤立记录时返回空", async () => {
    app.insertApplied("1_test", Date.now() * 1000);

    const list = new MigrationsList();
    list.register({ file: "1_test" });

    const runner = new MigrationsRunner(app, list);
    const removed = await runner.historySync();

    expect(removed).toEqual([]);
  });

  test("getAppliedMigrations 返回按 applied 升序排列", async () => {
    const now = Date.now() * 1000;
    app.insertApplied("3_test", now - 2);
    app.insertApplied("1_test", now - 1);
    app.insertApplied("2_test", now);

    const list = new MigrationsList();
    const runner = new MigrationsRunner(app, list);
    await runner.initTable();

    const records = await runner.getAppliedMigrations();
    expect(records.map((r) => r.file)).toEqual([
      "3_test",
      "1_test",
      "2_test",
    ]);
  });

  test("isMigrationApplied 检查存在/不存在", async () => {
    app.insertApplied("1_test", Date.now() * 1000);

    const list = new MigrationsList();
    const runner = new MigrationsRunner(app, list);

    expect(await runner.isMigrationApplied("1_test")).toBe(true);
    expect(await runner.isMigrationApplied("nonexistent")).toBe(false);
  });

  test("自定义表名", async () => {
    const list = new MigrationsList();
    list.register({
      file: "1_test",
      up: async () => {},
    });

    const runner = new MigrationsRunner(app, list, "custom_migrations");
    const applied = await runner.up();

    expect(applied).toEqual(["1_test"]);
  });
});

// ============================================================
// 迁移完整 Up → Down 流程（对照 Go 版 TestMigrationsRunnerUpAndDown）
// ============================================================

describe("MigrationsRunner Up → Down 完整流程", () => {
  test("对照 Go 版完整测试", async () => {
    const app = new MockMigrationApp();
    const callsOrder: string[] = [];

    const list = new MigrationsList();
    list.register({
      file: "2_test",
      up: async () => {
        callsOrder.push("up2");
      },
      down: async () => {
        callsOrder.push("down2");
      },
    });
    list.register({
      file: "3_test",
      up: async () => {
        callsOrder.push("up3");
      },
      down: async () => {
        callsOrder.push("down3");
      },
    });
    list.register({
      file: "1_test",
      up: async () => {
        callsOrder.push("up1");
      },
      down: async () => {
        callsOrder.push("down1");
      },
    });
    list.register({
      file: "4_test",
      up: async () => {
        callsOrder.push("up4");
      },
      down: async () => {
        callsOrder.push("down4");
      },
    });
    list.register({
      file: "5_test",
      up: async () => {
        callsOrder.push("up5");
      },
      down: async () => {
        callsOrder.push("down5");
      },
      reapplyCondition: async () => true,
    });

    // 模拟部分已应用（乱序）
    const now = Date.now() * 1000;
    app.insertApplied("4_test", now - 2);
    app.insertApplied("5_test", now - 1);
    app.insertApplied("2_test", now);

    const runner = new MigrationsRunner(app, list);

    // --- Up ---
    const applied = await runner.up();

    expect(applied).toEqual(["1_test", "3_test", "5_test"]);
    expect(callsOrder).toEqual(["up1", "up3", "up5"]);

    // --- 重置 callsOrder ---
    callsOrder.length = 0;

    // 添加一个新的未执行的迁移
    list.register({
      file: "6_test",
      down: async () => {
        callsOrder.push("down6");
      },
    });

    // 模拟来自不同列表的迁移
    app.insertApplied("from_different_list", Date.now() * 1000 + 1000);

    // --- Down(2) ---
    const reverted = await runner.down(2);

    // 按 applied 降序回退：from_different_list（最新）, 然后某个已应用的
    // from_different_list 不在 list 中所以 down 不会被调用
    expect(reverted.length).toBe(2);
    expect(reverted[0]).toBe("from_different_list");
    // 第二个应该是最近 applied 的已知迁移之一
  });
});

// ============================================================
// 迁移模板生成 — T100
// ============================================================

describe("generateMigrationTimestamp", () => {
  test("生成 14 位时间戳格式 YYYYMMDDHHMMSS", () => {
    const ts = generateMigrationTimestamp();
    expect(ts).toMatch(/^\d{14}$/);

    // 验证可解析为有效日期
    const year = parseInt(ts.slice(0, 4));
    const month = parseInt(ts.slice(4, 6));
    const day = parseInt(ts.slice(6, 8));
    const hour = parseInt(ts.slice(8, 10));
    const minute = parseInt(ts.slice(10, 12));
    const second = parseInt(ts.slice(12, 14));

    expect(year).toBeGreaterThanOrEqual(2024);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThanOrEqual(59);
    expect(second).toBeGreaterThanOrEqual(0);
    expect(second).toBeLessThanOrEqual(59);
  });

  test("新旧格式混合排序（对照 Go 版 TestMigrationFilenameFormat_MixedSorting）", () => {
    // 旧格式（Unix 时间戳前缀，较短）vs 新格式（YYYYMMDDHHMMSS，14位）
    const files = [
      "20240115120000_new_format.ts",
      "1704067200_old_format.ts",
      "20240116090000_another_new.ts",
    ];

    files.sort();

    // 旧的 Unix 时间戳（以 1 开头）在字典序中排在前面
    expect(files[0]).toBe("1704067200_old_format.ts");
    expect(files[1]).toBe("20240115120000_new_format.ts");
    expect(files[2]).toBe("20240116090000_another_new.ts");
  });
});

describe("blankMigrationTemplate", () => {
  test("生成空白迁移文件", () => {
    const { filename, content } = blankMigrationTemplate(
      "20240115120000",
      "add users table",
    );

    expect(filename).toBe("20240115120000_add_users_table.ts");
    expect(content).toContain("export const up");
    expect(content).toContain("export const down");
    expect(content).toContain("MigrationApp");
  });

  test("CamelCase 名称转 snake_case", () => {
    const { filename } = blankMigrationTemplate(
      "20240115120000",
      "MyTestMigration",
    );
    expect(filename).toBe("20240115120000_my_test_migration.ts");
  });
});

describe("createCollectionTemplate", () => {
  test("生成 Collection 创建迁移", () => {
    const json = JSON.stringify(
      { id: "abc123", name: "posts", type: "base", schema: [], system: false },
      null,
      2,
    );

    const { filename, content } = createCollectionTemplate(
      "20240115120000",
      "posts",
      json,
    );

    expect(filename).toBe("20240115120000_created_posts.ts");
    expect(content).toContain("collectionData");
    expect(content).toContain("INSERT INTO _collections");
    expect(content).toContain("export const up");
    expect(content).toContain("export const down");
    expect(content).toContain('DELETE FROM _collections WHERE name = ?');
    expect(content).toContain('DROP TABLE IF EXISTS "posts"');
  });
});

describe("deleteCollectionTemplate", () => {
  test("生成 Collection 删除迁移", () => {
    const json = JSON.stringify(
      { id: "abc123", name: "posts", type: "base", schema: [], system: false },
      null,
      2,
    );

    const { filename, content } = deleteCollectionTemplate(
      "20240115120000",
      "posts",
      json,
    );

    expect(filename).toBe("20240115120000_deleted_posts.ts");
    expect(content).toContain('DELETE FROM _collections WHERE name = ?');
    expect(content).toContain("export const up");
    expect(content).toContain("export const down");
    // down 应该重新创建
    expect(content).toContain("INSERT INTO _collections");
  });
});

// ============================================================
// 文件操作辅助 — T100
// ============================================================

describe("writeMigrationFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "migration-test-"));
  });

  test("写入文件到指定目录", async () => {
    const migrationsDir = join(tmpDir, "pb_migrations");
    const filePath = await writeMigrationFile(
      migrationsDir,
      "20240115120000_test.ts",
      "// test content",
    );

    expect(filePath).toBe(join(migrationsDir, "20240115120000_test.ts"));

    const content = await Bun.file(filePath).text();
    expect(content).toBe("// test content");
  });

  test("自动创建目录", async () => {
    const migrationsDir = join(tmpDir, "deep", "nested", "pb_migrations");
    await writeMigrationFile(
      migrationsDir,
      "test.ts",
      "content",
    );

    const files = await readdir(migrationsDir);
    expect(files).toContain("test.ts");
  });
});

describe("loadMigrationFiles", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "migration-load-"));
  });

  test("加载 .ts 和 .js 文件", async () => {
    await Bun.write(join(tmpDir, "001_first.ts"), "");
    await Bun.write(join(tmpDir, "002_second.js"), "");
    await Bun.write(join(tmpDir, "003_third.ts"), "");
    await Bun.write(join(tmpDir, "readme.md"), "");
    await Bun.write(join(tmpDir, ".hidden"), "");

    const files = await loadMigrationFiles(tmpDir);
    expect(files).toEqual(["001_first.ts", "002_second.js", "003_third.ts"]);
  });

  test("按文件名排序", async () => {
    await Bun.write(join(tmpDir, "c_migration.ts"), "");
    await Bun.write(join(tmpDir, "a_migration.ts"), "");
    await Bun.write(join(tmpDir, "b_migration.ts"), "");

    const files = await loadMigrationFiles(tmpDir);
    expect(files).toEqual([
      "a_migration.ts",
      "b_migration.ts",
      "c_migration.ts",
    ]);
  });

  test("目录不存在返回空数组", async () => {
    const files = await loadMigrationFiles("/nonexistent/dir");
    expect(files).toEqual([]);
  });

  test("空目录返回空数组", async () => {
    const files = await loadMigrationFiles(tmpDir);
    expect(files).toEqual([]);
  });
});
