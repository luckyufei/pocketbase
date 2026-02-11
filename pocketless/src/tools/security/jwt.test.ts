/**
 * JWT 工具测试 — 签发/验证/解码
 * 对照 Go 版 tools/security/jwt_test.go 1:1 移植
 * T189
 */

import { describe, test, expect } from "bun:test";
import { signToken, verifyToken, decodeToken, buildSigningKey, type TokenClaims } from "./jwt";

const TEST_SECRET = "test-secret-key-for-jwt-testing-2024";

describe("signToken", () => {
  test("返回 JWT 字符串（3 段）", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
    );
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });

  test("字符串过期时间", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
      "1h",
    );
    const claims = decodeToken(token);
    expect(claims.exp).toBeDefined();
    // 1 小时后过期
    const exp = claims.exp as number;
    const now = Math.floor(Date.now() / 1000);
    expect(exp - now).toBeGreaterThan(3500);
    expect(exp - now).toBeLessThanOrEqual(3600);
  });

  test("数值过期时间（秒）", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
      300,
    );
    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const now = Math.floor(Date.now() / 1000);
    expect(exp - now).toBeGreaterThan(295);
    expect(exp - now).toBeLessThanOrEqual(300);
  });

  test("包含 iat 字段", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
    );
    const claims = decodeToken(token);
    expect(claims.iat).toBeDefined();
  });

  test("自定义 claims 字段", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1", refreshable: true, newEmail: "new@test.com" },
      TEST_SECRET,
    );
    const claims = decodeToken(token);
    expect(claims.id).toBe("user1");
    expect(claims.type).toBe("auth");
    expect(claims.collectionId).toBe("col1");
    expect(claims.refreshable).toBe(true);
    expect(claims.newEmail).toBe("new@test.com");
  });
});

describe("verifyToken", () => {
  test("正确密钥验证通过", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
    );
    const claims = await verifyToken(token, TEST_SECRET);
    expect(claims.id).toBe("user1");
    expect(claims.type).toBe("auth");
    expect(claims.collectionId).toBe("col1");
  });

  test("错误密钥验证失败", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
    );
    await expect(verifyToken(token, "wrong-secret")).rejects.toThrow();
  });

  test("过期 token 验证失败", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
      -10, // 已过期
    );
    await expect(verifyToken(token, TEST_SECRET)).rejects.toThrow();
  });

  test("篡改 token 验证失败", async () => {
    const token = await signToken(
      { id: "user1", type: "auth", collectionId: "col1" },
      TEST_SECRET,
    );
    const parts = token.split(".");
    parts[1] = parts[1] + "x"; // 篡改 payload
    const tampered = parts.join(".");
    await expect(verifyToken(tampered, TEST_SECRET)).rejects.toThrow();
  });
});

describe("decodeToken", () => {
  test("不验证签名解码", async () => {
    const token = await signToken(
      { id: "user1", type: "file", collectionId: "col1" },
      TEST_SECRET,
    );
    const claims = decodeToken(token);
    expect(claims.id).toBe("user1");
    expect(claims.type).toBe("file");
  });

  test("无效 token 抛出错误", () => {
    expect(() => decodeToken("not-a-jwt")).toThrow();
  });
});

describe("buildSigningKey", () => {
  test("拼接 tokenKey + tokenSecret", () => {
    expect(buildSigningKey("abc", "def")).toBe("abcdef");
  });

  test("空 tokenKey", () => {
    expect(buildSigningKey("", "secret")).toBe("secret");
  });

  test("空 tokenSecret", () => {
    expect(buildSigningKey("key", "")).toBe("key");
  });
});

describe("TokenType", () => {
  test("5 种 token 类型均可签发", async () => {
    const types: Array<TokenClaims["type"]> = ["auth", "file", "verification", "passwordReset", "emailChange"];
    for (const type of types) {
      const token = await signToken({ id: "u1", type, collectionId: "c1" }, TEST_SECRET);
      const claims = await verifyToken(token, TEST_SECRET);
      expect(claims.type).toBe(type);
    }
  });
});
