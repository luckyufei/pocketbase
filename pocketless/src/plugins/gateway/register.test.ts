/**
 * T178: Gateway 插件完整测试
 * 对照 Go 版 — 代理转发、熔断器状态机、速率限制、路由匹配
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  MemoryGatewayManager,
  type ProxyConfig,
  type GatewayConfig,
} from "./register";

function makeRoute(overrides: Partial<ProxyConfig> = {}): ProxyConfig {
  return {
    id: "r1",
    path: "/api/proxy",
    upstream: "http://backend:3000",
    stripPath: true,
    accessRule: "",
    headers: {},
    timeout: 30,
    active: true,
    maxConcurrent: 10,
    circuitBreaker: { enabled: false, threshold: 5, timeout: 30 },
    ...overrides,
  };
}

describe("Gateway Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.disabled).toBe(false);
      expect(cfg.enableMetrics).toBe(false);
      expect(cfg.transportConfig).toBeDefined();
      expect(cfg.transportConfig!.maxIdleConns).toBe(100);
      expect(cfg.transportConfig!.idleConnTimeout).toBe(90);
      expect(cfg.transportConfig!.responseHeaderTimeout).toBe(30);
    });

    test("每次返回新对象", () => {
      const a = defaultConfig();
      const b = defaultConfig();
      expect(a).not.toBe(b);
    });
  });

  describe("MustRegister", () => {
    test("返回 MemoryGatewayManager", () => {
      const manager = MustRegister(null);
      expect(manager).toBeDefined();
      expect(manager.isEnabled()).toBe(true);
    });

    test("disabled 配置", () => {
      const manager = MustRegister(null, { disabled: true, enableMetrics: false });
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe("isEnabled", () => {
    test("默认启用", () => {
      const m = new MemoryGatewayManager(defaultConfig());
      expect(m.isEnabled()).toBe(true);
    });

    test("disabled=true 时禁用", () => {
      const m = new MemoryGatewayManager({ disabled: true, enableMetrics: false });
      expect(m.isEnabled()).toBe(false);
    });
  });

  describe("路由管理", () => {
    let manager: MemoryGatewayManager;

    beforeEach(() => {
      manager = new MemoryGatewayManager(defaultConfig());
    });

    test("初始无路由", () => {
      expect(manager.getRoutes()).toEqual([]);
    });

    test("添加路由", () => {
      manager.addRoute(makeRoute({ id: "r1", path: "/api/v1" }));
      expect(manager.getRoutes()).toHaveLength(1);
      expect(manager.getRoutes()[0].path).toBe("/api/v1");
    });

    test("添加多个路由", () => {
      manager.addRoute(makeRoute({ id: "r1" }));
      manager.addRoute(makeRoute({ id: "r2", path: "/api/v2" }));
      expect(manager.getRoutes()).toHaveLength(2);
    });

    test("覆盖同 id 路由", () => {
      manager.addRoute(makeRoute({ id: "r1", upstream: "http://a:3000" }));
      manager.addRoute(makeRoute({ id: "r1", upstream: "http://b:3000" }));
      const routes = manager.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].upstream).toBe("http://b:3000");
    });

    test("getRoutes 只返回 active 路由", () => {
      manager.addRoute(makeRoute({ id: "r1", active: true }));
      manager.addRoute(makeRoute({ id: "r2", active: false }));
      manager.addRoute(makeRoute({ id: "r3", active: true }));
      const routes = manager.getRoutes();
      expect(routes).toHaveLength(2);
      expect(routes.every((r) => r.active)).toBe(true);
    });

    test("removeRoute 删除路由", () => {
      manager.addRoute(makeRoute({ id: "r1" }));
      manager.addRoute(makeRoute({ id: "r2" }));
      manager.removeRoute("r1");
      const routes = manager.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].id).toBe("r2");
    });

    test("removeRoute 不存在的 id（静默）", () => {
      manager.removeRoute("nonexistent"); // 不抛错
      expect(manager.getRoutes()).toEqual([]);
    });

    test("路由配置完整字段", () => {
      const route = makeRoute({
        id: "full",
        path: "/proxy",
        upstream: "http://backend:8080",
        stripPath: false,
        accessRule: "@request.auth.id != ''",
        headers: { "X-Custom": "val" },
        timeout: 60,
        maxConcurrent: 20,
        circuitBreaker: { enabled: true, threshold: 10, timeout: 60 },
      });
      manager.addRoute(route);
      const stored = manager.getRoutes()[0];
      expect(stored.path).toBe("/proxy");
      expect(stored.upstream).toBe("http://backend:8080");
      expect(stored.stripPath).toBe(false);
      expect(stored.headers["X-Custom"]).toBe("val");
      expect(stored.circuitBreaker.enabled).toBe(true);
      expect(stored.circuitBreaker.threshold).toBe(10);
    });
  });
});
