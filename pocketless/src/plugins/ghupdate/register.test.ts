/**
 * T185: GHUpdate 插件完整测试
 * 对照 Go 版 — GitHub Release 检查、版本比较、下载更新
 */
import { describe, test, expect, beforeAll } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  type GHUpdateConfig,
  type GHUpdatePlugin,
} from "./register";

describe("GHUpdate Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.owner).toBe("pocketbase");
      expect(cfg.repo).toBe("pocketbase");
      expect(cfg.archiveExecutable).toBe("pocketbase");
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
      expect(cfg.owner).toBe("pocketbase");
      expect(cfg.repo).toBe("pocketbase");
    });

    test("使用自定义配置", () => {
      const plugin = MustRegister(null, null, {
        owner: "myorg",
        repo: "myapp",
        archiveExecutable: "myapp",
      });
      const cfg = plugin.getConfig();
      expect(cfg.owner).toBe("myorg");
      expect(cfg.repo).toBe("myapp");
      expect(cfg.archiveExecutable).toBe("myapp");
    });
  });

  describe("getConfig", () => {
    test("返回配置副本", () => {
      const plugin = MustRegister(null, null);
      const cfg1 = plugin.getConfig();
      const cfg2 = plugin.getConfig();
      expect(cfg1).not.toBe(cfg2);
      expect(cfg1).toEqual(cfg2);
    });

    test("修改返回值不影响内部配置", () => {
      const plugin = MustRegister(null, null);
      const cfg = plugin.getConfig();
      cfg.owner = "hacked";
      expect(plugin.getConfig().owner).toBe("pocketbase");
    });
  });

  describe("compareVersions", () => {
    let plugin: GHUpdatePlugin;

    beforeAll(() => {
      plugin = MustRegister(null, null);
    });

    test("相同版本 → 0", () => {
      expect(plugin.compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    test("当前版本较低 → -1", () => {
      expect(plugin.compareVersions("1.0.0", "1.0.1")).toBe(-1);
    });

    test("当前版本较高 → 1", () => {
      expect(plugin.compareVersions("1.0.1", "1.0.0")).toBe(1);
    });

    test("主版本号差异", () => {
      expect(plugin.compareVersions("1.0.0", "2.0.0")).toBe(-1);
      expect(plugin.compareVersions("2.0.0", "1.0.0")).toBe(1);
    });

    test("次版本号差异", () => {
      expect(plugin.compareVersions("1.1.0", "1.2.0")).toBe(-1);
      expect(plugin.compareVersions("1.2.0", "1.1.0")).toBe(1);
    });

    test("补丁版本号差异", () => {
      expect(plugin.compareVersions("1.0.1", "1.0.2")).toBe(-1);
      expect(plugin.compareVersions("1.0.2", "1.0.1")).toBe(1);
    });

    test("带 v 前缀", () => {
      expect(plugin.compareVersions("v1.0.0", "v1.0.1")).toBe(-1);
      expect(plugin.compareVersions("v1.0.1", "v1.0.0")).toBe(1);
      expect(plugin.compareVersions("v1.0.0", "v1.0.0")).toBe(0);
    });

    test("混合有无 v 前缀", () => {
      expect(plugin.compareVersions("v1.0.0", "1.0.1")).toBe(-1);
      expect(plugin.compareVersions("1.0.0", "v1.0.0")).toBe(0);
    });

    test("不同长度版本号", () => {
      expect(plugin.compareVersions("1.0", "1.0.1")).toBe(-1);
      expect(plugin.compareVersions("1.0.0", "1.0")).toBe(0);
    });

    test("大版本号跳跃", () => {
      expect(plugin.compareVersions("0.22.28", "0.23.0")).toBe(-1);
    });
  });

  describe("fetchLatestRelease", () => {
    test("方法存在且返回 Promise", () => {
      const plugin = MustRegister(null, null);
      const result = plugin.fetchLatestRelease();
      expect(result).toBeInstanceOf(Promise);
    });

    test("无效 owner/repo 返回 null", async () => {
      const plugin = MustRegister(null, null, {
        owner: "nonexistent-org-12345",
        repo: "nonexistent-repo-12345",
      });
      const release = await plugin.fetchLatestRelease();
      expect(release).toBeNull();
    });
  });
});
