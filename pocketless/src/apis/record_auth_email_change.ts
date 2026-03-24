/**
 * Email Change 端点
 * POST /api/collections/:col/request-email-change (需要认证)
 * POST /api/collections/:col/confirm-email-change
 * 与 Go 版 apis/record_auth_email_change_request.go + _confirm.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { TOKEN_TYPE_EMAIL_CHANGE, CLAIM_NEW_EMAIL } from "../core/tokens";
import { verifyToken, buildSigningKey, decodeToken } from "../tools/security/jwt";
import { verifyPassword } from "../tools/security/password";
import { badRequestError, notFoundError, unauthorizedError, forbiddenError } from "./errors";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** 解析请求 body：空 body → {}，无效 JSON → null */
async function parseBody(c: { req: { text(): Promise<string> } }): Promise<Record<string, unknown> | null> {
  const raw = await c.req.text();
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function registerEmailChangeRoutes(app: Hono, baseApp: BaseApp): void {
  // ─── request-email-change（需要认证）───
  app.post("/api/collections/:collection/request-email-change", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      // Go 版：未认证时返回 401（与 non-auth collection 相同）
      throw unauthorizedError("The request requires valid record authorization token to be set.");
    }

    // 检查认证
    const authUser = (baseApp as any).getAuthUser?.();
    if (!authUser) {
      throw unauthorizedError("The request requires valid record authorization token to be set.");
    }

    // 检查认证用户属于此集合
    if (authUser.collectionId && authUser.collectionId !== collection.id) {
      throw forbiddenError("The request requires valid record authorization token to be set.");
    }

    const body = await parseBody(c);
    if (body === null) {
      throw badRequestError("An error occurred while validating the submitted data.", {});
    }

    const newEmail = body.newEmail ?? "";

    if (!newEmail) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        newEmail: { code: "validation_required", message: "Cannot be blank." },
      });
    }

    if (!isValidEmail(newEmail)) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        newEmail: { code: "validation_is_email", message: "Must be a valid email address." },
      });
    }

    // 新邮箱不能和当前邮箱相同
    if (newEmail === authUser.getEmail()) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        newEmail: { code: "validation_record_email_change_same", message: "The new email address must be different from the current one." },
      });
    }

    // 检查新邮箱是否已被使用
    const existing = await (baseApp as any).findAuthRecordByEmail?.(collection.id, newEmail);
    if (existing) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        newEmail: { code: "validation_invalid_new_email", message: "The email address is already in use." },
      });
    }

    // 在生产环境中发送邮箱变更确认邮件
    return c.body(null, 204);
  });

  // ─── confirm-email-change ───
  app.post("/api/collections/:collection/confirm-email-change", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const body = await parseBody(c);
    if (body === null) {
      throw badRequestError("An error occurred while validating the submitted data.", {});
    }

    const token = body.token ?? "";
    const password = body.password ?? "";

    // 必填验证
    const errors: Record<string, { code: string; message: string }> = {};
    if (!token) errors.token = { code: "validation_required", message: "Cannot be blank." };
    if (!password) errors.password = { code: "validation_required", message: "Cannot be blank." };
    if (Object.keys(errors).length > 0) {
      throw badRequestError("An error occurred while validating the submitted data.", errors);
    }

    // 解码 JWT（不验证签名）
    let claims: Record<string, unknown>;
    try {
      claims = decodeToken(token);
    } catch {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token", message: "Invalid or expired token." },
      });
    }

    // token 类型必须是 emailChange
    if (claims.type !== TOKEN_TYPE_EMAIL_CHANGE) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token_payload", message: "Invalid token payload." },
      });
    }

    const newEmail = claims[CLAIM_NEW_EMAIL] as string;
    if (!newEmail) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token_payload", message: "Missing new email in token." },
      });
    }

    // 验证集合匹配
    if (claims.collectionId && claims.collectionId !== collection.id) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_token_collection_mismatch", message: "Token collection mismatch." },
      });
    }

    // 查找 record
    const record = await (baseApp as any).findRecordById?.(collection.name, claims.id);
    if (!record) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token", message: "Invalid or expired token." },
      });
    }

    // 验证 JWT 签名（此时才验证过期和签名）
    const tokenConfig = collection.options.emailChangeToken as { secret: string } | undefined;
    const signingKey = buildSigningKey(record.getTokenKey(), tokenConfig?.secret ?? "");

    try {
      await verifyToken(token, signingKey);
    } catch {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token", message: "Invalid or expired token." },
      });
    }

    // 验证密码
    const passwordHash = record.getPasswordHash();
    const isValid = await verifyPassword(password, passwordHash);
    if (!isValid) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        password: { code: "validation_invalid_password", message: "Missing or invalid password." },
      });
    }

    // 更新邮箱并标记已验证
    record.set("email", newEmail);
    record.set("verified", true);
    await (baseApp as any).save?.(record);

    return c.body(null, 204);
  });
}
