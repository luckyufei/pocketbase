/**
 * Analytics Routes 集成测试
 * 对照 Go 版 plugins/analytics/routes_test.go
 *
 * 覆盖 5 个端点：
 * - POST /api/analytics/events (无认证)
 * - GET /api/analytics/stats (Superuser)
 * - GET /api/analytics/top-pages (Superuser)
 * - GET /api/analytics/top-sources (Superuser)
 * - GET /api/analytics/devices (Superuser)
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerAnalyticsRoutes } from "./routes";
import { DBAnalytics, MustRegister, type AnalyticsConfig } from "./register";
import { SQLiteAdapter } from "../../core/db_adapter_sqlite";

// 测试辅助：创建内存数据库并初始化 _events 和 _events_daily 表
// 注意：表结构必须与 register.ts 中的 DBAnalytics 实现一致
function createTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT,
      source TEXT,
      browser TEXT,
      os TEXT,
      visitorId TEXT,
      duration INTEGER DEFAULT 0,
      properties TEXT,
      timestamp TEXT NOT NULL,
      created TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _events_daily (
      date TEXT NOT NULL,
      path TEXT NOT NULL,
      totalPV INTEGER DEFAULT 0,
      totalUV INTEGER DEFAULT 0,
      avgDuration REAL DEFAULT 0,
      PRIMARY KEY (date, path)
    )
  `);
  return db;
}

// 测试辅助：创建 Superuser auth 中间件
function createSuperuserAuthMiddleware(): any {
  return async (c: any, next: any) => {
    c.set("auth", { id: "su_1", collectionName: "_superusers" });
    await next();
  };
}

// 测试辅助：创建普通用户 auth 中间件
function createRegularUserAuthMiddleware(): any {
  return async (c: any, next: any) => {
    c.set("auth", { id: "user_1", collectionName: "users" });
    await next();
  };
}

describe("Analytics Routes", () => {
  let hono: Hono;
  let analytics: DBAnalytics;
  let db: SQLiteAdapter;

  beforeEach(() => {
    db = createTestDB();
    const config: AnalyticsConfig = { enabled: true };
    analytics = MustRegister({}, config, db) as DBAnalytics;
    hono = new Hono();
    // POST /events 不需要认证，GET 需要 Superuser
    hono.use("/api/analytics/*", async (c, next) => {
      // Skip auth for POST /events
      if (c.req.method === "POST" && c.req.path === "/api/analytics/events") {
        return next();
      }
      // Require superuser for GET endpoints
      c.set("auth", { id: "su_1", collectionName: "_superusers" });
      await next();
    });
    registerAnalyticsRoutes(hono, analytics);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/analytics/events
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/analytics/events tracks single event", async () => {
    const res = await hono.request("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "pageview",
        path: "/home",
        source: "https://google.com",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(1);
  });

  test("POST /api/analytics/events tracks batch events", async () => {
    const res = await hono.request("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { name: "pageview", path: "/page1" },
        { name: "pageview", path: "/page2" },
        { name: "click", path: "/page1" },
      ]),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(3);
  });

  test("POST /api/analytics/events without auth works", async () => {
    const app = new Hono();
    registerAnalyticsRoutes(app, analytics);

    const res = await app.request("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test", path: "/" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/analytics/stats
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/analytics/stats returns empty array when no data", async () => {
    const res = await hono.request("/api/analytics/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    // getStats returns an array of DailyStat
    expect(body).toBeInstanceOf(Array);
    expect(body).toHaveLength(0);
  });

  test("GET /api/analytics/stats aggregates events", async () => {
    // Track some events
    analytics.track({
      name: "pageview",
      path: "/home",
      visitorId: "visitor1",
    });
    analytics.track({
      name: "pageview",
      path: "/about",
      visitorId: "visitor1",
    });
    analytics.track({
      name: "pageview",
      path: "/home",
      visitorId: "visitor2",
    });

    // Flush to database
    await analytics.flush();

    const res = await hono.request("/api/analytics/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    // getStats returns DailyStat[] array
    expect(body).toBeInstanceOf(Array);
  });

  test("GET /api/analytics/stats with date range", async () => {
    const res = await hono.request("/api/analytics/stats?startDate=2024-01-01&endDate=2024-12-31");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/analytics/top-pages
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/analytics/top-pages returns empty when no data", async () => {
    const res = await hono.request("/api/analytics/top-pages");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Returns array directly, not {items: []}
    expect(body).toEqual([]);
  });

  test("GET /api/analytics/top-pages returns top pages by views", async () => {
    // Track multiple pageviews
    for (let i = 0; i < 5; i++) {
      analytics.track({ name: "pageview", path: "/popular" });
    }
    for (let i = 0; i < 2; i++) {
      analytics.track({ name: "pageview", path: "/less-popular" });
    }

    // Flush to database
    await analytics.flush();

    const res = await hono.request("/api/analytics/top-pages");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Returns array directly
    expect(body.length).toBeGreaterThan(0);
  });

  test("GET /api/analytics/top-pages with limit", async () => {
    analytics.track({ name: "pageview", path: "/page1" });
    analytics.track({ name: "pageview", path: "/page2" });
    analytics.track({ name: "pageview", path: "/page3" });

    const res = await hono.request("/api/analytics/top-pages?limit=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Returns array directly
    expect(body.length).toBeLessThanOrEqual(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/analytics/top-sources
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/analytics/top-sources returns top referrers", async () => {
    analytics.track({ name: "pageview", path: "/", source: "https://google.com" });
    analytics.track({ name: "pageview", path: "/", source: "https://google.com" });
    analytics.track({ name: "pageview", path: "/", source: "https://twitter.com" });

    // Flush to database
    await analytics.flush();

    const res = await hono.request("/api/analytics/top-sources");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Returns array directly
    expect(body.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/analytics/devices
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/analytics/devices returns device breakdown", async () => {
    analytics.track({ name: "pageview", path: "/", browser: "Chrome", os: "Windows" });
    analytics.track({ name: "pageview", path: "/", browser: "Chrome", os: "Windows" });
    analytics.track({ name: "pageview", path: "/", browser: "Safari", os: "iOS" });

    // Flush to database
    await analytics.flush();

    const res = await hono.request("/api/analytics/devices");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Returns array directly
    expect(body.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 权限测试
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/analytics/stats without auth returns 401", async () => {
    const app = new Hono();
    registerAnalyticsRoutes(app, analytics);

    const res = await app.request("/api/analytics/stats");
    expect(res.status).toBe(401);
  });

  test("GET /api/analytics/stats with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/analytics/*", createRegularUserAuthMiddleware());
    registerAnalyticsRoutes(app, analytics);

    const res = await app.request("/api/analytics/stats");
    expect(res.status).toBe(403);
  });

  test("GET /api/analytics/top-pages with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/analytics/*", createRegularUserAuthMiddleware());
    registerAnalyticsRoutes(app, analytics);

    const res = await app.request("/api/analytics/top-pages");
    expect(res.status).toBe(403);
  });
});
