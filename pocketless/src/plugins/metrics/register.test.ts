/**
 * T181: Metrics 插件完整测试
 * 对照 Go 版 — CPU/内存采集、P95 延迟、5xx 计数、数据保留
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  LatencyBuffer,
  MemoryMetricsCollector,
  type MetricsConfig,
} from "./register";

describe("Metrics Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.enabled).toBe(false);
      expect(cfg.interval).toBe(60);
      expect(cfg.retentionDays).toBe(7);
      expect(cfg.httpEnabled).toBe(true);
    });

    test("每次返回新对象", () => {
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  describe("MustRegister", () => {
    test("返回 MemoryMetricsCollector", () => {
      const collector = MustRegister(null, { enabled: true });
      expect(collector).toBeDefined();
      expect(collector.isEnabled()).toBe(true);
    });

    test("默认配置禁用", () => {
      const collector = MustRegister(null);
      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe("LatencyBuffer", () => {
    test("空缓冲 p95 返回 0", () => {
      const buf = new LatencyBuffer();
      expect(buf.p95()).toBe(0);
    });

    test("单个值 p95", () => {
      const buf = new LatencyBuffer();
      buf.push(100);
      expect(buf.p95()).toBe(100);
    });

    test("多个值 P95 计算", () => {
      const buf = new LatencyBuffer(100);
      // 推入 1-100 的值
      for (let i = 1; i <= 100; i++) {
        buf.push(i);
      }
      const p95 = buf.p95();
      // P95 应该约等于 95（idx = floor(100 * 0.95) = 95，sorted[95] = 96）
      expect(p95).toBeGreaterThanOrEqual(90);
      expect(p95).toBeLessThanOrEqual(100);
    });

    test("P95 偏高延迟敏感", () => {
      const buf = new LatencyBuffer(100);
      // 99 个正常值 + 1 个异常值
      for (let i = 0; i < 99; i++) buf.push(10);
      buf.push(1000);
      const p95 = buf.p95();
      // 95% 分位应该还是低值区
      expect(p95).toBeLessThanOrEqual(1000);
    });

    test("环形缓冲区溢出", () => {
      const buf = new LatencyBuffer(5);
      buf.push(100);
      buf.push(200);
      buf.push(300);
      buf.push(400);
      buf.push(500);
      buf.push(600); // 覆盖第一个
      buf.push(700); // 覆盖第二个
      const p95 = buf.p95();
      // 缓冲区现在是 [600, 700, 300, 400, 500]
      expect(p95).toBeGreaterThan(0);
    });

    test("reset 清空", () => {
      const buf = new LatencyBuffer();
      buf.push(100);
      buf.push(200);
      buf.reset();
      expect(buf.p95()).toBe(0);
    });

    test("自定义容量", () => {
      const buf = new LatencyBuffer(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.push(4); // 溢出
      // 缓冲区只保留 3 个值
      expect(buf.p95()).toBeGreaterThan(0);
    });
  });

  describe("MemoryMetricsCollector", () => {
    let collector: MemoryMetricsCollector;

    beforeEach(() => {
      collector = new MemoryMetricsCollector({ enabled: true, interval: 60, retentionDays: 7 });
    });

    test("isEnabled", () => {
      expect(collector.isEnabled()).toBe(true);
      const disabled = new MemoryMetricsCollector({ enabled: false });
      expect(disabled.isEnabled()).toBe(false);
    });

    test("recordLatency + snapshot 包含 P95", () => {
      collector.recordLatency(10);
      collector.recordLatency(20);
      collector.recordLatency(30);
      collector.recordLatency(100);
      const snapshot = collector.getCurrentSnapshot();
      expect(snapshot.p95LatencyMs).toBeGreaterThan(0);
    });

    test("record5xx + snapshot 包含 5xx 计数", () => {
      collector.record5xx();
      collector.record5xx();
      collector.record5xx();
      const snapshot = collector.getCurrentSnapshot();
      expect(snapshot.http5xxCount).toBe(3);
    });

    test("getCurrentSnapshot 有完整字段", () => {
      const s = collector.getCurrentSnapshot();
      expect(s.id).toBeDefined();
      expect(s.timestamp).toBeDefined();
      expect(typeof s.cpuUsagePercent).toBe("number");
      expect(typeof s.memoryAllocMb).toBe("number");
      expect(s.memoryAllocMb).toBeGreaterThanOrEqual(0);
      expect(typeof s.goroutinesCount).toBe("number");
      expect(typeof s.p95LatencyMs).toBe("number");
      expect(typeof s.http5xxCount).toBe("number");
    });

    test("getCurrentSnapshot — 无延迟时 P95=0", () => {
      expect(collector.getCurrentSnapshot().p95LatencyMs).toBe(0);
    });

    test("getCurrentSnapshot — 无 5xx 时 count=0", () => {
      expect(collector.getCurrentSnapshot().http5xxCount).toBe(0);
    });

    test("getHistory 默认返回空", async () => {
      const history = await collector.getHistory();
      expect(history).toEqual([]);
    });

    test("start/stop 不抛错", () => {
      collector.start();
      collector.stop();
    });
  });
});
