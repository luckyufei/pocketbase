/**
 * Metrics 插件 — 系统监控
 * 对照 Go 版 plugins/metrics/
 *
 * 功能: CPU/内存/延迟/5xx 采集、_metrics 表、P95 计算
 */

export interface MetricsConfig {
  enabled: boolean;
  interval?: number; // 采集间隔（秒）
  retentionDays?: number;
  httpEnabled?: boolean;
}

export function defaultConfig(): MetricsConfig {
  return {
    enabled: false,
    interval: 60,
    retentionDays: 7,
    httpEnabled: true,
  };
}

export interface MetricsSnapshot {
  id: string;
  timestamp: string;
  cpuUsagePercent: number;
  memoryAllocMb: number;
  goroutinesCount: number; // Bun 中对应 active handles
  p95LatencyMs: number;
  http5xxCount: number;
}

export interface MetricsCollector {
  isEnabled(): boolean;
  recordLatency(ms: number): void;
  record5xx(): void;
  getCurrentSnapshot(): MetricsSnapshot;
  getHistory(hours?: number, limit?: number): Promise<MetricsSnapshot[]>;
  start(): void;
  stop(): void;
}

/** LatencyBuffer — 用于 P95 计算的环形缓冲 */
export class LatencyBuffer {
  private buffer: number[];
  private pos = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(0);
  }

  push(latencyMs: number): void {
    this.buffer[this.pos] = latencyMs;
    this.pos = (this.pos + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  p95(): number {
    if (this.count === 0) return 0;
    const sorted = this.buffer.slice(0, this.count).sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  reset(): void {
    this.pos = 0;
    this.count = 0;
  }
}

/** 内存实现 */
export class MemoryMetricsCollector implements MetricsCollector {
  private config: MetricsConfig;
  private latencyBuf = new LatencyBuffer();
  private http5xx = 0;
  private history: MetricsSnapshot[] = [];

  constructor(config: MetricsConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  recordLatency(ms: number): void {
    this.latencyBuf.push(ms);
  }

  record5xx(): void {
    this.http5xx++;
  }

  getCurrentSnapshot(): MetricsSnapshot {
    const mem = process.memoryUsage();
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 0, // 需要专门采样器
      memoryAllocMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      goroutinesCount: 0,
      p95LatencyMs: this.latencyBuf.p95(),
      http5xxCount: this.http5xx,
    };
  }

  async getHistory(hours = 24, limit = 1000): Promise<MetricsSnapshot[]> {
    const since = Date.now() - hours * 60 * 60 * 1000;
    return this.history
      .filter((s) => new Date(s.timestamp).getTime() > since)
      .slice(-limit);
  }

  start(): void {}
  stop(): void {}
}

export function MustRegister(_app: unknown, config: MetricsConfig = defaultConfig()): MetricsCollector {
  return new MemoryMetricsCollector(config);
}
