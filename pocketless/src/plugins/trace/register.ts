/**
 * Trace 插件 — 分布式追踪
 * 对照 Go 版 plugins/trace/
 *
 * 功能:
 *  - Span 采集（SpanBuilder 链式 API）
 *  - RingBuffer（固定内存，溢出时丢弃最旧）
 *  - 条件过滤（pre/post 两阶段过滤器链）
 *  - 染色用户（强制追踪指定用户）
 *  - 三种运行模式：off / conditional / full
 */

export type TraceMode = "off" | "conditional" | "full";
export type SpanStatus = "unset" | "ok" | "error";
export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer";
export type FilterPhase = "pre" | "post";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface TraceConfig {
  mode: TraceMode;
  sampleRate?: number;
  bufferSize?: number;
  flushInterval?: number;    // 秒
  batchSize?: number;
  retentionDays?: number;
  filters?: Filter[];
  dyeMaxUsers?: number;
  dyeDefaultTTL?: number;    // 秒
}

export function defaultConfig(): TraceConfig {
  return {
    mode: "off",
    sampleRate: 0.1,
    bufferSize: 10000,
    flushInterval: 1,
    batchSize: 100,
    retentionDays: 7,
    filters: [],
    dyeMaxUsers: 100,
    dyeDefaultTTL: 86400,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** 一次请求/操作的追踪记录。对照 Go 版 types.go Span */
export interface Span {
  id: string;
  traceId: string;
  spanId: string;
  parentId: string;
  name: string;
  kind: SpanKind;
  startTime: number; // UnixMs
  duration: number;  // ms
  status: SpanStatus;
  attributes: Record<string, unknown>;
}

/** 过滤器上下文，分 pre/post 两个阶段 */
export interface FilterContext {
  path: string;
  method: string;
  statusCode?: number;   // post 阶段可用
  durationMs?: number;   // post 阶段可用
  userId?: string;
  error?: Error;
}

/** 过滤器接口，对照 Go 版 filter.go Filter */
export interface Filter {
  name(): string;
  phase(): FilterPhase;
  shouldTrace(ctx: FilterContext): boolean;
}

/** Span 构建器，链式 API */
export interface SpanBuilder {
  setAttribute(key: string, value: unknown): SpanBuilder;
  setStatus(status: SpanStatus): SpanBuilder;
  setKind(kind: SpanKind): SpanBuilder;
  end(): void;
}

/** 染色用户记录 */
export interface DyedUser {
  userId: string;
  expiresAt: number; // UnixMs
  reason?: string;
  addedBy?: string;
}

// ─── Tracer 接口 ──────────────────────────────────────────────────────────────

/** Tracer 主接口，对照 Go 版 types.go Tracer */
export interface Tracer {
  isEnabled(): boolean;
  startSpan(name: string): SpanBuilder;
  recordSpan(span: Span): void;
  flush(): Promise<void>;
  dyeUser(userId: string, ttlSeconds: number, reason?: string): void;
  undyeUser(userId: string): void;
  isDyed(userId: string): boolean;
  listDyedUsers(): DyedUser[];
  /** RingBuffer 当前积压数量（可用于监控） */
  bufferLen(): number;
  /** 因缓冲区满而丢弃的 Span 总数 */
  droppedCount(): number;
}

// ─── NoopTracer ───────────────────────────────────────────────────────────────

/** 零开销空 builder，对照 Go noop.go */
class NoopSpanBuilder implements SpanBuilder {
  setAttribute(): SpanBuilder { return this; }
  setStatus(): SpanBuilder { return this; }
  setKind(): SpanBuilder { return this; }
  end(): void {}
}

/** 零开销 Tracer（mode=off），所有方法均为空操作 */
export class NoopTracer implements Tracer {
  private static readonly _builder = new NoopSpanBuilder();

  isEnabled(): boolean { return false; }
  startSpan(): SpanBuilder { return NoopTracer._builder; }
  recordSpan(): void {}
  async flush(): Promise<void> {}
  dyeUser(): void {}
  undyeUser(): void {}
  isDyed(): boolean { return false; }
  listDyedUsers(): DyedUser[] { return []; }
  bufferLen(): number { return 0; }
  droppedCount(): number { return 0; }
}

// ─── MemoryTracer ─────────────────────────────────────────────────────────────

import { RingBuffer } from "./buffer";
import { MemoryDyeStore } from "./dye_store";
import type { DyeStore } from "./dye_store";
import { shouldTrace as runFilters } from "./filters";

/**
 * 内存版 Tracer，对照 Go 版 tracer_impl（内存 repository 版本）。
 *
 * 使用 RingBuffer 暂存 Span，MemoryDyeStore 管理染色用户。
 * flush() 将缓冲区按 batchSize 全量清空。
 */
export class MemoryTracer implements Tracer {
  private readonly config: Required<TraceConfig>;
  private readonly buffer: RingBuffer;
  private readonly dyeStore: DyeStore;

  constructor(config: TraceConfig) {
    this.config = {
      mode: config.mode,
      sampleRate: config.sampleRate ?? 0.1,
      bufferSize: config.bufferSize ?? 10000,
      flushInterval: config.flushInterval ?? 1,
      batchSize: config.batchSize ?? 100,
      retentionDays: config.retentionDays ?? 7,
      filters: config.filters ?? [],
      dyeMaxUsers: config.dyeMaxUsers ?? 100,
      dyeDefaultTTL: config.dyeDefaultTTL ?? 86400,
    };
    this.buffer = new RingBuffer(this.config.bufferSize);
    this.dyeStore = new MemoryDyeStore(this.config.dyeMaxUsers, this.config.dyeDefaultTTL);
  }

  isEnabled(): boolean {
    return this.config.mode !== "off";
  }

  startSpan(name: string): SpanBuilder {
    const span: Span = {
      id: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
      spanId: crypto.randomUUID().slice(0, 16),
      parentId: "",
      name,
      kind: "server",
      startTime: Date.now(),
      duration: 0,
      status: "unset",
      attributes: {},
    };

    const tracer = this;
    const builder: SpanBuilder = {
      setAttribute(key: string, value: unknown) {
        span.attributes[key] = value;
        return this;
      },
      setStatus(status: SpanStatus) {
        span.status = status;
        return this;
      },
      setKind(kind: SpanKind) {
        span.kind = kind;
        return this;
      },
      end() {
        span.duration = Date.now() - span.startTime;
        tracer.recordSpan(span);
      },
    };

    return builder;
  }

  recordSpan(span: Span): void {
    this.buffer.push(span);
  }

  /** 将缓冲区中所有 Span 按 batchSize 批次清空 */
  async flush(): Promise<void> {
    const batchSize = this.config.batchSize;
    while (this.buffer.len() > 0) {
      this.buffer.flush(batchSize);
    }
  }

  // ── 染色用户 ───────────────────────────────────────────────────────────────

  dyeUser(userId: string, ttlSeconds: number, reason?: string): void {
    this.dyeStore.add(userId, ttlSeconds * 1000, undefined, reason);
  }

  undyeUser(userId: string): void {
    this.dyeStore.remove(userId);
  }

  isDyed(userId: string): boolean {
    return this.dyeStore.isDyed(userId);
  }

  listDyedUsers(): DyedUser[] {
    return this.dyeStore.list().map((u) => ({
      userId: u.userId,
      expiresAt: u.expiresAt,
      reason: u.reason,
      addedBy: u.addedBy,
    }));
  }

  // ── 监控 ──────────────────────────────────────────────────────────────────

  bufferLen(): number {
    return this.buffer.len();
  }

  droppedCount(): number {
    return this.buffer.droppedCount();
  }

  // ── 过滤器（供 Middleware 调用） ──────────────────────────────────────────

  /**
   * 判断给定请求上下文是否应该追踪。
   * 对照 Go 版 middleware.go TraceMiddleware 的过滤逻辑。
   */
  shouldTrace(preCtx: FilterContext, postCtx?: FilterContext): boolean {
    return runFilters(this.config.mode, this.config.filters, preCtx, postCtx);
  }
}

// ─── DBTracer（数据库持久化版）────────────────────────────────────────────────

import type { DBAdapter } from "../../core/db_adapter";
import { DateTime } from "../../tools/types/datetime";

/**
 * 数据库持久化版 Tracer。
 * 继承 MemoryTracer，flush() 时将 RingBuffer 中的 Span 批量写入 DB。
 * 对照 Go 版 tracer_db.go（如果存在）。
 */
export class DBTracer extends MemoryTracer {
  private readonly db: DBAdapter;

  constructor(config: TraceConfig, db: DBAdapter) {
    super(config);
    this.db = db;
  }

  /**
   * 将 RingBuffer 中所有 Span 批量写入 _spans 表，然后清空 buffer。
   */
  override async flush(): Promise<void> {
    // 访问父类中的 private buffer 字段（通过 unknown 转型）
    const buf = (this as unknown as { buffer: RingBuffer }).buffer;
    const batchSize = (this as unknown as { config: Required<TraceConfig> }).config.batchSize;
    while (buf.len() > 0) {
      const spans = buf.flush(batchSize);
      if (spans.length === 0) break;
      this._saveSpans(spans);
    }
  }

  /** 查询指定 traceId 的所有 Span */
  getSpansByTraceId(traceId: string, limit = 100): Span[] {
    const rows = this.db.query<Record<string, unknown>>(
      `SELECT * FROM _spans WHERE traceId = ? ORDER BY startTime ASC LIMIT ?`,
      traceId, limit,
    );
    return rows.map(this._rowToSpan);
  }

  /** 分页查询最近的 Span（按 created 降序） */
  listSpans(options: {
    limit?: number;
    offset?: number;
    status?: SpanStatus;
    traceId?: string;
    name?: string;
    minDuration?: number;
    maxDuration?: number;
  } = {}): Span[] {
    const { limit = 100, offset = 0, status, traceId, name, minDuration, maxDuration } = options;
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) { where.push("status = ?"); params.push(status); }
    if (traceId) { where.push("traceId = ?"); params.push(traceId); }
    if (name) { where.push("name LIKE ?"); params.push(`%${name}%`); }
    if (minDuration !== undefined) { where.push("duration >= ?"); params.push(minDuration); }
    if (maxDuration !== undefined) { where.push("duration <= ?"); params.push(maxDuration); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return this.db.query<Record<string, unknown>>(
      `SELECT * FROM _spans ${whereClause} ORDER BY created DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    ).map(this._rowToSpan);
  }

  /** 删除指定 traceId 的所有 Span */
  deleteByTraceId(traceId: string): void {
    this.db.exec(`DELETE FROM _spans WHERE traceId = ?`, traceId);
  }

  /**
   * 清理超出保留期的 Span（后台 cron 调用）。
   * 对照 Go 版 cleanup.go pruneSpans()。
   */
  pruneOldSpans(retentionDays?: number): number {
    const days = retentionDays ?? (this as unknown as { config: Required<TraceConfig> }).config.retentionDays;
    const cutoff = new Date(Date.now() - days * 86400_000);
    const cutoffStr = new DateTime(cutoff).toSQLite();
    // 先查数量
    const row = this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM _spans WHERE created < ?`,
      cutoffStr,
    );
    const count = row?.cnt ?? 0;
    if (count > 0) {
      this.db.exec(`DELETE FROM _spans WHERE created < ?`, cutoffStr);
    }
    return count;
  }

  /** 批量写入 Span */
  private _saveSpans(spans: Span[]): void {
    const now = DateTime.now().toSQLite();
    for (const s of spans) {
      try {
        this.db.exec(
          `INSERT OR IGNORE INTO _spans
            (id, traceId, spanId, parentId, name, kind, startTime, duration, status, attributes, created)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          s.id, s.traceId, s.spanId, s.parentId ?? "",
          s.name, s.kind, s.startTime, s.duration, s.status,
          JSON.stringify(s.attributes ?? {}), now,
        );
      } catch {
        // 忽略唯一冲突（重复 flush）
      }
    }
  }

  /** DB 行转 Span 对象 */
  private _rowToSpan(row: Record<string, unknown>): Span {
    return {
      id: row.id as string,
      traceId: row.traceId as string,
      spanId: row.spanId as string,
      parentId: (row.parentId as string) ?? "",
      name: row.name as string,
      kind: (row.kind as SpanKind) ?? "server",
      startTime: row.startTime as number,
      duration: row.duration as number,
      status: (row.status as SpanStatus) ?? "unset",
      attributes: (() => {
        try { return JSON.parse(row.attributes as string); } catch { return {}; }
      })(),
    };
  }
}

// ─── MustRegister ─────────────────────────────────────────────────────────────

/**
 * 创建并返回 Tracer 实例。
 * 对照 Go 版 register.go MustRegister()。
 *
 * - mode=off → NoopTracer（零开销）
 * - db 注入 → DBTracer（持久化版）
 * - 无 db   → MemoryTracer（内存版）
 */
export function MustRegister(
  _app: unknown,
  config: TraceConfig = defaultConfig(),
  db?: DBAdapter,
): Tracer {
  if (config.mode === "off") return new NoopTracer();
  if (db) return new DBTracer(config, db);
  return new MemoryTracer(config);
}

// ─── 重新导出子模块（方便外部直接从 register 导入） ───────────────────────────

export { RingBuffer } from "./buffer";
export { MemoryDyeStore } from "./dye_store";
export type { DyeStore } from "./dye_store";
export { ErrorOnly, SlowRequest, PathPrefix, PathExclude, SampleRate, DyedUserFilter_, shouldTrace } from "./filters";
