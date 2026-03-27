/**
 * T185: GHUpdate 插件完整测试
 * 对照 Go 版 plugins/ghupdate/
 * 覆盖: defaultConfig, applyEnvOverrides, MustRegister, getConfig,
 *       compareVersions, isUpdateAvailable, findAsset, fetchLatestRelease
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  type GHUpdateConfig,
  type GHUpdatePlugin,
  type Release,
  type ReleaseAsset,
} from "./register";

// ---------- 辅助函数 ----------

function makePlugin(overrides: Partial<GHUpdateConfig> = {}): GHUpdatePlugin {
  return MustRegister(null, null, { ...defaultConfig(), ...overrides });
}

function makeRelease(assets: Partial<ReleaseAsset>[] = []): Release {
  return {
    name: "v0.23.0",
    tag: "v0.23.0",
    published: "2024-06-15T00:00:00Z",
    url: "https://github.com/pocketbase/pocketbase/releases/tag/v0.23.0",
    body: "Release notes",
    assets: assets.map((a, i) => ({
      name: a.name ?? `asset-${i}`,
      downloadUrl: a.downloadUrl ?? `https://example.com/asset-${i}`,
      id: a.id ?? i,
      size: a.size ?? 1024,
    })),
  };
}

// ---------- 测试套件 ----------

describe("GHUpdate Plugin", () => {
  // ============================
  // defaultConfig
  // ============================
  describe("defaultConfig", () => {
    test("owner 默认为 pocketbase", () => {
      expect(defaultConfig().owner).toBe("pocketbase");
    });

    test("repo 默认为 pocketbase", () => {
      expect(defaultConfig().repo).toBe("pocketbase");
    });

    test("archiveExecutable 默认为 pocketbase", () => {
      expect(defaultConfig().archiveExecutable).toBe("pocketbase");
    });

    test("每次返回新对象", () => {
      const a = defaultConfig();
      const b = defaultConfig();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    test("修改返回值不影响下次调用", () => {
      const cfg = defaultConfig();
      cfg.owner = "modified";
      expect(defaultConfig().owner).toBe("pocketbase");
    });
  });

  // ============================
  // applyEnvOverrides
  // ============================
  describe("applyEnvOverrides", () => {
    const ENV_KEYS = [
      "PB_GHUPDATE_OWNER",
      "PB_GHUPDATE_REPO",
      "PB_GHUPDATE_ARCHIVE_EXECUTABLE",
    ] as const;

    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const k of ENV_KEYS) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of ENV_KEYS) {
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
      process.env.PB_GHUPDATE_OWNER = "neworg";
      applyEnvOverrides(cfg);
      expect(cfg.owner).toBe("pocketbase");
    });

    test("PB_GHUPDATE_OWNER 覆盖 owner", () => {
      process.env.PB_GHUPDATE_OWNER = "myorg";
      expect(applyEnvOverrides(defaultConfig()).owner).toBe("myorg");
    });

    test("PB_GHUPDATE_REPO 覆盖 repo", () => {
      process.env.PB_GHUPDATE_REPO = "myapp";
      expect(applyEnvOverrides(defaultConfig()).repo).toBe("myapp");
    });

    test("PB_GHUPDATE_ARCHIVE_EXECUTABLE 覆盖 archiveExecutable", () => {
      process.env.PB_GHUPDATE_ARCHIVE_EXECUTABLE = "myapp";
      expect(applyEnvOverrides(defaultConfig()).archiveExecutable).toBe("myapp");
    });

    test("三个变量同时生效", () => {
      process.env.PB_GHUPDATE_OWNER = "corp";
      process.env.PB_GHUPDATE_REPO = "backend";
      process.env.PB_GHUPDATE_ARCHIVE_EXECUTABLE = "backend-bin";
      const result = applyEnvOverrides(defaultConfig());
      expect(result.owner).toBe("corp");
      expect(result.repo).toBe("backend");
      expect(result.archiveExecutable).toBe("backend-bin");
    });

    test("空字符串也被应用", () => {
      process.env.PB_GHUPDATE_OWNER = "";
      expect(applyEnvOverrides(defaultConfig()).owner).toBe("");
    });
  });

  // ============================
  // MustRegister
  // ============================
  describe("MustRegister", () => {
    test("接受 app=null, rootCmd=null", () => {
      expect(MustRegister(null, null)).toBeDefined();
    });

    test("使用默认配置", () => {
      expect(MustRegister(null, null).getConfig()).toEqual(defaultConfig());
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

    test("archiveExecutable 可选，可以省略", () => {
      const plugin = MustRegister(null, null, { owner: "org", repo: "repo" });
      expect(plugin.getConfig().archiveExecutable).toBeUndefined();
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
      const plugin = makePlugin({ owner: "original" });
      const cfg = plugin.getConfig();
      cfg.owner = "hacked";
      expect(plugin.getConfig().owner).toBe("original");
    });
  });

  // ============================
  // compareVersions
  // ============================
  describe("compareVersions", () => {
    let plugin: GHUpdatePlugin;

    beforeAll(() => {
      plugin = makePlugin();
    });

    test("相同版本 → 0", () => {
      expect(plugin.compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    test("current < latest → -1（有新版本）", () => {
      expect(plugin.compareVersions("1.0.0", "1.0.1")).toBe(-1);
    });

    test("current > latest → 1（比远端更新）", () => {
      expect(plugin.compareVersions("1.0.1", "1.0.0")).toBe(1);
    });

    test("主版本号差异：低 → -1", () => {
      expect(plugin.compareVersions("1.0.0", "2.0.0")).toBe(-1);
    });

    test("主版本号差异：高 → 1", () => {
      expect(plugin.compareVersions("2.0.0", "1.0.0")).toBe(1);
    });

    test("次版本号差异：低 → -1", () => {
      expect(plugin.compareVersions("1.1.0", "1.2.0")).toBe(-1);
    });

    test("次版本号差异：高 → 1", () => {
      expect(plugin.compareVersions("1.2.0", "1.1.0")).toBe(1);
    });

    test("补丁版本号差异：低 → -1", () => {
      expect(plugin.compareVersions("1.0.1", "1.0.2")).toBe(-1);
    });

    test("补丁版本号差异：高 → 1", () => {
      expect(plugin.compareVersions("1.0.2", "1.0.1")).toBe(1);
    });

    test("带 v 前缀：低 → -1", () => {
      expect(plugin.compareVersions("v1.0.0", "v1.0.1")).toBe(-1);
    });

    test("带 v 前缀：相同 → 0", () => {
      expect(plugin.compareVersions("v1.0.0", "v1.0.0")).toBe(0);
    });

    test("混合有无 v 前缀", () => {
      expect(plugin.compareVersions("v1.0.0", "1.0.1")).toBe(-1);
      expect(plugin.compareVersions("1.0.0", "v1.0.0")).toBe(0);
    });

    test("不同长度：1.0 vs 1.0.1 → -1", () => {
      expect(plugin.compareVersions("1.0", "1.0.1")).toBe(-1);
    });

    test("不同长度：1.0.0 vs 1.0 → 0（补零相等）", () => {
      expect(plugin.compareVersions("1.0.0", "1.0")).toBe(0);
    });

    test("大版本号跳跃：0.22.28 vs 0.23.0 → -1", () => {
      expect(plugin.compareVersions("0.22.28", "0.23.0")).toBe(-1);
    });

    test("十位数字版本号", () => {
      expect(plugin.compareVersions("1.9.0", "1.10.0")).toBe(-1);
    });
  });

  // ============================
  // isUpdateAvailable
  // ============================
  describe("isUpdateAvailable", () => {
    let plugin: GHUpdatePlugin;

    beforeAll(() => {
      plugin = makePlugin();
    });

    test("有新版本返回 true", () => {
      expect(plugin.isUpdateAvailable("1.0.0", "1.0.1")).toBe(true);
    });

    test("已是最新返回 false", () => {
      expect(plugin.isUpdateAvailable("1.0.0", "1.0.0")).toBe(false);
    });

    test("比远端更新也返回 false", () => {
      expect(plugin.isUpdateAvailable("1.0.1", "1.0.0")).toBe(false);
    });

    test("带 v 前缀：有新版本 → true", () => {
      expect(plugin.isUpdateAvailable("v0.22.28", "v0.23.0")).toBe(true);
    });

    test("主版本号升级 → true", () => {
      expect(plugin.isUpdateAvailable("1.9.9", "2.0.0")).toBe(true);
    });
  });

  // ============================
  // findAsset
  // ============================
  describe("findAsset", () => {
    let plugin: GHUpdatePlugin;

    beforeAll(() => {
      plugin = makePlugin();
    });

    const release = makeRelease([
      { name: "pocketbase_0.23.0_linux_amd64.zip" },
      { name: "pocketbase_0.23.0_linux_arm64.zip" },
      { name: "pocketbase_0.23.0_darwin_amd64.zip" },
      { name: "pocketbase_0.23.0_windows_amd64.exe.zip" },
      { name: "checksums.txt" },
    ]);

    test("精确名称匹配", () => {
      const asset = plugin.findAsset(release, "checksums.txt");
      expect(asset).not.toBeNull();
      expect(asset?.name).toBe("checksums.txt");
    });

    test("通配符前缀匹配", () => {
      const asset = plugin.findAsset(release, "*linux_amd64*");
      expect(asset?.name).toBe("pocketbase_0.23.0_linux_amd64.zip");
    });

    test("通配符后缀匹配", () => {
      const asset = plugin.findAsset(release, "*arm64.zip");
      expect(asset?.name).toBe("pocketbase_0.23.0_linux_arm64.zip");
    });

    test("通配符 windows 匹配", () => {
      const asset = plugin.findAsset(release, "*windows*");
      expect(asset?.name).toBe("pocketbase_0.23.0_windows_amd64.exe.zip");
    });

    test("通配符 darwin 匹配", () => {
      const asset = plugin.findAsset(release, "*darwin*");
      expect(asset?.name).toBe("pocketbase_0.23.0_darwin_amd64.zip");
    });

    test("大小写不敏感匹配", () => {
      const asset = plugin.findAsset(release, "*LINUX*");
      expect(asset).not.toBeNull();
    });

    test("无匹配时返回 null", () => {
      expect(plugin.findAsset(release, "*freebsd*")).toBeNull();
    });

    test("空资源列表返回 null", () => {
      const emptyRelease = makeRelease([]);
      expect(plugin.findAsset(emptyRelease, "*anything*")).toBeNull();
    });

    test("返回第一个匹配项", () => {
      // 两个 linux 文件，应该返回第一个
      const asset = plugin.findAsset(release, "*linux*");
      expect(asset?.name).toBe("pocketbase_0.23.0_linux_amd64.zip");
    });

    test("纯通配符 * 匹配第一个资源", () => {
      const asset = plugin.findAsset(release, "*");
      expect(asset).not.toBeNull();
      expect(asset?.name).toBe("pocketbase_0.23.0_linux_amd64.zip");
    });
  });

  // ============================
  // fetchLatestRelease
  // ============================
  describe("fetchLatestRelease", () => {
    test("方法存在且返回 Promise", () => {
      const plugin = makePlugin();
      const result = plugin.fetchLatestRelease();
      expect(result).toBeInstanceOf(Promise);
      // 避免 unhandled rejection：消费掉 promise
      result.catch(() => {});
    });

    test("无效 owner/repo 返回 null", async () => {
      const plugin = makePlugin({
        owner: "nonexistent-org-zzz12345xyz",
        repo: "nonexistent-repo-zzz12345xyz",
      });
      const release = await plugin.fetchLatestRelease();
      expect(release).toBeNull();
    });
  });

  // ============================
  // Release / ReleaseAsset 类型结构
  // ============================
  describe("Release 类型结构", () => {
    test("makeRelease 产生合法的 Release 对象", () => {
      const r = makeRelease([{ name: "test.zip", size: 2048, id: 42 }]);
      expect(r.name).toBe("v0.23.0");
      expect(r.tag).toBe("v0.23.0");
      expect(r.assets).toHaveLength(1);
      expect(r.assets[0].name).toBe("test.zip");
      expect(r.assets[0].size).toBe(2048);
      expect(r.assets[0].id).toBe(42);
    });

    test("ReleaseAsset 包含所有必需字段", () => {
      const r = makeRelease([{ name: "bin.zip", downloadUrl: "https://example.com/bin.zip" }]);
      const asset = r.assets[0];
      expect(asset).toHaveProperty("name");
      expect(asset).toHaveProperty("downloadUrl");
      expect(asset).toHaveProperty("id");
      expect(asset).toHaveProperty("size");
    });
  });
});
