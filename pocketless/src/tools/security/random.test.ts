/**
 * 随机工具测试 — ID 生成、随机字符串
 * 对照 Go 版 tools/security/random_test.go 1:1 移植
 * T190
 */

import { describe, test, expect } from "bun:test";
import { generateId, randomString, randomStringWithAlphabet, generateTokenKey } from "./random";

describe("generateId", () => {
  test("默认 15 字符长度", () => {
    const id = generateId();
    expect(id.length).toBe(15);
  });

  test("仅包含 a-z0-9", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    }
  });

  test("自定义长度", () => {
    expect(generateId(1).length).toBe(1);
    expect(generateId(10).length).toBe(10);
    expect(generateId(50).length).toBe(50);
  });

  test("唯一性（100 个 ID 不重复）", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  test("长度 0 返回空字符串", () => {
    expect(generateId(0)).toBe("");
  });
});

describe("randomString", () => {
  test("指定长度", () => {
    expect(randomString(10).length).toBe(10);
    expect(randomString(32).length).toBe(32);
  });

  test("包含大小写字母和数字", () => {
    // 生成足够多的字符串来验证字母表覆盖
    let combined = "";
    for (let i = 0; i < 100; i++) {
      combined += randomString(20);
    }
    expect(combined).toMatch(/[a-z]/);
    expect(combined).toMatch(/[A-Z]/);
    expect(combined).toMatch(/[0-9]/);
  });

  test("长度 0 返回空字符串", () => {
    expect(randomString(0)).toBe("");
  });

  test("唯一性", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(randomString(20));
    }
    expect(set.size).toBe(100);
  });
});

describe("randomStringWithAlphabet", () => {
  test("仅使用指定字母表", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomStringWithAlphabet(20, "abc");
      expect(s).toMatch(/^[abc]+$/);
    }
  });

  test("单字符字母表", () => {
    const s = randomStringWithAlphabet(10, "x");
    expect(s).toBe("xxxxxxxxxx");
  });

  test("数字字母表", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomStringWithAlphabet(10, "0123456789");
      expect(s).toMatch(/^[0-9]+$/);
    }
  });

  test("长度 0 返回空字符串", () => {
    expect(randomStringWithAlphabet(0, "abc")).toBe("");
  });
});

describe("generateTokenKey", () => {
  test("返回 50 字符长度", () => {
    const key = generateTokenKey();
    expect(key.length).toBe(50);
  });

  test("包含大小写字母和数字", () => {
    let combined = "";
    for (let i = 0; i < 20; i++) {
      combined += generateTokenKey();
    }
    expect(combined).toMatch(/[a-z]/);
    expect(combined).toMatch(/[A-Z]/);
    expect(combined).toMatch(/[0-9]/);
  });

  test("唯一性", () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateTokenKey());
    }
    expect(set.size).toBe(50);
  });
});
