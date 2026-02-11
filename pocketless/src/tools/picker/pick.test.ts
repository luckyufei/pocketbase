/**
 * Picker 测试 — T045
 * 覆盖基础字段选择、嵌套路径、通配符、modifier
 */

import { describe, test, expect } from "bun:test";
import { pick } from "./pick";

describe("pick (T045)", () => {
  // ─── 基础用例 ───

  test("空 fields 返回原数据不变", () => {
    const data = { a: 1, b: 2, c: 3 };
    const result = pick(data, "");
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test("选择单个字段", () => {
    const data = { a: 1, b: 2, c: 3 };
    const result = pick(data, "a");
    expect(result).toEqual({ a: 1 });
  });

  test("选择多个字段", () => {
    const data = { a: 1, b: 2, c: 3 };
    const result = pick(data, "a,c");
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test("选择不存在的字段返回空对象", () => {
    const data = { a: 1, b: 2 };
    const result = pick(data, "x,y");
    expect(result).toEqual({});
  });

  // ─── 嵌套字段 ───

  test("嵌套字段选择 (dot notation)", () => {
    const data = { a: 1, b: { b1: 10, b2: 20 }, c: 3 };
    const result = pick(data, "a,b.b1");
    expect(result).toEqual({ a: 1, b: { b1: 10 } });
  });

  test("深层嵌套字段选择", () => {
    const data = { a: { b: { c: { d: 1, e: 2 } } } };
    const result = pick(data, "a.b.c.d");
    expect(result).toEqual({ a: { b: { c: { d: 1 } } } });
  });

  // ─── 通配符 ───

  test("根级 * 返回所有字段", () => {
    const data = { a: 1, b: 2, c: 3 };
    const result = pick(data, "*");
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test("* 加嵌套路径保留指定嵌套 + 其他所有根字段", () => {
    const data = { a: 1, b: { b1: 10, b2: 20 }, c: 3 };
    const result = pick(data, "*,b.b1");
    // * 保留 a, c 原样; b.b1 仅保留 b1
    expect(result).toEqual({ a: 1, b: { b1: 10 }, c: 3 });
  });

  // ─── 数组支持 ───

  test("数组中的 map 被逐个过滤", () => {
    const data = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
    ];
    const result = pick(data, "a,c");
    expect(result).toEqual([
      { a: 1, c: 3 },
      { a: 4, c: 6 },
    ]);
  });

  test("非 map 数组返回原样", () => {
    const data = [1, 2, 3];
    const result = pick(data, "a");
    expect(result).toEqual([1, 2, 3]);
  });

  // ─── 非对象数据 ───

  test("字符串数据返回原样", () => {
    const result = pick("hello", "a");
    expect(result).toBe("hello");
  });

  test("null 数据返回 null", () => {
    const result = pick(null, "a");
    expect(result).toBeNull();
  });

  // ─── 混合嵌套结构 ───

  test("嵌套数组中的 map 也被过滤", () => {
    const data = {
      items: [
        { id: "1", title: "A", body: "..." },
        { id: "2", title: "B", body: "..." },
      ],
    };
    const result = pick(data, "items.id,items.title");
    expect(result).toEqual({
      items: [
        { id: "1", title: "A" },
        { id: "2", title: "B" },
      ],
    });
  });
});
