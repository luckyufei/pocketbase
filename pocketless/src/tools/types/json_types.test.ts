/**
 * JSON 集合类型测试 — JSONArray, JSONMap, JSONRaw, Vector
 * 对照 Go 版 tools/types/json_*_test.go 1:1 移植
 * T194
 */

import { describe, test, expect } from "bun:test";
import { JSONArray, JSONMap, JSONRaw, Vector } from "./json_types";

// ─── JSONArray ───

describe("JSONArray", () => {
  test("默认空数组", () => {
    const a = new JSONArray();
    expect(a.get()).toEqual([]);
    expect(a.length()).toBe(0);
  });

  test("从数组构造", () => {
    const a = new JSONArray([1, 2, 3]);
    expect(a.get()).toEqual([1, 2, 3]);
    expect(a.length()).toBe(3);
  });

  test("构造复制数组（不共享引用）", () => {
    const arr = [1, 2, 3];
    const a = new JSONArray(arr);
    arr.push(4);
    expect(a.get()).toEqual([1, 2, 3]);
  });

  test("get 返回副本", () => {
    const a = new JSONArray([1, 2]);
    const g = a.get();
    g.push(3);
    expect(a.get()).toEqual([1, 2]);
  });

  test("set 替换内容", () => {
    const a = new JSONArray([1]);
    a.set([4, 5, 6]);
    expect(a.get()).toEqual([4, 5, 6]);
  });

  test("toJSON 返回原始数组", () => {
    const a = new JSONArray(["a", "b"]);
    expect(a.toJSON()).toEqual(["a", "b"]);
  });

  test("fromJSON — 数组", () => {
    const a = JSONArray.fromJSON([1, 2]);
    expect(a.get()).toEqual([1, 2]);
  });

  test("fromJSON — JSON 字符串", () => {
    const a = JSONArray.fromJSON('[1,2,3]');
    expect(a.get()).toEqual([1, 2, 3]);
  });

  test("fromJSON — 无效字符串返回空", () => {
    const a = JSONArray.fromJSON("not json");
    expect(a.get()).toEqual([]);
  });

  test("fromJSON — 对象字符串返回空", () => {
    const a = JSONArray.fromJSON('{"a":1}');
    expect(a.get()).toEqual([]);
  });

  test("fromJSON — null 返回空", () => {
    const a = JSONArray.fromJSON(null);
    expect(a.get()).toEqual([]);
  });

  test("fromJSON — 数字返回空", () => {
    const a = JSONArray.fromJSON(42);
    expect(a.get()).toEqual([]);
  });
});

// ─── JSONMap ───

describe("JSONMap", () => {
  test("默认空对象", () => {
    const m = new JSONMap();
    expect(m.keys()).toEqual([]);
  });

  test("从对象构造", () => {
    const m = new JSONMap({ a: 1, b: 2 });
    expect(m.get("a")).toBe(1);
    expect(m.get("b")).toBe(2);
  });

  test("构造复制对象", () => {
    const obj = { a: 1 };
    const m = new JSONMap(obj);
    obj.a = 999;
    expect(m.get("a")).toBe(1);
  });

  test("get 不存在返回 undefined", () => {
    const m = new JSONMap();
    expect(m.get("missing")).toBeUndefined();
  });

  test("set 和 get", () => {
    const m = new JSONMap<number>();
    m.set("x", 42);
    expect(m.get("x")).toBe(42);
  });

  test("has", () => {
    const m = new JSONMap({ a: 1 });
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
  });

  test("delete", () => {
    const m = new JSONMap({ a: 1, b: 2 });
    m.delete("a");
    expect(m.has("a")).toBe(false);
    expect(m.has("b")).toBe(true);
  });

  test("keys", () => {
    const m = new JSONMap({ c: 3, a: 1, b: 2 });
    expect(m.keys().sort()).toEqual(["a", "b", "c"]);
  });

  test("toJSON 返回副本", () => {
    const m = new JSONMap({ a: 1 });
    const j = m.toJSON();
    j.b = 2;
    expect(m.has("b")).toBe(false);
  });

  test("fromJSON — 对象", () => {
    const m = JSONMap.fromJSON({ a: 1 });
    expect(m.get("a")).toBe(1);
  });

  test("fromJSON — JSON 字符串", () => {
    const m = JSONMap.fromJSON('{"a":1}');
    expect(m.get("a")).toBe(1);
  });

  test("fromJSON — 数组返回空", () => {
    const m = JSONMap.fromJSON([1, 2]);
    expect(m.keys()).toEqual([]);
  });

  test("fromJSON — 无效字符串返回空", () => {
    const m = JSONMap.fromJSON("not json");
    expect(m.keys()).toEqual([]);
  });

  test("fromJSON — null 返回空", () => {
    const m = JSONMap.fromJSON(null);
    expect(m.keys()).toEqual([]);
  });
});

// ─── JSONRaw ───

describe("JSONRaw", () => {
  test("默认 null", () => {
    const r = new JSONRaw();
    expect(r.get()).toBeNull();
  });

  test("保持原始值", () => {
    expect(new JSONRaw(42).get()).toBe(42);
    expect(new JSONRaw("hello").get()).toBe("hello");
    expect(new JSONRaw(true).get()).toBe(true);
    expect(new JSONRaw([1, 2]).get()).toEqual([1, 2]);
    expect(new JSONRaw({ a: 1 }).get()).toEqual({ a: 1 });
  });

  test("set 更新值", () => {
    const r = new JSONRaw(1);
    r.set("updated");
    expect(r.get()).toBe("updated");
  });

  test("toJSON", () => {
    expect(new JSONRaw(42).toJSON()).toBe(42);
    expect(new JSONRaw("hi").toJSON()).toBe("hi");
  });

  test("toString", () => {
    expect(new JSONRaw(42).toString()).toBe("42");
    expect(new JSONRaw("hi").toString()).toBe('"hi"');
    expect(new JSONRaw([1, 2]).toString()).toBe("[1,2]");
  });

  test("fromJSON — 字符串解析为 JSON", () => {
    const r = JSONRaw.fromJSON('{"a":1}');
    expect(r.get()).toEqual({ a: 1 });
  });

  test("fromJSON — 无效 JSON 字符串保持原样", () => {
    const r = JSONRaw.fromJSON("plain text");
    expect(r.get()).toBe("plain text");
  });

  test("fromJSON — 非字符串直接包裹", () => {
    expect(JSONRaw.fromJSON(42).get()).toBe(42);
    expect(JSONRaw.fromJSON(null).get()).toBeNull();
    expect(JSONRaw.fromJSON([1]).get()).toEqual([1]);
  });
});

// ─── Vector ───

describe("Vector", () => {
  test("默认空向量", () => {
    const v = new Vector();
    expect(v.get()).toEqual([]);
    expect(v.dimension()).toBe(0);
  });

  test("从数组构造", () => {
    const v = new Vector([1, 2, 3]);
    expect(v.get()).toEqual([1, 2, 3]);
    expect(v.dimension()).toBe(3);
  });

  test("构造复制数组", () => {
    const arr = [1, 2, 3];
    const v = new Vector(arr);
    arr.push(4);
    expect(v.get()).toEqual([1, 2, 3]);
  });

  test("get 返回副本", () => {
    const v = new Vector([1, 2]);
    const g = v.get();
    g.push(3);
    expect(v.get()).toEqual([1, 2]);
  });

  test("set 替换内容", () => {
    const v = new Vector([1]);
    v.set([4, 5, 6]);
    expect(v.get()).toEqual([4, 5, 6]);
  });

  test("toJSON", () => {
    const v = new Vector([1.5, 2.5, 3.5]);
    expect(v.toJSON()).toEqual([1.5, 2.5, 3.5]);
  });

  test("toPgVector 格式", () => {
    const v = new Vector([1, 2, 3]);
    expect(v.toPgVector()).toBe("[1,2,3]");
  });

  test("toPgVector 空向量", () => {
    const v = new Vector();
    expect(v.toPgVector()).toBe("[]");
  });

  test("fromJSON — 数组", () => {
    const v = Vector.fromJSON([1, 2, 3]);
    expect(v.get()).toEqual([1, 2, 3]);
  });

  test("fromJSON — 字符串数组", () => {
    const v = Vector.fromJSON(["1", "2", "3"]);
    expect(v.get()).toEqual([1, 2, 3]);
  });

  test("fromJSON — JSON 字符串", () => {
    const v = Vector.fromJSON("[1,2,3]");
    expect(v.get()).toEqual([1, 2, 3]);
  });

  test("fromJSON — pgvector 格式字符串", () => {
    const v = Vector.fromJSON("[1.5,2.5,3.5]");
    expect(v.get()).toEqual([1.5, 2.5, 3.5]);
  });

  test("fromJSON — null 返回空", () => {
    const v = Vector.fromJSON(null);
    expect(v.get()).toEqual([]);
  });

  test("fromJSON — 非法值返回空", () => {
    const v = Vector.fromJSON(42);
    expect(v.get()).toEqual([]);
  });
});
