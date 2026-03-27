/**
 * T178: Gateway 插件完整测试
 * 对照 Go 版 — 代理路由管理、熔断器状态机、环境变量覆盖、路由匹配
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  MemoryGatewayManager,
  CircuitBreaker,
  type ProxyConfig,
  type GatewayConfig,
} from "./register";

// ─── 辅助工厂 ───────────────────────────────────────────────────────────────

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

function makeManager(): MemoryGatewayManager {
  return new MemoryGatewayManager(defaultConfig());
}

describe("Gateway Plugin", () => {

  // ============================================================
  // defaultConfig
  // ============================================================

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
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  // ============================================================
  // applyEnvOverrides
  // ============================================================

  describe("applyEnvOverrides", () => {
    function clean() {
      delete process.env.PB_GATEWAY_DISABLED;
      delete process.env.PB_GATEWAY_ENABLE_METRICS;
      delete process.env.PB_GATEWAY_MAX_IDLE_CONNS;
      delete process.env.PB_GATEWAY_IDLE_CONN_TIMEOUT;
      delete process.env.PB_GATEWAY_RESP_HEADER_TIMEOUT;
    }

    test("无环境变量时原样返回配置", () => {
      clean();
      const cfg = defaultConfig();
      const result = applyEnvOverrides(cfg);
      expect(result).toEqual(cfg);
      expect(result).not.toBe(cfg); // 返回副本
    });

    test("PB_GATEWAY_DISABLED=true 禁用 gateway", () => {
      process.env.PB_GATEWAY_DISABLED = "true";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.disabled).toBe(true);
      } finally { clean(); }
    });

    test("PB_GATEWAY_DISABLED=false 启用 gateway", () => {
      process.env.PB_GATEWAY_DISABLED = "false";
      try {
        const result = applyEnvOverrides({ disabled: true, enableMetrics: false });
        expect(result.disabled).toBe(false);
      } finally { clean(); }
    });

    test("PB_GATEWAY_ENABLE_METRICS=true 启用 metrics", () => {
      process.env.PB_GATEWAY_ENABLE_METRICS = "true";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.enableMetrics).toBe(true);
      } finally { clean(); }
    });

    test("PB_GATEWAY_MAX_IDLE_CONNS 覆盖连接数", () => {
      process.env.PB_GATEWAY_MAX_IDLE_CONNS = "200";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.transportConfig!.maxIdleConns).toBe(200);
      } finally { clean(); }
    });

    test("PB_GATEWAY_IDLE_CONN_TIMEOUT 覆盖超时", () => {
      process.env.PB_GATEWAY_IDLE_CONN_TIMEOUT = "120";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.transportConfig!.idleConnTimeout).toBe(120);
      } finally { clean(); }
    });

    test("PB_GATEWAY_RESP_HEADER_TIMEOUT 覆盖响应头超时", () => {
      process.env.PB_GATEWAY_RESP_HEADER_TIMEOUT = "60";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.transportConfig!.responseHeaderTimeout).toBe(60);
      } finally { clean(); }
    });

    test("原始配置对象不被修改", () => {
      process.env.PB_GATEWAY_DISABLED = "true";
      try {
        const cfg = defaultConfig();
        applyEnvOverrides(cfg);
        expect(cfg.disabled).toBe(false); // 未被修改
      } finally { clean(); }
    });

    test("transportConfig 返回独立副本", () => {
      clean();
      const cfg = defaultConfig();
      const result = applyEnvOverrides(cfg);
      result.transportConfig!.maxIdleConns = 999;
      expect(cfg.transportConfig!.maxIdleConns).toBe(100); // 原始未变
    });
  });

  // ============================================================
  // MustRegister
  // ============================================================

  describe("MustRegister", () => {
    test("返回 MemoryGatewayManager", () => {
      const m = MustRegister(null);
      expect(m).toBeDefined();
      expect(m.isEnabled()).toBe(true);
    });

    test("disabled 配置", () => {
      const m = MustRegister(null, { disabled: true, enableMetrics: false });
      expect(m.isEnabled()).toBe(false);
    });

    test("无参数不抛错", () => {
      expect(() => MustRegister(null)).not.toThrow();
    });
  });

  // ============================================================
  // isEnabled / getConfig
  // ============================================================

  describe("isEnabled / getConfig", () => {
    test("默认启用", () => {
      expect(makeManager().isEnabled()).toBe(true);
    });

    test("disabled=true 时禁用", () => {
      expect(new MemoryGatewayManager({ disabled: true, enableMetrics: false }).isEnabled()).toBe(false);
    });

    test("getConfig 返回副本", () => {
      const m = makeManager();
      const cfg = m.getConfig();
      cfg.disabled = true;
      expect(m.isEnabled()).toBe(true); // 未被修改
    });
  });

  // ============================================================
  // 路由管理 — CRUD
  // ============================================================

  describe("路由管理 — CRUD", () => {
    let m: MemoryGatewayManager;
    beforeEach(() => { m = makeManager(); });

    test("初始无路由", () => {
      expect(m.getRoutes()).toEqual([]);
      expect(m.getAllRoutes()).toEqual([]);
    });

    test("addRoute + getRoutes", () => {
      m.addRoute(makeRoute({ id: "r1", path: "/api/v1" }));
      expect(m.getRoutes()).toHaveLength(1);
      expect(m.getRoutes()[0].path).toBe("/api/v1");
    });

    test("添加多个路由", () => {
      m.addRoute(makeRoute({ id: "r1" }));
      m.addRoute(makeRoute({ id: "r2", path: "/api/v2" }));
      expect(m.getRoutes()).toHaveLength(2);
    });

    test("覆盖同 id 路由", () => {
      m.addRoute(makeRoute({ id: "r1", upstream: "http://a:3000" }));
      m.addRoute(makeRoute({ id: "r1", upstream: "http://b:3000" }));
      expect(m.getRoutes()).toHaveLength(1);
      expect(m.getRoutes()[0].upstream).toBe("http://b:3000");
    });

    test("getRoutes 只返回 active 路由", () => {
      m.addRoute(makeRoute({ id: "r1", active: true }));
      m.addRoute(makeRoute({ id: "r2", active: false }));
      m.addRoute(makeRoute({ id: "r3", active: true }));
      expect(m.getRoutes()).toHaveLength(2);
      expect(m.getRoutes().every((r) => r.active)).toBe(true);
    });

    test("getAllRoutes 包含 inactive 路由", () => {
      m.addRoute(makeRoute({ id: "r1", active: true }));
      m.addRoute(makeRoute({ id: "r2", active: false }));
      expect(m.getAllRoutes()).toHaveLength(2);
    });

    test("getRoute 按 id 获取", () => {
      m.addRoute(makeRoute({ id: "r1", path: "/x" }));
      const r = m.getRoute("r1");
      expect(r).not.toBeNull();
      expect(r!.path).toBe("/x");
    });

    test("getRoute 不存在返回 null", () => {
      expect(m.getRoute("nonexistent")).toBeNull();
    });

    test("removeRoute 删除路由", () => {
      m.addRoute(makeRoute({ id: "r1" }));
      m.addRoute(makeRoute({ id: "r2" }));
      m.removeRoute("r1");
      expect(m.getRoutes()).toHaveLength(1);
      expect(m.getRoutes()[0].id).toBe("r2");
    });

    test("removeRoute 不存在的 id（静默）", () => {
      m.removeRoute("nonexistent"); // 不抛错
      expect(m.getRoutes()).toEqual([]);
    });

    test("addRoute 存储副本，外部修改不影响内部", () => {
      const route = makeRoute({ id: "r1", path: "/original" });
      m.addRoute(route);
      route.path = "/tampered";
      expect(m.getRoute("r1")!.path).toBe("/original");
    });
  });

  // ============================================================
  // 路由管理 — updateRoute
  // ============================================================

  describe("路由管理 — updateRoute", () => {
    let m: MemoryGatewayManager;
    beforeEach(() => {
      m = makeManager();
      m.addRoute(makeRoute({ id: "r1", path: "/api", upstream: "http://old:3000", active: true }));
    });

    test("更新部分字段返回 true", () => {
      expect(m.updateRoute("r1", { upstream: "http://new:3000" })).toBe(true);
      expect(m.getRoute("r1")!.upstream).toBe("http://new:3000");
    });

    test("更新 active 状态", () => {
      m.updateRoute("r1", { active: false });
      expect(m.getRoutes()).toHaveLength(0); // active=false 不再出现在 getRoutes
      expect(m.getAllRoutes()).toHaveLength(1); // getAllRoutes 仍能看到
    });

    test("更新多个字段", () => {
      m.updateRoute("r1", { path: "/v2", timeout: 60 });
      const r = m.getRoute("r1")!;
      expect(r.path).toBe("/v2");
      expect(r.timeout).toBe(60);
    });

    test("不存在的 id 返回 false", () => {
      expect(m.updateRoute("nonexistent", { active: false })).toBe(false);
    });

    test("更新后原有字段保留", () => {
      m.updateRoute("r1", { timeout: 99 });
      const r = m.getRoute("r1")!;
      expect(r.path).toBe("/api"); // 原有字段保留
      expect(r.timeout).toBe(99);
    });
  });

  // ============================================================
  // 路由配置字段
  // ============================================================

  describe("路由配置字段", () => {
    test("完整字段存储正确", () => {
      const m = makeManager();
      const route = makeRoute({
        id: "full",
        path: "/proxy",
        upstream: "http://backend:8080",
        stripPath: false,
        accessRule: "@request.auth.id != ''",
        headers: { "X-Custom": "val", "Authorization": "Bearer token" },
        timeout: 60,
        maxConcurrent: 20,
        circuitBreaker: { enabled: true, threshold: 10, timeout: 60 },
      });
      m.addRoute(route);
      const stored = m.getRoutes()[0];
      expect(stored.upstream).toBe("http://backend:8080");
      expect(stored.stripPath).toBe(false);
      expect(stored.accessRule).toBe("@request.auth.id != ''");
      expect(stored.headers["X-Custom"]).toBe("val");
      expect(stored.timeout).toBe(60);
      expect(stored.maxConcurrent).toBe(20);
      expect(stored.circuitBreaker.enabled).toBe(true);
      expect(stored.circuitBreaker.threshold).toBe(10);
    });
  });

  // ============================================================
  // 路由匹配 matchRoute
  // ============================================================

  describe("matchRoute", () => {
    let m: MemoryGatewayManager;
    beforeEach(() => {
      m = makeManager();
      m.addRoute(makeRoute({ id: "api", path: "/api", active: true }));
      m.addRoute(makeRoute({ id: "api-v2", path: "/api/v2", active: true }));
      m.addRoute(makeRoute({ id: "health", path: "/health", active: true }));
    });

    test("精确匹配", () => {
      const r = m.matchRoute("/health");
      expect(r).not.toBeNull();
      expect(r!.id).toBe("health");
    });

    test("前缀匹配", () => {
      const r = m.matchRoute("/api/users");
      expect(r).not.toBeNull();
      expect(r!.id).toBe("api");
    });

    test("最长前缀优先", () => {
      const r = m.matchRoute("/api/v2/users");
      expect(r).not.toBeNull();
      expect(r!.id).toBe("api-v2"); // /api/v2 比 /api 更具体
    });

    test("无匹配返回 null", () => {
      expect(m.matchRoute("/unknown/path")).toBeNull();
    });

    test("inactive 路由不参与匹配", () => {
      m.addRoute(makeRoute({ id: "disabled", path: "/special", active: false }));
      expect(m.matchRoute("/special")).toBeNull();
    });

    test("空路由时返回 null", () => {
      const empty = makeManager();
      expect(empty.matchRoute("/api")).toBeNull();
    });
  });

  // ============================================================
  // CircuitBreaker 状态机
  // ============================================================

  describe("CircuitBreaker", () => {
    test("初始状态为 closed", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 3, timeout: 10 });
      expect(cb.getState()).toBe("closed");
    });

    test("closed 状态 allowRequest 返回 true", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 3, timeout: 10 });
      expect(cb.allowRequest()).toBe(true);
    });

    test("失败未达阈值时保持 closed", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 3, timeout: 10 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("closed");
      expect(cb.getFailures()).toBe(2);
    });

    test("失败达到阈值时变为 open", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 3, timeout: 10 });
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure(); // 第 3 次
      expect(cb.getState()).toBe("open");
    });

    test("open 状态 allowRequest 返回 false", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 2, timeout: 10 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.allowRequest()).toBe(false);
    });

    test("成功重置 closed 状态", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 2, timeout: 10 });
      cb.recordFailure();
      cb.recordSuccess();
      expect(cb.getState()).toBe("closed");
      expect(cb.getFailures()).toBe(0);
    });

    test("open 超时后变为 half-open", async () => {
      // 用 timeout=60 先验证 open 状态，再切换到 timeout=0 版本验证转换
      const cb = new CircuitBreaker({ enabled: true, threshold: 1, timeout: 60 });
      cb.recordFailure(); // → open（60秒后才 half-open，此刻仍 open）
      expect(cb.getState()).toBe("open");

      // 独立验证：timeout=0 时 sleep 后变为 half-open
      const cb2 = new CircuitBreaker({ enabled: true, threshold: 1, timeout: 0 });
      cb2.recordFailure();
      await Bun.sleep(10); // 超过 0 秒
      expect(cb2.getState()).toBe("half-open");
    });

    test("half-open 状态 allowRequest 返回 true", async () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 1, timeout: 0 });
      cb.recordFailure(); // → open（timeout=0，立即可转 half-open）
      await Bun.sleep(10); // 确保超时
      expect(cb.allowRequest()).toBe(true); // half-open 允许请求
    });

    test("half-open 成功后变为 closed", async () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 1, timeout: 0 });
      cb.recordFailure(); // → open
      await Bun.sleep(10); // → half-open
      expect(cb.getState()).toBe("half-open");
      cb.recordSuccess(); // half-open → closed
      expect(cb.getState()).toBe("closed");
    });

    test("reset 重置所有状态", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 2, timeout: 10 });
      cb.recordFailure();
      cb.recordFailure();
      cb.reset();
      expect(cb.getState()).toBe("closed");
      expect(cb.getFailures()).toBe(0);
    });

    test("阈值为 1 时单次失败即触发熔断", () => {
      const cb = new CircuitBreaker({ enabled: true, threshold: 1, timeout: 30 });
      cb.recordFailure();
      expect(cb.getState()).toBe("open");
      expect(cb.allowRequest()).toBe(false);
    });
  });
});
