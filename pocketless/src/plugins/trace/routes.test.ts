/**
 * Trace Routes 集成测试
 * 对照 Go 版 plugins/trace/routes_test.go
 *
 * 覆盖 3 个端点：
 * - GET /api/_/trace/spans
 * - GET /api/_/trace/spans/:traceId
 * - DELETE /api/_/trace/spans/:traceId
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerTraceRoutes } from "./routes";
import { DBTracer, MustRegister, type TraceConfig } from "./register";
import { SQLiteAdapter } from "../../core/db_adapter_sqlite";

// 测试辅助：创建内存数据库并初始化 _spans 表
function createTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _spans (
      id TEXT PRIMARY KEY,
      traceId TEXT NOT NULL,
      spanId TEXT NOT NULL,
      parentId TEXT,
      name TEXT NOT NULL,
      kind TEXT,
      startTime INTEGER,
      duration INTEGER,
      status TEXT,
      attributes TEXT,
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

describe("Trace Routes", () => {
  let hono: Hono;
  let tracer: DBTracer;
  let db: SQLiteAdapter;

  beforeEach(() => {
    db = createTestDB();
    const config: TraceConfig = { mode: "full", bufferSize: 100 };
    tracer = MustRegister({}, config, db) as DBTracer;
    hono = new Hono();
    // 先添加 auth 中间件，再注册路由
    hono.use("/api/_/trace/*", createSuperuserAuthMiddleware());
    registerTraceRoutes(hono, tracer);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/_/trace/spans
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/_/trace/spans returns 200 with empty list", async () => {
    const res = await hono.request("/api/_/trace/spans");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(50); // default
    expect(body.offset).toBe(0);
  });

  test("GET /api/_/trace/spans with custom limit/offset", async () => {
    const res = await hono.request("/api/_/trace/spans?limit=10&offset=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(5);
  });

  test("GET /api/_/trace/spans clamps limit to 1000", async () => {
    const res = await hono.request("/api/_/trace/spans?limit=2000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBeLessThanOrEqual(1000);
  });

  test("GET /api/_/trace/spans clamps limit to minimum 1", async () => {
    const res = await hono.request("/api/_/trace/spans?limit=0");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBeGreaterThanOrEqual(1);
  });

  test("GET /api/_/trace/spans filters by status", async () => {
    // 插入测试数据
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_1", "trace_1", "spanId_1", "test1", "ok", now
    );
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_2", "trace_2", "spanId_2", "test2", "error", now
    );

    const res = await hono.request("/api/_/trace/spans?status=ok");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].status).toBe("ok");
  });

  test("GET /api/_/trace/spans filters by traceId", async () => {
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_1", "trace_abc", "spanId_1", "test1", "ok", now
    );
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_2", "trace_xyz", "spanId_2", "test2", "ok", now
    );

    const res = await hono.request("/api/_/trace/spans?traceId=trace_abc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].traceId).toBe("trace_abc");
  });

  test("GET /api/_/trace/spans filters by name", async () => {
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_1", "trace_1", "spanId_1", "api_request", "ok", now
    );
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_2", "trace_2", "spanId_2", "db_query", "ok", now
    );

    const res = await hono.request("/api/_/trace/spans?name=api");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("api_request");
  });

  test("GET /api/_/trace/spans filters by duration range", async () => {
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, duration, status, created) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "span_1", "trace_1", "spanId_1", "fast", 50, "ok", now
    );
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, duration, status, created) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      "span_2", "trace_2", "spanId_2", "slow", 500, "ok", now
    );

    const res = await hono.request("/api/_/trace/spans?minDuration=100&maxDuration=300");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0); // 50 和 500 都不在 100-300 范围内

    const res2 = await hono.request("/api/_/trace/spans?minDuration=400");
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.items).toHaveLength(1);
    expect(body2.items[0].name).toBe("slow");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/_/trace/spans/:traceId
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/_/trace/spans/:traceId returns spans for trace", async () => {
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_1", "trace_abc", "spanId_1", "span1", "ok", now
    );
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_2", "trace_abc", "spanId_2", "span2", "ok", now
    );
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_3", "trace_xyz", "spanId_3", "span3", "ok", now
    );

    const res = await hono.request("/api/_/trace/spans/trace_abc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body.every((s: any) => s.traceId === "trace_abc")).toBe(true);
  });

  test("GET /api/_/trace/spans/:traceId returns empty array for non-existent trace", async () => {
    const res = await hono.request("/api/_/trace/spans/non_existent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test("GET /api/_/trace/spans/:traceId respects limit parameter", async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      db.exec(
        `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
        `span_${i}`, "trace_many", `spanId_${i}`, `span${i}`, "ok", now
      );
    }

    const res = await hono.request("/api/_/trace/spans/trace_many?limit=3");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/_/trace/spans/:traceId
  // ─────────────────────────────────────────────────────────────────────────

  test("DELETE /api/_/trace/spans/:traceId returns 204", async () => {
    const now = new Date().toISOString();
    db.exec(
      `INSERT INTO _spans (id, traceId, spanId, name, status, created) VALUES (?, ?, ?, ?, ?, ?)`,
      "span_1", "trace_delete", "spanId_1", "span1", "ok", now
    );

    const res = await hono.request("/api/_/trace/spans/trace_delete", { method: "DELETE" });
    expect(res.status).toBe(204);

    // 验证已删除
    const res2 = await hono.request("/api/_/trace/spans/trace_delete");
    const body = await res2.json();
    expect(body).toHaveLength(0);
  });

  test("DELETE /api/_/trace/spans/:traceId returns 204 for non-existent trace", async () => {
    const res = await hono.request("/api/_/trace/spans/non_existent", { method: "DELETE" });
    expect(res.status).toBe(204); // idempotent delete
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 权限测试
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/_/trace/spans without auth returns 401", async () => {
    const app = new Hono();
    // 不添加 auth 中间件
    registerTraceRoutes(app, tracer);

    const res = await app.request("/api/_/trace/spans");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.status).toBe(401);
  });

  test("GET /api/_/trace/spans with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/_/trace/*", createRegularUserAuthMiddleware());
    registerTraceRoutes(app, tracer);

    const res = await app.request("/api/_/trace/spans");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.status).toBe(403);
  });
});
