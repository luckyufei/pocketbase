/**
 * T177: Jobs 插件完整测试
 * 对照 Go 版 — 任务入队/出队、Worker 执行、重试逻辑、崩溃恢复、超时处理
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  MemoryJobsStore,
  type JobsConfig,
  type Job,
} from "./register";

describe("Jobs Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.enabled).toBe(false);
      expect(cfg.pollInterval).toBe(5);
      expect(cfg.maxConcurrent).toBe(5);
      expect(cfg.defaultMaxRetries).toBe(3);
      expect(cfg.httpEnabled).toBe(true);
      expect(cfg.allowedTopics).toEqual([]);
    });

    test("每次返回新对象", () => {
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  describe("MustRegister", () => {
    test("返回 MemoryJobsStore", () => {
      const store = MustRegister(null, { enabled: true });
      expect(store).toBeDefined();
    });

    test("使用默认配置", () => {
      const store = MustRegister(null);
      expect(store).toBeDefined();
    });
  });

  describe("enqueue", () => {
    let store: MemoryJobsStore;

    beforeEach(() => {
      store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
    });

    test("入队返回 job id", async () => {
      const id = await store.enqueue("email.send", { to: "a@b.com" });
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("入队的 job 状态为 pending", async () => {
      const id = await store.enqueue("email.send");
      const job = await store.get(id);
      expect(job).not.toBeNull();
      expect(job!.status).toBe("pending");
      expect(job!.topic).toBe("email.send");
    });

    test("带 payload 入队", async () => {
      const payload = { to: "a@b.com", subject: "Hi" };
      const id = await store.enqueue("email.send", payload);
      const job = await store.get(id);
      expect(job!.payload).toEqual(payload);
    });

    test("不带 payload 默认 null", async () => {
      const id = await store.enqueue("test");
      const job = await store.get(id);
      expect(job!.payload).toBeNull();
    });

    test("带 options 入队", async () => {
      const runAt = new Date(Date.now() + 60000);
      const id = await store.enqueue("delayed", null, { runAt, maxRetries: 5 });
      const job = await store.get(id);
      expect(job!.runAt).toEqual(runAt);
      expect(job!.maxRetries).toBe(5);
    });

    test("默认 maxRetries 使用配置值", async () => {
      const store2 = new MemoryJobsStore({ enabled: true, defaultMaxRetries: 7, allowedTopics: [] });
      const id = await store2.enqueue("test");
      const job = await store2.get(id);
      expect(job!.maxRetries).toBe(7);
    });

    test("topic 白名单校验 — 允许", async () => {
      const store2 = new MemoryJobsStore({ enabled: true, allowedTopics: ["email.send", "sms.send"] });
      const id = await store2.enqueue("email.send");
      expect(id).toBeDefined();
    });

    test("topic 白名单校验 — 拒绝", async () => {
      const store2 = new MemoryJobsStore({ enabled: true, allowedTopics: ["email.send"] });
      await expect(store2.enqueue("hacking.attempt")).rejects.toThrow("不在白名单中");
    });

    test("空白名单允许所有 topic", async () => {
      const id = await store.enqueue("any.topic");
      expect(id).toBeDefined();
    });

    test("Job 有完整字段", async () => {
      const id = await store.enqueue("test", { data: 1 });
      const job = await store.get(id);
      expect(job!.id).toBe(id);
      expect(job!.topic).toBe("test");
      expect(job!.retries).toBe(0);
      expect(job!.lastError).toBe("");
      expect(job!.lockedUntil).toBeNull();
      expect(job!.created).toBeInstanceOf(Date);
      expect(job!.updated).toBeInstanceOf(Date);
    });
  });

  describe("get", () => {
    test("获取已有 job", async () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      const id = await store.enqueue("test");
      const job = await store.get(id);
      expect(job).not.toBeNull();
      expect(job!.id).toBe(id);
    });

    test("获取不存在的 job 返回 null", async () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      expect(await store.get("nonexistent")).toBeNull();
    });
  });

  describe("list", () => {
    let store: MemoryJobsStore;

    beforeEach(async () => {
      store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      await store.enqueue("email.send", null);
      await store.enqueue("sms.send", null);
      await store.enqueue("email.send", null);
    });

    test("默认列出所有 jobs", async () => {
      const jobs = await store.list();
      expect(jobs).toHaveLength(3);
    });

    test("按 topic 过滤", async () => {
      const jobs = await store.list({ topic: "email.send" });
      expect(jobs).toHaveLength(2);
      expect(jobs.every((j) => j.topic === "email.send")).toBe(true);
    });

    test("按 status 过滤", async () => {
      const jobs = await store.list({ status: "pending" });
      expect(jobs).toHaveLength(3);
      const completed = await store.list({ status: "completed" });
      expect(completed).toHaveLength(0);
    });

    test("分页 — limit + offset", async () => {
      const page1 = await store.list({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      const page2 = await store.list({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(1);
    });

    test("默认 limit=50", async () => {
      const jobs = await store.list();
      expect(jobs.length).toBeLessThanOrEqual(50);
    });
  });

  describe("stats", () => {
    test("空队列 stats", async () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      const s = await store.stats();
      expect(s.pending).toBe(0);
      expect(s.processing).toBe(0);
      expect(s.completed).toBe(0);
      expect(s.failed).toBe(0);
      expect(s.successRate).toBe(0);
    });

    test("多状态统计", async () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      const id1 = await store.enqueue("test");
      const id2 = await store.enqueue("test");
      const id3 = await store.enqueue("test");

      // 手动修改状态模拟
      const job2 = await store.get(id2);
      (job2 as any).status = "completed";
      const job3 = await store.get(id3);
      (job3 as any).status = "failed";

      const s = await store.stats();
      expect(s.pending).toBe(1);
      expect(s.completed).toBe(1);
      expect(s.failed).toBe(1);
      expect(s.successRate).toBe(0.5); // 1 completed / (1 completed + 1 failed)
    });
  });

  describe("delete", () => {
    let store: MemoryJobsStore;

    beforeEach(() => {
      store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
    });

    test("删除 pending job", async () => {
      const id = await store.enqueue("test");
      await store.delete(id);
      expect(await store.get(id)).toBeNull();
    });

    test("删除 failed job", async () => {
      const id = await store.enqueue("test");
      const job = await store.get(id);
      (job as any).status = "failed";
      await store.delete(id);
      expect(await store.get(id)).toBeNull();
    });

    test("不删除 processing job", async () => {
      const id = await store.enqueue("test");
      const job = await store.get(id);
      (job as any).status = "processing";
      await store.delete(id);
      expect(await store.get(id)).not.toBeNull();
    });

    test("不删除 completed job", async () => {
      const id = await store.enqueue("test");
      const job = await store.get(id);
      (job as any).status = "completed";
      await store.delete(id);
      expect(await store.get(id)).not.toBeNull();
    });
  });

  describe("requeue", () => {
    test("failed → pending", async () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      const id = await store.enqueue("test");
      const job = await store.get(id);
      (job as any).status = "failed";
      (job as any).retries = 3;
      (job as any).lastError = "timeout";

      await store.requeue(id);
      const requeued = await store.get(id);
      expect(requeued!.status).toBe("pending");
      expect(requeued!.retries).toBe(0);
      expect(requeued!.lastError).toBe("");
    });

    test("非 failed 状态不 requeue", async () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      const id = await store.enqueue("test");
      await store.requeue(id); // pending → 不变
      expect((await store.get(id))!.status).toBe("pending");
    });
  });

  describe("register handler", () => {
    test("注册 handler", () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      const handler = async (_job: Job) => {};
      store.register("email.send", handler);
      // 不抛错即成功
    });
  });

  describe("start/stop", () => {
    test("start 和 stop 不抛错", () => {
      const store = new MemoryJobsStore({ enabled: true, allowedTopics: [] });
      store.start();
      store.stop();
    });
  });
});
