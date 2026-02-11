/**
 * Token 生成/验证测试 — 对照 Go 版 core/record_tokens_test.go
 * TDD RED phase: 先写测试，再实现
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { RecordModel } from "./record_model";
import { CollectionModel, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_BASE } from "./collection_model";
import { decodeToken, verifyToken } from "../tools/security/jwt";
import {
  TOKEN_TYPE_AUTH,
  TOKEN_TYPE_FILE,
  TOKEN_TYPE_VERIFICATION,
  TOKEN_TYPE_PASSWORD_RESET,
  TOKEN_TYPE_EMAIL_CHANGE,
  CLAIM_ID,
  CLAIM_TYPE,
  CLAIM_COLLECTION_ID,
  CLAIM_EMAIL,
  CLAIM_NEW_EMAIL,
  CLAIM_REFRESHABLE,
  ErrNotAuthRecord,
  ErrMissingSigningKey,
  newAuthToken,
  newStaticAuthToken,
  newVerificationToken,
  newPasswordResetToken,
  newEmailChangeToken,
  newFileToken,
} from "./tokens";

// ─── 测试辅助 ───

/** 创建 Auth 集合（带 token 配置） */
function createAuthCollection(overrides?: Partial<{
  authTokenSecret: string;
  authTokenDuration: number;
  verificationTokenSecret: string;
  verificationTokenDuration: number;
  passwordResetTokenSecret: string;
  passwordResetTokenDuration: number;
  emailChangeTokenSecret: string;
  emailChangeTokenDuration: number;
  fileTokenSecret: string;
  fileTokenDuration: number;
}>): CollectionModel {
  const col = new CollectionModel();
  col.id = "col_auth_123";
  col.name = "users";
  col.type = COLLECTION_TYPE_AUTH;
  col.options = {
    authToken: {
      secret: overrides?.authTokenSecret ?? "a".repeat(50),
      duration: overrides?.authTokenDuration ?? 604800, // 7 days
    },
    verificationToken: {
      secret: overrides?.verificationTokenSecret ?? "b".repeat(50),
      duration: overrides?.verificationTokenDuration ?? 259200, // 3 days
    },
    passwordResetToken: {
      secret: overrides?.passwordResetTokenSecret ?? "c".repeat(50),
      duration: overrides?.passwordResetTokenDuration ?? 1800, // 30 min
    },
    emailChangeToken: {
      secret: overrides?.emailChangeTokenSecret ?? "d".repeat(50),
      duration: overrides?.emailChangeTokenDuration ?? 1800, // 30 min
    },
    fileToken: {
      secret: overrides?.fileTokenSecret ?? "e".repeat(50),
      duration: overrides?.fileTokenDuration ?? 180, // 3 min
    },
  };
  return col;
}

/** 创建 Auth Record */
function createAuthRecord(collection?: CollectionModel): RecordModel {
  const col = collection ?? createAuthCollection();
  const record = new RecordModel(col);
  record.id = "rec_user_123";
  record.set("email", "test@example.com");
  record.set("tokenKey", "testTokenKey123");
  return record;
}

/** 创建非 Auth 的 Base Record */
function createBaseRecord(): RecordModel {
  const col = new CollectionModel();
  col.id = "col_base_456";
  col.name = "demo1";
  col.type = COLLECTION_TYPE_BASE;
  const record = new RecordModel(col);
  record.id = "rec_demo_456";
  return record;
}

// ─── 常量测试 ───

describe("Token constants", () => {
  test("token types match Go version", () => {
    expect(TOKEN_TYPE_AUTH).toBe("auth");
    expect(TOKEN_TYPE_FILE).toBe("file");
    expect(TOKEN_TYPE_VERIFICATION).toBe("verification");
    expect(TOKEN_TYPE_PASSWORD_RESET).toBe("passwordReset");
    expect(TOKEN_TYPE_EMAIL_CHANGE).toBe("emailChange");
  });

  test("claim names match Go version", () => {
    expect(CLAIM_ID).toBe("id");
    expect(CLAIM_TYPE).toBe("type");
    expect(CLAIM_COLLECTION_ID).toBe("collectionId");
    expect(CLAIM_EMAIL).toBe("email");
    expect(CLAIM_NEW_EMAIL).toBe("newEmail");
    expect(CLAIM_REFRESHABLE).toBe("refreshable");
  });
});

// ─── newAuthToken 测试（对照 Go TestNewAuthToken） ───

describe("newAuthToken", () => {
  test("non-auth record should throw ErrNotAuthRecord", async () => {
    const record = createBaseRecord();
    await expect(newAuthToken(record)).rejects.toThrow(ErrNotAuthRecord.message);
  });

  test("auth record should generate valid token", async () => {
    const record = createAuthRecord();
    const token = await newAuthToken(record);

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    // 解码并验证 claims
    const claims = decodeToken(token);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_AUTH);
    expect(claims[CLAIM_ID]).toBe(record.id);
    expect(claims[CLAIM_COLLECTION_ID]).toBe(record.collectionId);
    expect(claims[CLAIM_REFRESHABLE]).toBe(true);
  });

  test("token should be verifiable with correct signing key", async () => {
    const record = createAuthRecord();
    const token = await newAuthToken(record);

    const tokenKey = record.getTokenKey();
    const secret = (record.collection().options.authToken as { secret: string }).secret;
    const signingKey = tokenKey + secret;

    const claims = await verifyToken(token, signingKey);
    expect(claims[CLAIM_ID]).toBe(record.id);
  });

  test("token should have correct expiration (7 days default)", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newAuthToken(record);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2; // seconds
    const expectedExp = now + 604800;

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("empty signing key should throw ErrMissingSigningKey", async () => {
    const col = createAuthCollection({ authTokenSecret: "" });
    const record = createAuthRecord(col);
    record.set("tokenKey", ""); // 清空 tokenKey

    await expect(newAuthToken(record)).rejects.toThrow(ErrMissingSigningKey.message);
  });
});

// ─── newStaticAuthToken 测试（对照 Go TestNewStaticAuthToken） ───

describe("newStaticAuthToken", () => {
  test("non-auth record should throw ErrNotAuthRecord", async () => {
    const record = createBaseRecord();
    await expect(newStaticAuthToken(record, 0)).rejects.toThrow(ErrNotAuthRecord.message);
  });

  test("auth record should generate token with refreshable=false", async () => {
    const record = createAuthRecord();
    const token = await newStaticAuthToken(record, 0);

    const claims = decodeToken(token);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_AUTH);
    expect(claims[CLAIM_ID]).toBe(record.id);
    expect(claims[CLAIM_COLLECTION_ID]).toBe(record.collectionId);
    expect(claims[CLAIM_REFRESHABLE]).toBe(false);
  });

  test("zero duration should fallback to collection setting (7 days)", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newStaticAuthToken(record, 0);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + 604800; // 7 days

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("negative duration should fallback to collection setting", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newStaticAuthToken(record, -100);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + 604800;

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("positive duration should use custom duration", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const customDuration = 100; // seconds
    const token = await newStaticAuthToken(record, customDuration);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + customDuration;

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("empty signing key should throw ErrMissingSigningKey", async () => {
    const col = createAuthCollection({ authTokenSecret: "" });
    const record = createAuthRecord(col);
    record.set("tokenKey", "");

    await expect(newStaticAuthToken(record, 0)).rejects.toThrow(ErrMissingSigningKey.message);
  });
});

// ─── newVerificationToken 测试（对照 Go TestNewVerificationToken） ───

describe("newVerificationToken", () => {
  test("non-auth record should throw ErrNotAuthRecord", async () => {
    const record = createBaseRecord();
    await expect(newVerificationToken(record)).rejects.toThrow(ErrNotAuthRecord.message);
  });

  test("auth record should generate valid verification token", async () => {
    const record = createAuthRecord();
    const token = await newVerificationToken(record);

    const claims = decodeToken(token);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_VERIFICATION);
    expect(claims[CLAIM_ID]).toBe(record.id);
    expect(claims[CLAIM_COLLECTION_ID]).toBe(record.collectionId);
    expect(claims[CLAIM_EMAIL]).toBe("test@example.com");
  });

  test("token should have correct expiration (3 days)", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newVerificationToken(record);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + 259200; // 3 days

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("token verifiable with correct signing key", async () => {
    const record = createAuthRecord();
    const token = await newVerificationToken(record);

    const tokenKey = record.getTokenKey();
    const secret = (record.collection().options.verificationToken as { secret: string }).secret;
    const signingKey = tokenKey + secret;

    const claims = await verifyToken(token, signingKey);
    expect(claims[CLAIM_EMAIL]).toBe("test@example.com");
  });

  test("empty signing key should throw ErrMissingSigningKey", async () => {
    const col = createAuthCollection({ verificationTokenSecret: "" });
    const record = createAuthRecord(col);
    record.set("tokenKey", "");

    await expect(newVerificationToken(record)).rejects.toThrow(ErrMissingSigningKey.message);
  });
});

// ─── newPasswordResetToken 测试（对照 Go TestNewPasswordResetToken） ───

describe("newPasswordResetToken", () => {
  test("non-auth record should throw ErrNotAuthRecord", async () => {
    const record = createBaseRecord();
    await expect(newPasswordResetToken(record)).rejects.toThrow(ErrNotAuthRecord.message);
  });

  test("auth record should generate valid password reset token", async () => {
    const record = createAuthRecord();
    const token = await newPasswordResetToken(record);

    const claims = decodeToken(token);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_PASSWORD_RESET);
    expect(claims[CLAIM_ID]).toBe(record.id);
    expect(claims[CLAIM_COLLECTION_ID]).toBe(record.collectionId);
    expect(claims[CLAIM_EMAIL]).toBe("test@example.com");
  });

  test("token should have correct expiration (30 min)", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newPasswordResetToken(record);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + 1800;

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("token verifiable with correct signing key", async () => {
    const record = createAuthRecord();
    const token = await newPasswordResetToken(record);

    const tokenKey = record.getTokenKey();
    const secret = (record.collection().options.passwordResetToken as { secret: string }).secret;
    const signingKey = tokenKey + secret;

    const claims = await verifyToken(token, signingKey);
    expect(claims[CLAIM_EMAIL]).toBe("test@example.com");
  });

  test("empty signing key should throw ErrMissingSigningKey", async () => {
    const col = createAuthCollection({ passwordResetTokenSecret: "" });
    const record = createAuthRecord(col);
    record.set("tokenKey", "");

    await expect(newPasswordResetToken(record)).rejects.toThrow(ErrMissingSigningKey.message);
  });
});

// ─── newEmailChangeToken 测试（对照 Go TestNewEmailChangeToken） ───

describe("newEmailChangeToken", () => {
  test("non-auth record should throw ErrNotAuthRecord", async () => {
    const record = createBaseRecord();
    await expect(newEmailChangeToken(record, "new@example.com")).rejects.toThrow(ErrNotAuthRecord.message);
  });

  test("auth record should generate valid email change token", async () => {
    const record = createAuthRecord();
    const token = await newEmailChangeToken(record, "new@example.com");

    const claims = decodeToken(token);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_EMAIL_CHANGE);
    expect(claims[CLAIM_ID]).toBe(record.id);
    expect(claims[CLAIM_COLLECTION_ID]).toBe(record.collectionId);
    expect(claims[CLAIM_EMAIL]).toBe("test@example.com");
    expect(claims[CLAIM_NEW_EMAIL]).toBe("new@example.com");
  });

  test("token should have correct expiration (30 min)", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newEmailChangeToken(record, "new@example.com");

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + 1800;

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("token verifiable with correct signing key", async () => {
    const record = createAuthRecord();
    const token = await newEmailChangeToken(record, "new@example.com");

    const tokenKey = record.getTokenKey();
    const secret = (record.collection().options.emailChangeToken as { secret: string }).secret;
    const signingKey = tokenKey + secret;

    const claims = await verifyToken(token, signingKey);
    expect(claims[CLAIM_NEW_EMAIL]).toBe("new@example.com");
  });

  test("empty signing key should throw ErrMissingSigningKey", async () => {
    const col = createAuthCollection({ emailChangeTokenSecret: "" });
    const record = createAuthRecord(col);
    record.set("tokenKey", "");

    await expect(newEmailChangeToken(record, "new@example.com")).rejects.toThrow(ErrMissingSigningKey.message);
  });
});

// ─── newFileToken 测试（对照 Go TestNewFileToken） ───

describe("newFileToken", () => {
  test("non-auth record should throw ErrNotAuthRecord", async () => {
    const record = createBaseRecord();
    await expect(newFileToken(record)).rejects.toThrow(ErrNotAuthRecord.message);
  });

  test("auth record should generate valid file token", async () => {
    const record = createAuthRecord();
    const token = await newFileToken(record);

    const claims = decodeToken(token);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_FILE);
    expect(claims[CLAIM_ID]).toBe(record.id);
    expect(claims[CLAIM_COLLECTION_ID]).toBe(record.collectionId);
    // file token 不包含 email
    expect(claims[CLAIM_EMAIL]).toBeUndefined();
  });

  test("token should have correct expiration (3 min)", async () => {
    const record = createAuthRecord();
    const now = Math.floor(Date.now() / 1000);
    const token = await newFileToken(record);

    const claims = decodeToken(token);
    const exp = claims.exp as number;
    const tolerance = 2;
    const expectedExp = now + 180;

    expect(exp).toBeGreaterThanOrEqual(expectedExp - tolerance);
    expect(exp).toBeLessThanOrEqual(expectedExp + tolerance);
  });

  test("token verifiable with correct signing key", async () => {
    const record = createAuthRecord();
    const token = await newFileToken(record);

    const tokenKey = record.getTokenKey();
    const secret = (record.collection().options.fileToken as { secret: string }).secret;
    const signingKey = tokenKey + secret;

    const claims = await verifyToken(token, signingKey);
    expect(claims[CLAIM_TYPE]).toBe(TOKEN_TYPE_FILE);
  });

  test("empty signing key should throw ErrMissingSigningKey", async () => {
    const col = createAuthCollection({ fileTokenSecret: "" });
    const record = createAuthRecord(col);
    record.set("tokenKey", "");

    await expect(newFileToken(record)).rejects.toThrow(ErrMissingSigningKey.message);
  });
});

// ─── 跨 token 类型互验测试 ───

describe("cross-token verification", () => {
  test("auth token should NOT verify with verification token secret", async () => {
    const record = createAuthRecord();
    const token = await newAuthToken(record);

    const tokenKey = record.getTokenKey();
    const wrongSecret = (record.collection().options.verificationToken as { secret: string }).secret;
    const wrongKey = tokenKey + wrongSecret;

    await expect(verifyToken(token, wrongKey)).rejects.toThrow();
  });

  test("verification token should NOT verify with auth token secret", async () => {
    const record = createAuthRecord();
    const token = await newVerificationToken(record);

    const tokenKey = record.getTokenKey();
    const wrongSecret = (record.collection().options.authToken as { secret: string }).secret;
    const wrongKey = tokenKey + wrongSecret;

    await expect(verifyToken(token, wrongKey)).rejects.toThrow();
  });

  test("different token types use different signing keys", async () => {
    const record = createAuthRecord();

    const [authToken, verifyTok, resetToken, changeToken, fileToken] = await Promise.all([
      newAuthToken(record),
      newVerificationToken(record),
      newPasswordResetToken(record),
      newEmailChangeToken(record, "new@example.com"),
      newFileToken(record),
    ]);

    // 每种 token 都有不同的 type claim
    const authClaims = decodeToken(authToken);
    const verifyClaims = decodeToken(verifyTok);
    const resetClaims = decodeToken(resetToken);
    const changeClaims = decodeToken(changeToken);
    const fileClaims = decodeToken(fileToken);

    expect(authClaims.type).toBe(TOKEN_TYPE_AUTH);
    expect(verifyClaims.type).toBe(TOKEN_TYPE_VERIFICATION);
    expect(resetClaims.type).toBe(TOKEN_TYPE_PASSWORD_RESET);
    expect(changeClaims.type).toBe(TOKEN_TYPE_EMAIL_CHANGE);
    expect(fileClaims.type).toBe(TOKEN_TYPE_FILE);
  });
});

// ─── TokenConfig 辅助函数测试 ───

describe("TokenConfig helpers", () => {
  test("getTokenConfig extracts correct config from collection options", () => {
    const col = createAuthCollection();
    const authConfig = col.options.authToken as { secret: string; duration: number };
    expect(authConfig.secret).toBe("a".repeat(50));
    expect(authConfig.duration).toBe(604800);

    const fileConfig = col.options.fileToken as { secret: string; duration: number };
    expect(fileConfig.secret).toBe("e".repeat(50));
    expect(fileConfig.duration).toBe(180);
  });

  test("default durations match Go version", () => {
    const col = createAuthCollection();
    const authConfig = col.options.authToken as { secret: string; duration: number };
    const verifyConfig = col.options.verificationToken as { secret: string; duration: number };
    const resetConfig = col.options.passwordResetToken as { secret: string; duration: number };
    const changeConfig = col.options.emailChangeToken as { secret: string; duration: number };
    const fileConfig = col.options.fileToken as { secret: string; duration: number };

    expect(authConfig.duration).toBe(604800);    // 7 days
    expect(verifyConfig.duration).toBe(259200);   // 3 days
    expect(resetConfig.duration).toBe(1800);      // 30 min
    expect(changeConfig.duration).toBe(1800);     // 30 min
    expect(fileConfig.duration).toBe(180);        // 3 min
  });
});
