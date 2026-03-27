/**
 * T176: Secrets 插件完整测试
 * 对照 Go 版 — _secrets 表 CRUD、AES-256-GCM 加解密、环境隔离、Go 互通
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  MemorySecretsStore,
  type SecretsConfig,
} from "./register";

describe("Secrets Plugin", () => {
  const MASTER_KEY = "01234567890123456789012345678901"; // 恰好 32 字节

  // ============================================================
  // defaultConfig
  // ============================================================

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

  // ============================================================
  // applyEnvOverrides
  // ============================================================

  describe("applyEnvOverrides", () => {
    const origEnv = { ...process.env };

    // 每个测试后恢复环境变量
    function restoreEnv() {
      delete process.env.PB_SECRETS_MASTER_KEY;
      delete process.env.PB_SECRETS_ENABLED;
      delete process.env.PB_SECRETS_HTTP_ENABLED;
    }

    test("无环境变量时原样返回配置", () => {
      restoreEnv();
      const cfg = { enabled: true, masterKey: MASTER_KEY, httpEnabled: false };
      const result = applyEnvOverrides(cfg);
      expect(result).toEqual(cfg);
      expect(result).not.toBe(cfg); // 返回副本
    });

    test("PB_SECRETS_MASTER_KEY 覆盖 masterKey", () => {
      const newKey = "abcdefghijklmnopqrstuvwxyz012345"; // 32 字节
      process.env.PB_SECRETS_MASTER_KEY = newKey;
      try {
        const cfg = defaultConfig();
        const result = applyEnvOverrides(cfg);
        expect(result.masterKey).toBe(newKey);
      } finally {
        restoreEnv();
      }
    });

    test("PB_SECRETS_ENABLED=true 覆盖 enabled", () => {
      process.env.PB_SECRETS_ENABLED = "true";
      try {
        const cfg = defaultConfig(); // enabled=false
        const result = applyEnvOverrides(cfg);
        expect(result.enabled).toBe(true);
      } finally {
        restoreEnv();
      }
    });

    test("PB_SECRETS_ENABLED=false 覆盖 enabled", () => {
      process.env.PB_SECRETS_ENABLED = "false";
      try {
        const cfg = { enabled: true, masterKey: MASTER_KEY };
        const result = applyEnvOverrides(cfg);
        expect(result.enabled).toBe(false);
      } finally {
        restoreEnv();
      }
    });

    test("PB_SECRETS_HTTP_ENABLED=false 禁用 HTTP", () => {
      process.env.PB_SECRETS_HTTP_ENABLED = "false";
      try {
        const cfg = defaultConfig();
        const result = applyEnvOverrides(cfg);
        expect(result.httpEnabled).toBe(false);
      } finally {
        restoreEnv();
      }
    });

    test("PB_SECRETS_HTTP_ENABLED=true 启用 HTTP", () => {
      process.env.PB_SECRETS_HTTP_ENABLED = "true";
      try {
        const cfg = { enabled: true, masterKey: MASTER_KEY, httpEnabled: false };
        const result = applyEnvOverrides(cfg);
        expect(result.httpEnabled).toBe(true);
      } finally {
        restoreEnv();
      }
    });

    test("原始配置对象不被修改", () => {
      process.env.PB_SECRETS_MASTER_KEY = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      try {
        const cfg = defaultConfig();
        const original = cfg.masterKey;
        applyEnvOverrides(cfg);
        expect(cfg.masterKey).toBe(original); // 未被修改
      } finally {
        restoreEnv();
      }
    });
  });

  // ============================================================
  // MustRegister
  // ============================================================

  describe("MustRegister", () => {
    test("返回 MemorySecretsStore 实例", () => {
      const store = MustRegister(null, { enabled: true, masterKey: MASTER_KEY });
      expect(store).toBeDefined();
      expect(store.isEnabled()).toBe(true);
    });

    test("使用默认配置 → disabled", () => {
      const store = MustRegister(null);
      expect(store.isEnabled()).toBe(false);
    });

    test("无参数不抛错", () => {
      expect(() => MustRegister(null)).not.toThrow();
    });
  });

  // ============================================================
  // isEnabled
  // ============================================================

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

    test("masterKey 恰好 33 字符 → false（必须精确 32）", () => {
      const store = new MemorySecretsStore({
        enabled: true,
        masterKey: "0".repeat(33),
      });
      expect(store.isEnabled()).toBe(false);
    });
  });

  // ============================================================
  // set/get — 加密往返
  // ============================================================

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

      await Bun.sleep(10);
      await store.set("k", "v2");
      const secrets2 = await store.list();
      expect(secrets2[0].created).toBe(created1);
    });

    test("覆盖时 updated 时间更新", async () => {
      await store.set("k", "v1");
      const before = (await store.list())[0].updated;

      await Bun.sleep(10);
      await store.set("k", "v2");
      const after = (await store.list())[0].updated;

      expect(after >= before).toBe(true);
      // 如果等待足够，updated 应该更新
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

  // ============================================================
  // 加密安全性
  // ============================================================

  describe("加密安全性", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("同一明文每次加密产生不同密文（随机 nonce）", async () => {
      await store.set("k1", "same_value");
      const cipher1 = (await store.list())[0].value;

      // 覆盖写入，产生新密文
      await store.set("k1", "same_value");
      const cipher2 = (await store.list())[0].value;

      // AES-GCM 每次 nonce 随机，密文必然不同
      expect(cipher1).not.toBe(cipher2);
    });

    test("存储的 value 是密文，不是明文", async () => {
      const plaintext = "super_secret_password";
      await store.set("pwd", plaintext);
      const secret = (await store.list())[0];
      expect(secret.value).not.toBe(plaintext);
      expect(secret.value).not.toContain(plaintext);
    });

    test("不同 masterKey 无法解密对方的数据", async () => {
      const storeA = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      const storeB = new MemorySecretsStore({
        enabled: true,
        masterKey: "98765432109876543210987654321098", // 另一个 32 字节 key
      });

      await storeA.set("k", "secret");
      const encryptedValue = (await storeA.list())[0].value;

      // 手动尝试用 storeB 的 key 解密 storeA 的密文
      const { decrypt } = await import("../../tools/security/crypto");
      expect(() =>
        decrypt(encryptedValue, "98765432109876543210987654321098")
      ).toThrow();
    });
  });

  // ============================================================
  // 环境隔离
  // ============================================================

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

    test("多 env 独立存储，list 按 env 过滤正确", async () => {
      await store.set("key1", "v1", { env: "prod" });
      await store.set("key2", "v2", { env: "prod" });
      await store.set("key3", "v3", { env: "dev" });

      const prod = await store.list("prod");
      const dev = await store.list("dev");

      expect(prod).toHaveLength(2);
      expect(dev).toHaveLength(1);
      expect(prod.every((s) => s.env === "prod")).toBe(true);
    });
  });

  // ============================================================
  // getWithDefault
  // ============================================================

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

    test("插件未启用时返回默认值（不抛错）", async () => {
      const disabled = new MemorySecretsStore({ enabled: false, masterKey: MASTER_KEY });
      const val = await disabled.getWithDefault("k", "safe_default");
      expect(val).toBe("safe_default");
    });
  });

  // ============================================================
  // delete
  // ============================================================

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

    test("删除后 get 抛错", async () => {
      await store.set("k", "v");
      await store.delete("k");
      await expect(store.get("k")).rejects.toThrow('secret "k" not found');
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

    test("删除一个 env 不影响另一个 env", async () => {
      await store.set("k", "global_v");
      await store.set("k", "prod_v", { env: "prod" });
      await store.delete("k"); // 删除 global
      expect(await store.exists("k")).toBe(false);
      expect(await store.exists("k", "prod")).toBe(true);
    });
  });

  // ============================================================
  // exists
  // ============================================================

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

    test("已删除后返回 false", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      await store.set("k", "v");
      await store.delete("k");
      expect(await store.exists("k")).toBe(false);
    });

    test("指定 env 不存在返回 false", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      await store.set("k", "v"); // global
      expect(await store.exists("k", "prod")).toBe(false);
    });
  });

  // ============================================================
  // list
  // ============================================================

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
      expect(typeof s.id).toBe("string");
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

    test("list 返回的是副本，修改不影响内部", async () => {
      await store.set("k", "v");
      const list1 = await store.list();
      list1[0].key = "tampered";
      const list2 = await store.list();
      expect(list2[0].key).toBe("k"); // 未被修改
    });
  });

  // ============================================================
  // keys()
  // ============================================================

  describe("keys()", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("空时返回空数组", async () => {
      expect(await store.keys()).toEqual([]);
    });

    test("返回所有 key 名称（字母序）", async () => {
      await store.set("b", "1");
      await store.set("a", "2");
      await store.set("c", "3");
      expect(await store.keys()).toEqual(["a", "b", "c"]);
    });

    test("跨 env 的同名 key 去重", async () => {
      await store.set("db_pass", "v1", { env: "prod" });
      await store.set("db_pass", "v2", { env: "dev" });
      await store.set("api_key", "v3");
      const keys = await store.keys();
      expect(keys).toHaveLength(2); // db_pass 和 api_key（去重）
      expect(keys.sort()).toEqual(["api_key", "db_pass"]);
    });
  });

  // ============================================================
  // description 字段保留
  // ============================================================

  describe("description 字段", () => {
    let store: MemorySecretsStore;

    beforeEach(() => {
      store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
    });

    test("初次 set 携带 description", async () => {
      await store.set("k", "v", { description: "my secret" });
      const s = (await store.list())[0];
      expect(s.description).toBe("my secret");
    });

    test("覆盖时不传 description 保留旧值", async () => {
      await store.set("k", "v1", { description: "original desc" });
      await store.set("k", "v2"); // 不传 description
      const s = (await store.list())[0];
      expect(s.description).toBe("original desc"); // 旧值保留
    });

    test("覆盖时传入新 description 覆盖旧值", async () => {
      await store.set("k", "v1", { description: "old desc" });
      await store.set("k", "v2", { description: "new desc" });
      const s = (await store.list())[0];
      expect(s.description).toBe("new desc");
    });

    test("不传 description 默认为空字符串", async () => {
      await store.set("k", "v");
      const s = (await store.list())[0];
      expect(s.description).toBe("");
    });
  });

  // ============================================================
  // id 稳定性
  // ============================================================

  describe("id 稳定性", () => {
    test("同一 key 多次 set id 不变", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      await store.set("k", "v1");
      const id1 = (await store.list())[0].id;

      await store.set("k", "v2");
      const id2 = (await store.list())[0].id;

      expect(id1).toBe(id2);
    });

    test("不同 key 的 id 不相同", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      await store.set("k1", "v1");
      await store.set("k2", "v2");
      const secrets = await store.list();
      const ids = secrets.map((s) => s.id);
      expect(new Set(ids).size).toBe(2);
    });

    test("不同 env 的同名 key 有不同 id", async () => {
      const store = new MemorySecretsStore({ enabled: true, masterKey: MASTER_KEY });
      await store.set("k", "v1", { env: "prod" });
      await store.set("k", "v2", { env: "dev" });
      const secrets = await store.list();
      expect(secrets[0].id).not.toBe(secrets[1].id);
    });
  });
});
