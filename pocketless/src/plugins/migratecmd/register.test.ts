/**
 * T184: MigrateCmd 插件完整测试
 * 对照 Go 版 plugins/migratecmd/
 * 覆盖: defaultConfig, applyEnvOverrides, generateTemplate, getMigrationFilename,
 *       Migration CRUD (add/list/getPending/getApplied), run (up/down), rollback
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  generateTemplate,
  getMigrationFilename,
  type MigrateCmdConfig,
  type MigrateCmdPlugin,
  type Migration,
} from "./register";

// ---------- 辅助函数 ----------

function makePlugin(overrides: Partial<MigrateCmdConfig> = {}): MigrateCmdPlugin {
  return MustRegister(null, null, { ...defaultConfig(), ...overrides });
}

/** 创建一个简单的内存迁移记录 */
function makeMigration(name: string): Migration {
  return {
    name,
    up: () => {},
    down: () => {},
  };
}

// ---------- 测试套件 ----------

describe("MigrateCmd Plugin", () => {
  // ============================
  // defaultConfig
  // ============================
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.dir).toBe("pb_migrations");
      expect(cfg.automigrate).toBe(true);
      expect(cfg.templateLang).toBe("ts");
    });

    test("每次返回新对象", () => {
      const a = defaultConfig();
      const b = defaultConfig();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    test("修改返回值不影响下一次调用", () => {
      const cfg = defaultConfig();
      cfg.dir = "hacked";
      expect(defaultConfig().dir).toBe("pb_migrations");
    });
  });

  // ============================
  // applyEnvOverrides
  // ============================
  describe("applyEnvOverrides", () => {
    const savedEnv: Record<string, string | undefined> = {};
    const keys = [
      "PB_MIGRATECMD_DIR",
      "PB_MIGRATECMD_AUTOMIGRATE",
      "PB_MIGRATECMD_TEMPLATE_LANG",
    ];

    beforeEach(() => {
      for (const k of keys) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of keys) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
      }
    });

    test("无环境变量时返回原配置的副本", () => {
      const cfg = defaultConfig();
      const result = applyEnvOverrides(cfg);
      expect(result).not.toBe(cfg);
      expect(result).toEqual(cfg);
    });

    test("不修改原始对象", () => {
      const cfg = defaultConfig();
      process.env.PB_MIGRATECMD_DIR = "/custom/path";
      applyEnvOverrides(cfg);
      expect(cfg.dir).toBe("pb_migrations");
    });

    test("PB_MIGRATECMD_DIR 覆盖 dir", () => {
      process.env.PB_MIGRATECMD_DIR = "/data/migrations";
      const result = applyEnvOverrides(defaultConfig());
      expect(result.dir).toBe("/data/migrations");
    });

    test("PB_MIGRATECMD_AUTOMIGRATE=false 覆盖 automigrate", () => {
      process.env.PB_MIGRATECMD_AUTOMIGRATE = "false";
      const result = applyEnvOverrides(defaultConfig());
      expect(result.automigrate).toBe(false);
    });

    test("PB_MIGRATECMD_AUTOMIGRATE=true 覆盖为 true", () => {
      process.env.PB_MIGRATECMD_AUTOMIGRATE = "true";
      const result = applyEnvOverrides({ ...defaultConfig(), automigrate: false });
      expect(result.automigrate).toBe(true);
    });

    test("PB_MIGRATECMD_TEMPLATE_LANG=js 覆盖 templateLang", () => {
      process.env.PB_MIGRATECMD_TEMPLATE_LANG = "js";
      const result = applyEnvOverrides(defaultConfig());
      expect(result.templateLang).toBe("js");
    });

    test("PB_MIGRATECMD_TEMPLATE_LANG=ts 覆盖为 ts", () => {
      process.env.PB_MIGRATECMD_TEMPLATE_LANG = "ts";
      const result = applyEnvOverrides({ ...defaultConfig(), templateLang: "js" });
      expect(result.templateLang).toBe("ts");
    });

    test("无效的 PB_MIGRATECMD_TEMPLATE_LANG 被忽略", () => {
      process.env.PB_MIGRATECMD_TEMPLATE_LANG = "go";
      const result = applyEnvOverrides(defaultConfig());
      expect(result.templateLang).toBe("ts"); // 保持原值
    });

    test("三个变量同时生效", () => {
      process.env.PB_MIGRATECMD_DIR = "/custom";
      process.env.PB_MIGRATECMD_AUTOMIGRATE = "false";
      process.env.PB_MIGRATECMD_TEMPLATE_LANG = "js";
      const result = applyEnvOverrides(defaultConfig());
      expect(result.dir).toBe("/custom");
      expect(result.automigrate).toBe(false);
      expect(result.templateLang).toBe("js");
    });
  });

  // ============================
  // generateTemplate
  // ============================
  describe("generateTemplate", () => {
    test("ts 模板包含 async up/down 函数", () => {
      const tpl = generateTemplate("add_users", "ts");
      expect(tpl).toContain("export async function up");
      expect(tpl).toContain("export async function down");
    });

    test("ts 模板包含迁移名称注释", () => {
      const tpl = generateTemplate("add_users", "ts");
      expect(tpl).toContain("add_users");
    });

    test("ts 模板包含 PocketBase import", () => {
      const tpl = generateTemplate("init", "ts");
      expect(tpl).toContain('import PocketBase from "pocketbase"');
    });

    test("js 模板包含 migrate() 调用", () => {
      const tpl = generateTemplate("add_posts", "js");
      expect(tpl).toContain("migrate(");
    });

    test("js 模板包含 reference 路径注释", () => {
      const tpl = generateTemplate("add_posts", "js");
      expect(tpl).toContain("/// <reference");
    });

    test("js 模板包含迁移名称注释", () => {
      const tpl = generateTemplate("add_posts", "js");
      expect(tpl).toContain("add_posts");
    });

    test("ts 模板不包含 migrate()", () => {
      const tpl = generateTemplate("init", "ts");
      expect(tpl).not.toContain("migrate(");
    });

    test("js 模板不包含 import PocketBase", () => {
      const tpl = generateTemplate("init", "js");
      expect(tpl).not.toContain("import PocketBase");
    });

    test("模板末尾以换行结束", () => {
      expect(generateTemplate("x", "ts").endsWith("\n")).toBe(true);
      expect(generateTemplate("x", "js").endsWith("\n")).toBe(true);
    });
  });

  // ============================
  // getMigrationFilename
  // ============================
  describe("getMigrationFilename", () => {
    const fixedDate = new Date("2024-06-15T12:00:00Z");
    const expectedTs = Math.floor(fixedDate.getTime() / 1000).toString();

    test("ts 文件名以 .ts 结尾", () => {
      const name = getMigrationFilename("add_users", "ts", fixedDate);
      expect(name.endsWith(".ts")).toBe(true);
    });

    test("js 文件名以 .js 结尾", () => {
      const name = getMigrationFilename("add_users", "js", fixedDate);
      expect(name.endsWith(".js")).toBe(true);
    });

    test("文件名包含 unix 时间戳前缀", () => {
      const name = getMigrationFilename("add_users", "ts", fixedDate);
      expect(name.startsWith(expectedTs)).toBe(true);
    });

    test("文件名包含迁移名称", () => {
      const name = getMigrationFilename("add_users", "ts", fixedDate);
      expect(name).toContain("add_users");
    });

    test("空格被替换为下划线", () => {
      const name = getMigrationFilename("add new users", "ts", fixedDate);
      expect(name).not.toContain(" ");
      expect(name).toContain("add_new_users");
    });

    test("特殊字符被替换为下划线", () => {
      const name = getMigrationFilename("add@users!", "ts", fixedDate);
      expect(name).toContain("add_users_");
    });

    test("不传 now 使用当前时间（时间戳不为零）", () => {
      const before = Math.floor(Date.now() / 1000);
      const filename = getMigrationFilename("test", "ts");
      const after = Math.floor(Date.now() / 1000);
      const ts = parseInt(filename.split("_")[0]);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    test("格式为 <ts>_<name>.<ext>", () => {
      const name = getMigrationFilename("init", "ts", fixedDate);
      expect(name).toMatch(/^\d+_init\.ts$/);
    });
  });

  // ============================
  // MustRegister
  // ============================
  describe("MustRegister", () => {
    test("接受 app=null, rootCmd=null", () => {
      const plugin = MustRegister(null, null);
      expect(plugin).toBeDefined();
    });

    test("使用默认配置", () => {
      const plugin = MustRegister(null, null);
      expect(plugin.getConfig()).toEqual(defaultConfig());
    });

    test("使用自定义配置", () => {
      const plugin = MustRegister(null, null, {
        dir: "custom_migrations",
        automigrate: false,
        templateLang: "js",
      });
      const cfg = plugin.getConfig();
      expect(cfg.dir).toBe("custom_migrations");
      expect(cfg.automigrate).toBe(false);
      expect(cfg.templateLang).toBe("js");
    });
  });

  // ============================
  // getConfig
  // ============================
  describe("getConfig", () => {
    test("返回配置副本", () => {
      const plugin = makePlugin();
      const a = plugin.getConfig();
      const b = plugin.getConfig();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    test("修改返回值不影响内部配置", () => {
      const plugin = makePlugin({ dir: "original" });
      const cfg = plugin.getConfig();
      cfg.dir = "hacked";
      expect(plugin.getConfig().dir).toBe("original");
    });
  });

  // ============================
  // isAutoMigrateEnabled
  // ============================
  describe("isAutoMigrateEnabled", () => {
    test("automigrate=true → true", () => {
      expect(makePlugin({ automigrate: true }).isAutoMigrateEnabled()).toBe(true);
    });

    test("automigrate=false → false", () => {
      expect(makePlugin({ automigrate: false }).isAutoMigrateEnabled()).toBe(false);
    });
  });

  // ============================
  // TemplateLang 类型
  // ============================
  describe("TemplateLang 类型", () => {
    test("支持 ts", () => {
      expect(makePlugin({ templateLang: "ts" }).getConfig().templateLang).toBe("ts");
    });

    test("支持 js", () => {
      expect(makePlugin({ templateLang: "js" }).getConfig().templateLang).toBe("js");
    });
  });

  // ============================
  // addMigration / listMigrations
  // ============================
  describe("addMigration / listMigrations", () => {
    test("初始状态列表为空", () => {
      expect(makePlugin().listMigrations()).toHaveLength(0);
    });

    test("添加一条迁移后列表长度为 1", () => {
      const p = makePlugin();
      p.addMigration(makeMigration("001_init"));
      expect(p.listMigrations()).toHaveLength(1);
    });

    test("多条迁移按添加顺序排列", () => {
      const p = makePlugin();
      p.addMigration(makeMigration("001_init"));
      p.addMigration(makeMigration("002_add_users"));
      p.addMigration(makeMigration("003_add_posts"));
      const names = p.listMigrations().map((m) => m.name);
      expect(names).toEqual(["001_init", "002_add_users", "003_add_posts"]);
    });

    test("listMigrations 返回副本，修改不影响内部", () => {
      const p = makePlugin();
      p.addMigration(makeMigration("001_init"));
      const list = p.listMigrations();
      list.push(makeMigration("injected"));
      expect(p.listMigrations()).toHaveLength(1);
    });

    test("同名迁移替换原有记录（保持位置）", () => {
      const p = makePlugin();
      const m1 = makeMigration("001_init");
      const m2 = makeMigration("002_users");
      p.addMigration(m1);
      p.addMigration(m2);

      const updated = { ...makeMigration("001_init"), name: "001_init" };
      p.addMigration(updated);

      const list = p.listMigrations();
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe("001_init");
      expect(list[1].name).toBe("002_users");
    });
  });

  // ============================
  // getPending / getApplied
  // ============================
  describe("getPending / getApplied", () => {
    test("初始所有迁移都是 pending", () => {
      const p = makePlugin();
      p.addMigration(makeMigration("001"));
      p.addMigration(makeMigration("002"));
      expect(p.getPending()).toHaveLength(2);
      expect(p.getApplied()).toHaveLength(0);
    });

    test("应用后移入 applied", () => {
      const p = makePlugin();
      const m = makeMigration("001_init");
      p.addMigration(m);
      m.appliedAt = new Date();

      expect(p.getPending()).toHaveLength(0);
      expect(p.getApplied()).toHaveLength(1);
    });

    test("混合状态正确分类", () => {
      const p = makePlugin();
      const m1 = makeMigration("001");
      const m2 = makeMigration("002");
      const m3 = makeMigration("003");
      p.addMigration(m1);
      p.addMigration(m2);
      p.addMigration(m3);
      m1.appliedAt = new Date();
      m3.appliedAt = new Date();

      expect(p.getPending()).toHaveLength(1);
      expect(p.getApplied()).toHaveLength(2);
      expect(p.getPending()[0].name).toBe("002");
    });
  });

  // ============================
  // run (up)
  // ============================
  describe("run — up 方向", () => {
    test("按顺序执行所有 up 函数", async () => {
      const p = makePlugin();
      const order: string[] = [];
      const m1 = { name: "001", up: () => { order.push("001"); }, down: () => {} };
      const m2 = { name: "002", up: () => { order.push("002"); }, down: () => {} };
      await p.run([m1, m2], "up");
      expect(order).toEqual(["001", "002"]);
    });

    test("执行后 appliedAt 被设置", async () => {
      const p = makePlugin();
      const before = Date.now();
      const m = makeMigration("001");
      await p.run([m], "up");
      const after = Date.now();
      expect(m.appliedAt).toBeDefined();
      expect(m.appliedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(m.appliedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    test("支持异步 up 函数", async () => {
      const p = makePlugin();
      const results: number[] = [];
      const m = {
        name: "001",
        up: async () => {
          await Bun.sleep(1);
          results.push(1);
        },
        down: async () => {},
      };
      await p.run([m], "up");
      expect(results).toEqual([1]);
    });

    test("空数组不报错", async () => {
      const p = makePlugin();
      await expect(p.run([], "up")).resolves.toBeUndefined();
    });
  });

  // ============================
  // run (down)
  // ============================
  describe("run — down 方向", () => {
    test("逆序执行 down 函数", async () => {
      const p = makePlugin();
      const order: string[] = [];
      const m1 = { name: "001", up: () => {}, down: () => { order.push("001"); } };
      const m2 = { name: "002", up: () => {}, down: () => { order.push("002"); } };
      const m3 = { name: "003", up: () => {}, down: () => { order.push("003"); } };
      await p.run([m1, m2, m3], "down");
      expect(order).toEqual(["003", "002", "001"]);
    });

    test("执行后 appliedAt 被清除", async () => {
      const p = makePlugin();
      const m = { ...makeMigration("001"), appliedAt: new Date() };
      await p.run([m], "down");
      expect(m.appliedAt).toBeUndefined();
    });

    test("不修改传入的 migrations 数组顺序", async () => {
      const p = makePlugin();
      const m1 = makeMigration("001");
      const m2 = makeMigration("002");
      const arr = [m1, m2];
      await p.run(arr, "down");
      expect(arr[0].name).toBe("001");
      expect(arr[1].name).toBe("002");
    });
  });

  // ============================
  // rollback
  // ============================
  describe("rollback", () => {
    test("无已应用迁移时不报错", async () => {
      const p = makePlugin();
      p.addMigration(makeMigration("001"));
      await expect(p.rollback()).resolves.toBeUndefined();
    });

    test("回滚最后一条已应用的迁移", async () => {
      const p = makePlugin();
      const rolled: string[] = [];
      const m1 = { name: "001", up: () => {}, down: () => { rolled.push("001"); }, appliedAt: new Date() };
      const m2 = { name: "002", up: () => {}, down: () => { rolled.push("002"); }, appliedAt: new Date() };
      p.addMigration(m1);
      p.addMigration(m2);

      await p.rollback();
      expect(rolled).toEqual(["002"]);
    });

    test("回滚后 appliedAt 被清除", async () => {
      const p = makePlugin();
      const m = { ...makeMigration("001"), appliedAt: new Date() };
      p.addMigration(m);
      await p.rollback();
      expect(m.appliedAt).toBeUndefined();
    });

    test("回滚后其他迁移不受影响", async () => {
      const p = makePlugin();
      const m1 = { ...makeMigration("001"), appliedAt: new Date() };
      const m2 = { ...makeMigration("002"), appliedAt: new Date() };
      p.addMigration(m1);
      p.addMigration(m2);
      await p.rollback();

      // m1 仍然应用
      expect(p.getApplied()).toHaveLength(1);
      expect(p.getApplied()[0].name).toBe("001");
    });

    test("连续回滚逐一撤销", async () => {
      const p = makePlugin();
      const m1 = { ...makeMigration("001"), appliedAt: new Date() };
      const m2 = { ...makeMigration("002"), appliedAt: new Date() };
      p.addMigration(m1);
      p.addMigration(m2);

      await p.rollback(); // 回滚 002
      await p.rollback(); // 回滚 001

      expect(p.getApplied()).toHaveLength(0);
      expect(p.getPending()).toHaveLength(2);
    });

    test("三次 rollback 后空状态不报错", async () => {
      const p = makePlugin();
      const m = { ...makeMigration("001"), appliedAt: new Date() };
      p.addMigration(m);
      await p.rollback();
      await expect(p.rollback()).resolves.toBeUndefined();
      await expect(p.rollback()).resolves.toBeUndefined();
    });
  });

  // ============================
  // run + rollback 集成
  // ============================
  describe("run + rollback 集成", () => {
    test("run up 全部 → rollback 一条", async () => {
      const p = makePlugin();
      const m1 = makeMigration("001");
      const m2 = makeMigration("002");
      p.addMigration(m1);
      p.addMigration(m2);

      await p.run([m1, m2], "up");
      expect(p.getApplied()).toHaveLength(2);

      await p.rollback();
      expect(p.getApplied()).toHaveLength(1);
      expect(p.getApplied()[0].name).toBe("001");
    });

    test("run down 后状态还原为 pending", async () => {
      const p = makePlugin();
      const m1 = { ...makeMigration("001"), appliedAt: new Date() };
      const m2 = { ...makeMigration("002"), appliedAt: new Date() };
      p.addMigration(m1);
      p.addMigration(m2);

      await p.run([m1, m2], "down");
      expect(p.getPending()).toHaveLength(2);
    });

    test("先 run up 再 run down 完整往返", async () => {
      const p = makePlugin();
      const log: string[] = [];
      const migrations: Migration[] = [
        { name: "001", up: () => { log.push("up:001"); }, down: () => { log.push("down:001"); } },
        { name: "002", up: () => { log.push("up:002"); }, down: () => { log.push("down:002"); } },
      ];
      migrations.forEach((m) => p.addMigration(m));

      await p.run(p.getPending(), "up");
      await p.run(p.getApplied(), "down");

      expect(log).toEqual(["up:001", "up:002", "down:002", "down:001"]);
      expect(p.getPending()).toHaveLength(2);
    });
  });
});
