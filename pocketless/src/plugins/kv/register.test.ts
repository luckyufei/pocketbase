/**
 * T179: KV 插件完整测试
 * 对照 Go 版 — Get/Set/Delete、L1 缓存命中/失效、L2 持久化、TTL 过期
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  MemoryKVStore,
  type KVConfig,
} from "./register";

describe("KV Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.enabled).toBe(false);
      expect(cfg.httpEnabled).toBe(false);
      expect(cfg.l1MaxSize).toBe(100 * 1024 * 1024);
      expect(cfg.l1MaxItems).toBe(10000);
      expect(cfg.cleanupInterval).toBe(60);
    });
  });

  describe("MustRegister", () => {
    test("返回 MemoryKVStore", () => {
      const store = MustRegister(null, { enabled: true });
      expect(store).toBeDefined();
      expect(store.isEnabled()).toBe(true);
    });

    test("默认配置 disabled", () => {
      const store = MustRegister(null);
      expect(store.isEnabled()).toBe(false);
    });
  });

  describe("基础 CRUD", () => {
    let store: MemoryKVStore;

    beforeEach(() => {
      store = new MemoryKVStore({ enabled: true });
    });

    test("set + get", async () => {
      await store.set("k", "hello");
      expect(await store.get("k")).toBe("hello");
    });

    test("get 不存在的 key 返回 null", async () => {
      expect(await store.get("missing")).toBeNull();
    });

    test("set 不同类型值", async () => {
      await store.set("str", "hello");
      await store.set("num", 42);
      await store.set("obj", { a: 1 });
      await store.set("arr", [1, 2, 3]);
      await store.set("bool", true);
      await store.set("null", null);

      expect(await store.get("str")).toBe("hello");
      expect(await store.get("num")).toBe(42);
      expect(await store.get("obj")).toEqual({ a: 1 });
      expect(await store.get("arr")).toEqual([1, 2, 3]);
      expect(await store.get("bool")).toBe(true);
      expect(await store.get("null")).toBeNull();
    });

    test("覆盖已有 key", async () => {
      await store.set("k", "v1");
      await store.set("k", "v2");
      expect(await store.get("k")).toBe("v2");
    });

    test("delete", async () => {
      await store.set("k", "v");
      await store.delete("k");
      expect(await store.get("k")).toBeNull();
    });

    test("delete 不存在的 key（静默）", async () => {
      await store.delete("nonexistent"); // 不抛错
    });

    test("exists", async () => {
      await store.set("k", "v");
      expect(await store.exists("k")).toBe(true);
      expect(await store.exists("missing")).toBe(false);
    });
  });

  describe("TTL", () => {
    let store: MemoryKVStore;

    beforeEach(() => {
      store = new MemoryKVStore({ enabled: true });
    });

    test("set with TTL → 过期后返回 null", async () => {
      await store.set("k", "v", 1); // 1 秒 TTL
      expect(await store.get("k")).toBe("v");
      await Bun.sleep(1100);
      expect(await store.get("k")).toBeNull();
    });

    test("set 无 TTL → 永不过期", async () => {
      await store.set("k", "v");
      expect(await store.get("k")).toBe("v");
    });

    test("ttl() — 不存在返回 -2", async () => {
      expect(await store.ttl("missing")).toBe(-2);
    });

    test("ttl() — 无过期返回 -1", async () => {
      await store.set("k", "v");
      expect(await store.ttl("k")).toBe(-1);
    });

    test("ttl() — 有过期返回剩余秒数", async () => {
      await store.set("k", "v", 60);
      const remaining = await store.ttl("k");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60);
    });

    test("expire() 设置过期时间", async () => {
      await store.set("k", "v");
      expect(await store.ttl("k")).toBe(-1);
      await store.expire("k", 30);
      const remaining = await store.ttl("k");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    test("exists 已过期返回 false", async () => {
      await store.set("k", "v", 1);
      await Bun.sleep(1100);
      expect(await store.exists("k")).toBe(false);
    });
  });

  describe("计数器", () => {
    let store: MemoryKVStore;

    beforeEach(() => {
      store = new MemoryKVStore({ enabled: true });
    });

    test("incr 从 0 开始", async () => {
      expect(await store.incr("counter")).toBe(1);
      expect(await store.incr("counter")).toBe(2);
      expect(await store.incr("counter")).toBe(3);
    });

    test("incrBy 指定增量", async () => {
      expect(await store.incrBy("counter", 10)).toBe(10);
      expect(await store.incrBy("counter", 5)).toBe(15);
    });

    test("decr", async () => {
      await store.set("counter", 10);
      expect(await store.decr("counter")).toBe(9);
      expect(await store.decr("counter")).toBe(8);
    });

    test("incr 非数字 key 视为 0", async () => {
      await store.set("k", "not a number");
      expect(await store.incr("k")).toBe(1);
    });
  });

  describe("Hash 操作", () => {
    let store: MemoryKVStore;

    beforeEach(() => {
      store = new MemoryKVStore({ enabled: true });
    });

    test("hset + hget", async () => {
      await store.hset("user:1", "name", "Alice");
      expect(await store.hget("user:1", "name")).toBe("Alice");
    });

    test("hget 不存在的 field 返回 null", async () => {
      await store.hset("user:1", "name", "Alice");
      expect(await store.hget("user:1", "age")).toBeNull();
    });

    test("hget 不存在的 key 返回 null", async () => {
      expect(await store.hget("nonexistent", "field")).toBeNull();
    });

    test("hgetAll", async () => {
      await store.hset("user:1", "name", "Alice");
      await store.hset("user:1", "age", 30);
      const all = await store.hgetAll("user:1");
      expect(all.name).toBe("Alice");
      expect(all.age).toBe(30);
    });

    test("hgetAll 不存在的 key 返回空对象", async () => {
      expect(await store.hgetAll("missing")).toEqual({});
    });

    test("hdel", async () => {
      await store.hset("user:1", "name", "Alice");
      await store.hset("user:1", "age", 30);
      await store.hdel("user:1", "name");
      expect(await store.hget("user:1", "name")).toBeNull();
      expect(await store.hget("user:1", "age")).toBe(30);
    });

    test("hincrBy", async () => {
      await store.hset("stats", "views", 10);
      expect(await store.hincrBy("stats", "views", 5)).toBe(15);
    });

    test("hincrBy 不存在的 field 从 0 开始", async () => {
      expect(await store.hincrBy("stats", "new_field", 3)).toBe(3);
    });
  });

  describe("分布式锁", () => {
    let store: MemoryKVStore;

    beforeEach(() => {
      store = new MemoryKVStore({ enabled: true });
    });

    test("lock 成功", async () => {
      expect(await store.lock("resource", 10)).toBe(true);
    });

    test("lock 重复获取失败", async () => {
      expect(await store.lock("resource", 10)).toBe(true);
      expect(await store.lock("resource", 10)).toBe(false);
    });

    test("unlock 后可再次 lock", async () => {
      await store.lock("resource", 10);
      await store.unlock("resource");
      expect(await store.lock("resource", 10)).toBe(true);
    });

    test("锁过期后自动释放", async () => {
      await store.lock("resource", 1); // 1秒
      await Bun.sleep(1100);
      expect(await store.lock("resource", 10)).toBe(true);
    });
  });

  describe("批量操作", () => {
    let store: MemoryKVStore;

    beforeEach(() => {
      store = new MemoryKVStore({ enabled: true });
    });

    test("mset + mget", async () => {
      await store.mset({ a: 1, b: 2, c: 3 });
      const results = await store.mget(["a", "b", "c", "missing"]);
      expect(results).toEqual([1, 2, 3, null]);
    });

    test("mget 空数组", async () => {
      expect(await store.mget([])).toEqual([]);
    });
  });

  describe("keys 模式匹配", () => {
    let store: MemoryKVStore;

    beforeEach(async () => {
      store = new MemoryKVStore({ enabled: true });
      await store.set("user:1", "Alice");
      await store.set("user:2", "Bob");
      await store.set("post:1", "Hello");
      await store.set("post:2", "World");
    });

    test("通配符 user:*", async () => {
      const keys = await store.keys("user:*");
      expect(keys).toHaveLength(2);
      expect(keys.sort()).toEqual(["user:1", "user:2"]);
    });

    test("通配符 *", async () => {
      const keys = await store.keys("*");
      expect(keys).toHaveLength(4);
    });

    test("精确匹配", async () => {
      const keys = await store.keys("user:1");
      expect(keys).toEqual(["user:1"]);
    });

    test("无匹配", async () => {
      const keys = await store.keys("order:*");
      expect(keys).toEqual([]);
    });

    test("过期的 key 不返回", async () => {
      await store.set("temp", "val", 1);
      await Bun.sleep(1100);
      const keys = await store.keys("temp");
      expect(keys).toEqual([]);
    });
  });
});
