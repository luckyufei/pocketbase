/**
 * Metrics 插件完整单测
 * 对照 Go 版 plugins/metrics/ 的测试覆盖
 *
 * 覆盖：defaultConfig、applyEnvOverrides、LatencyBuffer（P95/percentile/count/cap）、
 *       MemoryMetricsCollector（采集、历史、定时循环、resetOnCollect）
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  LatencyBuffer,
  MemoryMetricsCollector,
  type MetricsConfig,
  type SystemMetrics,
} from "./register";

// ═════════════════════════════════════════════════════════════════════════════
// defaultConfig
// ═════════════════════════════════════════════════════════════════════════════

describe("defaultConfig", () => {
  test("返回正确默认值", () => {
    const c = defaultConfig();
    expect(c.enabled).toBe(false);
    expect(c.interval).toBe(60);
    expect(c.retentionDays).toBe(7);
    expect(c.latencyBufferSize).toBe(1000);
    expect(c.resetLatencyBufferOnCollect).toBe(false);
    expect(c.httpEnabled).toBe(true);
  });

  test("每次返回新对象（不共享引用）", () => {
    expect(defaultConfig()).not.toBe(defaultConfig());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// applyEnvOverrides
// ═════════════════════════════════════════════════════════════════════════════

describe("applyEnvOverrides", () => {
  const base = defaultConfig();

  test("无环境变量时原样返回配置", () => {
    const c = applyEnvOverrides({ ...base });
    expect(c.interval).toBe(60);
    expect(c.retentionDays).toBe(7);
  });

  test("PB_METRICS_INTERVAL 覆盖采集间隔", () => {
    process.env["PB_METRICS_INTERVAL"] = "30";
    const c = applyEnvOverrides({ ...base });
    expect(c.interval).toBe(30);
    delete process.env["PB_METRICS_INTERVAL"];
  });

  test("PB_METRICS_RETENTION_DAYS 覆盖保留天数", () => {
    process.env["PB_METRICS_RETENTION_DAYS"] = "14";
    const c = applyEnvOverrides({ ...base });
    expect(c.retentionDays).toBe(14);
    delete process.env["PB_METRICS_RETENTION_DAYS"];
  });

  test("PB_METRICS_BUFFER_SIZE 覆盖 buffer 容量", () => {
    process.env["PB_METRICS_BUFFER_SIZE"] = "500";
    const c = applyEnvOverrides({ ...base });
    expect(c.latencyBufferSize).toBe(500);
    delete process.env["PB_METRICS_BUFFER_SIZE"];
  });

  test("PB_METRICS_RESET_LATENCY_BUFFER 覆盖 reset 策略", () => {
    process.env["PB_METRICS_RESET_LATENCY_BUFFER"] = "true";
    const c = applyEnvOverrides({ ...base });
    expect(c.resetLatencyBufferOnCollect).toBe(true);
    delete process.env["PB_METRICS_RESET_LATENCY_BUFFER"];
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MustRegister
// ═════════════════════════════════════════════════════════════════════════════

describe("MustRegister", () => {
  test("返回 MemoryMetricsCollector 实例", () => {
    const c = MustRegister(null, { enabled: true });
    expect(c).toBeInstanceOf(MemoryMetricsCollector);
    expect(c.isEnabled()).toBe(true);
  });

  test("默认配置 enabled=false", () => {
    const c = MustRegister(null);
    expect(c.isEnabled()).toBe(false);
  });

  test("无参数也不抛错", () => {
    expect(() => MustRegister(null)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LatencyBuffer
// ═════════════════════════════════════════════════════════════════════════════

describe("LatencyBuffer", () => {
  test("空时 p95 = 0", () => {
    expect(new LatencyBuffer().p95()).toBe(0);
  });

  test("单个值 p95 = 该值", () => {
    const b = new LatencyBuffer();
    b.push(100);
    expect(b.p95()).toBe(100);
  });

  test("P95 计算（100 个值）", () => {
    const b = new LatencyBuffer(200);
    for (let i = 1; i <= 100; i++) b.push(i);
    const p95 = b.p95();
    // ceil(100 * 0.95) - 1 = 94, sorted[94] = 95
    expect(p95).toBe(95);
  });

  test("P50 中位数", () => {
    const b = new LatencyBuffer(200);
    for (let i = 1; i <= 100; i++) b.push(i);
    // ceil(100 * 0.5) - 1 = 49, sorted[49] = 50
    expect(b.percentile(0.5)).toBe(50);
  });

  test("P99 分位数", () => {
    const b = new LatencyBuffer(200);
    for (let i = 1; i <= 100; i++) b.push(i);
    // ceil(100 * 0.99) - 1 = 98, sorted[98] = 99
    expect(b.percentile(0.99)).toBe(99);
  });

  test("环形缓冲区溢出时 count = capacity", () => {
    const b = new LatencyBuffer(5);
    for (let i = 0; i < 10; i++) b.push(i * 10);
    expect(b.getCount()).toBe(5);
    expect(b.p95()).toBeGreaterThan(0);
  });

  test("reset 后 count=0，p95=0", () => {
    const b = new LatencyBuffer();
    b.push(100);
    b.push(200);
    b.reset();
    expect(b.getCount()).toBe(0);
    expect(b.p95()).toBe(0);
  });

  test("cap 返回容量", () => {
    expect(new LatencyBuffer(42).cap()).toBe(42);
  });

  test("p95 结果精确到两位小数", () => {
    const b = new LatencyBuffer(10);
    b.push(33.333);
    b.push(66.666);
    b.push(99.999);
    // p95 = ceil(3 * 0.95) - 1 = 2, sorted[2] = 99.999 → round to 100
    const p95 = b.p95();
    expect(p95).toBe(100); // Math.round(99.999 * 100) / 100 = 100
  });

  test("高延迟异常值对 P95 的影响", () => {
    const b = new LatencyBuffer(200);
    // 99 个正常请求 + 1 个 10000ms 异常
    for (let i = 0; i < 99; i++) b.push(10);
    b.push(10000);
    // P95: ceil(100 * 0.95) - 1 = 94, sorted[94] = 10（正常区，95th 还是低值）
    expect(b.p95()).toBe(10);
    // P100（最大值）才是 10000；P99: ceil(100 * 0.99) - 1 = 98, sorted[98] = 10（第 99 个值）
    // 异常值在 sorted[99] = 10000，需要超过 P99 才包含
    expect(b.percentile(1.0)).toBe(10000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryMetricsCollector — 基础功能
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryMetricsCollector — 基础", () => {
  let c: MemoryMetricsCollector;

  beforeEach(() => {
    c = new MemoryMetricsCollector({ enabled: true });
  });

  afterEach(() => {
    c.stop();
  });

  test("isEnabled 返回 true/false", () => {
    expect(c.isEnabled()).toBe(true);
    expect(new MemoryMetricsCollector({ enabled: false }).isEnabled()).toBe(false);
  });

  test("recordLatency 增加 count", () => {
    expect(c.latencyCount()).toBe(0);
    c.recordLatency(50);
    c.recordLatency(100);
    expect(c.latencyCount()).toBe(2);
  });

  test("getCurrentSnapshot 包含完整字段", () => {
    const s = c.getCurrentSnapshot();
    expect(s.id).toBeDefined();
    expect(s.timestamp).toBeDefined();
    expect(typeof s.cpuUsagePercent).toBe("number");
    expect(typeof s.memoryAllocMb).toBe("number");
    expect(s.memoryAllocMb).toBeGreaterThanOrEqual(0);
    expect(typeof s.goroutinesCount).toBe("number");
    expect(typeof s.p95LatencyMs).toBe("number");
    expect(typeof s.http5xxCount).toBe("number");
  });

  test("getCurrentSnapshot — 无延迟时 p95 = 0", () => {
    expect(c.getCurrentSnapshot().p95LatencyMs).toBe(0);
  });

  test("getCurrentSnapshot — 记录延迟后 p95 > 0", () => {
    c.recordLatency(100);
    c.recordLatency(200);
    expect(c.getCurrentSnapshot().p95LatencyMs).toBeGreaterThan(0);
  });

  test("record5xx 累加到 snapshot", () => {
    c.record5xx();
    c.record5xx();
    expect(c.getCurrentSnapshot().http5xxCount).toBe(2);
  });

  test("getCurrentSnapshot — 无 5xx 时 count = 0", () => {
    expect(c.getCurrentSnapshot().http5xxCount).toBe(0);
  });

  test("isRunning — 未启动时 false", () => {
    expect(c.isRunning()).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryMetricsCollector — 历史记录
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryMetricsCollector — 历史记录", () => {
  let c: MemoryMetricsCollector;

  beforeEach(() => {
    c = new MemoryMetricsCollector({ enabled: true, interval: 1 });
  });

  afterEach(() => c.stop());

  test("初始 getHistory 返回空", async () => {
    expect(await c.getHistory()).toEqual([]);
  });

  test("初始 getLatest 返回 null", async () => {
    expect(await c.getLatest()).toBeNull();
  });

  test("start 后立即采集一条记录", async () => {
    c.start();
    // 立即采集一次
    const history = await c.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  test("start 后 isRunning = true", () => {
    c.start();
    expect(c.isRunning()).toBe(true);
  });

  test("stop 后 isRunning = false", () => {
    c.start();
    c.stop();
    expect(c.isRunning()).toBe(false);
  });

  test("重复 start 不重复启动", () => {
    c.start();
    c.start(); // 不抛错，也不重复创建
    expect(c.isRunning()).toBe(true);
    c.stop();
  });

  test("getLatest 返回最后一条", async () => {
    c.start();
    const latest = await c.getLatest();
    expect(latest).not.toBeNull();
    expect(latest!.id).toBeDefined();
  });

  test("getHistory hours 过滤", async () => {
    c.start();
    const all = await c.getHistory(24 * 365); // 一年内
    const none = await c.getHistory(-1);      // 负数 → 过去负时间 → 空
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(none.length).toBe(0);
  });

  test("getHistory limit 截断", async () => {
    c.start();
    // 手动多采集几条
    for (let i = 0; i < 5; i++) (c as any)._collectAndStore();
    const limited = await c.getHistory(24, 2);
    expect(limited.length).toBeLessThanOrEqual(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryMetricsCollector — resetLatencyBufferOnCollect
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryMetricsCollector — resetLatencyBufferOnCollect", () => {
  test("false（默认）：采集后延迟数据保留", () => {
    const c = new MemoryMetricsCollector({
      enabled: true,
      resetLatencyBufferOnCollect: false,
    });
    c.recordLatency(100);
    // 触发内部采集
    (c as any)._collectAndStore();
    // buffer 不重置，count 仍为 1
    expect(c.latencyCount()).toBe(1);
    c.stop();
  });

  test("true：采集后延迟 buffer 重置", () => {
    const c = new MemoryMetricsCollector({
      enabled: true,
      resetLatencyBufferOnCollect: true,
    });
    c.recordLatency(100);
    expect(c.latencyCount()).toBe(1);
    (c as any)._collectAndStore();
    expect(c.latencyCount()).toBe(0);
    c.stop();
  });

  test("true：采集后 5xx 计数重置", () => {
    const c = new MemoryMetricsCollector({ enabled: true, resetLatencyBufferOnCollect: true });
    c.record5xx();
    c.record5xx();
    // 采集时 5xx 快照为 2，之后重置
    (c as any)._collectAndStore();
    expect(c.getCurrentSnapshot().http5xxCount).toBe(0);
    c.stop();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryMetricsCollector — 定时采集集成
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryMetricsCollector — 定时采集", () => {
  test("1 秒间隔：2 秒后 history 至少 2 条", async () => {
    const c = new MemoryMetricsCollector({ enabled: true, interval: 1 });
    c.start();
    await Bun.sleep(2100);
    const history = await c.getHistory(1);
    c.stop();
    expect(history.length).toBeGreaterThanOrEqual(2);
  }, 5000); // 5s timeout
});
