/**
 * 中间件系统
 * 与 Go 版 apis/middlewares.go + middlewares_*.go 对齐
 *
 * 10 个核心中间件：
 * 1. Logger — 请求日志
 * 2. Panic Recovery — 错误恢复
 * 3. Rate Limit — 速率限制
 * 4. Auth Loading — 解析 Bearer token
 * 5. Security Headers — 安全头
 * 6. Body Limit — 请求体大小限制
 * 7. CORS — 跨域资源共享
 * 8. Gzip — 响应压缩
 * 9. Require Auth — 要求认证
 * 10. Require Superuser — 要求超级用户
 */

import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

// ─── T078: Logger Middleware ───

interface LogEntry {
  method: string;
  url: string;
  status: number;
  execTime: number;
  error?: string;
}

interface LoggerConfig {
  onLog?: (entry: LogEntry) => void;
}

export function loggerMiddleware(config?: LoggerConfig): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    let error: string | undefined;

    try {
      await next();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const entry: LogEntry = {
        method: c.req.method,
        url: c.req.url,
        status: c.res.status,
        execTime: Math.round(performance.now() - start),
        ...(error && { error }),
      };

      if (config?.onLog) {
        config.onLog(entry);
      }
    }
  };
}

// ─── T079: Panic Recovery Middleware ───

export function panicRecoveryMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal Server Error";
      return new Response(
        JSON.stringify({
          status: 500,
          message: `Internal Server Error: ${message}`,
          data: {},
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  };
}

// ─── T080: Rate Limit Middleware ───

interface RateLimitConfig {
  maxRequests: number;
  interval: number; // 秒
}

interface RateClient {
  available: number;
  lastConsume: number;
}

export function rateLimitMiddleware(config: RateLimitConfig): MiddlewareHandler {
  const clients = new Map<string, RateClient>();

  return async (c, next) => {
    // 简化版：使用请求 IP 作为 key
    const clientKey = c.req.header("X-Forwarded-For") ?? "default";
    const now = Math.floor(Date.now() / 1000);

    let client = clients.get(clientKey);
    if (!client) {
      client = { available: config.maxRequests, lastConsume: now };
      clients.set(clientKey, client);
    }

    // 如果间隔已过，重置
    if (now - client.lastConsume >= config.interval) {
      client.available = config.maxRequests;
    }

    client.lastConsume = now;

    if (client.available > 0) {
      client.available--;
      await next();
    } else {
      return c.json(
        {
          status: 429,
          message: "Too Many Requests.",
          data: {},
        },
        429,
      );
    }
  };
}

// ─── T081: Auth Loading Middleware ───

export function authLoadingMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token) {
      c.set("authToken", token);
      // 在真实实现中，这里会验证 token 并设置 c.set("auth", record)
      // 这里仅提取 token，验证逻辑在 BaseApp.findAuthRecordByToken 中
    }

    await next();
  };
}

// ─── T082: Security Headers Middleware ───

export function securityHeadersMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.res.headers.set("X-XSS-Protection", "1; mode=block");
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  };
}

// ─── T083: Body Limit Middleware ───

interface BodyLimitConfig {
  maxSize: number; // 字节
}

export function bodyLimitMiddleware(config: BodyLimitConfig): MiddlewareHandler {
  return async (c, next) => {
    const contentLength = c.req.header("Content-Length");
    if (contentLength && parseInt(contentLength, 10) > config.maxSize) {
      return c.json(
        {
          status: 413,
          message: "Request Entity Too Large.",
          data: {},
        },
        413,
      );
    }
    await next();
  };
}

// ─── T084: CORS Middleware ───

interface CORSConfig {
  allowOrigins?: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

export function corsMiddleware(config?: CORSConfig): MiddlewareHandler {
  const allowOrigins = config?.allowOrigins ?? ["*"];
  const allowMethods = config?.allowMethods ?? [
    "GET",
    "HEAD",
    "PUT",
    "PATCH",
    "POST",
    "DELETE",
  ];
  const allowHeaders = config?.allowHeaders ?? [];
  const exposeHeaders = config?.exposeHeaders ?? [];
  const maxAge = config?.maxAge ?? 86400;

  return async (c, next) => {
    const origin = c.req.header("Origin") ?? "";
    const isPreflight =
      c.req.method === "OPTIONS" &&
      c.req.header("Access-Control-Request-Method");

    // 检查 origin 是否允许
    let allowedOrigin = "";
    if (allowOrigins.includes("*")) {
      allowedOrigin = "*";
    } else if (origin && allowOrigins.includes(origin)) {
      allowedOrigin = origin;
    }

    if (allowedOrigin) {
      c.res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      if (config?.allowCredentials) {
        c.res.headers.set("Access-Control-Allow-Credentials", "true");
      }
    }

    if (isPreflight) {
      c.res.headers.set(
        "Access-Control-Allow-Methods",
        allowMethods.join(", "),
      );
      c.res.headers.set(
        "Access-Control-Allow-Headers",
        allowHeaders.length > 0
          ? allowHeaders.join(", ")
          : c.req.header("Access-Control-Request-Headers") ?? "",
      );
      c.res.headers.set("Access-Control-Max-Age", String(maxAge));
      return c.body(null, 204);
    }

    if (exposeHeaders.length > 0) {
      c.res.headers.set(
        "Access-Control-Expose-Headers",
        exposeHeaders.join(", "),
      );
    }

    c.res.headers.set("Vary", "Origin");

    await next();
  };
}

// ─── T085: Gzip Middleware ───

export function gzipMiddleware(): MiddlewareHandler {
  return compress();
}

// ─── T086: Require Auth Middleware ───

export function requireAuthMiddleware(
  collectionNames?: string[],
): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get("auth") as Record<string, unknown> | undefined;
    if (!auth) {
      return c.json(
        {
          status: 401,
          message:
            "The request requires valid record authorization token to be set.",
          data: {},
        },
        401,
      );
    }

    if (
      collectionNames &&
      collectionNames.length > 0 &&
      !collectionNames.includes(auth.collectionName as string)
    ) {
      return c.json(
        {
          status: 403,
          message:
            "The authorized record is not allowed to perform this action.",
          data: {},
        },
        403,
      );
    }

    await next();
  };
}

// ─── T087: Require Superuser Middleware ───

export function requireSuperuserMiddleware(): MiddlewareHandler {
  return requireAuthMiddleware(["_superusers"]);
}
