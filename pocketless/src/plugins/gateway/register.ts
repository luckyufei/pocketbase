/**
 * Gateway 插件 — API 反向代理
 * 对照 Go 版 plugins/gateway/
 *
 * 功能: _proxies 集合、反向代理、熔断器、并发限制
 */

export interface ProxyConfig {
  id: string;
  path: string;
  upstream: string;
  stripPath: boolean;
  accessRule: string;
  headers: Record<string, string>;
  timeout: number;
  active: boolean;
  maxConcurrent: number;
  circuitBreaker: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number; // 秒
}

export interface GatewayConfig {
  disabled: boolean;
  enableMetrics: boolean;
  transportConfig?: TransportConfig;
}

export interface TransportConfig {
  maxIdleConns?: number;
  idleConnTimeout?: number; // 秒
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

export interface GatewayManager {
  getRoutes(): ProxyConfig[];
  addRoute(config: ProxyConfig): void;
  removeRoute(id: string): void;
  isEnabled(): boolean;
}

/** 内存实现 */
export class MemoryGatewayManager implements GatewayManager {
  private routes: Map<string, ProxyConfig> = new Map();
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  getRoutes(): ProxyConfig[] {
    return Array.from(this.routes.values()).filter((r) => r.active);
  }

  addRoute(config: ProxyConfig): void {
    this.routes.set(config.id, config);
  }

  removeRoute(id: string): void {
    this.routes.delete(id);
  }

  isEnabled(): boolean {
    return !this.config.disabled;
  }
}

export function MustRegister(_app: unknown, config: GatewayConfig = defaultConfig()): GatewayManager {
  return new MemoryGatewayManager(config);
}
