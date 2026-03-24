/**
 * Password Reset 端点
 * POST /api/collections/:col/request-password-reset
 * POST /api/collections/:col/confirm-password-reset
 * 与 Go 版 apis/record_auth_password_reset_request.go + _confirm.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { TOKEN_TYPE_PASSWORD_RESET, CLAIM_EMAIL } from "../core/tokens";
import { verifyToken, buildSigningKey, decodeToken } from "../tools/security/jwt";
import { hashPassword } from "../tools/security/password";
import { badRequestError, notFoundError } from "./errors";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function registerPasswordResetRoutes(app: Hono, baseApp: BaseApp): void {
  // ─── request-password-reset ───
  app.post("/api/collections/:collection/request-password-reset", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    // 检查密码认证是否启用（在 body 验证之前）
    const passwordAuth = collection.options.passwordAuth as { enabled?: boolean } | undefined;
    if (!passwordAuth?.enabled) {
      throw badRequestError("The collection is not configured to allow password authentication.", {});
    }

    const rawBody = await c.req.text();
    let body: Record<string, unknown> | null = null;

    if (rawBody.trim() === "") {
      // 空 body 视为空对象，触发 validation_required
      body = {};
    } else {
      try {
        body = JSON.parse(rawBody);
      } catch {
        // 无效 JSON 格式
        throw badRequestError("An error occurred while validating the submitted data.", {});
      }
    }

    const email = (body as Record<string, unknown>)?.email ?? "";

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

    // 反枚举：不管找到与否都返回 204
    // const record = await (baseApp as any).findAuthRecordByEmail?.(collection.id, email);
    // if (record) { /* 生产环境发送密码重置邮件 */ }

    return c.body(null, 204);
  });

  // ─── confirm-password-reset ───
  app.post("/api/collections/:collection/confirm-password-reset", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const rawConfirmBody = await c.req.text();
    let body: Record<string, unknown> | null = null;

    if (rawConfirmBody.trim() === "") {
      // 空 body 视为空对象，触发各字段 validation_required
      body = {};
    } else {
      try {
        body = JSON.parse(rawConfirmBody);
      } catch {
        // 无效 JSON 格式
        throw badRequestError("An error occurred while validating the submitted data.", {});
      }
    }

    const token = body?.token ?? "";
    const password = body?.password ?? "";
    const passwordConfirm = body?.passwordConfirm ?? "";

    // 验证表单
    const errors: Record<string, { code: string; message: string }> = {};

    if (!token) {
      errors.token = { code: "validation_required", message: "Cannot be blank." };
    }
    if (!password) {
      errors.password = { code: "validation_required", message: "Cannot be blank." };
    }
    if (!passwordConfirm) {
      errors.passwordConfirm = { code: "validation_required", message: "Cannot be blank." };
    }

    if (Object.keys(errors).length > 0) {
      throw badRequestError("An error occurred while validating the submitted data.", errors);
    }

    // 密码最小长度 8
    if (password.length < 8) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        password: { code: "validation_length_out_of_range", message: "Must be between 8 and 100 characters." },
      });
    }

    if (password !== passwordConfirm) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        passwordConfirm: { code: "validation_values_mismatch", message: "Values don't match." },
      });
    }

    // 解码未验证的 claims
    let claims;
    try {
      claims = decodeToken(token);
    } catch {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token", message: "Invalid or expired token." },
      });
    }

    if (claims.type !== TOKEN_TYPE_PASSWORD_RESET) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token", message: "Invalid or expired token." },
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

    // 验证 JWT 签名
    const tokenConfig = collection.options.passwordResetToken as { secret: string } | undefined;
    const signingKey = buildSigningKey(record.getTokenKey(), tokenConfig?.secret ?? "");

    try {
      await verifyToken(token, signingKey);
    } catch {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_invalid_token", message: "Invalid or expired token." },
      });
    }

    // 更新密码
    const newHash = await hashPassword(password);
    record.set("password", newHash);

    // 如果 email 匹配，自动验证
    if (claims[CLAIM_EMAIL] === record.getEmail() && !record.get("verified")) {
      record.set("verified", true);
    }

    await (baseApp as any).save?.(record);

    return c.body(null, 204);
  });
}
