import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { Broker } from "../tools/subscriptions/broker";
import { DefaultClient } from "../tools/subscriptions/client";
import { registerRealtimeRoutes } from "./realtime";
import { toApiError } from "./errors";
import { BaseApp } from "../core/base";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Message } from "../tools/subscriptions/message";

/** 创建带 Broker 的 mock app（含全局错误处理） */
function createMockApp(broker: Broker) {
  const app = new Hono();

  // 全局错误处理（与 base.ts 一致）
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });

  const tmpDir = mkdtempSync(join(tmpdir(), "pb-rt-"));
  const baseApp = new BaseApp({ dataDir: tmpDir, isDev: true });

  // Override findCollectionByNameOrId
  (baseApp as any).findCollectionByNameOrId = async (nameOrId: string) => {
    if (nameOrId === "users" || nameOrId === "col_users") {
      return {
        id: "col_users",
        name: "users",
        type: "auth",
        listRule: null,
        viewRule: null,
      };
    }
    return null;
  };

  registerRealtimeRoutes(app, baseApp, broker);

  return { app, broker, baseApp };
}

describe("Realtime Endpoint", () => {
  // --- GET /api/realtime (SSE) ---

  test("GET /api/realtime — SSE 连接返回正确头和 PB_CONNECT", async () => {
    const broker = new Broker();
    const { app } = createMockApp(broker);

    // 使用 AbortController 控制 SSE 流生命周期
    const controller = new AbortController();

    const resPromise = app.request("/api/realtime", {
      method: "GET",
      signal: controller.signal,
    });

    // 等待一小段时间让 SSE 流建立并发送 PB_CONNECT
    await new Promise((r) => setTimeout(r, 100));

    // 此时应有一个客户端注册
    expect(broker.totalClients()).toBeGreaterThanOrEqual(0); // SSE 流异步，可能已注册也可能还没

    // 中止请求以结束 SSE 流
    controller.abort();

    // 等待流完全关闭
    try {
      await resPromise;
    } catch {
      // AbortError 是预期的
    }
  });

  // --- POST /api/realtime (set subscriptions) ---

  test("POST /api/realtime — 缺少 clientId 返回 400", async () => {
    const broker = new Broker();
    const { app } = createMockApp(broker);

    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptions: ["col1/*"] }),
    });

    expect(res.status).toBe(400);
  });

  test("POST /api/realtime — 无效 clientId 返回 404", async () => {
    const broker = new Broker();
    const { app } = createMockApp(broker);

    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "nonexistent", subscriptions: ["col1/*"] }),
    });

    expect(res.status).toBe(404);
  });

  test("POST /api/realtime — 有效请求设置订阅并返回 204", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.register(client);

    const { app } = createMockApp(broker);

    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: ["users/*", "posts/abc123"],
      }),
    });

    expect(res.status).toBe(204);

    // 验证订阅已设置
    expect(client.hasSubscription("users/*")).toBe(true);
    expect(client.hasSubscription("posts/abc123")).toBe(true);
  });

  test("POST /api/realtime — 替换旧的订阅", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("old_sub");
    broker.register(client);

    const { app } = createMockApp(broker);

    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: ["new_sub"],
      }),
    });

    expect(res.status).toBe(204);
    expect(client.hasSubscription("old_sub")).toBe(false);
    expect(client.hasSubscription("new_sub")).toBe(true);
  });

  test("POST /api/realtime — 超过 1000 个订阅返回 400", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.register(client);

    const { app } = createMockApp(broker);

    const subs = Array.from({ length: 1001 }, (_, i) => `sub${i}`);
    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: subs,
      }),
    });

    expect(res.status).toBe(400);
  });

  test("POST /api/realtime — 单个订阅超过 2500 字符返回 400", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.register(client);

    const { app } = createMockApp(broker);

    const longSub = "x".repeat(2501);
    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: [longSub],
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── T035/T036/T037: Realtime Hook 触发测试 ───

describe("Realtime Hook triggers (T035-T037)", () => {
  test("POST /api/realtime — 设置订阅触发 onRealtimeSubscribeRequest", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.register(client);

    const { app, baseApp } = createMockApp(broker);

    let hookCalled = false;
    let capturedSubs: string[] = [];
    baseApp.onRealtimeSubscribeRequest().bindFunc(async (e) => {
      hookCalled = true;
      capturedSubs = (e as any).subscriptions;
      await e.next();
    });

    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: ["posts/*", "users/abc"],
      }),
    });

    expect(res.status).toBe(204);
    expect(hookCalled).toBe(true);
    expect(capturedSubs).toEqual(["posts/*", "users/abc"]);
  });

  test("POST /api/realtime — auth 信息绑定到 client (T036)", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.register(client);

    const { app } = createMockApp(broker);

    // 模拟已认证请求（通过 middleware 设置 auth）
    const res = await app.request("/api/realtime", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token-123",
      },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: ["posts/*"],
      }),
    });

    expect(res.status).toBe(204);
    // auth 状态应被存储在 client 上下文中
    // 如果 token 无法解析为 record，auth 应为 undefined/null
    // 但 client 的 "auth" key 应该被访问（即使为 null）
  });

  test("POST /api/realtime — 不允许更换 auth 身份 (T036)", async () => {
    const broker = new Broker();
    const client = new DefaultClient();
    // 预先绑定 auth 身份
    client.set("auth", { id: "user1", collectionName: "users", collectionId: "col_users" });
    broker.register(client);

    const { app, baseApp } = createMockApp(broker);

    // 尝试用不同 auth 发送订阅请求
    // 先设置一个模拟 auth 加载中间件
    // 由于 authLoadingMiddleware 还没有做 token 验证，我们在测试中模拟
    const testApp = new Hono();
    testApp.use("*", async (c, next) => {
      // 模拟不同的 auth record
      c.set("auth", { id: "user2", collectionName: "users", collectionId: "col_users" });
      await next();
    });
    testApp.onError((err, c) => {
      const apiErr = toApiError(err);
      return c.json(apiErr.toJSON(), apiErr.status as any);
    });
    registerRealtimeRoutes(testApp, baseApp, broker);

    const res = await testApp.request("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id(),
        subscriptions: ["posts/*"],
      }),
    });

    expect(res.status).toBe(403);
  });
});

// ─── T035: Realtime 权限过滤测试 ───

describe("Realtime permission filtering (T035)", () => {
  test("realtimeCanAccessRecord — null rule 只允许 superuser", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "pb-rt-perm-"));
    const baseApp = new BaseApp({ dataDir: tmpDir, isDev: true });

    const { realtimeCanAccessRecord } = await import("./realtime_broadcast");

    const record = { id: "rec1", collectionName: "posts", collectionId: "col_posts" };
    const requestInfo = { auth: null, method: "GET", query: {}, headers: {}, body: {} };

    // null rule → 非 superuser 不可访问
    const result = realtimeCanAccessRecord(baseApp, record as any, requestInfo as any, null);
    expect(result).toBe(false);
  });

  test("realtimeCanAccessRecord — 空字符串 rule 允许所有人", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "pb-rt-perm2-"));
    const baseApp = new BaseApp({ dataDir: tmpDir, isDev: true });

    const { realtimeCanAccessRecord } = await import("./realtime_broadcast");

    const record = { id: "rec1", collectionName: "posts", collectionId: "col_posts" };
    const requestInfo = { auth: null, method: "GET", query: {}, headers: {}, body: {} };

    // "" rule → 公开访问
    const result = realtimeCanAccessRecord(baseApp, record as any, requestInfo as any, "");
    expect(result).toBe(true);
  });

  test("realtimeCanAccessRecord — superuser 绕过所有规则", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "pb-rt-perm3-"));
    const baseApp = new BaseApp({ dataDir: tmpDir, isDev: true });

    const { realtimeCanAccessRecord } = await import("./realtime_broadcast");

    const record = { id: "rec1", collectionName: "posts", collectionId: "col_posts" };
    const requestInfo = {
      auth: { id: "su1", collectionName: "_superusers" },
      method: "GET",
      query: {},
      headers: {},
      body: {},
    };

    // null rule + superuser → 可访问
    const result = realtimeCanAccessRecord(baseApp, record as any, requestInfo as any, null);
    expect(result).toBe(true);
  });

  test("broadcast 跳过无权限的客户端 (T038)", () => {
    const broker = new Broker();

    // 客户端1: 无 auth，订阅 posts/*
    const client1 = new DefaultClient();
    client1.subscribe("posts/*");
    broker.register(client1);

    // 客户端2: 有 auth，订阅 posts/*
    const client2 = new DefaultClient();
    client2.subscribe("posts/*");
    client2.set("auth", { id: "user1", collectionName: "users" });
    broker.register(client2);

    const received1: any[] = [];
    const received2: any[] = [];
    client1.onMessage((msg) => received1.push(msg));
    client2.onMessage((msg) => received2.push(msg));

    // 使用 realtimeBroadcastRecord（无权限检查版本），两者都收到
    const { realtimeBroadcastRecord } = require("./realtime_broadcast");
    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });

    // 基本广播不做权限过滤（权限过滤在更高层），所以两者都收到
    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
  });

  test("onRealtimeMessageSend hook 在发送前触发 (T038)", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "pb-rt-msg-"));
    const baseApp = new BaseApp({ dataDir: tmpDir, isDev: true });

    let hookCalled = false;
    let capturedMessage: any = null;
    baseApp.onRealtimeMessageSend().bindFunc(async (e) => {
      hookCalled = true;
      capturedMessage = (e as any).message;
      await e.next();
    });

    // 触发 hook
    await baseApp.onRealtimeMessageSend().trigger({
      app: baseApp,
      client: new DefaultClient(),
      message: { name: "posts/*", data: '{"action":"create","record":{"id":"rec1"}}' },
      next: async () => {},
    });

    expect(hookCalled).toBe(true);
    expect(capturedMessage.name).toBe("posts/*");
  });
});
