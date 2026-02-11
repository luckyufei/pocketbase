/**
 * Auth Refresh 端点
 * POST /api/collections/:col/auth-refresh
 * 与 Go 版 apis/record_auth_refresh.go 对齐
 *
 * refreshable token → 生成新 token
 * non-refreshable (static) token → 复用原 token
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { newAuthToken } from "../core/tokens";
import { decodeToken } from "../tools/security/jwt";
import { notFoundError, unauthorizedError } from "./errors";

export function registerAuthRefreshRoutes(app: Hono, baseApp: BaseApp): void {
  app.post("/api/collections/:collection/auth-refresh", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    // 检查认证
    const authUser = (baseApp as any).getAuthUser?.();
    if (!authUser) {
      throw unauthorizedError("The request requires valid record authorization token to be set.");
    }

    // 提取当前 token
    const authHeader = c.req.header("Authorization") ?? "";
    const currentToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    let token: string;

    if (currentToken) {
      // 检查是否可刷新
      try {
        const claims = decodeToken(currentToken);
        if (claims.refreshable === true) {
          // 可刷新 → 生成新 token
          token = await newAuthToken(authUser);
        } else {
          // 不可刷新 → 复用原 token
          token = currentToken;
        }
      } catch {
        // token 解码失败 → 生成新 token
        token = await newAuthToken(authUser);
      }
    } else {
      token = await newAuthToken(authUser);
    }

    const recordJSON = authUser.toJSON();
    delete recordJSON.tokenKey;

    return c.json({ token, record: recordJSON });
  });
}
