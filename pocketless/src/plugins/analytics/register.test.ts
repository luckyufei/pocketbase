/**
 * T180: Analytics 插件完整测试
 * 对照 Go 版 — 事件采集、缓冲、聚合统计（PV/UV/来源/设备）、flush、环境变量覆盖
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  NoopAnalytics,
  MemoryAnalytics,
  type AnalyticsConfig,
} from "./register";

// 固定测试日期，避免依赖真实当天日期
const TODAY = "2024-06-15";
const YESTERDAY = "2024-06-14";

/** 构造一个带固定日期的 MemoryAnalytics */
function makeStore(overrides: Partial<AnalyticsConfig> = {}): MemoryAnalytics {
  return new MemoryAnalytics({
    mode: "full",
    enabled: true,
    retention: 90,
    ...overrides,
  });
}

describe("Analytics Plugin", () => {

  // ============================================================
  // defaultConfig
  // ============================================================

  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.mode).toBe("off");
      expect(cfg.enabled).toBe(false);
      expect(cfg.retention).toBe(90);
      expect(cfg.flushInterval).toBe(60);
      expect(cfg.bufferSize).toBe(10000);
    });

    test("每次返回新对象", () => {
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  // ============================================================
  // applyEnvOverrides
  // ============================================================

  describe("applyEnvOverrides", () => {
    function clean() {
      delete process.env.PB_ANALYTICS_MODE;
      delete process.env.PB_ANALYTICS_ENABLED;
      delete process.env.PB_ANALYTICS_RETENTION;
      delete process.env.PB_ANALYTICS_FLUSH_INTERVAL;
      delete process.env.PB_ANALYTICS_BUFFER_SIZE;
    }

    test("无环境变量时原样返回配置", () => {
      clean();
      const cfg = defaultConfig();
      const result = applyEnvOverrides(cfg);
      expect(result).toEqual(cfg);
      expect(result).not.toBe(cfg); // 返回副本
    });

    test("PB_ANALYTICS_MODE 覆盖 mode", () => {
      process.env.PB_ANALYTICS_MODE = "full";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.mode).toBe("full");
      } finally { clean(); }
    });

    test("PB_ANALYTICS_MODE=conditional 有效", () => {
      process.env.PB_ANALYTICS_MODE = "conditional";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.mode).toBe("conditional");
      } finally { clean(); }
    });

    test("PB_ANALYTICS_MODE 无效值不覆盖", () => {
      process.env.PB_ANALYTICS_MODE = "invalid";
      try {
        const cfg = { ...defaultConfig(), mode: "full" as const };
        const result = applyEnvOverrides(cfg);
        expect(result.mode).toBe("full"); // 保持原值
      } finally { clean(); }
    });

    test("PB_ANALYTICS_ENABLED=true 覆盖 enabled", () => {
      process.env.PB_ANALYTICS_ENABLED = "true";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.enabled).toBe(true);
      } finally { clean(); }
    });

    test("PB_ANALYTICS_ENABLED=false 覆盖 enabled", () => {
      process.env.PB_ANALYTICS_ENABLED = "false";
      try {
        const result = applyEnvOverrides({ ...defaultConfig(), enabled: true });
        expect(result.enabled).toBe(false);
      } finally { clean(); }
    });

    test("PB_ANALYTICS_RETENTION 覆盖保留天数", () => {
      process.env.PB_ANALYTICS_RETENTION = "30";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.retention).toBe(30);
      } finally { clean(); }
    });

    test("PB_ANALYTICS_FLUSH_INTERVAL 覆盖刷新间隔", () => {
      process.env.PB_ANALYTICS_FLUSH_INTERVAL = "120";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.flushInterval).toBe(120);
      } finally { clean(); }
    });

    test("PB_ANALYTICS_BUFFER_SIZE 覆盖缓冲大小", () => {
      process.env.PB_ANALYTICS_BUFFER_SIZE = "500";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.bufferSize).toBe(500);
      } finally { clean(); }
    });

    test("原始配置对象不被修改", () => {
      process.env.PB_ANALYTICS_MODE = "full";
      try {
        const cfg = defaultConfig();
        applyEnvOverrides(cfg);
        expect(cfg.mode).toBe("off"); // 未被修改
      } finally { clean(); }
    });
  });

  // ============================================================
  // MustRegister 条件分支
  // ============================================================

  describe("MustRegister 条件分支", () => {
    test("mode=off → NoopAnalytics", () => {
      const a = MustRegister(null, { mode: "off", enabled: false, retention: 90 });
      expect(a).toBeInstanceOf(NoopAnalytics);
      expect(a.isEnabled()).toBe(false);
    });

    test("enabled=false → NoopAnalytics", () => {
      const a = MustRegister(null, { mode: "full", enabled: false, retention: 90 });
      expect(a).toBeInstanceOf(NoopAnalytics);
    });

    test("mode=full + enabled=true → MemoryAnalytics", () => {
      const a = MustRegister(null, { mode: "full", enabled: true, retention: 90 });
      expect(a).toBeInstanceOf(MemoryAnalytics);
      expect(a.isEnabled()).toBe(true);
    });

    test("mode=conditional + enabled=true → MemoryAnalytics", () => {
      const a = MustRegister(null, { mode: "conditional", enabled: true, retention: 90 });
      expect(a).toBeInstanceOf(MemoryAnalytics);
    });

    test("默认配置 → NoopAnalytics", () => {
      expect(MustRegister(null)).toBeInstanceOf(NoopAnalytics);
    });
  });

  // ============================================================
  // NoopAnalytics
  // ============================================================

  describe("NoopAnalytics", () => {
    let noop: NoopAnalytics;
    beforeEach(() => { noop = new NoopAnalytics(); });

    test("isEnabled 返回 false", () => { expect(noop.isEnabled()).toBe(false); });
    test("track 不抛错", () => { noop.track({ name: "pageview", path: "/" }); });
    test("flush 不抛错", async () => { await noop.flush(); });
    test("bufferSize 返回 0", () => { expect(noop.bufferSize()).toBe(0); });
    test("getStats 返回空数组", async () => {
      expect(await noop.getStats("2024-01-01", "2024-01-31")).toEqual([]);
    });
    test("getTopPages 返回空数组", async () => {
      expect(await noop.getTopPages("2024-01-01")).toEqual([]);
    });
    test("getTopSources 返回空数组", async () => {
      expect(await noop.getTopSources("2024-01-01")).toEqual([]);
    });
    test("getDeviceStats 返回空数组", async () => {
      expect(await noop.getDeviceStats("2024-01-01")).toEqual([]);
    });
  });

  // ============================================================
  // MemoryAnalytics — 基础
  // ============================================================

  describe("MemoryAnalytics — 基础", () => {
    let a: MemoryAnalytics;
    beforeEach(() => { a = makeStore(); });

    test("isEnabled — enabled + mode!=off → true", () => {
      expect(a.isEnabled()).toBe(true);
    });

    test("isEnabled — mode=off → false", () => {
      expect(new MemoryAnalytics({ mode: "off", enabled: true, retention: 90 }).isEnabled()).toBe(false);
    });

    test("isEnabled — enabled=false → false", () => {
      expect(new MemoryAnalytics({ mode: "full", enabled: false, retention: 90 }).isEnabled()).toBe(false);
    });

    test("track 增加 bufferSize", () => {
      a.track({ name: "pageview" });
      a.track({ name: "click" });
      expect(a.bufferSize()).toBe(2);
    });

    test("track 未启用时静默丢弃", () => {
      const disabled = new MemoryAnalytics({ mode: "off", enabled: true, retention: 90 });
      disabled.track({ name: "pageview" });
      expect(disabled.bufferSize()).toBe(0);
    });

    test("flush 清空缓冲", async () => {
      a.track({ name: "pageview" });
      a.track({ name: "click" });
      expect(a.bufferSize()).toBe(2);
      await a.flush();
      expect(a.bufferSize()).toBe(0);
    });

    test("flush 后可继续 track", async () => {
      a.track({ name: "e1" });
      await a.flush();
      a.track({ name: "e2" });
      expect(a.bufferSize()).toBe(1);
    });
  });

  // ============================================================
  // MemoryAnalytics — bufferSize 上限
  // ============================================================

  describe("MemoryAnalytics — bufferSize 上限", () => {
    test("超过 bufferSize 时丢弃最旧事件", () => {
      const a = makeStore({ bufferSize: 3 });
      a.track({ name: "e1" });
      a.track({ name: "e2" });
      a.track({ name: "e3" });
      a.track({ name: "e4" }); // 超过 3，e1 被丢弃
      expect(a.bufferSize()).toBe(3);
    });
  });

  // ============================================================
  // MemoryAnalytics — getStats PV/UV/avgDuration
  // ============================================================

  describe("MemoryAnalytics — getStats", () => {
    let a: MemoryAnalytics;
    beforeEach(() => { a = makeStore(); });

    test("空缓冲返回空数组", async () => {
      expect(await a.getStats(TODAY, TODAY)).toEqual([]);
    });

    test("PV 统计正确", async () => {
      a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T11:00:00Z` });
      a.track({ name: "pv", path: "/about", timestamp: `${TODAY}T12:00:00Z` });

      const stats = await a.getStats(TODAY, TODAY);
      const home = stats.find((s) => s.path === "/home");
      const about = stats.find((s) => s.path === "/about");

      expect(home?.totalPV).toBe(2);
      expect(about?.totalPV).toBe(1);
    });

    test("UV 按 visitorId 去重", async () => {
      a.track({ name: "pv", path: "/home", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", path: "/home", visitorId: "v1", timestamp: `${TODAY}T11:00:00Z` }); // 同一访客
      a.track({ name: "pv", path: "/home", visitorId: "v2", timestamp: `${TODAY}T12:00:00Z` });

      const stats = await a.getStats(TODAY, TODAY);
      const home = stats.find((s) => s.path === "/home");
      expect(home?.totalUV).toBe(2); // v1 + v2
    });

    test("无 visitorId 时 UV=0", async () => {
      a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T10:00:00Z` });
      const stats = await a.getStats(TODAY, TODAY);
      expect(stats[0].totalUV).toBe(0);
    });

    test("avgDuration 计算正确", async () => {
      a.track({ name: "pv", path: "/home", duration: 1000, timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", path: "/home", duration: 3000, timestamp: `${TODAY}T11:00:00Z` });
      const stats = await a.getStats(TODAY, TODAY);
      expect(stats[0].avgDuration).toBe(2000); // (1000+3000)/2
    });

    test("无 duration 时 avgDuration=0", async () => {
      a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T10:00:00Z` });
      const stats = await a.getStats(TODAY, TODAY);
      expect(stats[0].avgDuration).toBe(0);
    });

    test("日期范围过滤 — 不在范围内的事件不计入", async () => {
      a.track({ name: "pv", path: "/a", timestamp: `${YESTERDAY}T10:00:00Z` });
      a.track({ name: "pv", path: "/b", timestamp: `${TODAY}T10:00:00Z` });

      const statsToday = await a.getStats(TODAY, TODAY);
      expect(statsToday).toHaveLength(1);
      expect(statsToday[0].path).toBe("/b");

      const statsYesterday = await a.getStats(YESTERDAY, YESTERDAY);
      expect(statsYesterday).toHaveLength(1);
      expect(statsYesterday[0].path).toBe("/a");
    });

    test("日期范围两端都包含", async () => {
      a.track({ name: "pv", path: "/a", timestamp: `${YESTERDAY}T10:00:00Z` });
      a.track({ name: "pv", path: "/b", timestamp: `${TODAY}T10:00:00Z` });

      const stats = await a.getStats(YESTERDAY, TODAY);
      expect(stats).toHaveLength(2);
    });

    test("跨天的多路径统计", async () => {
      a.track({ name: "pv", path: "/x", timestamp: `${YESTERDAY}T10:00:00Z` });
      a.track({ name: "pv", path: "/x", timestamp: `${TODAY}T10:00:00Z` });

      const stats = await a.getStats(YESTERDAY, TODAY);
      // 同路径不同日期视为不同行
      expect(stats).toHaveLength(2);
      expect(stats.every((s) => s.path === "/x")).toBe(true);
    });

    test("path 缺省为 /", async () => {
      a.track({ name: "pv", timestamp: `${TODAY}T10:00:00Z` }); // 无 path
      const stats = await a.getStats(TODAY, TODAY);
      expect(stats[0].path).toBe("/");
    });

    test("DailyStat 对象字段完整", async () => {
      a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T10:00:00Z` });
      const stats = await a.getStats(TODAY, TODAY);
      const s = stats[0];
      expect(typeof s.date).toBe("string");
      expect(typeof s.path).toBe("string");
      expect(typeof s.totalPV).toBe("number");
      expect(typeof s.totalUV).toBe("number");
      expect(typeof s.avgDuration).toBe("number");
    });
  });

  // ============================================================
  // MemoryAnalytics — getTopPages
  // ============================================================

  describe("MemoryAnalytics — getTopPages", () => {
    let a: MemoryAnalytics;
    beforeEach(() => { a = makeStore(); });

    test("按 PV 降序排列", async () => {
      // /about 3 次，/home 2 次，/blog 1 次
      for (let i = 0; i < 3; i++)
        a.track({ name: "pv", path: "/about", timestamp: `${TODAY}T${10 + i}:00:00Z` });
      for (let i = 0; i < 2; i++)
        a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T1${i}:00:00Z` });
      a.track({ name: "pv", path: "/blog", timestamp: `${TODAY}T20:00:00Z` });

      const top = await a.getTopPages(TODAY);
      expect(top[0].path).toBe("/about");
      expect(top[0].totalPV).toBe(3);
      expect(top[1].path).toBe("/home");
    });

    test("limit 参数生效", async () => {
      for (let i = 0; i < 5; i++)
        a.track({ name: "pv", path: `/p${i}`, timestamp: `${TODAY}T10:00:00Z` });

      const top2 = await a.getTopPages(TODAY, 2);
      expect(top2).toHaveLength(2);
    });

    test("默认 limit=10", async () => {
      for (let i = 0; i < 15; i++)
        a.track({ name: "pv", path: `/p${i}`, timestamp: `${TODAY}T10:00:00Z` });

      const top = await a.getTopPages(TODAY);
      expect(top.length).toBeLessThanOrEqual(10);
    });

    test("无数据时返回空数组", async () => {
      expect(await a.getTopPages(TODAY)).toEqual([]);
    });
  });

  // ============================================================
  // MemoryAnalytics — getTopSources
  // ============================================================

  describe("MemoryAnalytics — getTopSources", () => {
    let a: MemoryAnalytics;
    beforeEach(() => { a = makeStore(); });

    test("按 visitors 降序排列", async () => {
      // google 2 人，twitter 1 人
      a.track({ name: "pv", source: "google", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", source: "google", visitorId: "v2", timestamp: `${TODAY}T11:00:00Z` });
      a.track({ name: "pv", source: "twitter", visitorId: "v3", timestamp: `${TODAY}T12:00:00Z` });

      const top = await a.getTopSources(TODAY);
      expect(top[0].source).toBe("google");
      expect(top[0].visitors).toBe(2);
      expect(top[1].source).toBe("twitter");
    });

    test("同一 visitorId 同来源只计一次", async () => {
      a.track({ name: "pv", source: "google", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", source: "google", visitorId: "v1", timestamp: `${TODAY}T11:00:00Z` }); // 重复

      const top = await a.getTopSources(TODAY);
      expect(top[0].visitors).toBe(1);
    });

    test("无 source 时归类为 (direct)", async () => {
      a.track({ name: "pv", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      const top = await a.getTopSources(TODAY);
      expect(top[0].source).toBe("(direct)");
    });

    test("limit 参数生效", async () => {
      for (let i = 0; i < 5; i++) {
        a.track({ name: "pv", source: `src${i}`, visitorId: `v${i}`, timestamp: `${TODAY}T10:00:00Z` });
      }
      const top2 = await a.getTopSources(TODAY, 2);
      expect(top2).toHaveLength(2);
    });

    test("SourceStat 字段完整", async () => {
      a.track({ name: "pv", source: "google", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      const stats = await a.getTopSources(TODAY);
      expect(typeof stats[0].date).toBe("string");
      expect(typeof stats[0].source).toBe("string");
      expect(typeof stats[0].visitors).toBe("number");
    });

    test("无数据返回空数组", async () => {
      expect(await a.getTopSources(TODAY)).toEqual([]);
    });
  });

  // ============================================================
  // MemoryAnalytics — getDeviceStats
  // ============================================================

  describe("MemoryAnalytics — getDeviceStats", () => {
    let a: MemoryAnalytics;
    beforeEach(() => { a = makeStore(); });

    test("按 browser+os 分组统计", async () => {
      a.track({ name: "pv", browser: "Chrome", os: "macOS", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", browser: "Chrome", os: "macOS", visitorId: "v2", timestamp: `${TODAY}T11:00:00Z` });
      a.track({ name: "pv", browser: "Safari", os: "iOS", visitorId: "v3", timestamp: `${TODAY}T12:00:00Z` });

      const stats = await a.getDeviceStats(TODAY);
      const chrome = stats.find((s) => s.browser === "Chrome");
      const safari = stats.find((s) => s.browser === "Safari");
      expect(chrome?.visitors).toBe(2);
      expect(safari?.visitors).toBe(1);
    });

    test("同 visitorId 同设备只计一次", async () => {
      a.track({ name: "pv", browser: "Chrome", os: "Win", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", browser: "Chrome", os: "Win", visitorId: "v1", timestamp: `${TODAY}T11:00:00Z` });

      const stats = await a.getDeviceStats(TODAY);
      expect(stats[0].visitors).toBe(1);
    });

    test("无 browser/os 时归类为 Unknown", async () => {
      a.track({ name: "pv", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      const stats = await a.getDeviceStats(TODAY);
      expect(stats[0].browser).toBe("Unknown");
      expect(stats[0].os).toBe("Unknown");
    });

    test("DeviceStat 字段完整", async () => {
      a.track({ name: "pv", browser: "Firefox", os: "Linux", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      const stats = await a.getDeviceStats(TODAY);
      const s = stats[0];
      expect(typeof s.date).toBe("string");
      expect(typeof s.browser).toBe("string");
      expect(typeof s.os).toBe("string");
      expect(typeof s.visitors).toBe("number");
    });

    test("无数据返回空数组", async () => {
      expect(await a.getDeviceStats(TODAY)).toEqual([]);
    });

    test("按 visitors 降序排列", async () => {
      a.track({ name: "pv", browser: "Safari", os: "iOS", visitorId: "v1", timestamp: `${TODAY}T10:00:00Z` });
      a.track({ name: "pv", browser: "Chrome", os: "Win", visitorId: "v2", timestamp: `${TODAY}T11:00:00Z` });
      a.track({ name: "pv", browser: "Chrome", os: "Win", visitorId: "v3", timestamp: `${TODAY}T12:00:00Z` });

      const stats = await a.getDeviceStats(TODAY);
      expect(stats[0].browser).toBe("Chrome"); // 2 visitors
    });
  });

  // ============================================================
  // MemoryAnalytics — flush 后 getStats 清空
  // ============================================================

  describe("MemoryAnalytics — flush 后统计清空", () => {
    test("flush 后 getStats 返回空", async () => {
      const a = makeStore();
      a.track({ name: "pv", path: "/home", timestamp: `${TODAY}T10:00:00Z` });
      await a.flush();
      const stats = await a.getStats(TODAY, TODAY);
      expect(stats).toEqual([]);
    });

    test("flush 后 getTopSources 返回空", async () => {
      const a = makeStore();
      a.track({ name: "pv", source: "google", timestamp: `${TODAY}T10:00:00Z` });
      await a.flush();
      expect(await a.getTopSources(TODAY)).toEqual([]);
    });

    test("flush 后 getDeviceStats 返回空", async () => {
      const a = makeStore();
      a.track({ name: "pv", browser: "Chrome", timestamp: `${TODAY}T10:00:00Z` });
      await a.flush();
      expect(await a.getDeviceStats(TODAY)).toEqual([]);
    });
  });
});
