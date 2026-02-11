/**
 * 随机工具 — ID 生成和随机字符串
 * 与 Go 版 security.RandomString/RandomStringWithAlphabet 对齐
 */

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const DEFAULT_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** 生成 15 字符 ID（与 Go 版对齐：a-z0-9） */
export function generateId(length: number = 15): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

/** 生成随机字符串 */
export function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => DEFAULT_ALPHABET[b % DEFAULT_ALPHABET.length]).join("");
}

/** 使用自定义字母表生成随机字符串 */
export function randomStringWithAlphabet(length: number, alphabet: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** 生成随机 Token Key（用于 Auth Record） */
export function generateTokenKey(): string {
  return randomString(50);
}
