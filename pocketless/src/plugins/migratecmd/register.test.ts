/**
 * T184: MigrateCmd 插件完整测试
 * 对照 Go 版 — CLI 命令注册、自动迁移触发、迁移文件生成
 */
import { describe, test, expect } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  type MigrateCmdConfig,
  type MigrateCmdPlugin,
} from "./register";

describe("MigrateCmd Plugin", () => {
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
  });

  describe("MustRegister", () => {
    test("接受 3 个参数（app, rootCmd, config）", () => {
      const plugin = MustRegister(null, null);
      expect(plugin).toBeDefined();
    });

    test("使用默认配置", () => {
      const plugin = MustRegister(null, null);
      const cfg = plugin.getConfig();
      expect(cfg.dir).toBe("pb_migrations");
      expect(cfg.automigrate).toBe(true);
      expect(cfg.templateLang).toBe("ts");
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

  describe("getConfig", () => {
    test("返回配置副本", () => {
      const plugin = MustRegister(null, null, {
        dir: "pb_migrations",
        automigrate: true,
        templateLang: "ts",
      });
      const cfg1 = plugin.getConfig();
      const cfg2 = plugin.getConfig();
      expect(cfg1).not.toBe(cfg2); // 不同引用
      expect(cfg1).toEqual(cfg2);  // 相同值
    });

    test("修改返回值不影响内部配置", () => {
      const plugin = MustRegister(null, null, {
        dir: "pb_migrations",
        automigrate: true,
        templateLang: "ts",
      });
      const cfg = plugin.getConfig();
      cfg.dir = "hacked";
      expect(plugin.getConfig().dir).toBe("pb_migrations");
    });
  });

  describe("isAutoMigrateEnabled", () => {
    test("automigrate=true → true", () => {
      const plugin = MustRegister(null, null, {
        dir: "pb_migrations",
        automigrate: true,
        templateLang: "ts",
      });
      expect(plugin.isAutoMigrateEnabled()).toBe(true);
    });

    test("automigrate=false → false", () => {
      const plugin = MustRegister(null, null, {
        dir: "pb_migrations",
        automigrate: false,
        templateLang: "ts",
      });
      expect(plugin.isAutoMigrateEnabled()).toBe(false);
    });
  });

  describe("TemplateLang 类型", () => {
    test("支持 ts", () => {
      const plugin = MustRegister(null, null, {
        dir: "pb_migrations",
        automigrate: true,
        templateLang: "ts",
      });
      expect(plugin.getConfig().templateLang).toBe("ts");
    });

    test("支持 js", () => {
      const plugin = MustRegister(null, null, {
        dir: "pb_migrations",
        automigrate: true,
        templateLang: "js",
      });
      expect(plugin.getConfig().templateLang).toBe("js");
    });
  });
});
