/**
 * Trace 插件 — 分布式追踪
 * 对照 Go 版 plugins/trace/
 *
 * 功能: Span 采集、Ring Buffer、条件过滤、染色用户、REST API
 */

export type TraceMode = "off" | "conditional" | "full";
export type SpanStatus = "unset" | "ok" | "error";
export type SpanKind = "internal" | "server" | "client";
export type FilterPhase = "pre" | "post";

export interface TraceConfig {
  mode: TraceMode;
  sampleRate?: number;
  bufferSize?: number;
  flushInterval?: number; // 秒
  batchSize?: number;
  retentionDays?: number;
  filters?: Filter[];
  dyeMaxUsers?: number;
  dyeDefaultTTL?: number; // 秒
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
    dyeDefaultTTL: 86400, // 24h
  };
}

export interface Span {
  id: string;
  traceId: string;
  spanId: string;
  parentId: string;
  name: string;
  kind: SpanKind;
  startTime: number; // UnixMs
  duration: number; // ms
  status: SpanStatus;
  attributes: Record<string, unknown>;
}

export interface Filter {
  name(): string;
  phase(): FilterPhase;
  shouldTrace(ctx: FilterContext): boolean;
}

export interface FilterContext {
  path: string;
  method: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string;
  error?: Error;
}

export interface SpanBuilder {
  setAttribute(key: string, value: unknown): SpanBuilder;
  setStatus(status: SpanStatus): SpanBuilder;
  setKind(kind: SpanKind): SpanBuilder;
  end(): void;
}

export interface DyedUser {
  userId: string;
  expiresAt: number; // UnixMs
  reason?: string;
  addedBy?: string;
}

export interface Tracer {
  isEnabled(): boolean;
  startSpan(name: string): SpanBuilder;
  recordSpan(span: Span): void;
  flush(): Promise<void>;
  dyeUser(userId: string, ttlSeconds: number, reason?: string): void;
  undyeUser(userId: string): void;
  isDyed(userId: string): boolean;
  listDyedUsers(): DyedUser[];
}

/** NoopSpanBuilder */
class NoopSpanBuilder implements SpanBuilder {
  setAttribute(): SpanBuilder { return this; }
  setStatus(): SpanBuilder { return this; }
  setKind(): SpanBuilder { return this; }
  end(): void {}
}

/** NoopTracer — 零开销 */
export class NoopTracer implements Tracer {
  isEnabled(): boolean { return false; }
  startSpan(): SpanBuilder { return new NoopSpanBuilder(); }
  recordSpan(): void {}
  async flush(): Promise<void> {}
  dyeUser(): void {}
  undyeUser(): void {}
  isDyed(): boolean { return false; }
  listDyedUsers(): DyedUser[] { return []; }
}

/** 内存实现 */
export class MemoryTracer implements Tracer {
  private config: TraceConfig;
  private spans: Span[] = [];
  private dyedUsers: Map<string, DyedUser> = new Map();

  constructor(config: TraceConfig) {
    this.config = config;
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

    const self = this;
    return {
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
        self.recordSpan(span);
      },
    };
  }

  recordSpan(span: Span): void {
    this.spans.push(span);
    const max = this.config.bufferSize ?? 10000;
    if (this.spans.length > max) {
      this.spans = this.spans.slice(-max);
    }
  }

  async flush(): Promise<void> {
    this.spans = [];
  }

  dyeUser(userId: string, ttlSeconds: number, reason?: string): void {
    const max = this.config.dyeMaxUsers ?? 100;
    if (this.dyedUsers.size >= max && !this.dyedUsers.has(userId)) return;
    this.dyedUsers.set(userId, {
      userId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      reason,
    });
  }

  undyeUser(userId: string): void {
    this.dyedUsers.delete(userId);
  }

  isDyed(userId: string): boolean {
    const user = this.dyedUsers.get(userId);
    if (!user) return false;
    if (Date.now() > user.expiresAt) {
      this.dyedUsers.delete(userId);
      return false;
    }
    return true;
  }

  listDyedUsers(): DyedUser[] {
    const now = Date.now();
    const result: DyedUser[] = [];
    for (const [, user] of this.dyedUsers) {
      if (now <= user.expiresAt) result.push(user);
    }
    return result;
  }
}

export function MustRegister(_app: unknown, config: TraceConfig = defaultConfig()): Tracer {
  if (config.mode === "off") return new NoopTracer();
  return new MemoryTracer(config);
}
