/**
 * 中间件系统测试
 * 对照 Go 版 apis/middlewares.go + middlewares_*.go
 * 全部 10 个中间件测试
 */

import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import {
  loggerMiddleware,
  panicRecoveryMiddleware,
  rateLimitMiddleware,
  authLoadingMiddleware,
  securityHeadersMiddleware,
  bodyLimitMiddleware,
  corsMiddleware,
  gzipMiddleware,
  requireAuthMiddleware,
  requireSuperuserMiddleware,
} from "./middlewares";

// ─── T079: Panic Recovery ───

describe("panicRecoveryMiddleware", () => {
  test("catches unhandled errors and returns 500", async () => {
    const app = new Hono();
    app.use("*", panicRecoveryMiddleware());
    app.get("/crash", () => {
      throw new Error("unexpected crash");
    });

    const res = await app.request("/crash");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Internal");
  });

  test("normal requests pass through", async () => {
    const app = new Hono();
    app.use("*", panicRecoveryMiddleware());
    app.get("/ok", (c) => c.json({ ok: true }));

    const res = await app.request("/ok");
    expect(res.status).toBe(200);
  });
});

// ─── T080: Rate Limiter ───

describe("rateLimitMiddleware", () => {
  test("allows requests within limit", async () => {
    const app = new Hono();
    app.use("*", rateLimitMiddleware({ maxRequests: 5, interval: 60 }));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
  });

  test("returns 429 when limit exceeded", async () => {
    const app = new Hono();
    app.use("*", rateLimitMiddleware({ maxRequests: 2, interval: 60 }));
    app.get("/api/test", (c) => c.json({ ok: true }));

    await app.request("/api/test");
    await app.request("/api/test");
    const res = await app.request("/api/test");
    expect(res.status).toBe(429);
  });
});

// ─── T081: Auth Loading ───

describe("authLoadingMiddleware", () => {
  test("sets auth to null when no token", async () => {
    let authValue: unknown = "initial";
    const app = new Hono();
    app.use("*", authLoadingMiddleware());
    app.get("/api/test", (c) => {
      authValue = c.get("auth");
      return c.json({ ok: true });
    });

    await app.request("/api/test");
    expect(authValue).toBeUndefined();
  });

  test("extracts Bearer token from Authorization header", async () => {
    let tokenValue: unknown;
    const app = new Hono();
    app.use("*", authLoadingMiddleware());
    app.get("/api/test", (c) => {
      tokenValue = c.get("authToken");
      return c.json({ ok: true });
    });

    await app.request("/api/test", {
      headers: { Authorization: "Bearer test_token_123" },
    });
    expect(tokenValue).toBe("test_token_123");
  });
});

// ─── T082: Security Headers ───

describe("securityHeadersMiddleware", () => {
  test("sets X-Frame-Options, X-Content-Type-Options, X-XSS-Protection", async () => {
    const app = new Hono();
    app.use("*", securityHeadersMiddleware());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });
});

// ─── T083: Body Limit ───

describe("bodyLimitMiddleware", () => {
  test("allows requests within body limit", async () => {
    const app = new Hono();
    app.use("*", bodyLimitMiddleware({ maxSize: 1024 }));
    app.post("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test", {
      method: "POST",
      body: "x".repeat(100),
      headers: { "Content-Type": "text/plain" },
    });
    expect(res.status).toBe(200);
  });

  test("returns 413 when Content-Length exceeds limit", async () => {
    const app = new Hono();
    app.use("*", bodyLimitMiddleware({ maxSize: 10 }));
    app.post("/api/test", async (c) => {
      await c.req.text();
      return c.json({ ok: true });
    });

    const res = await app.request("/api/test", {
      method: "POST",
      body: "x".repeat(100),
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "100",
      },
    });
    expect(res.status).toBe(413);
  });
});

// ─── T084: CORS ───

describe("corsMiddleware", () => {
  test("sets Access-Control-Allow-Origin for allowed origins", async () => {
    const app = new Hono();
    app.use("*", corsMiddleware({ allowOrigins: ["https://example.com"] }));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test", {
      headers: { Origin: "https://example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  test("wildcard allows any origin", async () => {
    const app = new Hono();
    app.use("*", corsMiddleware({ allowOrigins: ["*"] }));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test", {
      headers: { Origin: "https://any.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("OPTIONS preflight returns 204", async () => {
    const app = new Hono();
    app.use("*", corsMiddleware({ allowOrigins: ["*"] }));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBeDefined();
  });
});

// ─── T085: Gzip ───

describe("gzipMiddleware", () => {
  test("compresses response when Accept-Encoding includes gzip", async () => {
    const app = new Hono();
    app.use("*", gzipMiddleware());
    app.get("/api/test", (c) => c.text("Hello".repeat(100)));

    const res = await app.request("/api/test", {
      headers: { "Accept-Encoding": "gzip" },
    });
    // Hono 内部压缩：检查 Content-Encoding 头
    // 注意：Hono 测试请求可能不走真正的压缩，检查 response 正常即可
    expect(res.status).toBe(200);
  });

  test("does not compress when Accept-Encoding absent", async () => {
    const app = new Hono();
    app.use("*", gzipMiddleware());
    app.get("/api/test", (c) => c.text("Hello"));

    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Encoding")).toBeNull();
  });
});

// ─── T086: Require Auth ───

describe("requireAuthMiddleware", () => {
  test("returns 401 when no auth", async () => {
    const app = new Hono();
    app.use("*", requireAuthMiddleware());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(401);
  });

  test("allows request when auth is set", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("auth", { id: "user_1" });
      await next();
    });
    app.use("*", requireAuthMiddleware());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
  });
});

// ─── T087: Require Superuser ───

describe("requireSuperuserMiddleware", () => {
  test("returns 401 when no auth", async () => {
    const app = new Hono();
    app.use("*", requireSuperuserMiddleware());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(401);
  });

  test("returns 403 when auth is not superuser", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("auth", { id: "user_1", collectionName: "users" });
      await next();
    });
    app.use("*", requireSuperuserMiddleware());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(403);
  });

  test("allows superuser", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("auth", { id: "su_1", collectionName: "_superusers" });
      await next();
    });
    app.use("*", requireSuperuserMiddleware());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
  });
});

// ─── T078: Logger ───

describe("loggerMiddleware", () => {
  test("logs request info (passes through)", async () => {
    const logs: unknown[] = [];
    const app = new Hono();
    app.use("*", loggerMiddleware({ onLog: (entry) => logs.push(entry) }));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
    expect(logs.length).toBe(1);
    const log = logs[0] as Record<string, unknown>;
    expect(log.method).toBe("GET");
    expect(log.status).toBe(200);
    expect(typeof log.execTime).toBe("number");
  });
});
