/**
 * Metrics Routes 集成测试
 * 对照 Go 版 plugins/metrics/routes_test.go
 *
 * 覆盖 2 个端点：
 * - GET /api/system/metrics
 * - GET /api/system/metrics/current
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerMetricsRoutes } from "./routes";
import { DBMetricsCollector, MustRegister, type MetricsConfig } from "./register";
import { SQLiteAdapter } from "../../core/db_adapter_sqlite";

// 测试辅助：创建内存数据库并初始化 _metrics 表
function createTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _metrics (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      cpuUsagePercent REAL,
      memoryAllocMb REAL,
      goroutinesCount INTEGER,
      sqliteWalSizeMb REAL,
      sqliteOpenConns INTEGER,
      p95LatencyMs REAL,
      http5xxCount INTEGER,
      created TEXT
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

describe("Metrics Routes", () => {
  let hono: Hono;
  let collector: DBMetricsCollector;
  let db: SQLiteAdapter;

  beforeEach(() => {
    db = createTestDB();
    const config: MetricsConfig = { enabled: true, interval: 60 };
    collector = MustRegister({}, config, db) as DBMetricsCollector;
    hono = new Hono();
    hono.use("/api/system/metrics/*", createSuperuserAuthMiddleware());
    registerMetricsRoutes(hono, collector);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/system/metrics/current
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/system/metrics/current returns 200 with snapshot when data exists", async () => {
    // 插入测试数据
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "metric_1", now, 10.5, 256.5, 45.2, 0, now,
    );

    const res = await hono.request("/api/system/metrics/current");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("metric_1");
    expect(body.timestamp).toBe(now);
    expect(body.cpuUsagePercent).toBe(10.5);
    expect(body.memoryAllocMb).toBe(256.5);
    expect(body.p95LatencyMs).toBe(45.2);
    expect(body.http5xxCount).toBe(0);
  });

  test("GET /api/system/metrics/current returns message when no data", async () => {
    const res = await hono.request("/api/system/metrics/current");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("No metrics data available yet.");
  });

  test("GET /api/system/metrics/current returns latest snapshot", async () => {
    const now = new Date();
    const t1 = new Date(now.getTime() - 1000).toISOString();
    const t2 = new Date(now.getTime()).toISOString();

    db.exec(
      `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "metric_1", t1, 5.0, 100.0, 20.0, 1, t1,
    );
    db.exec(
      `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "metric_2", t2, 15.0, 200.0, 50.0, 2, t2,
    );

    const res = await hono.request("/api/system/metrics/current");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("metric_2"); // 最新的
    expect(body.cpuUsagePercent).toBe(15.0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/system/metrics
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/system/metrics returns 200 with history list", async () => {
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const ts = new Date(now.getTime() - i * 3600_000).toISOString();
      db.exec(
        `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        `metric_${i}`, ts, i * 10.0, i * 100.0, i * 20.0, i, ts,
      );
    }

    const res = await hono.request("/api/system/metrics");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeInstanceOf(Array);
    expect(body.items.length).toBe(3);
    expect(body.total).toBe(3);
    expect(body.hours).toBe(24); // default
    expect(body.limit).toBe(100); // default
  });

  test("GET /api/system/metrics with custom hours/limit", async () => {
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const ts = new Date(now.getTime() - i * 1800_000).toISOString(); // 每30分钟一条
      db.exec(
        `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        `metric_${i}`, ts, i * 10.0, i * 100.0, i * 20.0, i, ts,
      );
    }

    const res = await hono.request("/api/system/metrics?hours=1&limit=3");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hours).toBe(1);
    expect(body.limit).toBe(3);
    expect(body.items.length).toBeLessThanOrEqual(3);
  });

  test("GET /api/system/metrics clamps hours to 1-168 range", async () => {
    const res1 = await hono.request("/api/system/metrics?hours=0");
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.hours).toBeGreaterThanOrEqual(1);

    const res2 = await hono.request("/api/system/metrics?hours=200");
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.hours).toBeLessThanOrEqual(168);
  });

  test("GET /api/system/metrics clamps limit to 1-1000 range", async () => {
    const res1 = await hono.request("/api/system/metrics?limit=0");
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.limit).toBeGreaterThanOrEqual(1);

    const res2 = await hono.request("/api/system/metrics?limit=2000");
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.limit).toBeLessThanOrEqual(1000);
  });

  test("GET /api/system/metrics filters by hours (time range)", async () => {
    const now = new Date();
    // 30分钟内的数据（在1小时内）- 使用与代码中相同的 SQLite 格式
    const recent = new Date(now.getTime() - 30 * 60_000).toISOString().replace("T", " ");
    // 3小时前的数据（在1小时外）
    const old = new Date(now.getTime() - 3 * 3600_000).toISOString().replace("T", " ");

    db.exec(
      `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "recent", recent, 10.0, 100.0, 20.0, 0, recent,
    );
    db.exec(
      `INSERT INTO _metrics (id, timestamp, cpuUsagePercent, memoryAllocMb, p95LatencyMs, http5xxCount, created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "old", old, 5.0, 50.0, 10.0, 0, old,
    );

    const res = await hono.request("/api/system/metrics?hours=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    // 应该只返回最近1小时的数据（只包含 recent）
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe("recent");
  });

  test("GET /api/system/metrics returns empty array when no data", async () => {
    const res = await hono.request("/api/system/metrics");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 权限测试
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/system/metrics/current without auth returns 401", async () => {
    const app = new Hono();
    registerMetricsRoutes(app, collector);

    const res = await app.request("/api/system/metrics/current");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.status).toBe(401);
  });

  test("GET /api/system/metrics without auth returns 401", async () => {
    const app = new Hono();
    registerMetricsRoutes(app, collector);

    const res = await app.request("/api/system/metrics");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.status).toBe(401);
  });

  test("GET /api/system/metrics/current with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/system/metrics/*", createRegularUserAuthMiddleware());
    registerMetricsRoutes(app, collector);

    const res = await app.request("/api/system/metrics/current");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.status).toBe(403);
  });

  test("GET /api/system/metrics with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/system/metrics/*", createRegularUserAuthMiddleware());
    registerMetricsRoutes(app, collector);

    const res = await app.request("/api/system/metrics");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.status).toBe(403);
  });
});
