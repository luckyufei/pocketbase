/**
 * T176: Secrets 插件完整测试
 * 对照 Go 版 — _secrets 表 CRUD、AES-256-GCM 加解密、环境隔离、Go 互通
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  MemorySecretsStore,
  type SecretsConfig,
} from "./register";

describe("Secrets Plugin", () => {
  const MASTER_KEY = "01234567890123456789012345678901"; // 32 chars

  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.enabled).toBe(false);
      expect(cfg.masterKey).toBe("");
      expect(cfg.httpEnabled).toBe(true);
    });

    test("每次返回新对象", () => {
      const a = defaultConfig();
      const b = defaultConfig();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe("MustRegister", () => {
    test("返回 MemorySecretsStore 实例", () => {
      const store = MustRegister(null, { enabled: true, masterKey: MASTER_KEY });
      expect(store).toBeDefined();
      expect(store.isEnabled()).toBe(true);
    });

    test("使用默认配置", () => {
      const store = MustRegister(null);
      expect(store.isEnabled()).toBe(false);
    });
  });

  describe("isEnabled", () => {
    test("enabled=true + 32字符 masterKey → true", () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      expect(store.isEnabled()).toBe(true);
    });

    test("enabled=false → false", () => {
      const store = new MemorySecretsStore({ enabled: false, masterKey: MASTER_KEY });
      expect(store.isEnabled()).toBe(false);
    });

    test("masterKey 不足 32 字符 → false", () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: "short" });
      expect(store.isEnabled()).toBe(false);
    });

    test("masterKey 为空 → false", () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: "" });
      expect(store.isEnabled()).toBe(false);
    });
  });

  describe("set/get（加密往返）", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("set + get 返回原始明文", async () => {
      await store.set("api_key", "sk-test-12345");
      const val = await store.get("api_key");
      expect(val).toBe("sk-test-12345");
    });

    test("set 空字符串", async () => {
      await store.set("empty", "");
      const val = await store.get("empty");
      expect(val).toBe("");
    });

    test("set 长字符串（1KB）", async () => {
      const longStr = "x".repeat(1024);
      await store.set("long", longStr);
      expect(await store.get("long")).toBe(longStr);
    });

    test("set 含特殊字符", async () => {
      const special = '{"key":"val","arr":[1,2,3],"中文":"测试"}';
      await store.set("special", special);
      expect(await store.get("special")).toBe(special);
    });

    test("覆盖已有 key", async () => {
      await store.set("k", "v1");
      await store.set("k", "v2");
      expect(await store.get("k")).toBe("v2");
    });

    test("覆盖保留原 created 时间", async () => {
      await store.set("k", "v1");
      const secrets1 = await store.list();
      const created1 = secrets1[0].created;

      // 稍微等待确保时间差
      await Bun.sleep(10);
      await store.set("k", "v2");
      const secrets2 = await store.list();
      expect(secrets2[0].created).toBe(created1);
    });

    test("get 不存在的 key 抛错", async () => {
      await expect(store.get("nonexistent")).rejects.toThrow('secret "nonexistent" not found');
    });

    test("未启用时 set 抛错", async () => {
      const disabled = new MemorySecretsStore({ enabled: false, masterKey: MASTER_KEY });
      await expect(disabled.set("k", "v")).rejects.toThrow("Secrets 插件未启用");
    });

    test("未启用时 get 抛错", async () => {
      const disabled = new MemorySecretsStore({ enabled: false, masterKey: MASTER_KEY });
      await expect(disabled.get("k")).rejects.toThrow("Secrets 插件未启用");
    });
  });

  describe("环境隔离", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("默认 env 为 global", async () => {
      await store.set("k", "global_val");
      expect(await store.get("k")).toBe("global_val");
      expect(await store.get("k", "global")).toBe("global_val");
    });

    test("不同 env 互不干扰", async () => {
      await store.set("db_pass", "prod_pass", { env: "production" });
      await store.set("db_pass", "dev_pass", { env: "development" });
      expect(await store.get("db_pass", "production")).toBe("prod_pass");
      expect(await store.get("db_pass", "development")).toBe("dev_pass");
    });

    test("指定 env 不存在时 fallback 到 global", async () => {
      await store.set("api_key", "global_key");
      expect(await store.get("api_key", "staging")).toBe("global_key");
    });

    test("global 不存在且指定 env 不存在时抛错", async () => {
      await expect(store.get("missing", "staging")).rejects.toThrow('secret "missing" not found');
    });

    test("env=global 查询不 fallback", async () => {
      await store.set("k", "prod_val", { env: "production" });
      await expect(store.get("k", "global")).rejects.toThrow('secret "k" not found');
    });
  });

  describe("getWithDefault", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("存在时返回实际值", async () => {
      await store.set("k", "real_val");
      expect(await store.getWithDefault("k", "default")).toBe("real_val");
    });

    test("不存在时返回默认值", async () => {
      expect(await store.getWithDefault("missing", "fallback")).toBe("fallback");
    });
  });

  describe("delete", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("删除已有 key", async () => {
      await store.set("k", "v");
      expect(await store.exists("k")).toBe(true);
      await store.delete("k");
      expect(await store.exists("k")).toBe(false);
    });

    test("删除不存在的 key（静默）", async () => {
      await store.delete("nonexistent"); // 不抛错
    });

    test("删除指定 env 的 key", async () => {
      await store.set("k", "v1", { env: "prod" });
      await store.set("k", "v2", { env: "dev" });
      await store.delete("k", "prod");
      expect(await store.exists("k", "prod")).toBe(false);
      expect(await store.exists("k", "dev")).toBe(true);
    });
  });

  describe("exists", () => {
    test("存在返回 true", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      await store.set("k", "v");
      expect(await store.exists("k")).toBe(true);
    });

    test("不存在返回 false", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      expect(await store.exists("missing")).toBe(false);
    });
  });

  describe("list", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("空列表", async () => {
      expect(await store.list()).toEqual([]);
    });

    test("列出所有 secrets", async () => {
      await store.set("a", "1");
      await store.set("b", "2");
      const secrets = await store.list();
      expect(secrets).toHaveLength(2);
    });

    test("按 env 过滤", async () => {
      await store.set("a", "1", { env: "prod" });
      await store.set("b", "2", { env: "dev" });
      await store.set("c", "3", { env: "prod" });
      const prodSecrets = await store.list("prod");
      expect(prodSecrets).toHaveLength(2);
      expect(prodSecrets.every((s) => s.env === "prod")).toBe(true);
    });

    test("Secret 对象有完整字段", async () => {
      await store.set("k", "v", { description: "test desc" });
      const secrets = await store.list();
      const s = secrets[0];
      expect(s.id).toBeDefined();
      expect(s.key).toBe("k");
      expect(s.value).toBeDefined(); // 加密密文
      expect(s.value).not.toBe("v"); // 不是明文
      expect(s.env).toBe("global");
      expect(s.description).toBe("test desc");
      expect(s.created).toBeDefined();
      expect(s.updated).toBeDefined();
    });

    test("无 env 参数时列出全部", async () => {
      await store.set("a", "1", { env: "prod" });
      await store.set("b", "2", { env: "dev" });
      expect(await store.list()).toHaveLength(2);
    });
  });
});
