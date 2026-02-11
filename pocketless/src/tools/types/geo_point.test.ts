/**
 * GeoPoint 测试 — 构造、序列化、验证
 * 对照 Go 版 tools/types/geo_point_test.go 1:1 移植
 * T193
 */

import { describe, test, expect } from "bun:test";
import { GeoPoint } from "./geo_point";

describe("GeoPoint 构造", () => {
  test("默认值为 (0, 0)", () => {
    const p = new GeoPoint();
    expect(p.lon).toBe(0);
    expect(p.lat).toBe(0);
  });

  test("自定义值", () => {
    const p = new GeoPoint(116.397, 39.907);
    expect(p.lon).toBe(116.397);
    expect(p.lat).toBe(39.907);
  });

  test("负数坐标", () => {
    const p = new GeoPoint(-73.9857, 40.7484);
    expect(p.lon).toBe(-73.9857);
    expect(p.lat).toBe(40.7484);
  });

  test("lon/lat 可直接赋值", () => {
    const p = new GeoPoint();
    p.lon = 100;
    p.lat = 200;
    expect(p.lon).toBe(100);
    expect(p.lat).toBe(200);
  });
});

describe("GeoPoint.toJSON", () => {
  test("返回 {lon, lat} 对象", () => {
    const p = new GeoPoint(1.5, 2.5);
    expect(p.toJSON()).toEqual({ lon: 1.5, lat: 2.5 });
  });

  test("零值", () => {
    const p = new GeoPoint();
    expect(p.toJSON()).toEqual({ lon: 0, lat: 0 });
  });
});

describe("GeoPoint.fromJSON", () => {
  test("从对象解析", () => {
    const p = GeoPoint.fromJSON({ lon: 116.397, lat: 39.907 });
    expect(p.lon).toBe(116.397);
    expect(p.lat).toBe(39.907);
  });

  test("字符串值自动转数字", () => {
    const p = GeoPoint.fromJSON({ lon: "116.5", lat: "39.5" });
    expect(p.lon).toBe(116.5);
    expect(p.lat).toBe(39.5);
  });

  test("无效值转为 0", () => {
    const p = GeoPoint.fromJSON({ lon: "abc", lat: null });
    expect(p.lon).toBe(0);
    expect(p.lat).toBe(0);
  });

  test("缺少字段返回零值", () => {
    const p = GeoPoint.fromJSON({ other: 123 });
    expect(p.lon).toBe(0);
    expect(p.lat).toBe(0);
  });

  test("null 返回零值", () => {
    const p = GeoPoint.fromJSON(null);
    expect(p.lon).toBe(0);
    expect(p.lat).toBe(0);
  });

  test("undefined 返回零值", () => {
    const p = GeoPoint.fromJSON(undefined);
    expect(p.lon).toBe(0);
    expect(p.lat).toBe(0);
  });

  test("原始类型返回零值", () => {
    const p = GeoPoint.fromJSON(42);
    expect(p.lon).toBe(0);
    expect(p.lat).toBe(0);
  });
});

describe("GeoPoint.toString", () => {
  test("JSON 格式", () => {
    const p = new GeoPoint(1.5, 2.5);
    const s = p.toString();
    expect(JSON.parse(s)).toEqual({ lon: 1.5, lat: 2.5 });
  });

  test("零值", () => {
    const s = new GeoPoint().toString();
    expect(JSON.parse(s)).toEqual({ lon: 0, lat: 0 });
  });
});

describe("GeoPoint 互操作", () => {
  test("toJSON → fromJSON 往返", () => {
    const original = new GeoPoint(116.397, 39.907);
    const restored = GeoPoint.fromJSON(original.toJSON());
    expect(restored.lon).toBe(original.lon);
    expect(restored.lat).toBe(original.lat);
  });

  test("toString → JSON.parse → fromJSON 往返", () => {
    const original = new GeoPoint(-73.9857, 40.7484);
    const restored = GeoPoint.fromJSON(JSON.parse(original.toString()));
    expect(restored.lon).toBe(original.lon);
    expect(restored.lat).toBe(original.lat);
  });
});
