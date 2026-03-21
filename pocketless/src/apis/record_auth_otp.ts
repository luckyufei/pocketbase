/**
 * OTP 端点 — request-otp + auth-with-otp
 * 与 Go 版 apis/record_auth_otp_request.go + apis/record_auth_with_otp.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { CollectionModel } from "../core/collection_model";
import { newAuthToken } from "../core/tokens";
import { generateId } from "../tools/security/random";
import { badRequestError, forbiddenError, notFoundError } from "./errors";
import { type MFAStore, checkMFA, MFA_METHOD_OTP } from "./record_auth_mfa";

// ─── OTP 配置 ───

interface OTPConfig {
  enabled: boolean;
  duration: number; // 秒
  length: number;   // OTP 密码长度
}

function getOTPConfig(collection: CollectionModel): OTPConfig {
  const config = collection.options.otp as OTPConfig | undefined;
  return config ?? { enabled: false, duration: 180, length: 8 };
}

// ─── OTP Store（内存，生产环境应使用数据库 _otps 表） ───

export interface OTPEntry {
  id: string;
  collectionRef: string;
  recordRef: string;
  password: string;
  sentTo: string;
  createdAt: number;
  expiresAt: number;
}

/** OTP 存储（Map<otpId, OTPEntry>） */
export type OTPStore = Map<string, OTPEntry>;

/** 生成随机数字密码 */
function generateOTPPassword(length: number): string {
  const digits = "1234567890";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += digits[Math.floor(Math.random() * digits.length)];
  }
  return result;
}

/** 简单邮箱格式检查 */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ─── 路由注册 ───

export function registerOTPRoutes(
  app: Hono,
  baseApp: BaseApp,
  externalStore?: OTPStore,
  mfaStore?: MFAStore,
): void {
  // 使用外部 store 或创建默认的
  const otpStore: OTPStore = externalStore ?? new Map();

  // ─── request-otp ───
  app.post("/api/collections/:collection/request-otp", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const config = getOTPConfig(collection);
    if (!config.enabled) {
      throw forbiddenError("The collection is not configured to allow OTP authentication.");
    }

    const body = await c.req.json().catch(() => ({}));
    const email = body.email ?? "";

    if (!email) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        email: { code: "validation_required", message: "Cannot be blank." },
      });
    }

    if (!isValidEmail(email)) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        email: { code: "validation_is_email", message: "Must be a valid email address." },
      });
    }

    // 查找用户
    const record = await (baseApp as any).findAuthRecordByEmail?.(collection.id, email);

    if (!record) {
      // 枚举保护：即使用户不存在也返回 200 + 假 otpId
      return c.json({ otpId: generateId() });
    }

    // 生成 OTP
    const otpId = generateId();
    const password = generateOTPPassword(config.length);
    const now = Date.now();

    otpStore.set(otpId, {
      id: otpId,
      collectionRef: collection.id,
      recordRef: record.id,
      password,
      sentTo: email,
      createdAt: now,
      expiresAt: now + config.duration * 1000,
    });

    // 在生产环境中应通过邮件发送 OTP
    // 这里仅存储（邮件发送在后台异步进行以防时序攻击）

    return c.json({ otpId });
  });

  // ─── auth-with-otp ───
  app.post("/api/collections/:collection/auth-with-otp", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const config = getOTPConfig(collection);
    if (!config.enabled) {
      throw forbiddenError("The collection is not configured to allow OTP authentication.");
    }

    const body = await c.req.json().catch(() => ({}));
    const otpId = body.otpId ?? "";
    const password = body.password ?? "";

    if (!otpId) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        otpId: { code: "validation_required", message: "Cannot be blank." },
      });
    }

    if (!password) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        password: { code: "validation_required", message: "Cannot be blank." },
      });
    }

    // 查找 OTP
    const otpEntry = otpStore.get(otpId);
    if (!otpEntry) {
      throw badRequestError("Invalid or expired OTP.", {});
    }

    // 检查过期
    if (Date.now() > otpEntry.expiresAt) {
      otpStore.delete(otpId);
      throw badRequestError("Invalid or expired OTP.", {});
    }

    // 检查集合匹配
    if (otpEntry.collectionRef !== collection.id) {
      throw badRequestError("Invalid or expired OTP.", {});
    }

    // 验证密码
    if (otpEntry.password !== password) {
      throw badRequestError("Invalid or expired OTP.", {});
    }

    // 查找关联的 auth record
    const record = await (baseApp as any).findRecordById?.(collection.name, otpEntry.recordRef);
    if (!record) {
      otpStore.delete(otpId);
      throw badRequestError("Invalid or expired OTP.", {});
    }

    // 删除已使用的 OTP
    otpStore.delete(otpId);

    // MFA 检查
    if (mfaStore) {
      const mfaIdParam = body.mfaId ?? "";
      const mfaResult = checkMFA(mfaStore, collection, record, MFA_METHOD_OTP, mfaIdParam || undefined);
      if (mfaResult.mfaId) {
        return c.json({ mfaId: mfaResult.mfaId }, 401);
      }
    }

    // 生成认证 token
    const token = await newAuthToken(record);
    const recordJSON = record.toJSON();
    delete recordJSON.tokenKey;

    return c.json({ token, record: recordJSON });
  });
}
