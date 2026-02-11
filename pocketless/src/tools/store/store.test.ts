/**
 * Store 测试 — KV 存储
 * 对照 Go 版 tools/store/store_test.go 1:1 移植
 * T191
 */

import { describe, test, expect } from "bun:test";
import { Store } from "./store";

describe("Store", () => {
  test("初始状态为空", () => {
    const s = new Store<string>();
    expect(s.length()).toBe(0);
  });

  test("set 和 get", () => {
    const s = new Store<number>();
    s.set("a", 1);
    expect(s.get("a")).toBe(1);
  });

  test("get 不存在返回 undefined", () => {
    const s = new Store<string>();
    expect(s.get("missing")).toBeUndefined();
  });

  test("set 覆盖已有值", () => {
    const s = new Store<string>();
    s.set("key", "old");
    s.set("key", "new");
    expect(s.get("key")).toBe("new");
    expect(s.length()).toBe(1);
  });

  test("has — 存在", () => {
    const s = new Store<number>();
    s.set("x", 42);
    expect(s.has("x")).toBe(true);
  });

  test("has — 不存在", () => {
    const s = new Store<number>();
    expect(s.has("x")).toBe(false);
  });

  test("delete — 已有键", () => {
    const s = new Store<string>();
    s.set("key", "val");
    s.delete("key");
    expect(s.has("key")).toBe(false);
    expect(s.length()).toBe(0);
  });

  test("delete — 不存在的键不报错", () => {
    const s = new Store<string>();
    s.delete("nonexistent");
    expect(s.length()).toBe(0);
  });

  test("getAll 返回副本", () => {
    const s = new Store<number>();
    s.set("a", 1);
    s.set("b", 2);

    const all = s.getAll();
    expect(all.size).toBe(2);
    expect(all.get("a")).toBe(1);
    expect(all.get("b")).toBe(2);

    // 修改副本不影响原始
    all.set("c", 3);
    expect(s.has("c")).toBe(false);
  });

  test("reset 清空所有", () => {
    const s = new Store<number>();
    s.set("a", 1);
    s.set("b", 2);
    s.reset();
    expect(s.length()).toBe(0);
    expect(s.get("a")).toBeUndefined();
  });

  test("length 正确计数", () => {
    const s = new Store<number>();
    expect(s.length()).toBe(0);
    s.set("a", 1);
    expect(s.length()).toBe(1);
    s.set("b", 2);
    expect(s.length()).toBe(2);
    s.delete("a");
    expect(s.length()).toBe(1);
  });

  test("forEach 遍历所有键值", () => {
    const s = new Store<number>();
    s.set("a", 1);
    s.set("b", 2);
    s.set("c", 3);

    const collected: Record<string, number> = {};
    s.forEach((val, key) => {
      collected[key] = val;
    });

    expect(collected).toEqual({ a: 1, b: 2, c: 3 });
  });

  test("forEach 空 Store 不调用回调", () => {
    const s = new Store<number>();
    let called = false;
    s.forEach(() => { called = true; });
    expect(called).toBe(false);
  });

  test("getOrSet — 键不存在时创建", () => {
    const s = new Store<number>();
    const val = s.getOrSet("key", () => 42);
    expect(val).toBe(42);
    expect(s.get("key")).toBe(42);
  });

  test("getOrSet — 键已存在不调用工厂", () => {
    const s = new Store<number>();
    s.set("key", 100);
    let factoryCalled = false;
    const val = s.getOrSet("key", () => { factoryCalled = true; return 999; });
    expect(val).toBe(100);
    expect(factoryCalled).toBe(false);
  });

  test("不同类型值", () => {
    const s = new Store<unknown>();
    s.set("str", "hello");
    s.set("num", 42);
    s.set("bool", true);
    s.set("obj", { a: 1 });
    s.set("arr", [1, 2, 3]);
    s.set("null", null);

    expect(s.get("str")).toBe("hello");
    expect(s.get("num")).toBe(42);
    expect(s.get("bool")).toBe(true);
    expect(s.get("obj")).toEqual({ a: 1 });
    expect(s.get("arr")).toEqual([1, 2, 3]);
    expect(s.get("null")).toBeNull();
  });
});
