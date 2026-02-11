/**
 * Auth-with-password 端点
 * POST /api/collections/:collection/auth-with-password
 * 与 Go 版 apis/record_auth_with_password.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { CollectionModel } from "../core/collection_model";
import type { RecordModel } from "../core/record_model";
import { verifyPassword } from "../tools/security/password";
import { newAuthToken } from "../core/tokens";
import { badRequestError, forbiddenError, notFoundError } from "./errors";
import { type MFAStore, checkMFA, MFA_METHOD_PASSWORD } from "./record_auth_mfa";

/** 简单邮箱格式检查 */
function isEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** PasswordAuth 配置 */
interface PasswordAuthConfig {
  enabled: boolean;
  identityFields: string[];
}

/** 从 collection.options 获取 PasswordAuth 配置 */
function getPasswordAuthConfig(collection: CollectionModel): PasswordAuthConfig {
  const config = collection.options.passwordAuth as PasswordAuthConfig | undefined;
  return config ?? { enabled: false, identityFields: ["email"] };
}

/** 查找 Auth 集合（from URL path param） */
async function findAuthCollection(
  baseApp: BaseApp,
  collectionNameOrId: string,
): Promise<CollectionModel> {
  const collection = await baseApp.findCollectionByNameOrId(collectionNameOrId);
  if (!collection || !collection.isAuth()) {
    throw notFoundError("Missing or invalid auth collection context.");
  }
  return collection;
}

/** 请求体 */
interface AuthWithPasswordForm {
  identity: string;
  password: string;
  identityField?: string;
}

/** 验证请求体 */
function validateForm(
  form: AuthWithPasswordForm,
  collection: CollectionModel,
): Record<string, { code: string; message: string }> | null {
  const errors: Record<string, { code: string; message: string }> = {};

  if (!form.identity || form.identity.length === 0) {
    errors.identity = { code: "validation_required", message: "Cannot be blank." };
  } else if (form.identity.length > 255) {
    errors.identity = { code: "validation_length_out_of_range", message: "The length must be between 1 and 255." };
  }

  if (!form.password || form.password.length === 0) {
    errors.password = { code: "validation_required", message: "Cannot be blank." };
  } else if (form.password.length > 255) {
    errors.password = { code: "validation_length_out_of_range", message: "The length must be between 1 and 255." };
  }

  if (form.identityField) {
    const config = getPasswordAuthConfig(collection);
    if (!config.identityFields.includes(form.identityField)) {
      errors.identityField = { code: "validation_in_invalid", message: "Must be a valid value." };
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** 查找匹配 identity 的 Record */
async function findRecordByIdentity(
  baseApp: BaseApp,
  collection: CollectionModel,
  form: AuthWithPasswordForm,
): Promise<RecordModel | null> {
  const config = getPasswordAuthConfig(collection);

  if (form.identityField) {
    // 显式指定 identityField
    return baseApp.findRecordByIdentityField?.(collection, form.identityField, form.identity) ?? null;
  }

  // 自动检测：优先 email 字段
  let identityFields = [...config.identityFields];
  if (identityFields.length > 1 && identityFields[0] !== "email") {
    const emailIdx = identityFields.indexOf("email");
    if (emailIdx > 0) {
      identityFields.splice(emailIdx, 1);
      identityFields.unshift("email");
    }
  }

  for (const field of identityFields) {
    // 如果字段是 email 但 identity 不是邮箱格式，跳过
    if (field === "email" && !isEmailFormat(form.identity)) {
      continue;
    }

    const record = await baseApp.findRecordByIdentityField?.(collection, field, form.identity);
    if (record) return record;
  }

  return null;
}

/**
 * 生成认证响应（与 Go 版 RecordAuthResponse 对齐）
 * 返回 { token, record }
 */
async function recordAuthResponse(
  record: RecordModel,
): Promise<{ token: string; record: Record<string, unknown> }> {
  const token = await newAuthToken(record);

  // 导出 record JSON（自动排除 password 等敏感字段）
  const recordJSON = record.toJSON();

  // 额外排除 tokenKey
  delete recordJSON.tokenKey;

  return { token, record: recordJSON };
}

export function registerRecordAuthRoutes(app: Hono, baseApp: BaseApp, mfaStore?: MFAStore): void {
  app.post("/api/collections/:collection/auth-with-password", async (c) => {
    const collection = await findAuthCollection(baseApp, c.req.param("collection"));

    const config = getPasswordAuthConfig(collection);
    if (!config.enabled) {
      throw forbiddenError(
        "The collection is not configured to allow password authentication.",
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const form: AuthWithPasswordForm = {
      identity: body.identity ?? "",
      password: body.password ?? "",
      identityField: body.identityField,
    };

    // 验证
    const errors = validateForm(form, collection);
    if (errors) {
      throw badRequestError(
        "An error occurred while validating the submitted data.",
        errors,
      );
    }

    // 查找记录
    const record = await findRecordByIdentity(baseApp, collection, form);

    // 验证密码
    if (!record) {
      throw badRequestError("Failed to authenticate.", {});
    }

    const passwordHash = record.getPasswordHash();
    const isValid = await verifyPassword(form.password, passwordHash);
    if (!isValid) {
      throw badRequestError("Failed to authenticate.", {});
    }

    // MFA 检查
    if (mfaStore) {
      const mfaId = body.mfaId ?? c.req.query("mfaId") ?? "";
      const mfaResult = checkMFA(mfaStore, collection, record, MFA_METHOD_PASSWORD, mfaId || undefined);
      if (mfaResult.mfaId) {
        // 第一阶段：需要 MFA，返回 401 + mfaId
        return c.json({ mfaId: mfaResult.mfaId }, 401);
      }
    }

    // 生成响应
    const response = await recordAuthResponse(record);
    return c.json(response);
  });
}
