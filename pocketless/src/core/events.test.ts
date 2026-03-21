/**
 * T160 — events.test.ts
 * 对照 Go 版 core/events_test.go
 * 测试事件类型和 createEvent 工厂函数
 */

import { describe, expect, test } from "bun:test";
import { createEvent } from "./events";
import type {
  BaseEvent,
  BootstrapEvent,
  ModelEvent,
  RecordEvent,
  CollectionEvent,
  RecordListEvent,
  RecordAuthEvent,
  MailEvent,
  ServeEvent,
  TerminateEvent,
} from "./events";

describe("createEvent", () => {
  test("creates event with auto-generated next function", () => {
    const event = createEvent<BaseEvent>({});
    expect(event).toBeDefined();
    expect(typeof event.next).toBe("function");
  });

  test("next is callable and returns promise", async () => {
    const event = createEvent<BaseEvent>({});
    const result = event.next();
    expect(result).toBeInstanceOf(Promise);
    await result; // 不应抛出错误
  });

  test("BootstrapEvent has app property", () => {
    const mockApp = { name: "testApp" };
    const event = createEvent<BootstrapEvent>({ app: mockApp });
    expect(event.app).toBe(mockApp);
    expect(typeof event.next).toBe("function");
  });

  test("ServeEvent has app, server, router properties", () => {
    const event = createEvent<ServeEvent>({
      app: "app",
      server: "server",
      router: "router",
    });
    expect(event.app).toBe("app");
    expect(event.server).toBe("server");
    expect(event.router).toBe("router");
  });

  test("TerminateEvent has isRestart property", () => {
    const event = createEvent<TerminateEvent>({
      app: "app",
      isRestart: true,
    });
    expect(event.isRestart).toBe(true);
  });

  test("ModelEvent has app and model properties", () => {
    const model = { id: "test" };
    const event = createEvent<ModelEvent>({ app: "app", model });
    expect(event.model).toBe(model);
    expect(event.app).toBe("app");
  });

  test("RecordEvent has record and collection properties", () => {
    const record = { id: "r1" } as any;
    const collection = { id: "c1" } as any;
    const event = createEvent<RecordEvent>({
      app: "app",
      record,
      collection,
    });
    expect(event.record).toBe(record);
    expect(event.collection).toBe(collection);
  });

  test("RecordEvent with optional httpContext", () => {
    const event = createEvent<RecordEvent>({
      app: "app",
      record: {} as any,
      collection: {} as any,
      httpContext: { req: "test" },
    });
    expect(event.httpContext).toEqual({ req: "test" });
  });

  test("CollectionEvent has collection property", () => {
    const col = { id: "c1", name: "test" } as any;
    const event = createEvent<CollectionEvent>({
      app: "app",
      collection: col,
    });
    expect(event.collection).toBe(col);
  });

  test("RecordListEvent has records and totalItems", () => {
    const event = createEvent<RecordListEvent>({
      app: "app",
      collection: {} as any,
      records: [{}, {}] as any[],
      totalItems: 100,
      httpContext: {},
    });
    expect(event.records).toHaveLength(2);
    expect(event.totalItems).toBe(100);
  });

  test("RecordAuthEvent has token and meta", () => {
    const event = createEvent<RecordAuthEvent>({
      app: "app",
      record: {} as any,
      collection: {} as any,
      token: "jwt_token_here",
      meta: { provider: "google" },
      httpContext: {},
    });
    expect(event.token).toBe("jwt_token_here");
    expect(event.meta).toEqual({ provider: "google" });
  });

  test("MailEvent has message and meta", () => {
    const event = createEvent<MailEvent>({
      app: "app",
      record: {} as any,
      collection: {} as any,
      message: { subject: "Test" },
      meta: { templateId: "verify" },
    });
    expect(event.message).toEqual({ subject: "Test" });
    expect(event.meta).toEqual({ templateId: "verify" });
  });

  test("event preserves all extra properties", () => {
    const event = createEvent<ModelEvent>({
      app: "app",
      model: { id: "m1", extra: "value" },
    });
    expect((event.model as any).extra).toBe("value");
  });
});
