import { describe, test, expect } from "bun:test";
import { Broker } from "./broker";
import { DefaultClient } from "./client";

describe("Broker", () => {
  test("NewBroker — clients 初始化为空", () => {
    const b = new Broker();
    expect(b.clients()).toBeDefined();
    expect(b.clients().size).toBe(0);
  });

  test("Clients — 返回浅拷贝", () => {
    const b = new Broker();

    b.register(new DefaultClient());
    b.register(new DefaultClient());

    // 删除拷贝不影响原始数据
    const copy = b.clients();
    for (const k of copy.keys()) {
      copy.delete(k);
    }

    expect(b.clients().size).toBe(2);
  });

  test("ChunkedClients — 空 broker 返回空数组", () => {
    const b = new Broker();
    const chunks = b.chunkedClients(2);
    expect(chunks.length).toBe(0);
  });

  test("ChunkedClients — 正确分块", () => {
    const b = new Broker();
    b.register(new DefaultClient());
    b.register(new DefaultClient());
    b.register(new DefaultClient());

    const chunks = b.chunkedClients(2);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(2);
    expect(chunks[1].length).toBe(1);
  });

  test("TotalClients — 正确计数", () => {
    const b = new Broker();
    expect(b.totalClients()).toBe(0);

    b.register(new DefaultClient());
    b.register(new DefaultClient());

    expect(b.totalClients()).toBe(2);
  });

  test("ClientById — 查找已注册客户端", () => {
    const b = new Broker();
    const clientA = new DefaultClient();
    const clientB = new DefaultClient();
    b.register(clientA);
    b.register(clientB);

    const result = b.clientById(clientA.id());
    expect(result.id()).toBe(clientA.id());
  });

  test("ClientById — 未找到时抛出错误", () => {
    const b = new Broker();
    expect(() => b.clientById("missing")).toThrow(/no client/);
  });

  test("Register — 注册客户端", () => {
    const b = new Broker();
    const client = new DefaultClient();
    b.register(client);

    expect(b.clientById(client.id()).id()).toBe(client.id());
  });

  test("Unregister — 注销客户端并标记废弃", () => {
    const b = new Broker();
    const clientA = new DefaultClient();
    const clientB = new DefaultClient();
    b.register(clientA);
    b.register(clientB);

    b.unregister(clientA.id());

    expect(() => b.clientById(clientA.id())).toThrow();
    expect(clientA.isDiscarded()).toBe(true);

    // clientB 不受影响
    expect(b.clientById(clientB.id()).id()).toBe(clientB.id());
  });

  test("Unregister — 不存在的 ID 不报错", () => {
    const b = new Broker();
    b.unregister("non-existent"); // should not throw
  });
});
