import { describe, test, expect } from "bun:test";
import { DefaultClient } from "./client";
import type { Message } from "./message";

describe("DefaultClient", () => {
  test("NewDefaultClient — 正确初始化", () => {
    const c = new DefaultClient();
    expect(c.subscriptions().size).toBe(0);
    expect(c.id()).toBeTruthy();
    expect(c.id().length).toBe(40);
  });

  test("Id — 多个客户端 ID 唯一", () => {
    const clients = [
      new DefaultClient(),
      new DefaultClient(),
      new DefaultClient(),
      new DefaultClient(),
    ];

    const ids = new Set(clients.map((c) => c.id()));
    expect(ids.size).toBe(4);

    for (const c of clients) {
      expect(c.id().length).toBe(40);
    }
  });

  test("Subscriptions — 无前缀返回所有", () => {
    const c = new DefaultClient();
    expect(c.subscriptions().size).toBe(0);

    c.subscribe("sub1", "sub11", "sub2");

    const all = c.subscriptions();
    expect(all.size).toBe(3);
    expect(all.has("sub1")).toBe(true);
    expect(all.has("sub11")).toBe(true);
    expect(all.has("sub2")).toBe(true);
  });

  test("Subscriptions — 按前缀过滤", () => {
    const c = new DefaultClient();
    c.subscribe("sub1", "sub11", "sub2");

    // "sub1" 前缀匹配 "sub1" 和 "sub11"
    const filtered = c.subscriptions("sub1");
    expect(filtered.size).toBe(2);
    expect(filtered.has("sub1")).toBe(true);
    expect(filtered.has("sub11")).toBe(true);

    // "sub2" 前缀只匹配 "sub2"
    const filtered2 = c.subscriptions("sub2");
    expect(filtered2.size).toBe(1);
    expect(filtered2.has("sub2")).toBe(true);

    // 不匹配的前缀
    const filtered3 = c.subscriptions("missing");
    expect(filtered3.size).toBe(0);
  });

  test("Subscribe — 空字符串被跳过", () => {
    const c = new DefaultClient();
    c.subscribe("", "sub1", "sub2", "sub3");

    expect(c.subscriptions().size).toBe(3);
    expect(c.hasSubscription("sub1")).toBe(true);
    expect(c.hasSubscription("sub2")).toBe(true);
    expect(c.hasSubscription("sub3")).toBe(true);
  });

  test("Subscribe — 解析 options 参数", () => {
    const c = new DefaultClient();

    const sub1 = "test1";
    const sub2 = `test2?options=${encodeURIComponent(JSON.stringify({ query: { name: 123 }, headers: { "X-Token": 456 } }))}`;

    c.subscribe(sub1, sub2);

    const subs = c.subscriptions();

    // sub1: 空 options
    const opt1 = subs.get(sub1)!;
    expect(opt1).toBeDefined();
    expect(Object.keys(opt1.query).length).toBe(0);
    expect(Object.keys(opt1.headers).length).toBe(0);

    // sub2: 包含 query 和 headers（headers 名转 snake_case）
    const opt2 = subs.get(sub2)!;
    expect(opt2).toBeDefined();
    expect(opt2.query["name"]).toBe("123");
    expect(opt2.headers["x_token"]).toBe("456");
  });

  test("Unsubscribe — 取消指定订阅", () => {
    const c = new DefaultClient();
    c.subscribe("sub1", "sub2", "sub3");

    c.unsubscribe("sub1");
    expect(c.hasSubscription("sub1")).toBe(false);
    expect(c.subscriptions().size).toBe(2);
  });

  test("Unsubscribe — 无参数取消所有", () => {
    const c = new DefaultClient();
    c.subscribe("sub1", "sub2", "sub3");

    c.unsubscribe();
    expect(c.subscriptions().size).toBe(0);
  });

  test("HasSubscription", () => {
    const c = new DefaultClient();
    expect(c.hasSubscription("missing")).toBe(false);

    c.subscribe("sub");
    expect(c.hasSubscription("sub")).toBe(true);
  });

  test("Set/Get — 存取任意值", () => {
    const c = new DefaultClient();
    c.set("demo", 1);

    expect(c.get("demo")).toBe(1);
    expect(c.get("missing")).toBeUndefined();
  });

  test("Unset — 移除值", () => {
    const c = new DefaultClient();
    c.set("demo", 1);
    c.unset("demo");

    expect(c.get("demo")).toBeUndefined();
  });

  test("Discard — 标记为已废弃", () => {
    const c = new DefaultClient();
    expect(c.isDiscarded()).toBe(false);

    c.discard();
    expect(c.isDiscarded()).toBe(true);
  });

  test("Discard — 多次调用安全", () => {
    const c = new DefaultClient();
    c.discard();
    c.discard(); // 不应报错
    expect(c.isDiscarded()).toBe(true);
  });

  test("Send — 发送消息给监听器", () => {
    const c = new DefaultClient();
    const received: string[] = [];

    c.onMessage((msg) => {
      received.push(msg.name);
    });

    c.send({ name: "m1", data: "" });
    c.send({ name: "m2", data: "" });

    expect(received).toEqual(["m1", "m2"]);
  });

  test("Send — 废弃后不再发送", () => {
    const c = new DefaultClient();
    const received: string[] = [];

    c.onMessage((msg) => {
      received.push(msg.name);
    });

    c.send({ name: "m1", data: "" });
    c.discard();
    c.send({ name: "m2", data: "" }); // 应被忽略

    expect(received).toEqual(["m1"]);
  });
});
