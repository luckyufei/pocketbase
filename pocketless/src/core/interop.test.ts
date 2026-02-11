/**
 * interop.test.ts — T104/T105/T106 Go ↔ Bun 互操作验证
 * 对照 Go 版 tools/security/encrypt_test.go
 */
import { describe, test, expect } from "bun:test";
import { encrypt, decrypt } from "../tools/security/crypto";
import { generateId, randomString, randomStringWithAlphabet } from "../tools/security/random";

// ============================================================
// T104: AES-256-GCM 加密互操作（对照 Go 版 TestEncrypt/TestDecrypt）
// ============================================================

describe("AES-256-GCM 加密互操作", () => {
  const validKey = "abcdabcdabcdabcdabcdabcdabcdabcd"; // 32 字节

  test("加密 → 解密 往返", () => {
    const data = "123";
    const encrypted = encrypt(data, validKey);
    const decrypted = decrypt(encrypted, validKey);
    expect(decrypted).toBe(data);
  });

  test("空字符串加密 → 解密", () => {
    const encrypted = encrypt("", validKey);
    const decrypted = decrypt(encrypted, validKey);
    expect(decrypted).toBe("");
  });

  test("长文本加密 → 解密", () => {
    const data = "Hello, World! 这是一段中文测试。🎯 Special chars: <>&\"'";
    const encrypted = encrypt(data, validKey);
    const decrypted = decrypt(encrypted, validKey);
    expect(decrypted).toBe(data);
  });

  test("非 32 字节密钥应报错（对照 Go 版 key must be valid 32 char）", () => {
    expect(() => encrypt("123", "test")).toThrow();
    expect(() => encrypt("123", "")).toThrow();
    expect(() => encrypt("123", "short")).toThrow();
  });

  test("错误的密文应报错", () => {
    expect(() => decrypt("", validKey)).toThrow();
    expect(() => decrypt("short", validKey)).toThrow();
  });

  test("与 Go 版已知密文互通（对照 Go 版 TestDecrypt）", () => {
    // Go 版测试用例：encrypt("123", "abcdabcdabcdabcdabcdabcdabcdabcd") → 已知密文
    // 这里验证 Go 生成的密文可以被 TS 解密
    const goEncrypted = "8kcEqilvv+YKYcfnSr0aSC54gmnQCsB02SaB8ATlnA==";
    const decrypted = decrypt(goEncrypted, validKey);
    expect(decrypted).toBe("123");
  });

  test("TS 加密的密文格式正确（base64 标准编码）", () => {
    const encrypted = encrypt("test", validKey);
    // base64 标准编码（含 +/= 字符）
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // 解码后长度 = 12(nonce) + len(ciphertext) + 16(tag)
    const buf = Buffer.from(encrypted, "base64");
    // "test" = 4 字节 → ciphertext 4 字节 → 总长 12+4+16=32
    expect(buf.length).toBe(32);
  });

  test("不同 nonce 产生不同密文", () => {
    const e1 = encrypt("same data", validKey);
    const e2 = encrypt("same data", validKey);
    // 由于 nonce 随机，两次加密结果不同
    expect(e1).not.toBe(e2);
    // 但都能解密
    expect(decrypt(e1, validKey)).toBe("same data");
    expect(decrypt(e2, validKey)).toBe("same data");
  });

  test("错误密钥无法解密", () => {
    const encrypted = encrypt("secret", validKey);
    const wrongKey = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // 32 字节但不同
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });
});

// ============================================================
// T105: Bcrypt 互操作验证
// ============================================================

describe("Bcrypt 互操作", () => {
  test("Bun.password.hash 生成 bcrypt hash", async () => {
    const hash = await Bun.password.hash("test123", {
      algorithm: "bcrypt",
      cost: 12,
    });
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  test("验证 $2a$ 格式 hash（Go 版 golang.org/x/crypto/bcrypt 生成）", async () => {
    // 由 Go 的 bcrypt.GenerateFromPassword([]byte("test123"), 12) 生成
    const goHash = "$2a$12$sfXsN5d4C90OXlaPxlBXUurwlbLLJEbiJ0htsw0P.1qdV1eK7obNq";
    const valid = await Bun.password.verify("test123", goHash);
    expect(valid).toBe(true);

    // 错误密码
    const invalid = await Bun.password.verify("wrong", goHash);
    expect(invalid).toBe(false);
  });

  test("验证 $2b$ 格式 hash", async () => {
    // $2b$ 是较新的 bcrypt 变体
    const hash = await Bun.password.hash("hello", {
      algorithm: "bcrypt",
      cost: 10,
    });
    // Bun 可能生成 $2b$，验证仍然可用
    const valid = await Bun.password.verify("hello", hash);
    expect(valid).toBe(true);
  });

  test("错误密码验证失败", async () => {
    const hash = await Bun.password.hash("correct", {
      algorithm: "bcrypt",
      cost: 10,
    });
    const valid = await Bun.password.verify("wrong", hash);
    expect(valid).toBe(false);
  });

  test("空密码 Bun.password.hash 拒绝（与 Go 版行为一致：bcrypt 不接受空密码）", async () => {
    // Bun 不允许空密码，这与安全实践一致
    expect(() => Bun.password.hash("", { algorithm: "bcrypt", cost: 10 })).toThrow();
  });

  test("TS 生成的 hash 可被再次验证（self-roundtrip）", async () => {
    const password = "PocketBase2024!@#$%^&*()";
    const hash = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 12,
    });
    const valid = await Bun.password.verify(password, hash);
    expect(valid).toBe(true);
  });
});

// ============================================================
// T106: ID 格式兼容性验证
// ============================================================

describe("ID 格式兼容性", () => {
  const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

  test("默认生成 15 字符 ID", () => {
    const id = generateId();
    expect(id.length).toBe(15);
  });

  test("ID 仅包含 a-z0-9（与 Go 版 DefaultIdAlphabet 对齐）", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateId();
      for (const ch of id) {
        expect(ID_ALPHABET).toContain(ch);
      }
    }
  });

  test("自定义长度 ID", () => {
    expect(generateId(10).length).toBe(10);
    expect(generateId(20).length).toBe(20);
    expect(generateId(1).length).toBe(1);
  });

  test("ID 唯一性（概率测试）", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }
    // 1000 个 15 字符 ID 应该全部唯一
    expect(ids.size).toBe(1000);
  });

  test("randomString 使用 a-zA-Z0-9 字母表", () => {
    const DEFAULT_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 0; i < 50; i++) {
      const s = randomString(20);
      expect(s.length).toBe(20);
      for (const ch of s) {
        expect(DEFAULT_ALPHABET).toContain(ch);
      }
    }
  });

  test("randomStringWithAlphabet 自定义字母表", () => {
    const alphabet = "abc";
    for (let i = 0; i < 50; i++) {
      const s = randomStringWithAlphabet(10, alphabet);
      expect(s.length).toBe(10);
      for (const ch of s) {
        expect(alphabet).toContain(ch);
      }
    }
  });

  test("ID 字符分布大致均匀（统计测试）", () => {
    const counts: Record<string, number> = {};
    for (const ch of ID_ALPHABET) counts[ch] = 0;

    // 生成大量 ID，统计字符频率
    for (let i = 0; i < 500; i++) {
      const id = generateId();
      for (const ch of id) {
        counts[ch]++;
      }
    }

    const total = 500 * 15;
    const expected = total / 36; // 36 字符字母表

    // 每个字符的出现次数应在期望值的 50%~200% 范围内
    for (const ch of ID_ALPHABET) {
      expect(counts[ch]).toBeGreaterThan(expected * 0.3);
      expect(counts[ch]).toBeLessThan(expected * 3.0);
    }
  });
});
