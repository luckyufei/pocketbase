/**
 * Analytics 插件 — 用户行为分析
 * 对照 Go 版 plugins/analytics/
 *
 * 功能: 事件采集、日聚合、HLL UV、来源/设备统计
 */

export type AnalyticsMode = "off" | "conditional" | "full";

export interface AnalyticsConfig {
  mode: AnalyticsMode;
  enabled: boolean;
  retention: number; // 天
  flushInterval?: number; // 秒
}

export function defaultConfig(): AnalyticsConfig {
  return {
    mode: "off",
    enabled: false,
    retention: 90,
    flushInterval: 60,
  };
}

export interface EventInput {
  name: string;
  path?: string;
  source?: string;
  browser?: string;
  os?: string;
  visitorId?: string;
  properties?: Record<string, unknown>;
}

export interface DailyStat {
  date: string;
  path: string;
  totalPV: number;
  totalUV: number;
  avgDuration: number;
}

export interface SourceStat {
  date: string;
  source: string;
  visitors: number;
}

export interface DeviceStat {
  date: string;
  browser: string;
  os: string;
  visitors: number;
}

export interface Analytics {
  track(event: EventInput): void;
  isEnabled(): boolean;
  flush(): Promise<void>;
  getStats(startDate: string, endDate: string): Promise<DailyStat[]>;
  getTopPages(date: string, limit?: number): Promise<DailyStat[]>;
  getTopSources(date: string, limit?: number): Promise<SourceStat[]>;
  getDeviceStats(date: string): Promise<DeviceStat[]>;
}

/** Noop 实现 */
export class NoopAnalytics implements Analytics {
  track(_event: EventInput): void {}
  isEnabled(): boolean { return false; }
  async flush(): Promise<void> {}
  async getStats(): Promise<DailyStat[]> { return []; }
  async getTopPages(): Promise<DailyStat[]> { return []; }
  async getTopSources(): Promise<SourceStat[]> { return []; }
  async getDeviceStats(): Promise<DeviceStat[]> { return []; }
}

/** 内存实现 */
export class MemoryAnalytics implements Analytics {
  private events: EventInput[] = [];
  private config: AnalyticsConfig;

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.mode !== "off";
  }

  track(event: EventInput): void {
    if (!this.isEnabled()) return;
    this.events.push(event);
  }

  async flush(): Promise<void> {
    this.events = [];
  }

  async getStats(): Promise<DailyStat[]> { return []; }
  async getTopPages(): Promise<DailyStat[]> { return []; }
  async getTopSources(): Promise<SourceStat[]> { return []; }
  async getDeviceStats(): Promise<DeviceStat[]> { return []; }
}

export function MustRegister(_app: unknown, config: AnalyticsConfig = defaultConfig()): Analytics {
  if (!config.enabled || config.mode === "off") return new NoopAnalytics();
  return new MemoryAnalytics(config);
}
