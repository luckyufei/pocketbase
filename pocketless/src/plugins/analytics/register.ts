/**
 * Analytics 插件 — 用户行为分析
 * 对照 Go 版 plugins/analytics/
 *
 * 功能: 事件采集、日聚合、HLL UV 近似去重、来源/设备统计
 */

export type AnalyticsMode = "off" | "conditional" | "full";

export interface AnalyticsConfig {
  mode: AnalyticsMode;
  enabled: boolean;
  retention: number; // 天
  flushInterval?: number; // 秒
  bufferSize?: number; // 最大缓冲事件数
}

export function defaultConfig(): AnalyticsConfig {
  return {
    mode: "off",
    enabled: false,
    retention: 90,
    flushInterval: 60,
    bufferSize: 10000,
  };
}

/**
 * 从环境变量读取配置覆盖（对照 Go 版 applyEnvOverrides）
 *
 * 支持的环境变量：
 *   PB_ANALYTICS_MODE          — "off"/"conditional"/"full"
 *   PB_ANALYTICS_ENABLED       — "true"/"false"
 *   PB_ANALYTICS_RETENTION     — 天数（整数）
 *   PB_ANALYTICS_FLUSH_INTERVAL — 秒（整数）
 *   PB_ANALYTICS_BUFFER_SIZE   — 整数
 */
export function applyEnvOverrides(config: AnalyticsConfig): AnalyticsConfig {
  const result = { ...config };

  const mode = process.env.PB_ANALYTICS_MODE;
  if (mode === "off" || mode === "conditional" || mode === "full") {
    result.mode = mode;
  }

  const enabled = process.env.PB_ANALYTICS_ENABLED;
  if (enabled !== undefined) result.enabled = enabled === "true";

  const retention = process.env.PB_ANALYTICS_RETENTION;
  if (retention !== undefined) {
    const n = parseInt(retention, 10);
    if (!isNaN(n) && n > 0) result.retention = n;
  }

  const flushInterval = process.env.PB_ANALYTICS_FLUSH_INTERVAL;
  if (flushInterval !== undefined) {
    const n = parseInt(flushInterval, 10);
    if (!isNaN(n) && n > 0) result.flushInterval = n;
  }

  const bufferSize = process.env.PB_ANALYTICS_BUFFER_SIZE;
  if (bufferSize !== undefined) {
    const n = parseInt(bufferSize, 10);
    if (!isNaN(n) && n > 0) result.bufferSize = n;
  }

  return result;
}

export interface EventInput {
  name: string;
  path?: string;
  source?: string;
  browser?: string;
  os?: string;
  visitorId?: string;
  duration?: number; // 毫秒
  properties?: Record<string, unknown>;
  /** 事件时间，ISO 字符串；不传则用当前时间 */
  timestamp?: string;
}

/** 内部带时间戳的事件条目 */
interface EventEntry extends EventInput {
  _timestamp: string; // ISO 字符串，YYYY-MM-DD
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
  track(event: EventInput | EventInput[]): void;
  isEnabled(): boolean;
  flush(): Promise<void>;
  getStats(startDate?: string, endDate?: string): Promise<DailyStat[]>;
  getTopPages(date?: string, limit?: number): Promise<DailyStat[]>;
  getTopSources(date?: string, limit?: number): Promise<SourceStat[]>;
  getDeviceStats(date?: string): Promise<DeviceStat[]>;
  /** 当前缓冲区事件数 */
  bufferSize(): number;
}

/** 取 ISO 字符串的日期部分 YYYY-MM-DD */
function toDateStr(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().slice(0, 10);
}

/** Noop 实现 */
export class NoopAnalytics implements Analytics {
  track(_event: EventInput | EventInput[]): void {}
  isEnabled(): boolean { return false; }
  async flush(): Promise<void> {}
  async getStats(): Promise<DailyStat[]> { return []; }
  async getTopPages(): Promise<DailyStat[]> { return []; }
  async getTopSources(): Promise<SourceStat[]> { return []; }
  async getDeviceStats(): Promise<DeviceStat[]> { return []; }
  bufferSize(): number { return 0; }
}

/** 内存实现 — 提供真实的内存聚合统计 */
export class MemoryAnalytics implements Analytics {
  private buffer: EventEntry[] = [];
  private config: AnalyticsConfig;
  private readonly maxBuffer: number;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.maxBuffer = config.bufferSize ?? 10000;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.mode !== "off";
  }

  track(event: EventInput | EventInput[]): void {
    if (!this.isEnabled()) return;
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      // 超过 bufferSize 时丢弃最旧的
      if (this.buffer.length >= this.maxBuffer) this.buffer.shift();
      this.buffer.push({ ...e, _timestamp: toDateStr(e.timestamp) });
    }
  }

  async flush(): Promise<void> {
    this.buffer = [];
  }

  bufferSize(): number {
    return this.buffer.length;
  }

  /**
   * 按日期范围聚合 PV/UV/avgDuration（按 path 分组）
   * startDate/endDate 格式 YYYY-MM-DD，含两端
   */
  async getStats(startDate?: string, endDate?: string): Promise<DailyStat[]> {
    const events = this._filterByDateRange(startDate, endDate);

    // 按 "date|path" 分组
    const groups = new Map<string, { pv: number; visitors: Set<string>; durations: number[] }>();

    for (const e of events) {
      const path = e.path ?? "/";
      const key = `${e._timestamp}|${path}`;
      if (!groups.has(key)) {
        groups.set(key, { pv: 0, visitors: new Set(), durations: [] });
      }
      const g = groups.get(key)!;
      g.pv++;
      if (e.visitorId) g.visitors.add(e.visitorId);
      if (typeof e.duration === "number") g.durations.push(e.duration);
    }

    return Array.from(groups.entries()).map(([key, g]) => {
      const [date, path] = key.split("|");
      const avgDuration = g.durations.length
        ? Math.round(g.durations.reduce((a, b) => a + b, 0) / g.durations.length)
        : 0;
      return { date, path, totalPV: g.pv, totalUV: g.visitors.size, avgDuration };
    }).sort((a, b) => a.date.localeCompare(b.date) || b.totalPV - a.totalPV);
  }

  /**
   * 返回指定日期 PV 最多的页面，limit 默认 10
   */
  async getTopPages(date?: string, limit = 10): Promise<DailyStat[]> {
    const targetDate = date ?? toDateStr();
    const all = await this.getStats(targetDate, targetDate);
    return all
      .sort((a, b) => b.totalPV - a.totalPV)
      .slice(0, limit);
  }

  /**
   * 返回指定日期来源统计，limit 默认 10
   */
  async getTopSources(date?: string, limit = 10): Promise<SourceStat[]> {
    const targetDate = date ?? toDateStr();
    const events = this._filterByDateRange(targetDate, targetDate);

    // 按 source 分组，统计 unique visitors
    const groups = new Map<string, Set<string>>();
    for (const e of events) {
      const source = e.source ?? "(direct)";
      if (!groups.has(source)) groups.set(source, new Set());
      if (e.visitorId) groups.get(source)!.add(e.visitorId);
      else groups.get(source)!.add(`_pv_${Math.random()}`); // 无 visitorId 时每次计 1
    }

    return Array.from(groups.entries())
      .map(([source, visitors]) => ({
        date: targetDate,
        source,
        visitors: visitors.size,
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, limit);
  }

  /**
   * 返回指定日期设备（browser + os）统计
   */
  async getDeviceStats(date?: string): Promise<DeviceStat[]> {
    const targetDate = date ?? toDateStr();
    const events = this._filterByDateRange(targetDate, targetDate);

    // 按 "browser|os" 分组
    const groups = new Map<string, Set<string>>();
    for (const e of events) {
      const browser = e.browser ?? "Unknown";
      const os = e.os ?? "Unknown";
      const key = `${browser}|${os}`;
      if (!groups.has(key)) groups.set(key, new Set());
      if (e.visitorId) groups.get(key)!.add(e.visitorId);
      else groups.get(key)!.add(`_anon_${Math.random()}`);
    }

    return Array.from(groups.entries()).map(([key, visitors]) => {
      const [browser, os] = key.split("|");
      return { date: targetDate, browser, os, visitors: visitors.size };
    }).sort((a, b) => b.visitors - a.visitors);
  }

  /** 按日期范围过滤事件 */
  private _filterByDateRange(startDate?: string, endDate?: string): EventEntry[] {
    return this.buffer.filter((e) => {
      if (startDate && e._timestamp < startDate) return false;
      if (endDate && e._timestamp > endDate) return false;
      return true;
    });
  }
}

// ─── DBAnalytics（数据库持久化版）────────────────────────────────────────────

import type { DBAdapter } from "../../core/db_adapter";
import { DateTime } from "../../tools/types/datetime";

/**
 * 数据库持久化版 Analytics。
 * track() 将事件写入 _events 表；getStats() 查询 _events_daily 聚合表。
 * 后台聚合任务定期将 _events 聚合到 _events_daily。
 * 对照 Go 版 analytics_store.go DBAnalytics。
 */
export class DBAnalytics implements Analytics {
  private readonly db: DBAdapter;
  private readonly config: AnalyticsConfig;
  private aggregateTimer: ReturnType<typeof setInterval> | null = null;
  /** 内存缓冲区（批量写入，减少 DB 写次数）*/
  private buffer: EventEntry[] = [];
  private readonly maxBuffer: number;

  constructor(config: AnalyticsConfig, db: DBAdapter) {
    this.config = config;
    this.db = db;
    this.maxBuffer = config.bufferSize ?? 10000;
    // 启动后台聚合任务（每 flushInterval 秒 flush 一次）
    const interval = (config.flushInterval ?? 60) * 1000;
    this.aggregateTimer = setInterval(() => this.flush(), interval);
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.mode !== "off";
  }

  stopAggregate(): void {
    if (this.aggregateTimer) { clearInterval(this.aggregateTimer); this.aggregateTimer = null; }
  }

  track(event: EventInput | EventInput[]): void {
    if (!this.isEnabled()) return;
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      if (this.buffer.length >= this.maxBuffer) this.buffer.shift();
      this.buffer.push({ ...e, _timestamp: toDateStr(e.timestamp) });
    }
  }

  /** 将缓冲区的事件批量写入 _events，然后执行日聚合 */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    const now = DateTime.now().toSQLite();
    for (const e of batch) {
      try {
        this.db.exec(
          `INSERT OR IGNORE INTO _events
            (id, name, path, source, browser, os, visitorId, duration, properties, timestamp, created)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          crypto.randomUUID(),
          e.name,
          e.path ?? "",
          e.source ?? "",
          e.browser ?? "",
          e.os ?? "",
          e.visitorId ?? "",
          e.duration ?? 0,
          JSON.stringify(e.properties ?? {}),
          e._timestamp,
          now,
        );
      } catch { /* 忽略单条写入失败 */ }
    }
    // 聚合本次 batch 中涉及的所有日期到 _events_daily
    const dates = new Set(batch.map((e) => e._timestamp));
    for (const date of dates) {
      this._aggregateToDaily(date);
    }
    // 清理过期数据
    this._pruneOldEvents();
  }

  bufferSize(): number {
    return this.buffer.length;
  }

  async getStats(startDate?: string, endDate?: string): Promise<DailyStat[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (startDate) { conditions.push("date >= ?"); params.push(startDate); }
    if (endDate) { conditions.push("date <= ?"); params.push(endDate); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.query<Record<string, unknown>>(
      `SELECT date, path, totalPV, totalUV, avgDuration
       FROM _events_daily ${where} ORDER BY date ASC, totalPV DESC`,
      ...params,
    );
    return rows.map((r) => ({
      date: r.date as string,
      path: r.path as string,
      totalPV: Number(r.totalPV ?? 0),
      totalUV: Number(r.totalUV ?? 0),
      avgDuration: Number(r.avgDuration ?? 0),
    }));
  }

  async getTopPages(date?: string, limit = 10): Promise<DailyStat[]> {
    const targetDate = date ?? toDateStr();
    const rows = this.db.query<Record<string, unknown>>(
      `SELECT date, path, totalPV, totalUV, avgDuration
       FROM _events_daily WHERE date = ? ORDER BY totalPV DESC LIMIT ?`,
      targetDate, limit,
    );
    return rows.map((r) => ({
      date: r.date as string,
      path: r.path as string,
      totalPV: Number(r.totalPV ?? 0),
      totalUV: Number(r.totalUV ?? 0),
      avgDuration: Number(r.avgDuration ?? 0),
    }));
  }

  async getTopSources(date?: string, limit = 10): Promise<SourceStat[]> {
    const targetDate = date ?? toDateStr();
    const rows = this.db.query<{ source: string; visitors: number }>(
      `SELECT source, COUNT(DISTINCT visitorId) as visitors
       FROM _events WHERE timestamp = ?
       GROUP BY source ORDER BY visitors DESC LIMIT ?`,
      targetDate, limit,
    );
    return rows.map((r) => ({
      date: targetDate,
      source: r.source || "(direct)",
      visitors: Number(r.visitors ?? 0),
    }));
  }

  async getDeviceStats(date?: string): Promise<DeviceStat[]> {
    const targetDate = date ?? toDateStr();
    const rows = this.db.query<{ browser: string; os: string; visitors: number }>(
      `SELECT browser, os, COUNT(DISTINCT visitorId) as visitors
       FROM _events WHERE timestamp = ?
       GROUP BY browser, os ORDER BY visitors DESC`,
      targetDate,
    );
    return rows.map((r) => ({
      date: targetDate,
      browser: r.browser || "Unknown",
      os: r.os || "Unknown",
      visitors: Number(r.visitors ?? 0),
    }));
  }

  // ── 私有方法 ───────────────────────────────────────────────────────────────

  /** 将指定日期的原始事件聚合到 _events_daily */
  private _aggregateToDaily(date: string): void {
    const rows = this.db.query<{
      path: string; pv: number; uv: number; avgDuration: number;
    }>(
      `SELECT path,
              COUNT(*) as pv,
              COUNT(DISTINCT CASE WHEN visitorId != '' THEN visitorId END) as uv,
              AVG(CASE WHEN duration > 0 THEN duration END) as avgDuration
       FROM _events WHERE timestamp = ?
       GROUP BY path`,
      date,
    );
    const nowStr = DateTime.now().toSQLite();
    for (const r of rows) {
      this.db.exec(
        `INSERT OR REPLACE INTO _events_daily (date, path, totalPV, totalUV, avgDuration, updated)
         VALUES (?, ?, ?, ?, ?, ?)`,
        date, r.path,
        Number(r.pv ?? 0),
        Number(r.uv ?? 0),
        Math.round(Number(r.avgDuration ?? 0)),
        nowStr,
      );
    }
  }

  /** 清理超过 retention 天的原始事件 */
  private _pruneOldEvents(): void {
    const cutoff = new Date(Date.now() - this.config.retention * 86400_000);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    this.db.exec(`DELETE FROM _events WHERE timestamp < ?`, cutoffDate);
  }
}

// ─── MustRegister ────────────────────────────────────────────────────────────

export function MustRegister(
  _app: unknown,
  config: AnalyticsConfig = defaultConfig(),
  db?: DBAdapter,
): Analytics {
  const resolved = applyEnvOverrides(config);
  if (!resolved.enabled || resolved.mode === "off") return new NoopAnalytics();
  if (db) return new DBAnalytics(resolved, db);
  return new MemoryAnalytics(resolved);
}
