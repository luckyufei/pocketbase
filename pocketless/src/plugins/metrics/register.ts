/**
 * Metrics 插件 — 系统监控
 * 对照 Go 版 plugins/metrics/
 *
 * 功能:
 *  - CPU / 内存 / 延迟 / 5xx 采集
 *  - LatencyBuffer（环形 Ring Buffer，P95 计算，对照 latency_buffer.go）
 *  - 定时采集循环（对照 collector.go collectionLoop）
 *  - 历史记录存储（内存版，对照 repository.go）
 *  - resetLatencyBufferOnCollect 策略
 *  - 环境变量配置覆盖（PB_METRICS_*）
 */

// ─── Config ──────────────────────────────────────────────────────────────────

export interface MetricsConfig {
  enabled: boolean;
  /** 采集间隔（秒），默认 60 */
  interval?: number;
  /** 数据保留天数，默认 7 */
  retentionDays?: number;
  /** 延迟 Ring Buffer 容量，默认 1000 */
  latencyBufferSize?: number;
  /** 每次采集后是否重置延迟 buffer，默认 false */
  resetLatencyBufferOnCollect?: boolean;
  /** 是否注册 HTTP 路由，默认 true */
  httpEnabled?: boolean;
}

export function defaultConfig(): MetricsConfig {
  return {
    enabled: false,
    interval: 60,
    retentionDays: 7,
    latencyBufferSize: 1000,
    resetLatencyBufferOnCollect: false,
    httpEnabled: true,
  };
}

/** 应用环境变量覆盖（对照 config.go applyEnvOverrides） */
export function applyEnvOverrides(config: MetricsConfig): MetricsConfig {
  const c = { ...config };

  const disabled = process.env["PB_METRICS_DISABLED"];
  if (disabled) c.enabled = !(disabled === "true" || disabled === "1");

  const interval = Number(process.env["PB_METRICS_INTERVAL"]);
  if (interval > 0) c.interval = interval;

  const retentionDays = Number(process.env["PB_METRICS_RETENTION_DAYS"]);
  if (retentionDays > 0) c.retentionDays = retentionDays;

  const bufferSize = Number(process.env["PB_METRICS_BUFFER_SIZE"]);
  if (bufferSize > 0) c.latencyBufferSize = bufferSize;

  const middleware = process.env["PB_METRICS_MIDDLEWARE"];
  if (middleware) c.httpEnabled = middleware === "true" || middleware === "1";

  const resetBuf = process.env["PB_METRICS_RESET_LATENCY_BUFFER"];
  if (resetBuf) c.resetLatencyBufferOnCollect = resetBuf === "true" || resetBuf === "1";

  return c;
}

// ─── SystemMetrics ────────────────────────────────────────────────────────────

/** 一次采集的快照。对照 Go 版 model.go SystemMetrics */
export interface SystemMetrics {
  id: string;
  timestamp: string;               // ISO 8601
  cpuUsagePercent: number;         // 0–100（Bun 无系统调用，常为 0）
  memoryAllocMb: number;           // heapUsed MB
  goroutinesCount: number;         // Bun: 不适用，固定 0
  sqliteWalSizeMb: number;         // 不适用，固定 0
  sqliteOpenConns: number;         // 不适用，固定 0
  p95LatencyMs: number;
  http5xxCount: number;
}

// ─── MetricsCollector 接口 ────────────────────────────────────────────────────

export interface MetricsCollector {
  isEnabled(): boolean;
  /** 记录一次请求延迟（ms），由 HTTP 中间件调用 */
  recordLatency(ms: number): void;
  /** 记录一次 5xx 错误，由 HTTP 中间件调用 */
  record5xx(): void;
  /** 获取当前快照（实时采集，不存入 history） */
  getCurrentSnapshot(): SystemMetrics;
  /** 获取历史快照列表（已持久化的） */
  getHistory(hours?: number, limit?: number): Promise<SystemMetrics[]>;
  /** 获取最新一条历史快照 */
  getLatest(): Promise<SystemMetrics | null>;
  /** 启动定时采集循环 */
  start(): void;
  /** 停止定时采集循环 */
  stop(): void;
  /** 是否正在运行 */
  isRunning(): boolean;
  /** 延迟 buffer 当前样本数 */
  latencyCount(): number;
}

// ─── LatencyBuffer ────────────────────────────────────────────────────────────

/**
 * 环形延迟样本缓冲区，用于 P95 等分位数计算。
 * 对照 Go 版 latency_buffer.go LatencyBuffer。
 *
 * 与 Trace 的 RingBuffer 不同：存储 number，且 P95 使用 ceil 方式取索引。
 */
export class LatencyBuffer {
  private data: number[];
  private index = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number = 1000) {
    this.capacity = capacity > 0 ? capacity : 1000;
    this.data = new Array(this.capacity).fill(0);
  }

  push(latencyMs: number): void {
    this.data[this.index] = latencyMs;
    this.index = (this.index + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /**
   * 计算 P95 延迟（ms）。
   * 对照 Go 版：idx = ceil(n * 0.95) - 1，sorted 后取该位置。
   */
  p95(): number {
    if (this.count === 0) return 0;
    const samples = this.data.slice(0, this.count).sort((a, b) => a - b);
    const idx = Math.max(0, Math.ceil(samples.length * 0.95) - 1);
    return Math.round(samples[Math.min(idx, samples.length - 1)] * 100) / 100;
  }

  /** 计算任意分位数（0–1） */
  percentile(p: number): number {
    if (this.count === 0) return 0;
    const samples = this.data.slice(0, this.count).sort((a, b) => a - b);
    const idx = Math.max(0, Math.ceil(samples.length * p) - 1);
    return Math.round(samples[Math.min(idx, samples.length - 1)] * 100) / 100;
  }

  reset(): void {
    this.index = 0;
    this.count = 0;
  }

  /** 当前样本数量 */
  getCount(): number {
    return this.count;
  }

  /** buffer 容量 */
  cap(): number {
    return this.capacity;
  }
}

// ─── MemoryMetricsCollector ──────────────────────────────────────────────────

/**
 * 内存实现的 MetricsCollector。
 * 对照 Go 版 collector.go MetricsCollector + repository.go (内存版)。
 *
 * start() 启动定时采集循环，每隔 interval 秒将当前快照存入内存 history。
 * stop()  停止循环。
 */
export class MemoryMetricsCollector implements MetricsCollector {
  private readonly config: Required<MetricsConfig>;
  private readonly latencyBuf: LatencyBuffer;
  private http5xxCurrent = 0;
  private history: SystemMetrics[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: MetricsConfig) {
    this.config = {
      enabled: config.enabled,
      interval: config.interval ?? 60,
      retentionDays: config.retentionDays ?? 7,
      latencyBufferSize: config.latencyBufferSize ?? 1000,
      resetLatencyBufferOnCollect: config.resetLatencyBufferOnCollect ?? false,
      httpEnabled: config.httpEnabled ?? true,
    };
    this.latencyBuf = new LatencyBuffer(this.config.latencyBufferSize);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  recordLatency(ms: number): void {
    this.latencyBuf.push(ms);
  }

  record5xx(): void {
    this.http5xxCurrent++;
  }

  /**
   * 采集当前快照（实时，不存入 history）。
   * 对照 Go 版 collectMetrics()。
   */
  getCurrentSnapshot(): SystemMetrics {
    const memMb = this._readHeapMb();
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 0,      // Bun 无系统调用支持，留为 0
      memoryAllocMb: memMb,
      goroutinesCount: 0,      // 不适用
      sqliteWalSizeMb: 0,      // 不适用（内存版）
      sqliteOpenConns: 0,      // 不适用（内存版）
      p95LatencyMs: this.latencyBuf.p95(),
      http5xxCount: this.http5xxCurrent,
    };
  }

  async getHistory(hours = 24, limit = 1000): Promise<SystemMetrics[]> {
    const since = Date.now() - hours * 3600_000;
    const filtered = this.history.filter(
      (s) => new Date(s.timestamp).getTime() >= since
    );
    return filtered.slice(-limit);
  }

  async getLatest(): Promise<SystemMetrics | null> {
    if (this.history.length === 0) return null;
    return this.history[this.history.length - 1];
  }

  /**
   * 启动采集循环（对照 Go 版 collectionLoop）。
   * 立即采集一次，然后每 interval 秒采集一次。
   */
  start(): void {
    if (this.timer !== null) return; // 已在运行

    // 立即采集一次
    this._collectAndStore();

    this.timer = setInterval(() => {
      this._collectAndStore();
    }, this.config.interval * 1000);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  latencyCount(): number {
    return this.latencyBuf.getCount();
  }

  // ── 私有方法 ───────────────────────────────────────────────────────────────

  /** 采集并存入 history，对照 Go 版 collectAndStore() */
  private _collectAndStore(): void {
    const snapshot = this.getCurrentSnapshot();

    // 采集后重置 5xx 计数（对照 collectAndReset5xxCount）
    this.http5xxCurrent = 0;

    // 可选：每次采集后重置延迟 buffer
    if (this.config.resetLatencyBufferOnCollect) {
      this.latencyBuf.reset();
    }

    // 存入 history，自动清理超出保留期的记录
    this.history.push(snapshot);
    this._pruneHistory();
  }

  /** 清理超出 retentionDays 的历史记录 */
  private _pruneHistory(): void {
    const cutoff = Date.now() - this.config.retentionDays * 86400_000;
    const idx = this.history.findIndex(
      (s) => new Date(s.timestamp).getTime() >= cutoff
    );
    if (idx > 0) this.history = this.history.slice(idx);
  }

  /** 读取堆内存（MB），Bun 和 Node.js 均支持 process.memoryUsage() */
  private _readHeapMb(): number {
    const used = process.memoryUsage().heapUsed;
    return Math.round(used / 1024 / 1024 * 100) / 100;
  }
}

// ─── DBMetricsCollector（数据库持久化版） ─────────────────────────────────────

import type { DBAdapter } from "../../core/db_adapter";
import { DateTime } from "../../tools/types/datetime";

/**
 * 数据库持久化版 MetricsCollector。
 * 继承 MemoryMetricsCollector，采集后同时写入 _metrics 表。
 * 历史查询从 DB 读取（而非内存数组）。
 */
export class DBMetricsCollector extends MemoryMetricsCollector {
  private readonly db: DBAdapter;
  private dbTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: MetricsConfig, db: DBAdapter) {
    super(config);
    this.db = db;
  }

  /**
   * 覆盖 start()：除了父类内存采集，额外注册 DB 写入钩子。
   * 原理：父类 start() 调用 _collectAndStore()（private），
   * 我们在 start 时覆盖 getCurrentSnapshot 的触发时机，在父类
   * 执行后额外写入一条 snapshot 到 DB。
   */
  override start(): void {
    super.start(); // 启动内存采集循环
    // 同步写入刚刚采集的第一条 snapshot
    this.getLatest().then((s) => { if (s) this.saveSnapshot(s); }).catch(() => {});
    // 注册 DB 写入循环（与内存采集间隔一致）
    const cfg = this as unknown as { config: Required<MetricsConfig> };
    if (this.dbTimer !== null) return;
    this.dbTimer = setInterval(async () => {
      const s = await super.getLatest();
      if (s) this.saveSnapshot(s);
    }, cfg.config.interval * 1000);
  }

  override stop(): void {
    super.stop();
    if (this.dbTimer !== null) {
      clearInterval(this.dbTimer);
      this.dbTimer = null;
    }
  }

  /** 覆盖：getHistory 从数据库查询 */
  override async getHistory(hours = 24, limit = 1000): Promise<SystemMetrics[]> {
    const since = new Date(Date.now() - hours * 3600_000);
    const sinceStr = new DateTime(since).toSQLite();
    const rows = this.db.query<Record<string, unknown>>(
      `SELECT * FROM _metrics WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT ?`,
      sinceStr, limit,
    );
    return rows.map(this._rowToMetrics);
  }

  /** 覆盖：getLatest 从数据库查询最新一条 */
  override async getLatest(): Promise<SystemMetrics | null> {
    const row = this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM _metrics ORDER BY timestamp DESC LIMIT 1`,
    );
    if (!row) return null;
    return this._rowToMetrics(row);
  }

  /**
   * 清理超出 retentionDays 的历史记录。
   * 对照 Go 版 cleanup.go pruneMetrics()。
   * @returns 删除的行数
   */
  pruneOldMetrics(retentionDays?: number): number {
    const cfg = this as unknown as { config: Required<MetricsConfig> };
    const days = retentionDays ?? cfg.config.retentionDays;
    const cutoff = new Date(Date.now() - days * 86400_000);
    const cutoffStr = new DateTime(cutoff).toSQLite();
    const row = this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM _metrics WHERE timestamp < ?`, cutoffStr,
    );
    const count = row?.cnt ?? 0;
    if (count > 0) {
      this.db.exec(`DELETE FROM _metrics WHERE timestamp < ?`, cutoffStr);
    }
    return count;
  }

  /** 内部：将一条快照写入 DB（由父类 _collectAndStore 的扩展调用） */
  saveSnapshot(snapshot: SystemMetrics): void {
    const now = DateTime.now().toSQLite();
    try {
      this.db.exec(
        `INSERT OR IGNORE INTO _metrics
          (id, timestamp, cpuUsagePercent, memoryAllocMb, goroutinesCount,
           sqliteWalSizeMb, sqliteOpenConns, p95LatencyMs, http5xxCount, created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        snapshot.id,
        snapshot.timestamp,
        snapshot.cpuUsagePercent,
        snapshot.memoryAllocMb,
        snapshot.goroutinesCount,
        snapshot.sqliteWalSizeMb,
        snapshot.sqliteOpenConns,
        snapshot.p95LatencyMs,
        snapshot.http5xxCount,
        now,
      );
    } catch {
      // 忽略唯一冲突
    }
  }

  /** DB 行转 SystemMetrics 对象 */
  private _rowToMetrics(row: Record<string, unknown>): SystemMetrics {
    return {
      id: row.id as string,
      timestamp: row.timestamp as string,
      cpuUsagePercent: Number(row.cpuUsagePercent ?? 0),
      memoryAllocMb: Number(row.memoryAllocMb ?? 0),
      goroutinesCount: Number(row.goroutinesCount ?? 0),
      sqliteWalSizeMb: Number(row.sqliteWalSizeMb ?? 0),
      sqliteOpenConns: Number(row.sqliteOpenConns ?? 0),
      p95LatencyMs: Number(row.p95LatencyMs ?? 0),
      http5xxCount: Number(row.http5xxCount ?? 0),
    };
  }
}

// ─── MustRegister ─────────────────────────────────────────────────────────────

/**
 * 创建并返回 MetricsCollector 实例。
 * 对照 Go 版 register.go Register()。
 *
 * - db 注入 → DBMetricsCollector（持久化版）
 * - 无 db   → MemoryMetricsCollector（内存版）
 */
export function MustRegister(
  _app: unknown,
  config: MetricsConfig = defaultConfig(),
  db?: DBAdapter,
): MetricsCollector {
  const merged = applyEnvOverrides(config);
  if (db) return new DBMetricsCollector(merged, db);
  return new MemoryMetricsCollector(merged);
}
