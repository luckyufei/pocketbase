/**
 * Realtime SSE 端点
 * 与 Go 版 apis/realtime.go 对齐
 *
 * GET  /api/realtime  → SSE 连接
 * POST /api/realtime  → 设置订阅
 */

import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { BaseApp } from "../core/base";
import type { Broker } from "../tools/subscriptions/broker";
import { DefaultClient } from "../tools/subscriptions/client";
import type { Message } from "../tools/subscriptions/message";

/** SSE 客户端空闲超时（默认 5 分钟） */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** 最大订阅数 */
const MAX_SUBSCRIPTIONS = 1000;

/** 单个订阅最大长度 */
const MAX_SUBSCRIPTION_LENGTH = 2500;

/** Realtime 客户端 auth 状态 key */
export const REALTIME_CLIENT_AUTH_KEY = "auth";

/** 广播分块大小 */
export const CLIENTS_CHUNK_SIZE = 150;

/** 检查两个 auth 是否为同一身份 */
function isSameAuth(
  a: { id: string; collectionId?: string } | null | undefined,
  b: { id: string; collectionId?: string } | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.id === b.id;
}

export function registerRealtimeRoutes(
  app: Hono,
  _baseApp: BaseApp,
  broker: Broker,
): void {
  // GET /api/realtime — SSE 连接
  app.get("/api/realtime", (c) => {
    return streamSSE(c, async (stream) => {
      const client = new DefaultClient();

      // 设置 SSE 头
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-store");
      c.header("X-Accel-Buffering", "no");

      // 触发 onRealtimeConnectRequest hook
      await _baseApp.onRealtimeConnectRequest().trigger({
        app: _baseApp,
        httpContext: c,
        client,
        idleTimeout: IDLE_TIMEOUT_MS,
        next: async () => {},
      });

      // 注册客户端
      broker.register(client);

      try {
        // 发送 PB_CONNECT 消息（通过 onRealtimeMessageSend hook）
        const connectMsg: Message = {
          name: "PB_CONNECT",
          data: JSON.stringify({ clientId: client.id() }),
        };

        await _baseApp.onRealtimeMessageSend().trigger({
          app: _baseApp,
          client,
          message: connectMsg,
          next: async () => {},
        });

        await stream.writeSSE({
          event: connectMsg.name,
          data: connectMsg.data,
          id: client.id(),
        });

        // 空闲定时器
        let idleTimer: ReturnType<typeof setTimeout> | null = null;

        const resetIdleTimer = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            client.discard();
          }, IDLE_TIMEOUT_MS);
        };

        resetIdleTimer();

        // 注册消息监听器 — 将客户端消息转发到 SSE 流
        client.onMessage((msg: Message) => {
          // 通过 onRealtimeMessageSend hook 发送
          _baseApp.onRealtimeMessageSend().trigger({
            app: _baseApp,
            client,
            message: msg,
            next: async () => {},
          }).then(() => {
            return stream.writeSSE({
              event: msg.name,
              data: msg.data,
              id: client.id(),
            });
          }).then(() => {
            resetIdleTimer();
          }).catch(() => {
            client.discard();
          });
        });

        // 等待客户端被废弃或流被中止
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (client.isDiscarded() || stream.aborted) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          stream.onAbort(() => {
            clearInterval(checkInterval);
            resolve();
          });
        });

        if (idleTimer) clearTimeout(idleTimer);
      } finally {
        // 清理 — 注销客户端
        broker.unregister(client.id());
      }
    });
  });

  // POST /api/realtime — 设置订阅
  app.post("/api/realtime", async (c) => {
    const body = await c.req.json().catch(() => ({}));

    const clientId = body.clientId as string;
    const subscriptions = (body.subscriptions || []) as string[];

    // 验证 clientId
    if (!clientId) {
      return c.json(
        { status: 400, message: "Missing required clientId.", data: {} },
        400,
      );
    }

    // 验证订阅数量
    if (subscriptions.length > MAX_SUBSCRIPTIONS) {
      return c.json(
        { status: 400, message: `Subscriptions count must be at most ${MAX_SUBSCRIPTIONS}.`, data: {} },
        400,
      );
    }

    // 验证单个订阅长度
    for (const sub of subscriptions) {
      if (sub.length > MAX_SUBSCRIPTION_LENGTH) {
        return c.json(
          { status: 400, message: `Each subscription must be at most ${MAX_SUBSCRIPTION_LENGTH} characters.`, data: {} },
          400,
        );
      }
    }

    // 查找客户端
    let client;
    try {
      client = broker.clientById(clientId);
    } catch {
      return c.json(
        { status: 404, message: "Missing or invalid client id.", data: {} },
        404,
      );
    }

    // 检查 auth 一致性（T036）：只允许 guest → auth 升级，不允许更换 auth
    const currentAuth = c.get("auth") as { id: string; collectionId?: string } | null | undefined;
    const clientAuth = client.get(REALTIME_CLIENT_AUTH_KEY) as { id: string; collectionId?: string } | null | undefined;

    if (clientAuth && !isSameAuth(clientAuth, currentAuth)) {
      return c.json(
        { status: 403, message: "The current and the previous request authorization don't match.", data: {} },
        403,
      );
    }

    // 取消所有旧订阅
    client.unsubscribe();

    // 触发 onRealtimeSubscribeRequest hook
    await _baseApp.onRealtimeSubscribeRequest().trigger({
      app: _baseApp,
      httpContext: c,
      client,
      subscriptions,
      next: async () => {},
    });

    // 绑定 auth 到 client（T036）
    client.set(REALTIME_CLIENT_AUTH_KEY, currentAuth ?? null);

    // 设置新订阅
    client.subscribe(...subscriptions);

    return c.body(null, 204);
  });
}
