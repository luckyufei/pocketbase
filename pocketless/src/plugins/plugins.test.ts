/**
 * plugins.test.ts — T107-T116 所有 10 个插件的测试
 * 验证: MustRegister、Config、核心接口、关键行为
 */
import { describe, test, expect } from "bun:test";

import {
  MustRegister as RegisterSecrets,
  MemorySecretsStore,
  defaultConfig as secretsDefConfig,
} from "./secrets/register";

import {
  MustRegister as RegisterJobs,
  MemoryJobsStore,
  defaultConfig as jobsDefConfig,
} from "./jobs/register";

import {
  MustRegister as RegisterGateway,
  MemoryGatewayManager,
  defaultConfig as gatewayDefConfig,
} from "./gateway/register";

import {
  MustRegister as RegisterKV,
  MemoryKVStore,
  defaultConfig as kvDefConfig,
} from "./kv/register";

import {
  MustRegister as RegisterAnalytics,
  NoopAnalytics,
  MemoryAnalytics,
  defaultConfig as analyticsDefConfig,
} from "./analytics/register";

import {
  MustRegister as RegisterMetrics,
  MemoryMetricsCollector,
  LatencyBuffer,
  defaultConfig as metricsDefConfig,
} from "./metrics/register";

import {
  MustRegister as RegisterTrace,
  NoopTracer,
  MemoryTracer,
  defaultConfig as traceDefConfig,
} from "./trace/register";

import {
  MustRegister as RegisterProcessMan,
  MemoryProcessManager,
  defaultConfig as processmanDefConfig,
} from "./processman/register";

import {
  MustRegister as RegisterMigrateCmd,
  defaultConfig as migratecmdDefConfig,
} from "./migratecmd/register";

import {
  MustRegister as RegisterGHUpdate,
  defaultConfig as ghupdateDefConfig,
} from "./ghupdate/register";

// ============================================================
// T107: Secrets 插件
// ============================================================

describe("Secrets 插件", () => {
  const masterKey = "abcdabcdabcdabcdabcdabcdabcdabcd";

  test("MustRegister 返回 store 实例", () => {
    const store = RegisterSecrets(null, { enabled: true, masterKey });
    expect(store).toBeDefined();
    expect(store.isEnabled()).toBe(true);
  });

  test("默认配置", () => {
    const cfg = secretsDefConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.masterKey).toBe("");
  });

  test("未启用时 isEnabled 返回 false", () => {
    const store = new MemorySecretsStore({ enabled: false, masterKey: "" });
    expect(store.isEnabled()).toBe(false);
  });

  test("set/get 加密往返", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    await store.set("api_key", "sk-12345");
    const val = await store.get("api_key");
    expect(val).toBe("sk-12345");
  });

  test("get 不存在抛错", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    await expect(store.get("nonexistent")).rejects.toThrow();
  });

  test("getWithDefault 不存在返回默认值", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    const val = await store.getWithDefault("missing", "default");
    expect(val).toBe("default");
  });

  test("环境隔离", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    await store.set("db_pass", "prod123", { env: "production" });
    await store.set("db_pass", "dev456", { env: "development" });

    expect(await store.get("db_pass", "production")).toBe("prod123");
    expect(await store.get("db_pass", "development")).toBe("dev456");
  });

  test("环境 fallback 到 global", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    await store.set("global_key", "global_val");
    expect(await store.get("global_key", "staging")).toBe("global_val");
  });

  test("delete 和 exists", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    await store.set("temp", "val");
    expect(await store.exists("temp")).toBe(true);
    await store.delete("temp");
    expect(await store.exists("temp")).toBe(false);
  });

  test("list", async () => {
    const store = new MemorySecretsStore({ enabled: true, masterKey });
    await store.set("a", "1");
    await store.set("b", "2");
    const list = await store.list();
    expect(list.length).toBe(2);
  });
});

// ============================================================
// T108: Jobs 插件
// ============================================================

describe("Jobs 插件", () => {
  test("MustRegister 返回 store", () => {
    const store = RegisterJobs(null, { ...jobsDefConfig(), enabled: true });
    expect(store).toBeDefined();
  });

  test("默认配置", () => {
    const cfg = jobsDefConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.pollInterval).toBe(5);
    expect(cfg.defaultMaxRetries).toBe(3);
  });

  test("enqueue/get", async () => {
    const store = new MemoryJobsStore({ ...jobsDefConfig(), enabled: true });
    const id = await store.enqueue("email:send", { to: "test@test.com" });
    const job = await store.get(id);
    expect(job).not.toBeNull();
    expect(job!.topic).toBe("email:send");
    expect(job!.status).toBe("pending");
  });

  test("list 过滤", async () => {
    const store = new MemoryJobsStore({ ...jobsDefConfig(), enabled: true });
    await store.enqueue("a");
    await store.enqueue("b");
    await store.enqueue("a");

    const all = await store.list();
    expect(all.length).toBe(3);

    const filtered = await store.list({ topic: "a" });
    expect(filtered.length).toBe(2);
  });

  test("stats", async () => {
    const store = new MemoryJobsStore({ ...jobsDefConfig(), enabled: true });
    await store.enqueue("test");
    const stats = await store.stats();
    expect(stats.pending).toBe(1);
    expect(stats.completed).toBe(0);
  });

  test("delete 仅限 pending/failed", async () => {
    const store = new MemoryJobsStore({ ...jobsDefConfig(), enabled: true });
    const id = await store.enqueue("test");
    await store.delete(id);
    expect(await store.get(id)).toBeNull();
  });

  test("topic 白名单", async () => {
    const store = new MemoryJobsStore({
      ...jobsDefConfig(),
      enabled: true,
      allowedTopics: ["allowed"],
    });
    await expect(store.enqueue("blocked")).rejects.toThrow("不在白名单");
    const id = await store.enqueue("allowed");
    expect(id).toBeDefined();
  });

  test("register handler", () => {
    const store = new MemoryJobsStore({ ...jobsDefConfig(), enabled: true });
    store.register("test", async () => {});
    // 不报错即可
  });
});

// ============================================================
// T109: Gateway 插件
// ============================================================

describe("Gateway 插件", () => {
  test("MustRegister", () => {
    const manager = RegisterGateway(null);
    expect(manager).toBeDefined();
    expect(manager.isEnabled()).toBe(true);
  });

  test("默认配置", () => {
    const cfg = gatewayDefConfig();
    expect(cfg.disabled).toBe(false);
    expect(cfg.enableMetrics).toBe(false);
  });

  test("addRoute/getRoutes", () => {
    const manager = new MemoryGatewayManager(gatewayDefConfig());
    manager.addRoute({
      id: "r1",
      path: "/proxy",
      upstream: "http://backend:3000",
      stripPath: true,
      accessRule: "",
      headers: {},
      timeout: 30,
      active: true,
      maxConcurrent: 100,
      circuitBreaker: { enabled: false, threshold: 5, timeout: 30 },
    });

    expect(manager.getRoutes().length).toBe(1);
    expect(manager.getRoutes()[0].upstream).toBe("http://backend:3000");
  });

  test("inactive 路由不在 getRoutes 中", () => {
    const manager = new MemoryGatewayManager(gatewayDefConfig());
    manager.addRoute({
      id: "r1", path: "/a", upstream: "http://a", stripPath: false,
      accessRule: "", headers: {}, timeout: 30, active: false,
      maxConcurrent: 0, circuitBreaker: { enabled: false, threshold: 0, timeout: 0 },
    });
    expect(manager.getRoutes().length).toBe(0);
  });

  test("removeRoute", () => {
    const manager = new MemoryGatewayManager(gatewayDefConfig());
    manager.addRoute({
      id: "r1", path: "/a", upstream: "http://a", stripPath: false,
      accessRule: "", headers: {}, timeout: 30, active: true,
      maxConcurrent: 0, circuitBreaker: { enabled: false, threshold: 0, timeout: 0 },
    });
    manager.removeRoute("r1");
    expect(manager.getRoutes().length).toBe(0);
  });

  test("disabled 时 isEnabled 返回 false", () => {
    const manager = new MemoryGatewayManager({ ...gatewayDefConfig(), disabled: true });
    expect(manager.isEnabled()).toBe(false);
  });
});

// ============================================================
// T110: KV 插件
// ============================================================

describe("KV 插件", () => {
  test("MustRegister", () => {
    const store = RegisterKV(null, { ...kvDefConfig(), enabled: true });
    expect(store).toBeDefined();
    expect(store.isEnabled()).toBe(true);
  });

  test("get/set 基础操作", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    await store.set("key1", "value1");
    expect(await store.get("key1")).toBe("value1");
  });

  test("delete/exists", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    await store.set("k", "v");
    expect(await store.exists("k")).toBe(true);
    await store.delete("k");
    expect(await store.exists("k")).toBe(false);
  });

  test("TTL 过期", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    // TTL 0.01 秒（10ms）
    await store.set("temp", "val", 0.01);
    expect(await store.get("temp")).toBe("val");
    await Bun.sleep(20);
    expect(await store.get("temp")).toBeNull();
  });

  test("incr/decr", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    expect(await store.incr("counter")).toBe(1);
    expect(await store.incr("counter")).toBe(2);
    expect(await store.decr("counter")).toBe(1);
    expect(await store.incrBy("counter", 10)).toBe(11);
  });

  test("hset/hget/hgetAll/hdel", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    await store.hset("user:1", "name", "Alice");
    await store.hset("user:1", "age", 30);
    expect(await store.hget("user:1", "name")).toBe("Alice");
    expect(await store.hget("user:1", "age")).toBe(30);

    const all = await store.hgetAll("user:1");
    expect(all.name).toBe("Alice");

    await store.hdel("user:1", "age");
    expect(await store.hget("user:1", "age")).toBeNull();
  });

  test("hincrBy", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    expect(await store.hincrBy("obj", "count", 5)).toBe(5);
    expect(await store.hincrBy("obj", "count", 3)).toBe(8);
  });

  test("lock/unlock", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    expect(await store.lock("resource", 10)).toBe(true);
    expect(await store.lock("resource", 10)).toBe(false); // 已锁
    await store.unlock("resource");
    expect(await store.lock("resource", 10)).toBe(true); // 解锁后可重锁
  });

  test("mset/mget", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    await store.mset({ a: 1, b: 2, c: 3 });
    const vals = await store.mget(["a", "b", "c", "d"]);
    expect(vals).toEqual([1, 2, 3, null]);
  });

  test("keys 通配符", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    await store.set("user:1", "a");
    await store.set("user:2", "b");
    await store.set("post:1", "c");

    const userKeys = await store.keys("user:*");
    expect(userKeys.sort()).toEqual(["user:1", "user:2"]);

    const allKeys = await store.keys("*");
    expect(allKeys.length).toBe(3);
  });

  test("ttl 返回值", async () => {
    const store = new MemoryKVStore({ ...kvDefConfig(), enabled: true });
    expect(await store.ttl("nonexistent")).toBe(-2);
    await store.set("permanent", "val");
    expect(await store.ttl("permanent")).toBe(-1);
    await store.set("temp", "val", 60);
    expect(await store.ttl("temp")).toBeGreaterThan(0);
  });
});

// ============================================================
// T111: Analytics 插件
// ============================================================

describe("Analytics 插件", () => {
  test("off 模式返回 NoopAnalytics", () => {
    const a = RegisterAnalytics(null, { ...analyticsDefConfig(), mode: "off", enabled: false });
    expect(a).toBeInstanceOf(NoopAnalytics);
    expect(a.isEnabled()).toBe(false);
  });

  test("full 模式返回 MemoryAnalytics", () => {
    const a = RegisterAnalytics(null, { ...analyticsDefConfig(), mode: "full", enabled: true });
    expect(a).toBeInstanceOf(MemoryAnalytics);
    expect(a.isEnabled()).toBe(true);
  });

  test("track 事件", () => {
    const a = new MemoryAnalytics({ mode: "full", enabled: true, retention: 30 });
    a.track({ name: "pageview", path: "/home" });
    // 不报错即可
  });

  test("未启用时 track 为空操作", () => {
    const a = new MemoryAnalytics({ mode: "off", enabled: false, retention: 30 });
    a.track({ name: "pageview" });
    // 不报错
  });

  test("默认配置", () => {
    const cfg = analyticsDefConfig();
    expect(cfg.mode).toBe("off");
    expect(cfg.retention).toBe(90);
  });
});

// ============================================================
// T112: Metrics 插件
// ============================================================

describe("Metrics 插件", () => {
  test("MustRegister", () => {
    const c = RegisterMetrics(null, { ...metricsDefConfig(), enabled: true });
    expect(c).toBeDefined();
    expect(c.isEnabled()).toBe(true);
  });

  test("recordLatency + getCurrentSnapshot", () => {
    const c = new MemoryMetricsCollector({ ...metricsDefConfig(), enabled: true });
    c.recordLatency(100);
    c.recordLatency(200);
    c.recordLatency(300);
    const snap = c.getCurrentSnapshot();
    expect(snap.p95LatencyMs).toBeGreaterThanOrEqual(200);
    expect(snap.memoryAllocMb).toBeGreaterThan(0);
  });

  test("record5xx", () => {
    const c = new MemoryMetricsCollector({ ...metricsDefConfig(), enabled: true });
    c.record5xx();
    c.record5xx();
    const snap = c.getCurrentSnapshot();
    expect(snap.http5xxCount).toBe(2);
  });

  test("LatencyBuffer P95 计算", () => {
    const buf = new LatencyBuffer(100);
    for (let i = 1; i <= 100; i++) buf.push(i);
    expect(buf.p95()).toBe(96);
  });

  test("LatencyBuffer 空时返回 0", () => {
    const buf = new LatencyBuffer();
    expect(buf.p95()).toBe(0);
  });

  test("默认配置", () => {
    const cfg = metricsDefConfig();
    expect(cfg.interval).toBe(60);
    expect(cfg.retentionDays).toBe(7);
  });
});

// ============================================================
// T113: Trace 插件
// ============================================================

describe("Trace 插件", () => {
  test("off 模式返回 NoopTracer", () => {
    const t = RegisterTrace(null, { ...traceDefConfig(), mode: "off" });
    expect(t).toBeInstanceOf(NoopTracer);
    expect(t.isEnabled()).toBe(false);
  });

  test("conditional 模式返回 MemoryTracer", () => {
    const t = RegisterTrace(null, { ...traceDefConfig(), mode: "conditional" });
    expect(t).toBeInstanceOf(MemoryTracer);
    expect(t.isEnabled()).toBe(true);
  });

  test("startSpan + end", () => {
    const t = new MemoryTracer({ ...traceDefConfig(), mode: "full" });
    const span = t.startSpan("test-op");
    span.setAttribute("http.method", "GET");
    span.setStatus("ok");
    span.setKind("server");
    span.end();
    // 不报错即可
  });

  test("NoopTracer startSpan 零开销", () => {
    const t = new NoopTracer();
    const span = t.startSpan("noop");
    span.setAttribute("k", "v");
    span.setStatus("ok");
    span.end();
    // 全部为空操作
  });

  test("染色用户 CRUD", () => {
    const t = new MemoryTracer({ ...traceDefConfig(), mode: "full" });
    t.dyeUser("user1", 3600, "debug");
    expect(t.isDyed("user1")).toBe(true);
    expect(t.listDyedUsers().length).toBe(1);

    t.undyeUser("user1");
    expect(t.isDyed("user1")).toBe(false);
    expect(t.listDyedUsers().length).toBe(0);
  });

  test("染色用户过期", async () => {
    const t = new MemoryTracer({ ...traceDefConfig(), mode: "full" });
    t.dyeUser("user2", 0.01); // 10ms TTL
    expect(t.isDyed("user2")).toBe(true);
    await Bun.sleep(20);
    expect(t.isDyed("user2")).toBe(false);
  });

  test("染色用户最大数限制", () => {
    const t = new MemoryTracer({ ...traceDefConfig(), mode: "full", dyeMaxUsers: 2 });
    t.dyeUser("a", 3600);
    t.dyeUser("b", 3600);
    t.dyeUser("c", 3600); // 应被拒绝
    expect(t.listDyedUsers().length).toBe(2);
    expect(t.isDyed("c")).toBe(false);
  });
});

// ============================================================
// T114: ProcessMan 插件
// ============================================================

describe("ProcessMan 插件", () => {
  test("MustRegister", () => {
    const pm = RegisterProcessMan(null);
    expect(pm).toBeDefined();
  });

  test("addProcessConfig + list", () => {
    const pm = new MemoryProcessManager(processmanDefConfig());
    pm.addProcessConfig({ id: "web", command: "node", args: ["server.js"] });
    expect(pm.list().length).toBe(1);
    expect(pm.list()[0].status).toBe("stopped");
  });

  test("start/stop/restart", async () => {
    const pm = new MemoryProcessManager(processmanDefConfig());
    pm.addProcessConfig({ id: "worker" });

    await pm.start("worker");
    expect(pm.isRunning("worker")).toBe(true);
    expect(pm.list()[0].pid).not.toBeNull();

    await pm.stop("worker");
    expect(pm.isRunning("worker")).toBe(false);

    await pm.restart("worker");
    expect(pm.isRunning("worker")).toBe(true);
    expect(pm.list()[0].restartCount).toBe(1);
  });

  test("start 不存在的进程抛错", async () => {
    const pm = new MemoryProcessManager(processmanDefConfig());
    await expect(pm.start("nonexistent")).rejects.toThrow("not found");
  });

  test("重复 start 抛错", async () => {
    const pm = new MemoryProcessManager(processmanDefConfig());
    pm.addProcessConfig({ id: "dup" });
    await pm.start("dup");
    await expect(pm.start("dup")).rejects.toThrow("already running");
  });
});

// ============================================================
// T115: MigrateCmd 插件
// ============================================================

describe("MigrateCmd 插件", () => {
  test("MustRegister", () => {
    const plugin = RegisterMigrateCmd(null, null);
    expect(plugin).toBeDefined();
  });

  test("默认配置", () => {
    const cfg = migratecmdDefConfig();
    expect(cfg.dir).toBe("pb_migrations");
    expect(cfg.automigrate).toBe(true);
    expect(cfg.templateLang).toBe("ts");
  });

  test("getConfig 返回副本", () => {
    const plugin = RegisterMigrateCmd(null, null, {
      dir: "custom_dir",
      automigrate: false,
      templateLang: "js",
    });
    const cfg = plugin.getConfig();
    expect(cfg.dir).toBe("custom_dir");
    expect(cfg.automigrate).toBe(false);
    expect(cfg.templateLang).toBe("js");
  });

  test("isAutoMigrateEnabled", () => {
    const p1 = RegisterMigrateCmd(null, null, { ...migratecmdDefConfig(), automigrate: true });
    expect(p1.isAutoMigrateEnabled()).toBe(true);

    const p2 = RegisterMigrateCmd(null, null, { ...migratecmdDefConfig(), automigrate: false });
    expect(p2.isAutoMigrateEnabled()).toBe(false);
  });
});

// ============================================================
// T116: GHUpdate 插件
// ============================================================

describe("GHUpdate 插件", () => {
  test("MustRegister", () => {
    const plugin = RegisterGHUpdate(null, null);
    expect(plugin).toBeDefined();
  });

  test("默认配置", () => {
    const cfg = ghupdateDefConfig();
    expect(cfg.owner).toBe("pocketbase");
    expect(cfg.repo).toBe("pocketbase");
  });

  test("compareVersions", () => {
    const plugin = RegisterGHUpdate(null, null);
    expect(plugin.compareVersions("v0.22.0", "v0.23.0")).toBe(-1);
    expect(plugin.compareVersions("v0.23.0", "v0.23.0")).toBe(0);
    expect(plugin.compareVersions("v0.24.0", "v0.23.0")).toBe(1);
    expect(plugin.compareVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(plugin.compareVersions("2.0.0", "1.99.99")).toBe(1);
  });

  test("getConfig 返回副本", () => {
    const plugin = RegisterGHUpdate(null, null, {
      owner: "test",
      repo: "testrepo",
    });
    const cfg = plugin.getConfig();
    expect(cfg.owner).toBe("test");
    expect(cfg.repo).toBe("testrepo");
  });
});
