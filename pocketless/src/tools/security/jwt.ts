/**
 * JWT 工具 — 基于 jose 的 Token 签发/验证
 * 与 Go 版 5 种 Token 类型对齐
 */

import * as jose from "jose";

export type TokenType = "auth" | "file" | "verification" | "passwordReset" | "emailChange";

export interface TokenClaims {
  id: string;
  type: TokenType;
  collectionId: string;
  refreshable?: boolean;
  newEmail?: string;
  [key: string]: unknown;
}

/** 签发 JWT（HS256，与 Go 版 Claims 对齐） */
export async function signToken(
  claims: TokenClaims,
  signingKey: string,
  expirationTime: string | number = "1h",
): Promise<string> {
  const secret = new TextEncoder().encode(signingKey);

  const builder = new jose.SignJWT(claims as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (typeof expirationTime === "string") {
    builder.setExpirationTime(expirationTime);
  } else {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime);
  }

  return builder.sign(secret);
}

/** 验证 JWT */
export async function verifyToken(
  token: string,
  signingKey: string,
): Promise<TokenClaims> {
  const secret = new TextEncoder().encode(signingKey);
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as unknown as TokenClaims;
}

/** 解码 JWT（不验证签名） */
export function decodeToken(token: string): TokenClaims {
  const payload = jose.decodeJwt(token);
  return payload as unknown as TokenClaims;
}

/**
 * 构建签名密钥（与 Go 版对齐）
 * 格式：record.tokenKey + collection.tokenSecret
 */
export function buildSigningKey(tokenKey: string, tokenSecret: string): string {
  return tokenKey + tokenSecret;
}
