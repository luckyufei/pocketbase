/**
 * DateTime 测试 — 解析、格式化、IsZero、JSON 序列化
 * 对照 Go 版 tools/types/datetime_test.go 1:1 移植
 * T192
 */

import { describe, test, expect } from "bun:test";
import { DateTime } from "./datetime";

describe("DateTime 构造", () => {
  test("无参构造为零值", () => {
    const dt = new DateTime();
    expect(dt.isZero()).toBe(true);
  });

  test("Date 对象构造", () => {
    const d = new Date("2024-01-15T10:30:00Z");
    const dt = new DateTime(d);
    expect(dt.isZero()).toBe(false);
    expect(dt.time().getTime()).toBe(d.getTime());
  });

  test("字符串构造", () => {
    const dt = new DateTime("2024-01-15T10:30:00Z");
    expect(dt.isZero()).toBe(false);
  });

  test("空字符串构造为零值", () => {
    const dt = new DateTime("");
    expect(dt.isZero()).toBe(true);
  });

  test("数值（毫秒）构造", () => {
    const ts = new Date("2024-01-15T10:30:00Z").getTime();
    const dt = new DateTime(ts);
    expect(dt.isZero()).toBe(false);
    expect(dt.time().getTime()).toBe(ts);
  });

  test("0 数值构造为零值", () => {
    const dt = new DateTime(0);
    expect(dt.isZero()).toBe(true);
  });

  test("构造复制 Date（不共享引用）", () => {
    const d = new Date("2024-01-15T10:30:00Z");
    const dt = new DateTime(d);
    d.setFullYear(2000);
    expect(dt.time().getFullYear()).toBe(2024);
  });
});

describe("DateTime.isZero", () => {
  test("零值 true", () => {
    expect(new DateTime().isZero()).toBe(true);
  });

  test("非零值 false", () => {
    expect(new DateTime(new Date()).isZero()).toBe(false);
  });
});

describe("DateTime.time", () => {
  test("返回 Date 副本", () => {
    const dt = new DateTime("2024-01-15T10:30:00Z");
    const t1 = dt.time();
    const t2 = dt.time();
    t1.setFullYear(2000);
    expect(t2.getFullYear()).toBe(2024);
  });
});

describe("DateTime.string", () => {
  test("零值返回空字符串", () => {
    expect(new DateTime().string()).toBe("");
  });

  test("格式为 ISO 带空格分隔", () => {
    const dt = new DateTime("2024-01-15T10:30:00.000Z");
    const s = dt.string();
    expect(s).toContain(" ");
    expect(s).not.toContain("T");
    expect(s).toContain("2024-01-15");
    expect(s).toContain("10:30:00");
  });
});

describe("DateTime.toSQLite", () => {
  test("零值返回空字符串", () => {
    expect(new DateTime().toSQLite()).toBe("");
  });

  test("格式正确", () => {
    const dt = new DateTime("2024-01-15T10:30:00.123Z");
    const s = dt.toSQLite();
    expect(s).toBe("2024-01-15 10:30:00.123Z");
  });
});

describe("DateTime.toJSON", () => {
  test("与 string() 一致", () => {
    const dt = new DateTime("2024-01-15T10:30:00Z");
    expect(dt.toJSON()).toBe(dt.string());
  });

  test("零值返回空字符串", () => {
    expect(new DateTime().toJSON()).toBe("");
  });
});

describe("DateTime.now", () => {
  test("返回非零值", () => {
    const dt = DateTime.now();
    expect(dt.isZero()).toBe(false);
  });

  test("接近当前时间", () => {
    const before = Date.now();
    const dt = DateTime.now();
    const after = Date.now();
    expect(dt.time().getTime()).toBeGreaterThanOrEqual(before);
    expect(dt.time().getTime()).toBeLessThanOrEqual(after);
  });
});

describe("DateTime.parse", () => {
  test("空字符串返回零值", () => {
    expect(DateTime.parse("").isZero()).toBe(true);
  });

  test("ISO 格式", () => {
    const dt = DateTime.parse("2024-01-15T10:30:00Z");
    expect(dt.isZero()).toBe(false);
    expect(dt.time().getFullYear()).toBe(2024);
  });

  test("Go 版空格格式", () => {
    const dt = DateTime.parse("2024-01-15 10:30:00.000Z");
    expect(dt.isZero()).toBe(false);
    expect(dt.time().getUTCHours()).toBe(10);
  });

  test("带毫秒的 Go 格式", () => {
    const dt = DateTime.parse("2024-06-15 14:25:30.123Z");
    expect(dt.time().getUTCMilliseconds()).toBe(123);
  });
});
