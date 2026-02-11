/**
 * 加密工具 — AES-256-GCM（与 Go 版 security.Encrypt 完全对齐）
 *
 * 重要：Go 版直接使用原始 key 字节（必须恰好 32 字节），不做 SHA256 派生！
 * 格式：nonce(12) + ciphertext + tag(16) → base64（标准编码）
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * 将 key 字符串转为 Buffer。
 * Go 版要求 key 恰好是 32 字节 ASCII 字符串，直接 []byte(key) 使用。
 * 这里保持一致：直接用 UTF-8 编码，不做 SHA256 派生。
 */
function keyToBuffer(key: string): Buffer {
  const buf = Buffer.from(key, "utf8");
  if (buf.length !== 32) {
    throw new Error(`加密密钥必须恰好 32 字节，实际 ${buf.length} 字节`);
  }
  return buf;
}

/** AES-256-GCM 加密（与 Go 版 security.Encrypt 互通） */
export function encrypt(data: string, key: string): string {
  const keyBuf = keyToBuffer(key);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, nonce);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式: nonce(12) + ciphertext + tag(16) → base64（标准编码，与 Go base64.StdEncoding 对齐）
  return Buffer.concat([nonce, encrypted, tag]).toString("base64");
}

/** AES-256-GCM 解密（可解密 Go 版加密的数据） */
export function decrypt(encoded: string, key: string): string {
  const keyBuf = keyToBuffer(key);
  const buf = Buffer.from(encoded, "base64");

  if (buf.length < 28) {
    throw new Error("加密数据长度无效");
  }

  const nonce = buf.subarray(0, 12);
  // Go 的 gcm.Open 传入 cipherByte[nonceSize:] 其中包含 ciphertext+tag
  // Node.js 需要分开提取 tag
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", keyBuf, nonce);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}
