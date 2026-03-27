/**
 * KV HTTP 路由
 * 对照 Go 版 plugins/kv/routes.go
 *
 * GET    /api/kv/get      — 获取值
 * POST   /api/kv/set      — 设置值
 * DELETE /api/kv/delete   — 删除 key
 * GET    /api/kv/exists   — 检查存在
 * GET    /api/kv/ttl      — 获取剩余 TTL（秒）
 * POST   /api/kv/incr     — 自增 +1
 * POST   /api/kv/decr     — 自减 -1
 * POST   /api/kv/hset     — Hash 设置字段
 * GET    /api/kv/hget     — Hash 获取字段
 * GET    /api/kv/hgetall  — Hash 全部字段
 * POST   /api/kv/hdel     — Hash 删除字段
 * POST   /api/kv/mset     — 批量设置
 * POST   /api/kv/mget     — 批量获取
 * POST   /api/kv/lock     — 获取分布式锁
 * POST   /api/kv/unlock   — 释放锁
 * GET    /api/kv/keys     — 模式匹配 key 列表
 *
 * 权限：任何已认证用户（requireAuthMiddleware）
 */

import type { Hono } from "hono";
import { requireAuthMiddleware } from "../../apis/middlewares";
import { badRequestError } from "../../apis/errors";
import type { KVStore } from "./register";

export function registerKVRoutes(app: Hono, store: KVStore): void {
  const requireAuth = requireAuthMiddleware();

  /** GET /api/kv/get?key=... */
  app.get("/api/kv/get", requireAuth, async (c) => {
    const key = c.req.query("key");
    if (!key) throw badRequestError("Missing required query param: key");
    const value = await store.get(key);
    return c.json({ found: value !== null, value: value ?? null });
  });

  /** POST /api/kv/set — Body: {key, value, ttl?: seconds} */
  app.post("/api/kv/set", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    const value = body.value ?? null;
    const ttl = body.ttl !== undefined ? Number(body.ttl) : undefined;
    await store.set(key, value, ttl);
    return c.json({ ok: true });
  });

  /** DELETE /api/kv/delete?key=... */
  app.delete("/api/kv/delete", requireAuth, async (c) => {
    const key = c.req.query("key");
    if (!key) throw badRequestError("Missing required query param: key");
    await store.delete(key);
    return c.json({ ok: true });
  });

  /** GET /api/kv/exists?key=... */
  app.get("/api/kv/exists", requireAuth, async (c) => {
    const key = c.req.query("key");
    if (!key) throw badRequestError("Missing required query param: key");
    const exists = await store.exists(key);
    return c.json({ exists });
  });

  /** GET /api/kv/ttl?key=... — 返回剩余秒数；-1=无过期；-2=不存在 */
  app.get("/api/kv/ttl", requireAuth, async (c) => {
    const key = c.req.query("key");
    if (!key) throw badRequestError("Missing required query param: key");
    const ttl = await store.ttl(key);
    return c.json({ found: ttl !== -2, ttl });
  });

  /** POST /api/kv/incr — Body: {key} */
  app.post("/api/kv/incr", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    const value = await store.incr(key);
    return c.json({ value });
  });

  /** POST /api/kv/decr — Body: {key} */
  app.post("/api/kv/decr", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    const value = await store.decr(key);
    return c.json({ value });
  });

  /** POST /api/kv/hset — Body: {key, field, value} */
  app.post("/api/kv/hset", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    const field = body.field as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    if (!field) throw badRequestError("Missing required field: field");
    await store.hset(key, field, body.value ?? null);
    return c.json({ ok: true });
  });

  /** GET /api/kv/hget?key=...&field=... */
  app.get("/api/kv/hget", requireAuth, async (c) => {
    const key = c.req.query("key");
    const field = c.req.query("field");
    if (!key) throw badRequestError("Missing required query param: key");
    if (!field) throw badRequestError("Missing required query param: field");
    const value = await store.hget(key, field);
    return c.json({ found: value !== null, value: value ?? null });
  });

  /** GET /api/kv/hgetall?key=... */
  app.get("/api/kv/hgetall", requireAuth, async (c) => {
    const key = c.req.query("key");
    if (!key) throw badRequestError("Missing required query param: key");
    const data = await store.hgetAll(key);
    return c.json(data);
  });

  /** POST /api/kv/hdel — Body: {key, field} */
  app.post("/api/kv/hdel", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    const field = body.field as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    if (!field) throw badRequestError("Missing required field: field");
    await store.hdel(key, field);
    return c.json({ ok: true });
  });

  /** POST /api/kv/mset — Body: {pairs: Record<string, unknown>} */
  app.post("/api/kv/mset", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const pairs = body.pairs as Record<string, unknown> | undefined;
    if (!pairs || typeof pairs !== "object") {
      throw badRequestError("Missing required field: pairs (must be an object)");
    }
    await store.mset(pairs);
    return c.json({ ok: true });
  });

  /** POST /api/kv/mget — Body: {keys: string[]} */
  app.post("/api/kv/mget", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const keys = body.keys as string[] | undefined;
    if (!Array.isArray(keys)) {
      throw badRequestError("Missing required field: keys (must be an array)");
    }
    const values = await store.mget(keys);
    return c.json(values);
  });

  /** POST /api/kv/lock — Body: {key, ttl?: seconds (default 30)} */
  app.post("/api/kv/lock", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    const ttl = body.ttl !== undefined ? Number(body.ttl) : 30;
    const locked = await store.lock(key, ttl);
    return c.json({ locked });
  });

  /** POST /api/kv/unlock — Body: {key} */
  app.post("/api/kv/unlock", requireAuth, async (c) => {
    const body = await c.req.json() as Record<string, unknown>;
    const key = body.key as string | undefined;
    if (!key) throw badRequestError("Missing required field: key");
    await store.unlock(key);
    return c.json({ ok: true });
  });

  /** GET /api/kv/keys?pattern=... */
  app.get("/api/kv/keys", requireAuth, async (c) => {
    const pattern = c.req.query("pattern") || "*";
    const matched = await store.keys(pattern);
    return c.json({ keys: matched });
  });
}
