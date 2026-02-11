/**
 * 密码工具测试 — bcrypt 哈希与验证
 * TDD RED phase
 */

import { describe, test, expect } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  test("should return a bcrypt hash string", async () => {
    const hash = await hashPassword("Test123456");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
    // bcrypt 哈希以 $2b$ 或 $2a$ 开头
    expect(hash.startsWith("$2")).toBe(true);
  });

  test("same password should produce different hashes (salt)", async () => {
    const hash1 = await hashPassword("Test123456");
    const hash2 = await hashPassword("Test123456");
    expect(hash1).not.toBe(hash2);
  });

  test("different passwords should produce different hashes", async () => {
    const hash1 = await hashPassword("password1");
    const hash2 = await hashPassword("password2");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  test("correct password should verify", async () => {
    const hash = await hashPassword("Test123456");
    const result = await verifyPassword("Test123456", hash);
    expect(result).toBe(true);
  });

  test("wrong password should not verify", async () => {
    const hash = await hashPassword("Test123456");
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  test("empty hash should return false", async () => {
    const result = await verifyPassword("Test123456", "");
    expect(result).toBe(false);
  });

  test("invalid hash should return false", async () => {
    const result = await verifyPassword("Test123456", "not-a-hash");
    expect(result).toBe(false);
  });

  test("empty password against valid hash should not verify", async () => {
    const hash = await hashPassword("Test123456");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });
});
