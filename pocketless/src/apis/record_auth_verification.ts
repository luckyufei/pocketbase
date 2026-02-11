/**
 * Email Verification 端点
 * POST /api/collections/:col/request-verification
 * POST /api/collections/:col/confirm-verification
 * 与 Go 版 apis/record_auth_verification_request.go + _confirm.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { newVerificationToken, TOKEN_TYPE_VERIFICATION, CLAIM_EMAIL } from "../core/tokens";
import { verifyToken, buildSigningKey, decodeToken } from "../tools/security/jwt";
import { badRequestError, notFoundError } from "./errors";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function registerVerificationRoutes(app: Hono, baseApp: BaseApp): void {
  // ─── request-verification ───
  app.post("/api/collections/:collection/request-verification", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
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

    // 查找用户 — 不管找到与否都返回 204（反枚举）
    const record = await (baseApp as any).findAuthRecordByEmail?.(collection.id, email);
    if (!record) {
      return c.body(null, 204);
    }

    // 已验证的用户无需重发
    if (record.get("verified") === true) {
      return c.body(null, 204);
    }

    // 在生产环境中发送验证邮件
    // const token = await newVerificationToken(record);
    // await mails.sendRecordVerification(baseApp, record, token);

    return c.body(null, 204);
  });

  // ─── confirm-verification ───
  app.post("/api/collections/:collection/confirm-verification", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const body = await c.req.json().catch(() => ({}));
    const token = body.token ?? "";

    if (!token) {
      throw badRequestError("An error occurred while validating the submitted data.", {
        token: { code: "validation_required", message: "Cannot be blank." },
      });
    }

    // 解码未验证的 claims
    let claims;
    try {
      claims = decodeToken(token);
    } catch {
      throw badRequestError("Invalid or expired token.", {});
    }

    if (claims.type !== TOKEN_TYPE_VERIFICATION) {
      throw badRequestError("Invalid or expired token.", {});
    }

    // 查找 record
    const record = await (baseApp as any).findRecordById?.(collection.name, claims.id);
    if (!record) {
      throw badRequestError("Invalid or expired token.", {});
    }

    // 验证 JWT 签名
    const tokenConfig = collection.options.verificationToken as { secret: string } | undefined;
    const signingKey = buildSigningKey(record.getTokenKey(), tokenConfig?.secret ?? "");

    try {
      await verifyToken(token, signingKey);
    } catch {
      throw badRequestError("Invalid or expired token.", {});
    }

    // 检查 email 匹配
    if (claims[CLAIM_EMAIL] !== record.getEmail()) {
      throw badRequestError("Invalid or expired token.", {});
    }

    // 设置 verified = true
    record.set("verified", true);
    await (baseApp as any).save?.(record);

    return c.body(null, 204);
  });
}
