/**
 * 密码哈希/验证工具 — bcrypt
 * 与 Go 版 bcrypt.GenerateFromPassword / bcrypt.CompareHashAndPassword 对齐
 */

/**
 * 对明文密码进行 bcrypt 哈希
 * @param password 明文密码
 * @param cost 哈希成本因子（默认 12，与 Go 版一致）
 */
export async function hashPassword(password: string, cost: number = 12): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost });
}

/**
 * 验证明文密码是否匹配 bcrypt 哈希
 * @param password 明文密码
 * @param hash bcrypt 哈希值
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await Bun.password.verify(password, hash, "bcrypt");
  } catch {
    return false;
  }
}
