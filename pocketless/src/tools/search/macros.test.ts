/**
 * 日期宏测试 — 对照 Go 版 identifier_macros_test.go
 * 使用固定时间验证所有 16 个宏
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolveMacro, knownMacros, type MacroValue } from "./macros";

// Go 版使用 time.Date(2023, 2, 3, 4, 5, 6, 7, time.UTC)
// JS Date.UTC(2023, 1, 3, 4, 5, 6, 0) — 月份从 0 开始
const FROZEN_TIME = new Date(Date.UTC(2023, 1, 3, 4, 5, 6, 0));

// 冻结时间
let originalDateNow: typeof Date.now;
let OriginalDate: DateConstructor;

beforeAll(() => {
  originalDateNow = Date.now;
  OriginalDate = globalThis.Date;
  const frozenMs = FROZEN_TIME.getTime();

  // 代理 Date 以冻结 new Date()
  const MockDate = function (this: any, ...args: any[]) {
    if (args.length === 0) {
      return new OriginalDate(frozenMs);
    }
    return new (OriginalDate as any)(...args);
  } as any;
  MockDate.prototype = OriginalDate.prototype;
  MockDate.UTC = OriginalDate.UTC;
  MockDate.parse = OriginalDate.parse;
  MockDate.now = () => frozenMs;
  globalThis.Date = MockDate;
});

afterAll(() => {
  globalThis.Date = OriginalDate;
});

describe("Macros: resolveMacro", () => {
  // 对照 Go 版 TestIdentifierMacros 的精确期望值
  const expectedMacros: Record<string, MacroValue> = {
    "@now": "2023-02-03 04:05:06.000Z",
    "@yesterday": "2023-02-02 04:05:06.000Z",
    "@tomorrow": "2023-02-04 04:05:06.000Z",
    "@second": 6,
    "@minute": 5,
    "@hour": 4,
    "@day": 3,
    "@month": 2,
    "@weekday": 5, // Friday
    "@year": 2023,
    "@todayStart": "2023-02-03 00:00:00.000Z",
    "@todayEnd": "2023-02-03 23:59:59.999Z",
    "@monthStart": "2023-02-01 00:00:00.000Z",
    "@monthEnd": "2023-02-28 23:59:59.999Z",
    "@yearStart": "2023-01-01 00:00:00.000Z",
    "@yearEnd": "2023-12-31 23:59:59.999Z",
  };

  test("宏数量匹配", () => {
    expect(knownMacros.length).toBe(Object.keys(expectedMacros).length);
  });

  for (const [name, expected] of Object.entries(expectedMacros)) {
    test(`${name} → ${expected}`, () => {
      const result = resolveMacro(name);
      expect(result).toBe(expected);
    });
  }

  test("未知宏返回 null", () => {
    expect(resolveMacro("@unknown")).toBeNull();
    expect(resolveMacro("now")).toBeNull();
    expect(resolveMacro("")).toBeNull();
  });

  test("所有 knownMacros 都可以解析", () => {
    for (const name of knownMacros) {
      expect(resolveMacro(name)).not.toBeNull();
    }
  });
});
