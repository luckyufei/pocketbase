/**
 * 验证工具测试 — Zod 验证器
 * 对照 Go 版 validation 包
 * T195
 */

import { describe, test, expect } from "bun:test";
import {
  requiredString,
  email,
  url,
  minLength,
  maxLength,
  numberRange,
  recordId,
  collectionName,
  formatZodError,
  validate,
} from "./validation";
import { z } from "zod";

describe("requiredString", () => {
  test("非空字符串通过", () => {
    expect(requiredString.safeParse("hello").success).toBe(true);
  });

  test("空字符串失败", () => {
    expect(requiredString.safeParse("").success).toBe(false);
  });

  test("非字符串失败", () => {
    expect(requiredString.safeParse(123).success).toBe(false);
  });
});

describe("email", () => {
  test("有效邮箱", () => {
    expect(email.safeParse("user@example.com").success).toBe(true);
  });

  test("无效邮箱", () => {
    expect(email.safeParse("not-email").success).toBe(false);
  });

  test("空字符串", () => {
    expect(email.safeParse("").success).toBe(false);
  });
});

describe("url", () => {
  test("有效 URL", () => {
    expect(url.safeParse("https://example.com").success).toBe(true);
    expect(url.safeParse("http://localhost:3000").success).toBe(true);
  });

  test("无效 URL", () => {
    expect(url.safeParse("not-a-url").success).toBe(false);
  });
});

describe("minLength", () => {
  test("达到最小长度通过", () => {
    expect(minLength(3).safeParse("abc").success).toBe(true);
  });

  test("超过最小长度通过", () => {
    expect(minLength(3).safeParse("abcde").success).toBe(true);
  });

  test("不足最小长度失败", () => {
    expect(minLength(3).safeParse("ab").success).toBe(false);
  });
});

describe("maxLength", () => {
  test("在最大长度内通过", () => {
    expect(maxLength(5).safeParse("abc").success).toBe(true);
  });

  test("恰好最大长度通过", () => {
    expect(maxLength(5).safeParse("abcde").success).toBe(true);
  });

  test("超过最大长度失败", () => {
    expect(maxLength(5).safeParse("abcdef").success).toBe(false);
  });
});

describe("numberRange", () => {
  test("在范围内通过", () => {
    expect(numberRange(1, 10).safeParse(5).success).toBe(true);
  });

  test("等于最小值通过", () => {
    expect(numberRange(1, 10).safeParse(1).success).toBe(true);
  });

  test("等于最大值通过", () => {
    expect(numberRange(1, 10).safeParse(10).success).toBe(true);
  });

  test("小于最小值失败", () => {
    expect(numberRange(1, 10).safeParse(0).success).toBe(false);
  });

  test("大于最大值失败", () => {
    expect(numberRange(1, 10).safeParse(11).success).toBe(false);
  });

  test("仅 min", () => {
    expect(numberRange(0).safeParse(-1).success).toBe(false);
    expect(numberRange(0).safeParse(0).success).toBe(true);
    expect(numberRange(0).safeParse(999).success).toBe(true);
  });

  test("仅 max", () => {
    expect(numberRange(undefined, 100).safeParse(100).success).toBe(true);
    expect(numberRange(undefined, 100).safeParse(101).success).toBe(false);
  });

  test("无限制", () => {
    expect(numberRange().safeParse(-999).success).toBe(true);
    expect(numberRange().safeParse(999).success).toBe(true);
  });
});

describe("recordId", () => {
  test("15 字符 a-z0-9 通过", () => {
    expect(recordId.safeParse("abc123def456ghi").success).toBe(true);
  });

  test("14 字符失败", () => {
    expect(recordId.safeParse("abc123def456gh").success).toBe(false);
  });

  test("16 字符失败", () => {
    expect(recordId.safeParse("abc123def456ghij").success).toBe(false);
  });

  test("包含大写失败", () => {
    expect(recordId.safeParse("ABC123def456ghi").success).toBe(false);
  });

  test("包含特殊字符失败", () => {
    expect(recordId.safeParse("abc-23def456ghi").success).toBe(false);
  });
});

describe("collectionName", () => {
  test("字母开头通过", () => {
    expect(collectionName.safeParse("users").success).toBe(true);
  });

  test("下划线开头通过", () => {
    expect(collectionName.safeParse("_system").success).toBe(true);
  });

  test("字母数字下划线混合通过", () => {
    expect(collectionName.safeParse("user_posts_2024").success).toBe(true);
  });

  test("数字开头失败", () => {
    expect(collectionName.safeParse("123abc").success).toBe(false);
  });

  test("包含连字符失败", () => {
    expect(collectionName.safeParse("user-posts").success).toBe(false);
  });

  test("空字符串失败", () => {
    expect(collectionName.safeParse("").success).toBe(false);
  });

  test("包含空格失败", () => {
    expect(collectionName.safeParse("user posts").success).toBe(false);
  });
});

describe("formatZodError", () => {
  test("转换 Zod 错误为 PocketBase 格式", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    const result = schema.safeParse({ name: "", age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.name).toBeDefined();
      expect(formatted.name.code).toContain("validation_");
      expect(formatted.age).toBeDefined();
    }
  });

  test("嵌套路径用点号连接", () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });

    const result = schema.safeParse({ user: { email: "bad" } });
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted["user.email"]).toBeDefined();
    }
  });
});

describe("validate", () => {
  test("成功返回 data", () => {
    const result = validate(z.string(), "hello");
    expect(result.data).toBe("hello");
    expect(result.errors).toBeUndefined();
  });

  test("失败返回 errors", () => {
    const result = validate(z.number(), "not a number");
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
  });

  test("复杂 schema 验证", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0).max(150),
    });

    const ok = validate(schema, { name: "Test", age: 25 });
    expect(ok.data).toEqual({ name: "Test", age: 25 });

    const fail = validate(schema, { name: "", age: 200 });
    expect(fail.errors).toBeDefined();
    expect(fail.errors!.name).toBeDefined();
    expect(fail.errors!.age).toBeDefined();
  });
});
