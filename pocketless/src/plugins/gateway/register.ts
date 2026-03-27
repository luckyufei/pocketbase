/**
 * Gateway 插件 — API 反向代理
 * 对照 Go 版 plugins/gateway/
 *
 * 功能: _proxies 集合、反向代理、熔断器状态机、并发限制、路由匹配
 */

export interface ProxyConfig {
  id: string;
  path: string;
  upstream: string;
  stripPath: boolean;
  accessRule: string;
  headers: Record<string, string>;
  timeout: number; // 秒
  active: boolean;
  maxConcurrent: number; // 0 = 不限制
  circuitBreaker: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number; // 连续失败次数触发熔断
  timeout: number;   // 秒，熔断后半开等待时间
}

/** 熔断器状态 */
export type CircuitState = "closed" | "open" | "half-open";

export interface GatewayConfig {
  disabled: boolean;
  enableMetrics: boolean;
  transportConfig?: TransportConfig;
}

export interface TransportConfig {
  maxIdleConns?: number;
  idleConnTimeout?: number;      // 秒
  responseHeaderTimeout?: number; // 秒
}

export function defaultConfig(): GatewayConfig {
  return {
    disabled: false,
    enableMetrics: false,
    transportConfig: {
      maxIdleConns: 100,
      idleConnTimeout: 90,
      responseHeaderTimeout: 30,
    },
  };
}

/**
 * 从环境变量读取配置覆盖（对照 Go 版 applyEnvOverrides）
 *
 * 支持的环境变量：
 *   PB_GATEWAY_DISABLED          — "true"/"false"
 *   PB_GATEWAY_ENABLE_METRICS    — "true"/"false"
 *   PB_GATEWAY_MAX_IDLE_CONNS    — 整数
 *   PB_GATEWAY_IDLE_CONN_TIMEOUT — 秒（整数）
 *   PB_GATEWAY_RESP_HEADER_TIMEOUT — 秒（整数）
 */
export function applyEnvOverrides(config: GatewayConfig): GatewayConfig {
  const result: GatewayConfig = {
    ...config,
    transportConfig: config.transportConfig ? { ...config.transportConfig } : undefined,
  };

  const disabled = process.env.PB_GATEWAY_DISABLED;
  if (disabled !== undefined) result.disabled = disabled === "true";

  const metrics = process.env.PB_GATEWAY_ENABLE_METRICS;
  if (metrics !== undefined) result.enableMetrics = metrics === "true";

  const maxIdle = process.env.PB_GATEWAY_MAX_IDLE_CONNS;
  if (maxIdle !== undefined) {
    const n = parseInt(maxIdle, 10);
    if (!isNaN(n) && n > 0) {
      result.transportConfig = result.transportConfig ?? {};
      result.transportConfig.maxIdleConns = n;
    }
  }

  const idleTimeout = process.env.PB_GATEWAY_IDLE_CONN_TIMEOUT;
  if (idleTimeout !== undefined) {
    const n = parseInt(idleTimeout, 10);
    if (!isNaN(n) && n > 0) {
      result.transportConfig = result.transportConfig ?? {};
      result.transportConfig.idleConnTimeout = n;
    }
  }

  const respTimeout = process.env.PB_GATEWAY_RESP_HEADER_TIMEOUT;
  if (respTimeout !== undefined) {
    const n = parseInt(respTimeout, 10);
    if (!isNaN(n) && n > 0) {
      result.transportConfig = result.transportConfig ?? {};
      result.transportConfig.responseHeaderTimeout = n;
    }
  }

  return result;
}

/** 单个路由的熔断器运行时状态 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt: number | null = null;
  private readonly cfg: CircuitBreakerConfig;

  constructor(cfg: CircuitBreakerConfig) {
    this.cfg = cfg;
  }

  getState(): CircuitState {
    if (this.state === "open" && this.openedAt !== null) {
      const elapsed = (Date.now() - this.openedAt) / 1000;
      if (elapsed >= this.cfg.timeout) {
        this.state = "half-open";
      }
    }
    return this.state;
  }

  /** 记录一次成功：half-open → closed，重置计数 */
  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
    this.openedAt = null;
  }

  /** 记录一次失败：累计到 threshold → open */
  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.cfg.threshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  /** 是否允许通行（open 状态直接拒绝） */
  allowRequest(): boolean {
    const s = this.getState();
    return s !== "open";
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.openedAt = null;
  }

  getFailures(): number {
    return this.failures;
  }
}

export interface GatewayManager {
  getRoutes(): ProxyConfig[];
  getAllRoutes(): ProxyConfig[]; // 含 inactive
  getRoute(id: string): ProxyConfig | null;
  addRoute(config: ProxyConfig): void;
  updateRoute(id: string, updates: Partial<Omit<ProxyConfig, "id">>): boolean;
  removeRoute(id: string): void;
  matchRoute(path: string): ProxyConfig | null;
  isEnabled(): boolean;
  getConfig(): GatewayConfig;
}

/** 内存实现 */
export class MemoryGatewayManager implements GatewayManager {
  private routes: Map<string, ProxyConfig> = new Map();
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return !this.config.disabled;
  }

  getConfig(): GatewayConfig {
    return { ...this.config, transportConfig: this.config.transportConfig ? { ...this.config.transportConfig } : undefined };
  }

  /** 只返回 active=true 的路由 */
  getRoutes(): ProxyConfig[] {
    return Array.from(this.routes.values()).filter((r) => r.active);
  }

  /** 返回所有路由（含 inactive） */
  getAllRoutes(): ProxyConfig[] {
    return Array.from(this.routes.values());
  }

  getRoute(id: string): ProxyConfig | null {
    return this.routes.get(id) ?? null;
  }

  addRoute(config: ProxyConfig): void {
    this.routes.set(config.id, { ...config });
  }

  /** 更新路由部分字段，返回 true 表示成功，false 表示 id 不存在 */
  updateRoute(id: string, updates: Partial<Omit<ProxyConfig, "id">>): boolean {
    const existing = this.routes.get(id);
    if (!existing) return false;
    this.routes.set(id, { ...existing, ...updates });
    return true;
  }

  removeRoute(id: string): void {
    this.routes.delete(id);
  }

  /**
   * 按路径前缀匹配第一条 active 路由（最长前缀优先）
   */
  matchRoute(path: string): ProxyConfig | null {
    const active = this.getRoutes();
    // 按 route.path 长度降序，优先匹配最具体的路径
    const sorted = [...active].sort((a, b) => b.path.length - a.path.length);
    return sorted.find((r) => path.startsWith(r.path)) ?? null;
  }
}

export function MustRegister(
  _app: unknown,
  config: GatewayConfig = defaultConfig(),
): GatewayManager {
  const resolved = applyEnvOverrides(config);
  return new MemoryGatewayManager(resolved);
}
