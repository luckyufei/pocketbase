/**
 * Jobs 插件完整单测
 * 对照 Go 版 plugins/jobs/ 的测试覆盖
 *
 * 覆盖：defaultConfig、applyEnvOverrides、enqueue（校验/延时/Payload）、
 *       get/list/stats/delete/requeue、register（重复注册保护）、
 *       Dispatcher（执行/重试/指数退避/panic 恢复/锁超时恢复）
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  MemoryJobsStore,
  ErrJobNotFound,
  ErrJobTopicEmpty,
  ErrJobPayloadTooLarge,
  ErrJobTopicAlreadyRegistered,
  ErrJobCannotDelete,
  ErrJobCannotRequeue,
  type Job,
  type JobsConfig,
} from "./register";

// ═════════════════════════════════════════════════════════════════════════════
// defaultConfig
// ═════════════════════════════════════════════════════════════════════════════

describe("defaultConfig", () => {
  test("返回正确默认值", () => {
    const c = defaultConfig();
    expect(c.enabled).toBe(false);
    expect(c.workers).toBe(10);
    expect(c.pollInterval).toBe(1);
    expect(c.lockDuration).toBe(300);
    expect(c.batchSize).toBe(10);
    expect(c.defaultMaxRetries).toBe(3);
    expect(c.httpEnabled).toBe(true);
    expect(c.allowedTopics).toEqual([]);
    expect(c.autoStart).toBe(true);
  });

  test("每次返回新对象", () => {
    expect(defaultConfig()).not.toBe(defaultConfig());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// applyEnvOverrides
// ═════════════════════════════════════════════════════════════════════════════

describe("applyEnvOverrides", () => {
  const base = defaultConfig();

  test("无环境变量时原样返回", () => {
    const c = applyEnvOverrides({ ...base });
    expect(c.workers).toBe(10);
    expect(c.pollInterval).toBe(1);
  });

  test("PB_JOBS_WORKERS 覆盖 workers", () => {
    process.env["PB_JOBS_WORKERS"] = "20";
    const c = applyEnvOverrides({ ...base });
    expect(c.workers).toBe(20);
    delete process.env["PB_JOBS_WORKERS"];
  });

  test("PB_JOBS_POLL_INTERVAL 覆盖 pollInterval", () => {
    process.env["PB_JOBS_POLL_INTERVAL"] = "5";
    const c = applyEnvOverrides({ ...base });
    expect(c.pollInterval).toBe(5);
    delete process.env["PB_JOBS_POLL_INTERVAL"];
  });

  test("PB_JOBS_BATCH_SIZE 覆盖 batchSize", () => {
    process.env["PB_JOBS_BATCH_SIZE"] = "50";
    const c = applyEnvOverrides({ ...base });
    expect(c.batchSize).toBe(50);
    delete process.env["PB_JOBS_BATCH_SIZE"];
  });

  test("PB_JOBS_HTTP_ENABLED=false 禁用 HTTP", () => {
    process.env["PB_JOBS_HTTP_ENABLED"] = "false";
    const c = applyEnvOverrides({ ...base });
    expect(c.httpEnabled).toBe(false);
    delete process.env["PB_JOBS_HTTP_ENABLED"];
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MustRegister
// ═════════════════════════════════════════════════════════════════════════════

describe("MustRegister", () => {
  test("返回 MemoryJobsStore 实例", () => {
    const s = MustRegister(null, { enabled: true });
    expect(s).toBeInstanceOf(MemoryJobsStore);
  });

  test("默认配置不抛错", () => {
    expect(() => MustRegister(null)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// enqueue — 基础
// ═════════════════════════════════════════════════════════════════════════════

describe("enqueue — 基础", () => {
  let store: MemoryJobsStore;

  beforeEach(() => {
    store = new MemoryJobsStore({ enabled: true });
  });

  test("返回完整 Job 对象", async () => {
    const job = await store.enqueue("email.send", { to: "a@b.com" });
    expect(job.id).toBeDefined();
    expect(job.topic).toBe("email.send");
    expect(job.status).toBe("pending");
    expect(job.retries).toBe(0);
    expect(job.lastError).toBe("");
    expect(job.lockedUntil).toBeNull();
    expect(job.created).toBeInstanceOf(Date);
    expect(job.updated).toBeInstanceOf(Date);
  });

  test("无 payload 时 payload = null", async () => {
    const job = await store.enqueue("test");
    expect(job.payload).toBeNull();
  });

  test("自定义 runAt（延时任务）", async () => {
    const runAt = new Date(Date.now() + 60_000);
    const job = await store.enqueue("delayed", null, { runAt });
    expect(job.runAt.getTime()).toBe(runAt.getTime());
  });

  test("自定义 maxRetries", async () => {
    const job = await store.enqueue("test", null, { maxRetries: 10 });
    expect(job.maxRetries).toBe(10);
  });

  test("使用 config.defaultMaxRetries", async () => {
    const s2 = new MemoryJobsStore({ enabled: true, defaultMaxRetries: 7 });
    const job = await s2.enqueue("test");
    expect(job.maxRetries).toBe(7);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// enqueue — 校验
// ═════════════════════════════════════════════════════════════════════════════

describe("enqueue — 校验", () => {
  let store: MemoryJobsStore;

  beforeEach(() => {
    store = new MemoryJobsStore({ enabled: true });
  });

  test("topic 为空 → ErrJobTopicEmpty", async () => {
    await expect(store.enqueue("")).rejects.toBe(ErrJobTopicEmpty);
  });

  test("Payload 超过 1MB → ErrJobPayloadTooLarge", async () => {
    const bigPayload = { data: "x".repeat(1 << 20 + 1) };
    await expect(store.enqueue("test", bigPayload)).rejects.toBe(ErrJobPayloadTooLarge);
  });

  test("topic 不在白名单 → 抛错", async () => {
    const s2 = new MemoryJobsStore({ enabled: true, allowedTopics: ["email.send"] });
    await expect(s2.enqueue("hacking")).rejects.toThrow("不在白名单中");
  });

  test("topic 在白名单 → 成功", async () => {
    const s2 = new MemoryJobsStore({ enabled: true, allowedTopics: ["email.send"] });
    const job = await s2.enqueue("email.send");
    expect(job.id).toBeDefined();
  });

  test("空白名单允许所有 topic", async () => {
    const job = await store.enqueue("any.topic");
    expect(job.id).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// get
// ═════════════════════════════════════════════════════════════════════════════

describe("get", () => {
  let store: MemoryJobsStore;

  beforeEach(() => {
    store = new MemoryJobsStore({ enabled: true });
  });

  test("获取已有 job", async () => {
    const j = await store.enqueue("test");
    const got = await store.get(j.id);
    expect(got.id).toBe(j.id);
  });

  test("不存在 → ErrJobNotFound", async () => {
    await expect(store.get("nonexistent")).rejects.toBe(ErrJobNotFound);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// list
// ═════════════════════════════════════════════════════════════════════════════

describe("list", () => {
  let store: MemoryJobsStore;

  beforeEach(async () => {
    store = new MemoryJobsStore({ enabled: true });
    await store.enqueue("email.send");
    await store.enqueue("sms.send");
    await store.enqueue("email.send");
  });

  test("默认列出全部（按 created 降序）", async () => {
    const r = await store.list();
    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(3);
  });

  test("返回 total / limit / offset 字段", async () => {
    const r = await store.list({ limit: 2 });
    expect(r.total).toBe(3);
    expect(r.limit).toBe(2);
    expect(r.offset).toBe(0);
  });

  test("按 topic 过滤", async () => {
    const r = await store.list({ topic: "email.send" });
    expect(r.items).toHaveLength(2);
    expect(r.items.every((j) => j.topic === "email.send")).toBe(true);
  });

  test("按 status 过滤", async () => {
    const r = await store.list({ status: "pending" });
    expect(r.items).toHaveLength(3);
    const rc = await store.list({ status: "completed" });
    expect(rc.items).toHaveLength(0);
  });

  test("分页 limit + offset", async () => {
    const p1 = await store.list({ limit: 2, offset: 0 });
    const p2 = await store.list({ limit: 2, offset: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p2.items).toHaveLength(1);
    // 两页不重叠
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// stats
// ═════════════════════════════════════════════════════════════════════════════

describe("stats", () => {
  test("空队列返回全 0", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    const s = await store.stats();
    expect(s.pending).toBe(0);
    expect(s.completed).toBe(0);
    expect(s.failed).toBe(0);
    expect(s.total).toBe(0);
    expect(s.successRate).toBe(0);
  });

  test("多状态统计 + successRate", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    const j1 = await store.enqueue("test");
    const j2 = await store.enqueue("test");
    const j3 = await store.enqueue("test");
    // 直接修改状态
    (await store.get(j2.id) as any).status = "completed";
    (await store.get(j3.id) as any).status = "failed";

    const s = await store.stats();
    expect(s.pending).toBe(1);
    expect(s.completed).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.total).toBe(3);
    expect(s.successRate).toBe(0.5);
  });

  test("全部成功时 successRate = 1", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    const j = await store.enqueue("test");
    (await store.get(j.id) as any).status = "completed";
    const s = await store.stats();
    expect(s.successRate).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// delete
// ═════════════════════════════════════════════════════════════════════════════

describe("delete", () => {
  let store: MemoryJobsStore;

  beforeEach(() => {
    store = new MemoryJobsStore({ enabled: true });
  });

  test("删除 pending job", async () => {
    const j = await store.enqueue("test");
    await store.delete(j.id);
    await expect(store.get(j.id)).rejects.toBe(ErrJobNotFound);
  });

  test("删除 failed job", async () => {
    const j = await store.enqueue("test");
    (await store.get(j.id) as any).status = "failed";
    await store.delete(j.id);
    await expect(store.get(j.id)).rejects.toBe(ErrJobNotFound);
  });

  test("processing job → ErrJobCannotDelete", async () => {
    const j = await store.enqueue("test");
    (await store.get(j.id) as any).status = "processing";
    await expect(store.delete(j.id)).rejects.toBe(ErrJobCannotDelete);
  });

  test("completed job → ErrJobCannotDelete", async () => {
    const j = await store.enqueue("test");
    (await store.get(j.id) as any).status = "completed";
    await expect(store.delete(j.id)).rejects.toBe(ErrJobCannotDelete);
  });

  test("不存在的 id → ErrJobNotFound", async () => {
    await expect(store.delete("ghost")).rejects.toBe(ErrJobNotFound);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// requeue
// ═════════════════════════════════════════════════════════════════════════════

describe("requeue", () => {
  let store: MemoryJobsStore;

  beforeEach(() => {
    store = new MemoryJobsStore({ enabled: true });
  });

  test("failed → pending，重置 retries/lastError/runAt", async () => {
    const j = await store.enqueue("test");
    const stored = await store.get(j.id);
    (stored as any).status = "failed";
    (stored as any).retries = 3;
    (stored as any).lastError = "timeout";

    const rj = await store.requeue(j.id);
    expect(rj.status).toBe("pending");
    expect(rj.retries).toBe(0);
    expect(rj.lastError).toBe("");
    expect(rj.lockedUntil).toBeNull();
  });

  test("pending → ErrJobCannotRequeue", async () => {
    const j = await store.enqueue("test");
    await expect(store.requeue(j.id)).rejects.toBe(ErrJobCannotRequeue);
  });

  test("processing → ErrJobCannotRequeue", async () => {
    const j = await store.enqueue("test");
    (await store.get(j.id) as any).status = "processing";
    await expect(store.requeue(j.id)).rejects.toBe(ErrJobCannotRequeue);
  });

  test("不存在 → ErrJobNotFound", async () => {
    await expect(store.requeue("ghost")).rejects.toBe(ErrJobNotFound);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// register
// ═════════════════════════════════════════════════════════════════════════════

describe("register", () => {
  test("注册 handler 成功", () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.register("email.send", async () => {});
    expect(store.getRegisteredTopics()).toContain("email.send");
  });

  test("重复注册同一 topic → ErrJobTopicAlreadyRegistered", () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.register("test", async () => {});
    expect(() => store.register("test", async () => {})).toThrow(ErrJobTopicAlreadyRegistered);
  });

  test("不同 topic 各自注册成功", () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.register("a", async () => {});
    store.register("b", async () => {});
    const topics = store.getRegisteredTopics().sort();
    expect(topics).toEqual(["a", "b"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// start / stop
// ═════════════════════════════════════════════════════════════════════════════

describe("start / stop", () => {
  test("start 后 isRunning = true", () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.start();
    expect(store.isRunning()).toBe(true);
    store.stop();
  });

  test("stop 后 isRunning = false", () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.start();
    store.stop();
    expect(store.isRunning()).toBe(false);
  });

  test("重复 start 不报错", () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.start();
    store.start(); // 幂等
    expect(store.isRunning()).toBe(true);
    store.stop();
  });

  test("未 start 时 stop 不报错", () => {
    const store = new MemoryJobsStore({ enabled: true });
    expect(() => store.stop()).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// fetchAndLock — Dispatcher 内部逻辑
// ═════════════════════════════════════════════════════════════════════════════

describe("fetchAndLock", () => {
  test("只拾取 pending + runAt <= now 的任务", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.register("t", async () => {});

    await store.enqueue("t");  // 立即
    const future = new Date(Date.now() + 60_000);
    await store.enqueue("t", null, { runAt: future }); // 未来

    const locked = store.fetchAndLock(["t"], 10, 300_000);
    expect(locked).toHaveLength(1);
    expect(locked[0].status).toBe("processing");
    expect(locked[0].lockedUntil).not.toBeNull();
  });

  test("未注册的 topic 不拾取", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    await store.enqueue("unlisted");
    const locked = store.fetchAndLock(["registered"], 10, 300_000);
    expect(locked).toHaveLength(0);
  });

  test("锁超时的 processing 任务被重新拾取", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.register("t", async () => {});
    const j = await store.enqueue("t");
    // 模拟 processing + 锁已过期
    const stored = await store.get(j.id);
    (stored as any).status = "processing";
    (stored as any).lockedUntil = new Date(Date.now() - 1000);

    const locked = store.fetchAndLock(["t"], 10, 300_000);
    expect(locked).toHaveLength(1);
  });

  test("batchSize 限制", async () => {
    const store = new MemoryJobsStore({ enabled: true });
    store.register("t", async () => {});
    for (let i = 0; i < 5; i++) await store.enqueue("t");
    const locked = store.fetchAndLock(["t"], 3, 300_000);
    expect(locked).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Dispatcher 执行逻辑（通过 handleSuccess/handleFailure）
// ═════════════════════════════════════════════════════════════════════════════

describe("handleSuccess / handleFailure", () => {
  let store: MemoryJobsStore;

  beforeEach(() => {
    store = new MemoryJobsStore({ enabled: true });
  });

  test("handleSuccess → status=completed", async () => {
    const j = await store.enqueue("test");
    store.handleSuccess(j);
    const got = await store.get(j.id);
    expect(got.status).toBe("completed");
    expect(got.lockedUntil).toBeNull();
  });

  test("handleFailure (retries < maxRetries) → pending + 指数退避", async () => {
    const j = await store.enqueue("test", null, { maxRetries: 3 });
    const stored = await store.get(j.id);
    (stored as any).status = "processing";
    (stored as any).retries = 0;

    store.handleFailure(stored, new Error("network timeout"), 300_000);

    const got = await store.get(j.id);
    expect(got.status).toBe("pending");
    expect(got.retries).toBe(1);
    expect(got.lastError).toBe("network timeout");
    // 下次 runAt 在未来（退避 1² = 1 分钟）
    expect(got.runAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("handleFailure (retries >= maxRetries) → failed（死信）", async () => {
    const j = await store.enqueue("test", null, { maxRetries: 2 });
    const stored = await store.get(j.id);
    (stored as any).status = "processing";
    (stored as any).retries = 1; // 已重试 1 次，下次就是第 2 次 = maxRetries

    store.handleFailure(stored, new Error("permanent error"), 300_000);

    const got = await store.get(j.id);
    expect(got.status).toBe("failed");
    expect(got.lastError).toBe("permanent error");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 端到端：Dispatcher 实际执行任务
// ═════════════════════════════════════════════════════════════════════════════

describe("Dispatcher 端到端", () => {
  afterEach(() => {});

  test("注册 handler 后 start，任务被执行并 completed", async () => {
    const store = new MemoryJobsStore({
      enabled: true,
      pollInterval: 0.1,     // 100ms
      workers: 5,
      defaultMaxRetries: 1,
    });

    let executed = false;
    store.register("test.run", async (_job) => {
      executed = true;
    });

    const j = await store.enqueue("test.run");
    store.start();

    await Bun.sleep(400); // 等 4 个轮询周期
    store.stop();

    const got = await store.get(j.id);
    expect(executed).toBe(true);
    expect(got.status).toBe("completed");
  }, 3000);

  test("handler 抛错时任务按重试逻辑处理", async () => {
    const store = new MemoryJobsStore({
      enabled: true,
      pollInterval: 0.1,
      workers: 5,
      defaultMaxRetries: 1, // 0 次重试机会（retries+1 < 1 = false）
    });

    store.register("test.fail", async () => {
      throw new Error("intentional error");
    });

    const j = await store.enqueue("test.fail");
    store.start();
    await Bun.sleep(400);
    store.stop();

    const got = await store.get(j.id);
    // maxRetries=1，retries=0 → retries+1=1 < 1 false → 直接 failed
    expect(got.status).toBe("failed");
    expect(got.lastError).toBe("intentional error");
  }, 3000);

  test("handler panic (throw non-Error) 被安全捕获", async () => {
    const store = new MemoryJobsStore({
      enabled: true,
      pollInterval: 0.1,
      workers: 1,
      defaultMaxRetries: 1,
    });

    store.register("test.panic", async () => {
      throw "panic string"; // 非 Error 对象
    });

    const j = await store.enqueue("test.panic");
    store.start();
    await Bun.sleep(400);
    store.stop();

    const got = await store.get(j.id);
    expect(got.status).toBe("failed");
    expect(got.lastError).toBe("panic string");
  }, 3000);
});
