/**
 * AES-256-GCM 加解密测试
 * 对照 Go 版 tools/security/encrypt_test.go 1:1 移植
 * T188
 */

import { describe, test, expect } from "bun:test";
import { encrypt, decrypt } from "./crypto";

// 32 字节测试密钥
const TEST_KEY = "12345678901234567890123456789012";

describe("encrypt", () => {
  test("加密返回 base64 字符串", () => {
    const result = encrypt("hello", TEST_KEY);
    expect(typeof result).toBe("string");
    // base64 格式验证
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test("相同明文每次加密结果不同（nonce 随机）", () => {
    const r1 = encrypt("same data", TEST_KEY);
    const r2 = encrypt("same data", TEST_KEY);
    expect(r1).not.toBe(r2);
  });

  test("空字符串可加密", () => {
    const result = encrypt("", TEST_KEY);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("密钥不是 32 字节抛出错误", () => {
    expect(() => encrypt("test", "short")).toThrow("32 字节");
  });

  test("密钥 31 字节抛出错误", () => {
    expect(() => encrypt("test", "1234567890123456789012345678901")).toThrow("32 字节");
  });

  test("密钥 33 字节抛出错误", () => {
    expect(() => encrypt("test", "123456789012345678901234567890123")).toThrow("32 字节");
  });
});

describe("decrypt", () => {
  test("解密加密数据返回原文", () => {
    const encrypted = encrypt("hello world", TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe("hello world");
  });

  test("空字符串加密后可解密", () => {
    const encrypted = encrypt("", TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe("");
  });

  test("特殊字符加密后可解密", () => {
    const special = "Hello 你好 🌍 <script>alert(1)</script> \n\t";
    const encrypted = encrypt(special, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(special);
  });

  test("长文本加密后可解密", () => {
    const long = "x".repeat(10000);
    const encrypted = encrypt(long, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(long);
  });

  test("错误密钥解密抛出错误", () => {
    const encrypted = encrypt("test", TEST_KEY);
    const wrongKey = "abcdefghijklmnopqrstuvwxyz012345";
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  test("篡改密文抛出错误", () => {
    const encrypted = encrypt("test", TEST_KEY);
    // 翻转一个字符
    const tampered = encrypted.slice(0, 10) + "X" + encrypted.slice(11);
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  test("过短数据抛出错误", () => {
    expect(() => decrypt("dG9vc2hvcnQ=", TEST_KEY)).toThrow("长度无效");
  });

  test("非 base64 数据抛出错误", () => {
    expect(() => decrypt("not-valid-base64!!!", TEST_KEY)).toThrow();
  });

  test("密钥不是 32 字节抛出错误", () => {
    expect(() => decrypt("dGVzdA==", "short")).toThrow("32 字节");
  });
});

describe("encrypt/decrypt 互通", () => {
  test("多次加解密一致性", () => {
    const testCases = [
      "simple text",
      "",
      "a",
      JSON.stringify({ key: "value", num: 123 }),
      "line1\nline2\nline3",
    ];

    for (const tc of testCases) {
      const encrypted = encrypt(tc, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(tc);
    }
  });
});
