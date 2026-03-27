/**
 * Secrets HTTP 路由
 * 对照 Go 版 plugins/secrets/routes.go
 *
 * GET    /api/secrets          — 列出所有（value 为密文，不解密）
 * POST   /api/secrets          — 创建密钥
 * GET    /api/secrets/:key     — 获取（解密后的明文值）
 * PUT    /api/secrets/:key     — 更新密钥
 * DELETE /api/secrets/:key     — 删除
 *
 * 权限：所有端点需要 Superuser
 */

import type { Hono } from "hono";
import { requireSuperuserMiddleware } from "../../apis/middlewares";
import { badRequestError, notFoundError } from "../../apis/errors";
import type { SecretsStore } from "./register";

export function registerSecretsRoutes(app: Hono, store: SecretsStore): void {
  const requireSuperuser = requireSuperuserMiddleware();

  /**
   * GET /api/secrets
   * 列出所有密钥（value 字段为密文，不暴露明文）
   * Query: env? — 按 env 过滤
   */
  app.get("/api/secrets", requireSuperuser, async (c) => {
    const env = c.req.query("env") || undefined;
    const items = await store.list(env);
    return c.json({ items, total: items.length });
  });

  /**
   * POST /api/secrets
   * 创建新密钥
   * Body: {key: string, value: string, env?: string, description?: string}
   */
  app.post("/api/secrets", requireSuperuser, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    const value = body.value as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    if (value === undefined || value === null) throw badRequestError("Missing required field: value");
    const env = (body.env as string | undefined) || "global";
    const description = (body.description as string | undefined) || "";

    await store.set(key, String(value), { env, description });
    return c.json({ key, env, message: "Secret created successfully." }, 201);
  });

  /**
   * GET /api/secrets/:key
   * 获取密钥（解密后返回明文值）
   * Query: env? — 指定 env，未匹配时回退到 "global"
   */
  app.get("/api/secrets/:key", requireSuperuser, async (c) => {
    const key = c.req.param("key");
    const env = c.req.query("env") || undefined;
    try {
      const value = await store.get(key, env);
      return c.json({ key, value });
    } catch {
      throw notFoundError();
    }
  });

  /**
   * PUT /api/secrets/:key
   * 更新已有密钥
   * Body: {value: string, env?: string, description?: string}
   */
  app.put("/api/secrets/:key", requireSuperuser, async (c) => {
    const key = c.req.param("key");
    const body = await c.req.json() as Record<string, unknown>;
    const value = body.value as string | undefined;
    if (value === undefined || value === null) throw badRequestError("Missing required field: value");
    const env = (body.env as string | undefined) || undefined;
    const description = (body.description as string | undefined) || undefined;

    await store.set(key, String(value), { env, description });
    return c.json({ key, message: "Secret updated successfully." });
  });

  /**
   * DELETE /api/secrets/:key
   * 删除密钥
   * Query: env? — 指定 env，不传则删除 "global"
   */
  app.delete("/api/secrets/:key", requireSuperuser, async (c) => {
    const key = c.req.param("key");
    const env = c.req.query("env") || undefined;
    await store.delete(key, env);
    return c.body(null, 204);
  });
}
