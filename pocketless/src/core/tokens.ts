/**
 * Record Token 生成 — 与 Go 版 core/record_tokens.go 对齐
 * 5 种 Token 类型：auth, file, verification, passwordReset, emailChange
 */

import type { RecordModel } from "./record_model";
import { signToken, buildSigningKey } from "../tools/security/jwt";
import type { TokenClaims } from "../tools/security/jwt";

// ─── Token 类型常量（与 Go 版对齐） ───

export const TOKEN_TYPE_AUTH = "auth";
export const TOKEN_TYPE_FILE = "file";
export const TOKEN_TYPE_VERIFICATION = "verification";
export const TOKEN_TYPE_PASSWORD_RESET = "passwordReset";
export const TOKEN_TYPE_EMAIL_CHANGE = "emailChange";

// ─── Claim 名称常量（与 Go 版对齐） ───

export const CLAIM_ID = "id";
export const CLAIM_TYPE = "type";
export const CLAIM_COLLECTION_ID = "collectionId";
export const CLAIM_EMAIL = "email";
export const CLAIM_NEW_EMAIL = "newEmail";
export const CLAIM_REFRESHABLE = "refreshable";

// ─── 错误 ───

export const ErrNotAuthRecord = new Error("not an auth collection record");
export const ErrMissingSigningKey = new Error("missing or invalid signing key");

// ─── TokenConfig 类型（存储在 collection.options 中） ───

export interface TokenConfig {
  secret: string;
  /** Token 有效期（秒） */
  duration: number;
}

/** 从 collection.options 中提取 TokenConfig */
function getTokenConfig(
  record: RecordModel,
  configKey: string,
): TokenConfig {
  const options = record.collection().options;
  const config = options[configKey] as TokenConfig | undefined;
  return config ?? { secret: "", duration: 0 };
}

/** 确保 record 属于 auth 集合 */
function ensureAuthRecord(record: RecordModel): void {
  if (!record.collection().isAuth()) {
    throw ErrNotAuthRecord;
  }
}

/** 构建签名密钥并校验非空 */
function resolveSigningKey(record: RecordModel, tokenSecret: string): string {
  const key = buildSigningKey(record.getTokenKey(), tokenSecret);
  if (key === "") {
    throw ErrMissingSigningKey;
  }
  return key;
}

// ─── Token 生成函数 ───

/**
 * 生成 Auth Token（可刷新）
 * claims: { type: "auth", id, collectionId, refreshable: true }
 */
export async function newAuthToken(record: RecordModel): Promise<string> {
  return _newAuthToken(record, 0, true);
}

/**
 * 生成静态 Auth Token（不可刷新，支持自定义有效期）
 * 零或负数有效期会回退到集合配置
 */
export async function newStaticAuthToken(
  record: RecordModel,
  duration: number,
): Promise<string> {
  return _newAuthToken(record, duration, false);
}

async function _newAuthToken(
  record: RecordModel,
  duration: number,
  refreshable: boolean,
): Promise<string> {
  ensureAuthRecord(record);

  const config = getTokenConfig(record, "authToken");
  const key = resolveSigningKey(record, config.secret);

  const claims: TokenClaims = {
    [CLAIM_TYPE]: TOKEN_TYPE_AUTH,
    [CLAIM_ID]: record.id,
    [CLAIM_COLLECTION_ID]: record.collectionId,
    [CLAIM_REFRESHABLE]: refreshable,
  };

  // 零或负数回退到集合配置
  const effectiveDuration = duration > 0 ? duration : config.duration;

  return signToken(claims, key, effectiveDuration);
}

/**
 * 生成验证 Token
 * claims: { type: "verification", id, collectionId, email }
 */
export async function newVerificationToken(record: RecordModel): Promise<string> {
  ensureAuthRecord(record);

  const config = getTokenConfig(record, "verificationToken");
  const key = resolveSigningKey(record, config.secret);

  const claims: TokenClaims = {
    [CLAIM_TYPE]: TOKEN_TYPE_VERIFICATION,
    [CLAIM_ID]: record.id,
    [CLAIM_COLLECTION_ID]: record.collectionId,
    [CLAIM_EMAIL]: record.getEmail(),
  };

  return signToken(claims, key, config.duration);
}

/**
 * 生成密码重置 Token
 * claims: { type: "passwordReset", id, collectionId, email }
 */
export async function newPasswordResetToken(record: RecordModel): Promise<string> {
  ensureAuthRecord(record);

  const config = getTokenConfig(record, "passwordResetToken");
  const key = resolveSigningKey(record, config.secret);

  const claims: TokenClaims = {
    [CLAIM_TYPE]: TOKEN_TYPE_PASSWORD_RESET,
    [CLAIM_ID]: record.id,
    [CLAIM_COLLECTION_ID]: record.collectionId,
    [CLAIM_EMAIL]: record.getEmail(),
  };

  return signToken(claims, key, config.duration);
}

/**
 * 生成邮箱变更 Token
 * claims: { type: "emailChange", id, collectionId, email, newEmail }
 */
export async function newEmailChangeToken(
  record: RecordModel,
  newEmail: string,
): Promise<string> {
  ensureAuthRecord(record);

  const config = getTokenConfig(record, "emailChangeToken");
  const key = resolveSigningKey(record, config.secret);

  const claims: TokenClaims = {
    [CLAIM_TYPE]: TOKEN_TYPE_EMAIL_CHANGE,
    [CLAIM_ID]: record.id,
    [CLAIM_COLLECTION_ID]: record.collectionId,
    [CLAIM_EMAIL]: record.getEmail(),
    [CLAIM_NEW_EMAIL]: newEmail,
  };

  return signToken(claims, key, config.duration);
}

/**
 * 生成文件访问 Token
 * claims: { type: "file", id, collectionId }
 */
export async function newFileToken(record: RecordModel): Promise<string> {
  ensureAuthRecord(record);

  const config = getTokenConfig(record, "fileToken");
  const key = resolveSigningKey(record, config.secret);

  const claims: TokenClaims = {
    [CLAIM_TYPE]: TOKEN_TYPE_FILE,
    [CLAIM_ID]: record.id,
    [CLAIM_COLLECTION_ID]: record.collectionId,
  };

  return signToken(claims, key, config.duration);
}
