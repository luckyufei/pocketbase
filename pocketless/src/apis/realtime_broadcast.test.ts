import { describe, test, expect } from "bun:test";
import { Broker } from "../tools/subscriptions/broker";
import { DefaultClient } from "../tools/subscriptions/client";
import type { Message } from "../tools/subscriptions/message";
import {
  realtimeBroadcastRecord,
  realtimeBroadcastDryCacheKey,
  realtimeUnsetDryCacheKey,
  getDryCacheKey,
  CLIENTS_CHUNK_SIZE,
  REALTIME_CLIENT_AUTH_KEY,
} from "./realtime_broadcast";

describe("Broadcast Logic", () => {
  test("getDryCacheKey — 生成正确的 key", () => {
    expect(getDryCacheKey("delete", "posts", "abc123")).toBe("delete/posts/abc123");
    expect(getDryCacheKey("create", "users", "def456")).toBe("create/users/def456");
  });

  test("realtimeBroadcastRecord — 无客户端不报错", () => {
    const broker = new Broker();

    // 不应抛出异常
    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });
  });

  test("realtimeBroadcastRecord — 匹配通配符订阅的客户端收到消息", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("posts/*");
    broker.register(client);

    const received: Message[] = [];
    client.onMessage((msg) => received.push(msg));

    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });

    expect(received.length).toBe(1);
    expect(received[0].name).toBe("posts/*");
    const parsed = JSON.parse(received[0].data);
    expect(parsed.action).toBe("create");
    expect(parsed.record.title).toBe("Hello");
  });

  test("realtimeBroadcastRecord — 匹配特定 record ID 订阅", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("posts/rec1");
    broker.register(client);

    const received: Message[] = [];
    client.onMessage((msg) => received.push(msg));

    realtimeBroadcastRecord(broker, "update", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Updated" },
    });

    expect(received.length).toBe(1);
    const parsed = JSON.parse(received[0].data);
    expect(parsed.action).toBe("update");
    expect(parsed.record.title).toBe("Updated");
  });

  test("realtimeBroadcastRecord — 按 collectionId 订阅也能匹配", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("col_posts/*");
    broker.register(client);

    const received: Message[] = [];
    client.onMessage((msg) => received.push(msg));

    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });

    expect(received.length).toBe(1);
  });

  test("realtimeBroadcastRecord — 不匹配的订阅不收到消息", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("users/*"); // 订阅 users，不是 posts
    broker.register(client);

    const received: Message[] = [];
    client.onMessage((msg) => received.push(msg));

    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });

    expect(received.length).toBe(0);
  });

  test("realtimeBroadcastRecord — dryCache=true 缓存消息而非发送", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("posts/*");
    broker.register(client);

    const received: Message[] = [];
    client.onMessage((msg) => received.push(msg));

    realtimeBroadcastRecord(
      broker,
      "delete",
      {
        id: "rec1",
        collectionName: "posts",
        collectionId: "col_posts",
        data: { title: "To Delete" },
      },
      true,
    );

    // 不应直接发送
    expect(received.length).toBe(0);

    // 应存在 dry cache
    const cacheKey = getDryCacheKey("delete", "posts", "rec1");
    const cached = client.get(cacheKey) as Message[];
    expect(cached).toBeDefined();
    expect(cached.length).toBe(1);
    expect(JSON.parse(cached[0].data).action).toBe("delete");
  });

  test("realtimeBroadcastDryCacheKey — 广播并清理 dry cache", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    client.subscribe("posts/*");
    broker.register(client);

    // 先 dry cache
    const cacheKey = getDryCacheKey("delete", "posts", "rec1");
    const msg: Message = {
      name: "posts/*",
      data: JSON.stringify({ action: "delete", record: { id: "rec1" } }),
    };
    client.set(cacheKey, [msg]);

    const received: Message[] = [];
    client.onMessage((m) => received.push(m));

    // 广播 dry cache
    realtimeBroadcastDryCacheKey(broker, cacheKey);

    expect(received.length).toBe(1);
    expect(received[0].name).toBe("posts/*");

    // cache 已被清理
    expect(client.get(cacheKey)).toBeUndefined();
  });

  test("realtimeUnsetDryCacheKey — 清理 dry cache 不发送", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.register(client);

    const cacheKey = "delete/posts/rec1";
    client.set(cacheKey, [{ name: "test", data: "{}" }]);

    const received: Message[] = [];
    client.onMessage((m) => received.push(m));

    realtimeUnsetDryCacheKey(broker, cacheKey);

    // 不应发送消息
    expect(received.length).toBe(0);
    // cache 已清理
    expect(client.get(cacheKey)).toBeUndefined();
  });

  test("realtimeBroadcastRecord — 多客户端分块广播", () => {
    const broker = new Broker();
    const clients: DefaultClient[] = [];
    const receivedCounts: number[] = [];

    // 创建 5 个客户端，全部订阅 posts/*
    for (let i = 0; i < 5; i++) {
      const c = new DefaultClient();
      c.subscribe("posts/*");
      broker.register(c);
      clients.push(c);
      receivedCounts.push(0);

      c.onMessage(() => {
        receivedCounts[i]++;
      });
    }

    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });

    // 所有客户端都应收到消息
    for (let i = 0; i < 5; i++) {
      expect(receivedCounts[i]).toBe(1);
    }
  });

  test("realtimeBroadcastRecord — 旧版无通配符订阅（向后兼容）", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    // 旧版订阅格式：直接用 collection name，不加 /*
    client.subscribe("posts");
    broker.register(client);

    const received: Message[] = [];
    client.onMessage((msg) => received.push(msg));

    realtimeBroadcastRecord(broker, "create", {
      id: "rec1",
      collectionName: "posts",
      collectionId: "col_posts",
      data: { title: "Hello" },
    });

    // 应该匹配（向后兼容）
    expect(received.length).toBe(1);
  });
});
