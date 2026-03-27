/**
 * Phase 2 — 数据库持久化集成测试
 * 使用 SQLite 内存数据库（:memory:）隔离测试
 *
 * 覆盖：
 *  - Trace（DBTracer）
 *  - Metrics（DBMetricsCollector）
 *  - Jobs（DBJobsStore）
 *  - KV（DBKVStore）
 *  - Secrets（DBSecretsStore）
 *  - Analytics（DBAnalytics）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { getSystemMigrations } from "../migrations";

// ─── 辅助：创建内存 DB 并执行插件迁移 ─────────────────────────────────────

function makeTestDB(): SQLiteAdapter {
  const db = new SQLiteAdapter(":memory:");
  const migrations = getSystemMigrations();
  for (const m of migrations) {
    try { m.up(db, db); } catch { /* 忽略已存在表 */ }
  }
  return db;
}

// ─── Trace — DBTracer ──────────────────────────────────────────────────────

import {
  DBTracer,
  MustRegister as TraceMustRegister,
  type TraceConfig,
  type Span,
} from "./trace/register";

function makeTraceDB() { return makeTestDB(); }

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    id: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    spanId: crypto.randomUUID().slice(0, 16),
    parentId: "",
    name: "test-span",
    kind: "server",
    startTime: Date.now(),
    duration: 100,
    status: "ok",
    attributes: { key: "value" },
    ...overrides,
  };
}

describe("DBTracer", () => {
  let db: SQLiteAdapter;
  let tracer: DBTracer;

  beforeEach(() => {
    db = makeTraceDB();
    tracer = new DBTracer({ mode: "full", batchSize: 10 }, db);
  });

  test("recordSpan + flush 写入 DB", async () => {
    const span = makeSpan();
    tracer.recordSpan(span);
    await tracer.flush();

    const stored = tracer.getSpansByTraceId(span.traceId);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("test-span");
  });

  test("flush 后 buffer 清空", async () => {
    tracer.recordSpan(makeSpan());
    expect(tracer.bufferLen()).toBe(1);
    await tracer.flush();
    expect(tracer.bufferLen()).toBe(0);
  });

  test("getSpansByTraceId 按 traceId 过滤", async () => {
    const traceId = crypto.randomUUID();
    tracer.recordSpan(makeSpan({ traceId }));
    tracer.recordSpan(makeSpan({ traceId }));
    tracer.recordSpan(makeSpan()); // 不同 traceId
    await tracer.flush();

    const spans = tracer.getSpansByTraceId(traceId);
    expect(spans).toHaveLength(2);
    expect(spans.every(s => s.traceId === traceId)).toBe(true);
  });

  test("listSpans 返回最近 N 条", async () => {
    for (let i = 0; i < 5; i++) tracer.recordSpan(makeSpan({ name: `span-${i}` }));
    await tracer.flush();

    const list = tracer.listSpans({ limit: 3 });
    expect(list).toHaveLength(3);
  });

  test("listSpans 按 status 过滤", async () => {
    tracer.recordSpan(makeSpan({ status: "ok" }));
    tracer.recordSpan(makeSpan({ status: "error" }));
    tracer.recordSpan(makeSpan({ status: "error" }));
    await tracer.flush();

    const errors = tracer.listSpans({ status: "error" });
    expect(errors).toHaveLength(2);
    expect(errors.every(s => s.status === "error")).toBe(true);
  });

  test("deleteByTraceId 删除指定 traceId", async () => {
    const traceId = crypto.randomUUID();
    tracer.recordSpan(makeSpan({ traceId }));
    tracer.recordSpan(makeSpan()); // 保留
    await tracer.flush();

    tracer.deleteByTraceId(traceId);
    expect(tracer.getSpansByTraceId(traceId)).toHaveLength(0);
    expect(tracer.listSpans({ limit: 100 })).toHaveLength(1);
  });

  test("attributes 序列化/反序列化", async () => {
    const attrs = { url: "/api/test", method: "GET", status: 200 };
    tracer.recordSpan(makeSpan({ attributes: attrs }));
    await tracer.flush();

    const stored = tracer.listSpans({ limit: 1 });
    expect(stored[0].attributes).toEqual(attrs);
  });

  test("pruneOldSpans 删除过期 Span", async () => {
    tracer.recordSpan(makeSpan());
    await tracer.flush();

    // 设置过期时间为 -1 天（立即过期）
    const deleted = tracer.pruneOldSpans(-1); // retentionDays = -1
    expect(deleted).toBe(1);
    expect(tracer.listSpans({ limit: 100 })).toHaveLength(0);
  });

  test("pruneOldSpans 保留未过期 Span", async () => {
    tracer.recordSpan(makeSpan());
    await tracer.flush();

    const deleted = tracer.pruneOldSpans(999); // 999 天后才过期
    expect(deleted).toBe(0);
    expect(tracer.listSpans({ limit: 100 })).toHaveLength(1);
  });

  test("MustRegister with db 返回 DBTracer", () => {
    const t = TraceMustRegister(null, { mode: "full" }, makeTraceDB());
    expect(t).toBeInstanceOf(DBTracer);
  });

  test("MustRegister without db 返回 MemoryTracer", () => {
    const t = TraceMustRegister(null, { mode: "full" });
    expect(t).not.toBeInstanceOf(DBTracer);
  });

  test("mode=off 始终返回 NoopTracer", () => {
    const t = TraceMustRegister(null, { mode: "off" }, makeTraceDB());
    expect(t.isEnabled()).toBe(false);
  });

  test("重复 flush 不报错（INSERT OR IGNORE）", async () => {
    const span = makeSpan();
    // 手动写入两次同一个 span
    (tracer as unknown as { _saveSpans: (s: Span[]) => void })._saveSpans([span]);
    expect(() => {
      (tracer as unknown as { _saveSpans: (s: Span[]) => void })._saveSpans([span]);
    }).not.toThrow();
  });
});

// ─── Metrics — DBMetricsCollector ─────────────────────────────────────────

import {
  DBMetricsCollector,
  MustRegister as MetricsMustRegister,
  type MetricsConfig,
} from "./metrics/register";

describe("DBMetricsCollector", () => {
  let db: SQLiteAdapter;
  let collector: DBMetricsCollector;

  beforeEach(() => {
    db = makeTestDB();
    collector = new DBMetricsCollector(
      { enabled: true, interval: 999, retentionDays: 7 },
      db,
    );
  });

  test("saveSnapshot 写入 DB，getLatest 可读回", async () => {
    const snap = collector.getCurrentSnapshot();
    collector.saveSnapshot(snap);

    const latest = await collector.getLatest();
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(snap.id);
  });

  test("getHistory 按时间范围查询", async () => {
    collector.saveSnapshot(collector.getCurrentSnapshot());
    collector.saveSnapshot(collector.getCurrentSnapshot());

    const history = await collector.getHistory(24);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  test("getHistory 无数据返回空数组", async () => {
    const history = await collector.getHistory(24);
    expect(history).toHaveLength(0);
  });

  test("pruneOldMetrics 删除过期记录", async () => {
    collector.saveSnapshot(collector.getCurrentSnapshot());
    const deleted = collector.pruneOldMetrics(-1); // 立即过期
    expect(deleted).toBe(1);
  });

  test("pruneOldMetrics 保留未过期记录", async () => {
    collector.saveSnapshot(collector.getCurrentSnapshot());
    const deleted = collector.pruneOldMetrics(999);
    expect(deleted).toBe(0);
  });

  test("saveSnapshot 包含所有字段", async () => {
    collector.recordLatency(200);
    collector.record5xx();
    const snap = collector.getCurrentSnapshot();
    collector.saveSnapshot(snap);

    const latest = await collector.getLatest();
    expect(latest?.p95LatencyMs).toBeDefined();
    expect(latest?.memoryAllocMb).toBeGreaterThan(0);
  });

  test("MustRegister with db 返回 DBMetricsCollector", () => {
    const c = MetricsMustRegister(null, { enabled: true }, makeTestDB());
    expect(c).toBeInstanceOf(DBMetricsCollector);
  });

  test("MustRegister without db 返回 MemoryMetricsCollector", () => {
    const c = MetricsMustRegister(null, { enabled: true });
    expect(c).not.toBeInstanceOf(DBMetricsCollector);
  });

  test("重复写入同一 id 不报错（INSERT OR IGNORE）", () => {
    const snap = collector.getCurrentSnapshot();
    expect(() => {
      collector.saveSnapshot(snap);
      collector.saveSnapshot(snap);
    }).not.toThrow();
  });
});

// ─── Jobs — DBJobsStore ───────────────────────────────────────────────────

import {
  DBJobsStore,
  MustRegister as JobsMustRegister,
  ErrJobNotFound,
  ErrJobCannotDelete,
  ErrJobCannotRequeue,
  type JobsConfig,
} from "./jobs/register";

function makeJobsDB() { return makeTestDB(); }

describe("DBJobsStore", () => {
  let db: SQLiteAdapter;
  let store: DBJobsStore;

  beforeEach(() => {
    db = makeJobsDB();
    store = new DBJobsStore(
      { enabled: true, workers: 1, pollInterval: 999, autoStart: false },
      db,
    );
  });

  test("enqueue 写入 DB，get 可读回", async () => {
    const job = await store.enqueue("email", { to: "test@example.com" });
    const loaded = await store.get(job.id);
    expect(loaded.id).toBe(job.id);
    expect(loaded.topic).toBe("email");
    expect(loaded.status).toBe("pending");
  });

  test("enqueue payload 序列化/反序列化", async () => {
    const payload = { items: [1, 2, 3], nested: { a: true } };
    const job = await store.enqueue("task", payload);
    const loaded = await store.get(job.id);
    expect(loaded.payload).toEqual(payload);
  });

  test("enqueue 空 topic 抛错", async () => {
    await expect(store.enqueue("")).rejects.toThrow();
  });

  test("get 不存在的 id 抛 ErrJobNotFound", async () => {
    await expect(store.get("nonexistent")).rejects.toBe(ErrJobNotFound);
  });

  test("list 全量查询", async () => {
    await store.enqueue("a");
    await store.enqueue("b");
    const result = await store.list();
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });

  test("list 按 topic 过滤", async () => {
    await store.enqueue("email");
    await store.enqueue("sms");
    const result = await store.list({ topic: "email" });
    expect(result.items.every(j => j.topic === "email")).toBe(true);
  });

  test("list 按 status 过滤", async () => {
    await store.enqueue("a");
    const result = await store.list({ status: "pending" });
    expect(result.items.every(j => j.status === "pending")).toBe(true);
  });

  test("list 分页", async () => {
    for (let i = 0; i < 5; i++) await store.enqueue("a");
    const result = await store.list({ limit: 2, offset: 0 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  test("stats 统计各状态数量", async () => {
    await store.enqueue("a");
    await store.enqueue("b");
    const s = await store.stats();
    expect(s.pending).toBe(2);
    expect(s.total).toBe(2);
    expect(s.successRate).toBe(0);
  });

  test("delete pending 任务成功", async () => {
    const job = await store.enqueue("a");
    await store.delete(job.id);
    await expect(store.get(job.id)).rejects.toBe(ErrJobNotFound);
  });

  test("delete 不存在的任务抛错", async () => {
    await expect(store.delete("nonexistent")).rejects.toBe(ErrJobNotFound);
  });

  test("delete processing 任务抛 ErrJobCannotDelete", async () => {
    const job = await store.enqueue("a");
    // 手动设置为 processing
    db.exec(`UPDATE _jobs SET status='processing' WHERE id=?`, job.id);
    await expect(store.delete(job.id)).rejects.toBe(ErrJobCannotDelete);
  });

  test("requeue failed 任务恢复为 pending", async () => {
    const job = await store.enqueue("a");
    db.exec(`UPDATE _jobs SET status='failed' WHERE id=?`, job.id);
    const requeued = await store.requeue(job.id);
    expect(requeued.status).toBe("pending");
    expect(requeued.retries).toBe(0);
  });

  test("requeue pending 任务抛 ErrJobCannotRequeue", async () => {
    const job = await store.enqueue("a");
    await expect(store.requeue(job.id)).rejects.toBe(ErrJobCannotRequeue);
  });

  test("handleSuccess 更新状态为 completed", async () => {
    const job = await store.enqueue("a");
    store.handleSuccess(job);
    const loaded = await store.get(job.id);
    expect(loaded.status).toBe("completed");
  });

  test("handleFailure 未超过重试次数 → pending + backoff", async () => {
    const job = await store.enqueue("a", null, { maxRetries: 3 });
    store.handleFailure(job, new Error("boom"), 0);
    const loaded = await store.get(job.id);
    expect(loaded.status).toBe("pending");
    expect(loaded.retries).toBe(1);
    expect(loaded.lastError).toBe("boom");
  });

  test("handleFailure 超过重试次数 → failed + 死信队列", async () => {
    const job = await store.enqueue("a", null, { maxRetries: 1 });
    store.handleFailure(job, new Error("too many"), 0);
    const loaded = await store.get(job.id);
    expect(loaded.status).toBe("failed");
    // 验证死信队列有记录
    const dl = db.queryOne<{ jobId: string }>(
      `SELECT jobId FROM _jobs_deadletter WHERE jobId=?`, job.id,
    );
    expect(dl).not.toBeNull();
  });

  test("fetchAndLock 锁定 pending 任务", async () => {
    store.register("email", async () => {});
    await store.enqueue("email");
    const jobs = store.fetchAndLock(["email"], 10, 60000);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("processing");
  });

  test("fetchAndLock 不拾取 locked 任务", async () => {
    store.register("email", async () => {});
    await store.enqueue("email");
    store.fetchAndLock(["email"], 10, 60000); // 第一次锁定
    const second = store.fetchAndLock(["email"], 10, 60000); // 第二次
    expect(second).toHaveLength(0); // 已锁定
  });

  test("pruneCompleted 清理已完成任务", async () => {
    const job = await store.enqueue("a");
    store.handleSuccess(job);
    const deleted = store.pruneCompleted(-1); // 立即过期
    expect(deleted).toBe(1);
  });

  test("崩溃恢复：stuck processing 任务恢复为 pending", async () => {
    await store.enqueue("a");
    // 模拟崩溃：直接设置为 processing + 过期的 lockedUntil
    db.exec(
      `UPDATE _jobs SET status='processing', lockedUntil='2000-01-01 00:00:00.000Z'`,
    );
    // 重建 store（模拟重启）
    const newStore = new DBJobsStore({ enabled: true, autoStart: false }, db);
    const result = await newStore.list({ status: "pending" });
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("MustRegister with db 返回 DBJobsStore", () => {
    const s = JobsMustRegister(null, { enabled: true }, makeJobsDB());
    expect(s).toBeInstanceOf(DBJobsStore);
  });

  test("MustRegister without db 返回 MemoryJobsStore", () => {
    const s = JobsMustRegister(null, { enabled: true });
    expect(s).not.toBeInstanceOf(DBJobsStore);
  });
});

// ─── KV — DBKVStore ──────────────────────────────────────────────────────

import {
  DBKVStore,
  MustRegister as KVMustRegister,
  type KVConfig,
} from "./kv/register";

function makeKVDB() { return makeTestDB(); }

describe("DBKVStore", () => {
  let db: SQLiteAdapter;
  let kv: DBKVStore;

  beforeEach(() => {
    db = makeKVDB();
    kv = new DBKVStore({ enabled: true, cleanupInterval: 9999 }, db);
    kv.stopCleanup(); // 测试中不需要后台清理
  });

  test("set + get 基础操作", async () => {
    await kv.set("name", "alice");
    expect(await kv.get("name")).toBe("alice");
  });

  test("get 不存在的 key 返回 null", async () => {
    expect(await kv.get("missing")).toBeNull();
  });

  test("L2 持久化：L1 清空后仍可读取", async () => {
    await kv.set("persist_key", "hello");
    // 绕过 L1，直接查 DB
    const row = db.queryOne<{ value: string }>(
      `SELECT value FROM _kv WHERE key = ?`, "persist_key",
    );
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.value)).toBe("hello");
  });

  test("delete 同步删除 L1 和 L2", async () => {
    await kv.set("del_key", 42);
    await kv.delete("del_key");
    expect(await kv.get("del_key")).toBeNull();
    const row = db.queryOne(`SELECT key FROM _kv WHERE key = ?`, "del_key");
    expect(row).toBeNull();
  });

  test("exists 正确判断存在/不存在", async () => {
    await kv.set("ex", 1);
    expect(await kv.exists("ex")).toBe(true);
    expect(await kv.exists("noex")).toBe(false);
  });

  test("ttl 有 TTL key 返回正数", async () => {
    await kv.set("ttlkey", "v", 10);
    const remaining = await kv.ttl("ttlkey");
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(10);
  });

  test("ttl 无 TTL key 返回 -1", async () => {
    await kv.set("forever", "v");
    expect(await kv.ttl("forever")).toBe(-1);
  });

  test("ttl 不存在的 key 返回 -2", async () => {
    expect(await kv.ttl("missing")).toBe(-2);
  });

  test("incr / decr", async () => {
    expect(await kv.incr("counter")).toBe(1);
    expect(await kv.incr("counter")).toBe(2);
    expect(await kv.decr("counter")).toBe(1);
  });

  test("incrBy 自定义步长", async () => {
    await kv.set("cnt", 10);
    expect(await kv.incrBy("cnt", 5)).toBe(15);
  });

  test("hset + hget + hgetAll", async () => {
    await kv.hset("user:1", "name", "bob");
    await kv.hset("user:1", "age", 25);
    expect(await kv.hget("user:1", "name")).toBe("bob");
    const all = await kv.hgetAll("user:1");
    expect(all.name).toBe("bob");
    expect(all.age).toBe(25);
  });

  test("hdel 删除 hash 字段", async () => {
    await kv.hset("h", "f1", "v1");
    await kv.hset("h", "f2", "v2");
    await kv.hdel("h", "f1");
    expect(await kv.hget("h", "f1")).toBeNull();
    expect(await kv.hget("h", "f2")).toBe("v2");
  });

  test("hincrBy hash 字段计数", async () => {
    await kv.hset("stats", "views", 0);
    expect(await kv.hincrBy("stats", "views", 10)).toBe(10);
    expect(await kv.hincrBy("stats", "views", 5)).toBe(15);
  });

  test("lock + unlock", async () => {
    const got = await kv.lock("resource", 10);
    expect(got).toBe(true);
    // 锁定期间不能再次获取
    const blocked = await kv.lock("resource", 10);
    expect(blocked).toBe(false);
    // 解锁后可以获取
    await kv.unlock("resource");
    const got2 = await kv.lock("resource", 10);
    expect(got2).toBe(true);
  });

  test("mset + mget", async () => {
    await kv.mset({ a: 1, b: 2, c: 3 });
    const vals = await kv.mget(["a", "b", "c", "x"]);
    expect(vals).toEqual([1, 2, 3, null]);
  });

  test("keys 通配符匹配", async () => {
    await kv.set("user:1", "a");
    await kv.set("user:2", "b");
    await kv.set("post:1", "c");
    const userKeys = await kv.keys("user:*");
    expect(userKeys).toContain("user:1");
    expect(userKeys).toContain("user:2");
    expect(userKeys).not.toContain("post:1");
  });

  test("MustRegister with db 返回 DBKVStore", () => {
    const s = KVMustRegister(null, { enabled: true }, makeKVDB());
    expect(s).toBeInstanceOf(DBKVStore);
  });

  test("MustRegister without db 返回 MemoryKVStore", () => {
    const s = KVMustRegister(null, { enabled: true });
    expect(s).not.toBeInstanceOf(DBKVStore);
  });
});

// ─── Secrets — DBSecretsStore ─────────────────────────────────────────────

import {
  DBSecretsStore,
  MustRegister as SecretsMustRegister,
  type SecretsConfig,
} from "./secrets/register";

const TEST_MASTER_KEY = "a".repeat(32); // 32 字节

function makeSecretsDB() { return makeTestDB(); }

describe("DBSecretsStore", () => {
  let db: SQLiteAdapter;
  let store: DBSecretsStore;

  beforeEach(() => {
    db = makeSecretsDB();
    store = new DBSecretsStore(
      { enabled: true, masterKey: TEST_MASTER_KEY },
      db,
    );
  });

  test("set + get 往返", async () => {
    await store.set("db_url", "postgres://localhost/mydb");
    const val = await store.get("db_url");
    expect(val).toBe("postgres://localhost/mydb");
  });

  test("加密存储：DB 中是密文，不是明文", async () => {
    await store.set("password", "secret123");
    const row = db.queryOne<{ value: string }>(
      `SELECT value FROM _secrets WHERE key = ?`, "password",
    );
    expect(row?.value).not.toBe("secret123");
    expect(row?.value.length).toBeGreaterThan(10);
  });

  test("env 隔离：不同 env 存储不同值", async () => {
    await store.set("api_key", "prod-key", { env: "production" });
    await store.set("api_key", "dev-key", { env: "development" });
    expect(await store.get("api_key", "production")).toBe("prod-key");
    expect(await store.get("api_key", "development")).toBe("dev-key");
  });

  test("env 回退：指定 env 不存在时回退到 global", async () => {
    await store.set("shared", "global-value"); // 默认 env=global
    const val = await store.get("shared", "staging");
    expect(val).toBe("global-value");
  });

  test("get 不存在的 key 抛错", async () => {
    await expect(store.get("missing")).rejects.toThrow();
  });

  test("getWithDefault 不存在时返回默认值", async () => {
    const val = await store.getWithDefault("missing", "fallback");
    expect(val).toBe("fallback");
  });

  test("delete 删除指定 env 的密钥", async () => {
    await store.set("temp", "v", { env: "test" });
    await store.delete("temp", "test");
    expect(await store.exists("temp", "test")).toBe(false);
  });

  test("exists 正确判断", async () => {
    await store.set("ex", "v");
    expect(await store.exists("ex")).toBe(true);
    expect(await store.exists("noex")).toBe(false);
  });

  test("list 返回所有密钥（不含明文）", async () => {
    await store.set("k1", "v1");
    await store.set("k2", "v2", { env: "prod" });
    const all = await store.list();
    expect(all).toHaveLength(2);
    // 返回的是密文
    expect(all[0].value).not.toBe("v1");
  });

  test("list 按 env 过滤", async () => {
    await store.set("k1", "v1");
    await store.set("k2", "v2", { env: "prod" });
    const global = await store.list("global");
    expect(global).toHaveLength(1);
    expect(global[0].key).toBe("k1");
  });

  test("keys 去重并排序", async () => {
    await store.set("z", "v", { env: "a" });
    await store.set("z", "v2", { env: "b" });
    await store.set("a", "v3");
    const keys = await store.keys();
    expect(keys).toEqual(["a", "z"]);
  });

  test("description 字段持久化", async () => {
    await store.set("token", "abc", { description: "访问令牌" });
    const list = await store.list();
    expect(list[0].description).toBe("访问令牌");
  });

  test("更新时保留 id 和 created", async () => {
    await store.set("key1", "v1");
    const before = await store.list();
    await store.set("key1", "v2");
    const after = await store.list();
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].created).toBe(before[0].created);
  });

  test("MustRegister with db 返回 DBSecretsStore", () => {
    const s = SecretsMustRegister(null, { enabled: true, masterKey: TEST_MASTER_KEY }, makeSecretsDB());
    expect(s).toBeInstanceOf(DBSecretsStore);
  });

  test("MustRegister without db 返回 MemorySecretsStore", () => {
    const s = SecretsMustRegister(null, { enabled: true, masterKey: TEST_MASTER_KEY });
    expect(s).not.toBeInstanceOf(DBSecretsStore);
  });

  test("未启用时 set 抛错", async () => {
    const disabled = new DBSecretsStore({ enabled: false, masterKey: TEST_MASTER_KEY }, db);
    await expect(disabled.set("k", "v")).rejects.toThrow("未启用");
  });
});

// ─── Analytics — DBAnalytics ─────────────────────────────────────────────

import {
  DBAnalytics,
  MustRegister as AnalyticsMustRegister,
  type AnalyticsConfig,
  type EventInput,
} from "./analytics/register";

function makeAnalyticsDB() { return makeTestDB(); }

describe("DBAnalytics", () => {
  let db: SQLiteAdapter;
  let analytics: DBAnalytics;
  // 使用真实的当前日期，避免 retention 清理导致测试数据丢失
  const TODAY = new Date().toISOString().slice(0, 10);
  const YESTERDAY = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  beforeEach(() => {
    db = makeAnalyticsDB();
    analytics = new DBAnalytics(
      { mode: "full", enabled: true, retention: 90, flushInterval: 9999 },
      db,
    );
    analytics.stopAggregate();
  });

  function track(overrides: Partial<EventInput> = {}): void {
    analytics.track({
      name: "pageview",
      path: "/home",
      visitorId: "v1",
      duration: 1000,
      timestamp: new Date(TODAY).toISOString(),
      ...overrides,
    });
  }

  test("track + flush 写入 DB", async () => {
    track();
    await analytics.flush();
    const rows = db.query(`SELECT * FROM _events`);
    expect(rows).toHaveLength(1);
  });

  test("flush 后 buffer 清空", async () => {
    track();
    expect(analytics.bufferSize()).toBe(1);
    await analytics.flush();
    expect(analytics.bufferSize()).toBe(0);
  });

  test("getStats 查询 _events_daily", async () => {
    track({ visitorId: "v1" });
    track({ visitorId: "v2" });
    await analytics.flush(); // 写入 DB + 聚合

    const stats = await analytics.getStats(TODAY, TODAY);
    expect(stats.length).toBeGreaterThan(0);
    const home = stats.find(s => s.path === "/home");
    expect(home?.totalPV).toBe(2);
    expect(home?.totalUV).toBe(2);
  });

  test("getTopPages 按 PV 降序", async () => {
    track({ path: "/home" });
    track({ path: "/home" });
    track({ path: "/about" });
    await analytics.flush();

    const top = await analytics.getTopPages(TODAY, 10);
    expect(top[0].path).toBe("/home");
    expect(top[0].totalPV).toBe(2);
  });

  test("getTopSources 按来源统计", async () => {
    track({ source: "google", visitorId: "v1" });
    track({ source: "google", visitorId: "v2" });
    track({ source: "direct", visitorId: "v3" });
    await analytics.flush();

    const sources = await analytics.getTopSources(TODAY, 10);
    const google = sources.find(s => s.source === "google");
    expect(google?.visitors).toBeGreaterThanOrEqual(2);
  });

  test("getDeviceStats 按 browser + os 分组", async () => {
    track({ browser: "Chrome", os: "macOS", visitorId: "v1" });
    track({ browser: "Safari", os: "iOS", visitorId: "v2" });
    await analytics.flush();

    const devices = await analytics.getDeviceStats(TODAY);
    expect(devices.some(d => d.browser === "Chrome")).toBe(true);
  });

  test("UV 去重：同 visitorId 同路径只计一次", async () => {
    track({ visitorId: "same_user" });
    track({ visitorId: "same_user" });
    track({ visitorId: "same_user" });
    await analytics.flush();

    const stats = await analytics.getStats(TODAY, TODAY);
    const home = stats.find(s => s.path === "/home");
    expect(home?.totalPV).toBe(3);
    expect(home?.totalUV).toBe(1);
  });

  test("多天数据，getStats 跨天查询", async () => {
    analytics.track({ name: "pv", path: "/", timestamp: `${TODAY}T00:00:00Z` });
    analytics.track({ name: "pv", path: "/", timestamp: `${YESTERDAY}T00:00:00Z` });
    await analytics.flush();

    const stats = await analytics.getStats(YESTERDAY, TODAY);
    const dates = new Set(stats.map(s => s.date));
    expect(dates.has(TODAY)).toBe(true);
    expect(dates.has(YESTERDAY)).toBe(true);
  });

  test("pruneOldEvents：过期事件被删除", async () => {
    // 写入一条过期事件（直接插入）
    db.exec(
      `INSERT INTO _events (id, name, path, timestamp, created) VALUES (?, 'old', '/', '2000-01-01', '2000-01-01')`,
      crypto.randomUUID(),
    );
    // 触发清理
    (analytics as unknown as { _pruneOldEvents: () => void })._pruneOldEvents();
    const rows = db.query(`SELECT * FROM _events WHERE timestamp = '2000-01-01'`);
    expect(rows).toHaveLength(0);
  });

  test("isEnabled 返回 true", () => {
    expect(analytics.isEnabled()).toBe(true);
  });

  test("MustRegister with db 返回 DBAnalytics", () => {
    const a = AnalyticsMustRegister(null, { mode: "full", enabled: true, retention: 90 }, makeAnalyticsDB());
    expect(a).toBeInstanceOf(DBAnalytics);
  });

  test("MustRegister without db 返回 MemoryAnalytics", () => {
    const a = AnalyticsMustRegister(null, { mode: "full", enabled: true, retention: 90 });
    expect(a).not.toBeInstanceOf(DBAnalytics);
  });

  test("mode=off 始终返回 NoopAnalytics", () => {
    const a = AnalyticsMustRegister(null, { mode: "off", enabled: true, retention: 90 }, makeAnalyticsDB());
    expect(a.isEnabled()).toBe(false);
  });
});
