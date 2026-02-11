/**
 * 修饰符测试 — 对照 Go 版 core/record_field_resolver 修饰符行为
 * 覆盖 extractModifiers 和 SQL 应用函数
 */

import { describe, test, expect } from "bun:test";
import {
  extractModifiers,
  applyLengthModifier,
  applyLowerModifier,
  applyIssetModifier,
  knownModifiers,
  type Modifier,
} from "./modifiers";

// ─── extractModifiers ───

describe("extractModifiers", () => {
  test("无修饰符", () => {
    const [path, mods] = extractModifiers("name");
    expect(path).toBe("name");
    expect(mods).toHaveLength(0);
  });

  test(":length", () => {
    const [path, mods] = extractModifiers("tags:length");
    expect(path).toBe("tags");
    expect(mods).toEqual(["length"]);
  });

  test(":lower", () => {
    const [path, mods] = extractModifiers("name:lower");
    expect(path).toBe("name");
    expect(mods).toEqual(["lower"]);
  });

  test(":isset", () => {
    const [path, mods] = extractModifiers("email:isset");
    expect(path).toBe("email");
    expect(mods).toEqual(["isset"]);
  });

  test(":changed", () => {
    const [path, mods] = extractModifiers("title:changed");
    expect(path).toBe("title");
    expect(mods).toEqual(["changed"]);
  });

  test(":each", () => {
    const [path, mods] = extractModifiers("items:each");
    expect(path).toBe("items");
    expect(mods).toEqual(["each"]);
  });

  test("多个修饰符 :each:lower", () => {
    const [path, mods] = extractModifiers("tags:each:lower");
    expect(path).toBe("tags");
    expect(mods).toEqual(["each", "lower"]);
  });

  test("非修饰符的冒号保留在路径中", () => {
    const [path, mods] = extractModifiers("@collection:alias.field");
    expect(path).toBe("@collection:alias.field");
    expect(mods).toHaveLength(0);
  });

  test("混合路径和修饰符", () => {
    const [path, mods] = extractModifiers("@collection:users.tags:length");
    expect(path).toBe("@collection:users.tags");
    expect(mods).toEqual(["length"]);
  });

  test("空路径", () => {
    const [path, mods] = extractModifiers("");
    expect(path).toBe("");
    expect(mods).toHaveLength(0);
  });

  test("只有修饰符", () => {
    const [path, mods] = extractModifiers(":length");
    expect(path).toBe("");
    expect(mods).toEqual(["length"]);
  });
});

// ─── knownModifiers ───

describe("knownModifiers", () => {
  test("包含 5 种修饰符", () => {
    expect(knownModifiers).toHaveLength(5);
    expect(knownModifiers).toContain("isset");
    expect(knownModifiers).toContain("changed");
    expect(knownModifiers).toContain("length");
    expect(knownModifiers).toContain("each");
    expect(knownModifiers).toContain("lower");
  });
});

// ─── SQL 应用函数 ───

describe("applyLengthModifier", () => {
  test("SQLite", () => {
    expect(applyLengthModifier('"tags"', "sqlite")).toBe('JSON_ARRAY_LENGTH("tags")');
  });

  test("PostgreSQL", () => {
    expect(applyLengthModifier('"tags"', "postgres")).toBe('jsonb_array_length("tags")');
  });
});

describe("applyLowerModifier", () => {
  test("包装 LOWER()", () => {
    expect(applyLowerModifier('"name"')).toBe('LOWER("name")');
  });
});

describe("applyIssetModifier", () => {
  test("生成 IS NOT NULL AND != '' 表达式", () => {
    const result = applyIssetModifier('"email"');
    expect(result).toBe('("email" IS NOT NULL AND "email" != \'\')');
  });
});
