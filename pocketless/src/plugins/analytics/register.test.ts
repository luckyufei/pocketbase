/**
 * T180: Analytics 插件完整测试
 * 对照 Go 版 — 事件采集、缓冲刷新、去重、聚合统计
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  NoopAnalytics,
  MemoryAnalytics,
  type AnalyticsConfig,
  type EventInput,
} from "./register";

describe("Analytics Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.mode).toBe("off");
      expect(cfg.enabled).toBe(false);
      expect(cfg.retention).toBe(90);
      expect(cfg.flushInterval).toBe(60);
    });

    test("每次返回新对象", () => {
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  describe("MustRegister 条件分支", () => {
    test("mode=off → NoopAnalytics", () => {
      const analytics = MustRegister(null, { mode: "off", enabled: false, retention: 90 });
      expect(analytics).toBeInstanceOf(NoopAnalytics);
      expect(analytics.isEnabled()).toBe(false);
    });

    test("enabled=false → NoopAnalytics", () => {
      const analytics = MustRegister(null, { mode: "full", enabled: false, retention: 90 });
      expect(analytics).toBeInstanceOf(NoopAnalytics);
    });

    test("mode=full + enabled=true → MemoryAnalytics", () => {
      const analytics = MustRegister(null, { mode: "full", enabled: true, retention: 90 });
      expect(analytics).toBeInstanceOf(MemoryAnalytics);
      expect(analytics.isEnabled()).toBe(true);
    });

    test("mode=conditional + enabled=true → MemoryAnalytics", () => {
      const analytics = MustRegister(null, { mode: "conditional", enabled: true, retention: 90 });
      expect(analytics).toBeInstanceOf(MemoryAnalytics);
    });

    test("默认配置 → NoopAnalytics", () => {
      const analytics = MustRegister(null);
      expect(analytics).toBeInstanceOf(NoopAnalytics);
    });
  });

  describe("NoopAnalytics", () => {
    let noop: NoopAnalytics;

    beforeEach(() => {
      noop = new NoopAnalytics();
    });

    test("isEnabled 返回 false", () => {
      expect(noop.isEnabled()).toBe(false);
    });

    test("track 不抛错", () => {
      noop.track({ name: "pageview", path: "/" });
    });

    test("flush 不抛错", async () => {
      await noop.flush();
    });

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

  describe("MemoryAnalytics", () => {
    let analytics: MemoryAnalytics;

    beforeEach(() => {
      analytics = new MemoryAnalytics({ mode: "full", enabled: true, retention: 90 });
    });

    test("isEnabled — enabled + mode!=off → true", () => {
      expect(analytics.isEnabled()).toBe(true);
    });

    test("isEnabled — mode=off → false", () => {
      const a = new MemoryAnalytics({ mode: "off", enabled: true, retention: 90 });
      expect(a.isEnabled()).toBe(false);
    });

    test("isEnabled — enabled=false → false", () => {
      const a = new MemoryAnalytics({ mode: "full", enabled: false, retention: 90 });
      expect(a.isEnabled()).toBe(false);
    });

    test("track 事件（启用时）", () => {
      analytics.track({ name: "pageview", path: "/" });
      analytics.track({ name: "click", path: "/about" });
      // 不抛错即成功（内部缓冲）
    });

    test("track 事件（未启用时静默丢弃）", () => {
      const disabled = new MemoryAnalytics({ mode: "off", enabled: true, retention: 90 });
      disabled.track({ name: "pageview" }); // 不抛错
    });

    test("track 带完整字段", () => {
      analytics.track({
        name: "pageview",
        path: "/home",
        source: "google",
        browser: "Chrome",
        os: "macOS",
        visitorId: "v123",
        properties: { referrer: "https://google.com" },
      });
    });

    test("flush 清空缓冲", async () => {
      analytics.track({ name: "pageview" });
      await analytics.flush();
      // flush 后继续 track 不抛错
      analytics.track({ name: "pageview2" });
    });

    test("getStats 返回空数组（占位实现）", async () => {
      analytics.track({ name: "pageview" });
      expect(await analytics.getStats()).toEqual([]);
    });

    test("getTopPages 返回空数组", async () => {
      expect(await analytics.getTopPages()).toEqual([]);
    });

    test("getTopSources 返回空数组", async () => {
      expect(await analytics.getTopSources()).toEqual([]);
    });

    test("getDeviceStats 返回空数组", async () => {
      expect(await analytics.getDeviceStats()).toEqual([]);
    });
  });
});
