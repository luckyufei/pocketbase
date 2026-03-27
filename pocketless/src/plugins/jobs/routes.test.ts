/**
 * Jobs Routes 集成测试
 * 对照 Go 版 plugins/jobs/routes_test.go
 *
 * 覆盖 6 个端点：
 * - POST /api/jobs/enqueue
 * - GET /api/jobs
 * - GET /api/jobs/stats
 * - GET /api/jobs/:id
 * - POST /api/jobs/:id/requeue
 * - DELETE /api/jobs/:id
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerJobsRoutes } from "./routes";
import { DBJobsStore, MustRegister, type JobsConfig } from "./register";
import { SQLiteAdapter } from "../../core/db_adapter_sqlite";

// 测试辅助：创建内存数据库并初始化 _jobs 表
function createTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _jobs (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL,
      runAt TEXT NOT NULL,
      lockedUntil TEXT,
      retries INTEGER DEFAULT 0,
      maxRetries INTEGER DEFAULT 3,
      lastError TEXT DEFAULT '',
      created TEXT NOT NULL,
      updated TEXT NOT NULL
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

describe("Jobs Routes", () => {
  let hono: Hono;
  let store: DBJobsStore;
  let db: SQLiteAdapter;

  beforeEach(() => {
    db = createTestDB();
    const config: JobsConfig = { enabled: false, autoStart: false };
    store = MustRegister({}, config, db) as DBJobsStore;
    hono = new Hono();
    hono.use("/api/jobs/*", createSuperuserAuthMiddleware());
    registerJobsRoutes(hono, store);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/jobs/enqueue
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/jobs/enqueue creates job with topic only", async () => {
    const res = await hono.request("/api/jobs/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "test.topic" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.topic).toBe("test.topic");
    expect(body.status).toBe("pending");
    expect(body.id).toBeDefined();
    expect(body.payload).toBeNull();
  });

  test("POST /api/jobs/enqueue creates job with payload", async () => {
    const payload = { userId: "user_123", action: "send_email" };
    const res = await hono.request("/api/jobs/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "email.send", payload }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.topic).toBe("email.send");
    expect(body.payload).toEqual(payload);
  });

  test("POST /api/jobs/enqueue with runAt schedules job", async () => {
    const runAt = new Date(Date.now() + 3600_000).toISOString(); // 1小时后
    const res = await hono.request("/api/jobs/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "delayed.task", runAt }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.runAt).toBeDefined();
  });

  test("POST /api/jobs/enqueue with maxRetries", async () => {
    const res = await hono.request("/api/jobs/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "important.task", maxRetries: 5 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.maxRetries).toBe(5);
  });

  test("POST /api/jobs/enqueue without topic returns error", async () => {
    const res = await hono.request("/api/jobs/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: {} }),
    });
    // 当前实现使用 throw，返回 500
    expect(res.status).toBe(500);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/jobs
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/jobs returns empty list", async () => {
    const res = await hono.request("/api/jobs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test("GET /api/jobs returns job list", async () => {
    await store.enqueue("topic.a", { data: 1 });
    await store.enqueue("topic.b", { data: 2 });

    const res = await hono.request("/api/jobs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(30);
    expect(body.offset).toBe(0);
  });

  test("GET /api/jobs with topic filter", async () => {
    await store.enqueue("topic.a", { data: 1 });
    await store.enqueue("topic.b", { data: 2 });

    const res = await hono.request("/api/jobs?topic=topic.a");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].topic).toBe("topic.a");
  });

  test("GET /api/jobs with status filter", async () => {
    const job = await store.enqueue("test.topic", {});

    const res = await hono.request("/api/jobs?status=pending");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(job.id);
  });

  test("GET /api/jobs with pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await store.enqueue("test.topic", { index: i });
    }

    const res = await hono.request("/api/jobs?limit=2&offset=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
    expect(body.total).toBe(5);
  });

  test("GET /api/jobs clamps limit to 1000", async () => {
    const res = await hono.request("/api/jobs?limit=2000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBeLessThanOrEqual(1000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/jobs/stats
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/jobs/stats returns zero stats when empty", async () => {
    const res = await hono.request("/api/jobs/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pending).toBe(0);
    expect(body.processing).toBe(0);
    expect(body.completed).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.total).toBe(0);
    expect(body.successRate).toBe(0);
  });

  test("GET /api/jobs/stats counts jobs by status", async () => {
    // 创建一些任务
    await store.enqueue("test.topic", { n: 1 });
    await store.enqueue("test.topic", { n: 2 });
    await store.enqueue("test.topic", { n: 3 });

    const res = await hono.request("/api/jobs/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pending).toBe(3);
    expect(body.total).toBe(3);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/jobs/:id
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/jobs/:id returns job details", async () => {
    const job = await store.enqueue("test.topic", { key: "value" });

    const res = await hono.request(`/api/jobs/${job.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(job.id);
    expect(body.topic).toBe("test.topic");
    expect(body.payload).toEqual({ key: "value" });
  });

  test("GET /api/jobs/:id returns 404 for non-existent job", async () => {
    const res = await hono.request("/api/jobs/non_existent_id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe(404);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/jobs/:id/requeue
  // ─────────────────────────────────────────────────────────────────────────

  test("POST /api/jobs/:id/requeue requeues failed job", async () => {
    // 创建一个任务并手动标记为 failed
    const job = await store.enqueue("test.topic", {});
    db.exec(`UPDATE _jobs SET status = 'failed', lastError = 'test error' WHERE id = ?`, job.id);

    const res = await hono.request(`/api/jobs/${job.id}/requeue`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
    expect(body.retries).toBe(0);
    expect(body.lastError).toBe("");
  });

  test("POST /api/jobs/:id/requeue returns error for non-failed job", async () => {
    const job = await store.enqueue("test.topic", {});
    // job is pending, not failed

    const res = await hono.request(`/api/jobs/${job.id}/requeue`, {
      method: "POST",
    });
    // throw 导致 500
    expect(res.status).toBe(500);
  });

  test("POST /api/jobs/:id/requeue returns error for non-existent job", async () => {
    const res = await hono.request("/api/jobs/non_existent/requeue", {
      method: "POST",
    });
    // throw 导致 500
    expect(res.status).toBe(500);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/jobs/:id
  // ─────────────────────────────────────────────────────────────────────────

  test("DELETE /api/jobs/:id deletes pending job", async () => {
    const job = await store.enqueue("test.topic", {});

    const res = await hono.request(`/api/jobs/${job.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    // Verify deletion
    const getRes = await hono.request(`/api/jobs/${job.id}`);
    expect(getRes.status).toBe(404);
  });

  test("DELETE /api/jobs/:id deletes failed job", async () => {
    const job = await store.enqueue("test.topic", {});
    db.exec(`UPDATE _jobs SET status = 'failed' WHERE id = ?`, job.id);

    const res = await hono.request(`/api/jobs/${job.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  test("DELETE /api/jobs/:id returns error for processing job", async () => {
    const job = await store.enqueue("test.topic", {});
    db.exec(`UPDATE _jobs SET status = 'processing' WHERE id = ?`, job.id);

    const res = await hono.request(`/api/jobs/${job.id}`, { method: "DELETE" });
    // throw 导致 500
    expect(res.status).toBe(500);
  });

  test("DELETE /api/jobs/:id returns error for completed job", async () => {
    const job = await store.enqueue("test.topic", {});
    db.exec(`UPDATE _jobs SET status = 'completed' WHERE id = ?`, job.id);

    const res = await hono.request(`/api/jobs/${job.id}`, { method: "DELETE" });
    // throw 导致 500
    expect(res.status).toBe(500);
  });

  test("DELETE /api/jobs/:id returns error for non-existent job", async () => {
    const res = await hono.request("/api/jobs/non_existent", { method: "DELETE" });
    // throw 导致 500
    expect(res.status).toBe(500);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 权限测试
  // ─────────────────────────────────────────────────────────────────────────

  test("GET /api/jobs without auth returns 401", async () => {
    const app = new Hono();
    registerJobsRoutes(app, store);

    const res = await app.request("/api/jobs");
    expect(res.status).toBe(401);
  });

  test("GET /api/jobs with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/jobs/*", createRegularUserAuthMiddleware());
    registerJobsRoutes(app, store);

    const res = await app.request("/api/jobs");
    expect(res.status).toBe(403);
  });

  test("POST /api/jobs/enqueue with non-superuser returns 403", async () => {
    const app = new Hono();
    app.use("/api/jobs/*", createRegularUserAuthMiddleware());
    registerJobsRoutes(app, store);

    const res = await app.request("/api/jobs/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "test" }),
    });
    expect(res.status).toBe(403);
  });
});
