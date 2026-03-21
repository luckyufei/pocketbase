/**
 * Logger 测试 — T048
 * 覆盖日志级别过滤、结构化数据、子 logger
 */

import { describe, test, expect } from "bun:test";
import { Logger, LogLevel } from "./logger";

describe("Logger (T048)", () => {
  // ─── 基础日志 ───

  test("debug 级别日志记录", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    logger.debug("test message");

    expect(entries.length).toBe(1);
    expect(entries[0].level).toBe("DEBUG");
    expect(entries[0].message).toBe("test message");
  });

  test("info 级别日志记录", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    logger.info("info msg");

    expect(entries.length).toBe(1);
    expect(entries[0].level).toBe("INFO");
  });

  test("warn 级别日志记录", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    logger.warn("warning");
    expect(entries[0].level).toBe("WARN");
  });

  test("error 级别日志记录", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    logger.error("error msg");
    expect(entries[0].level).toBe("ERROR");
  });

  // ─── 级别过滤 ───

  test("低于设定级别的日志被过滤", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.WARN,
      handler: (entry) => entries.push(entry),
    });

    logger.debug("should not appear");
    logger.info("should not appear");
    logger.warn("should appear");
    logger.error("should appear");

    expect(entries.length).toBe(2);
    expect(entries[0].level).toBe("WARN");
    expect(entries[1].level).toBe("ERROR");
  });

  // ─── 结构化数据 ───

  test("附带键值对数据", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    logger.info("request", "method", "GET", "path", "/api/test", "status", 200);

    expect(entries[0].data).toEqual({
      method: "GET",
      path: "/api/test",
      status: 200,
    });
  });

  test("奇数个参数最后一个 key 值为 undefined", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    logger.info("msg", "key1", "val1", "key2");

    expect(entries[0].data).toEqual({
      key1: "val1",
      key2: undefined,
    });
  });

  // ─── 子 logger (with) ───

  test("with() 创建携带上下文的子 logger", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    const child = logger.with("requestId", "abc123", "userId", "user1");
    child.info("processing");

    expect(entries[0].data).toEqual({
      requestId: "abc123",
      userId: "user1",
    });
  });

  test("子 logger 合并父级和当前上下文", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    const child = logger.with("requestId", "abc123");
    child.info("msg", "extra", "data");

    expect(entries[0].data).toEqual({
      requestId: "abc123",
      extra: "data",
    });
  });

  test("父 logger 不受子 logger 影响", () => {
    const entries: any[] = [];
    const logger = new Logger({
      level: LogLevel.DEBUG,
      handler: (entry) => entries.push(entry),
    });

    const child = logger.with("child", true);
    logger.info("parent msg");

    expect(entries[0].data).toEqual({});
    expect(entries[0].data.child).toBeUndefined();
  });

  // ─── 默认 handler ───

  test("无 handler 不报错", () => {
    const logger = new Logger({ level: LogLevel.DEBUG });
    expect(() => logger.info("test")).not.toThrow();
  });
});
