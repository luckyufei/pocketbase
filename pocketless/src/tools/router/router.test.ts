/**
 * Router wrapper 测试 — 对照 Go 版 tools/router 测试
 * 覆盖: Router, RouterGroup, Route, ApiError, Event helpers
 */

import { describe, test, expect } from "bun:test";
import {
  Router,
  type RouterGroup,
  type Route,
  type RouterEvent,
  type MiddlewareFunc,
  ApiError,
  toApiError,
  NewNotFoundError,
  NewBadRequestError,
  NewForbiddenError,
  NewUnauthorizedError,
  NewInternalServerError,
  NewTooManyRequestsError,
} from "./router";

// ==================== ApiError 测试 ====================

describe("ApiError", () => {
  test("constructor and properties", () => {
    const err = new ApiError(400, "bad request", { key: "value" });
    expect(err.status).toBe(400);
    expect(err.message).toBe("bad request");
    expect(err.data).toEqual({ key: "value" });
    expect(err instanceof Error).toBe(true);
  });

  test("toJSON serialization", () => {
    const err = new ApiError(404, "not found", {});
    const json = err.toJSON();
    expect(json).toEqual({
      status: 404,
      message: "not found",
      data: {},
    });
  });

  test("factory functions", () => {
    const notFound = NewNotFoundError("missing", {});
    expect(notFound.status).toBe(404);
    expect(notFound.message).toBe("missing");

    const badReq = NewBadRequestError("invalid", {});
    expect(badReq.status).toBe(400);

    const forbidden = NewForbiddenError("nope", {});
    expect(forbidden.status).toBe(403);

    const unauth = NewUnauthorizedError("login required", {});
    expect(unauth.status).toBe(401);

    const internal = NewInternalServerError("oops", {});
    expect(internal.status).toBe(500);

    const tooMany = NewTooManyRequestsError("slow down", {});
    expect(tooMany.status).toBe(429);
  });

  test("toApiError converts unknown error", () => {
    const err = new Error("something broke");
    const apiErr = toApiError(err);
    expect(apiErr.status).toBe(500);
    expect(apiErr.message).toBe("something broke");
  });

  test("toApiError passes through ApiError", () => {
    const original = new ApiError(422, "validation error", { field: "email" });
    const converted = toApiError(original);
    expect(converted).toBe(original);
    expect(converted.status).toBe(422);
    expect(converted.data).toEqual({ field: "email" });
  });

  test("default data is empty object", () => {
    const err = new ApiError(500, "error");
    expect(err.data).toEqual({});
  });
});

// ==================== Router 测试 ====================

describe("Router", () => {
  test("constructor creates instance", () => {
    const router = new Router();
    expect(router).toBeDefined();
    expect(router.routes()).toEqual([]);
  });

  test("GET/POST/PUT/PATCH/DELETE/ANY route registration", () => {
    const router = new Router();
    const handler = async () => {};

    router.get("/users", handler);
    router.post("/users", handler);
    router.put("/users/:id", handler);
    router.patch("/users/:id", handler);
    router.delete("/users/:id", handler);
    router.any("/wildcard", handler);

    const routes = router.routes();
    expect(routes.length).toBe(6);

    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/users");

    expect(routes[1].method).toBe("POST");
    expect(routes[1].path).toBe("/users");

    expect(routes[2].method).toBe("PUT");
    expect(routes[2].path).toBe("/users/:id");

    expect(routes[3].method).toBe("PATCH");
    expect(routes[3].path).toBe("/users/:id");

    expect(routes[4].method).toBe("DELETE");
    expect(routes[4].path).toBe("/users/:id");

    expect(routes[5].method).toBe("ANY");
    expect(routes[5].path).toBe("/wildcard");
  });

  test("route with action", () => {
    const router = new Router();
    let called = false;
    router.get("/test", async () => {
      called = true;
    });

    const routes = router.routes();
    expect(routes.length).toBe(1);
    expect(routes[0].action).toBeDefined();
  });

  test("hasRoute checks existence", () => {
    const router = new Router();
    router.get("/api/health", async () => {});

    expect(router.hasRoute("GET", "/api/health")).toBe(true);
    expect(router.hasRoute("POST", "/api/health")).toBe(false);
    expect(router.hasRoute("GET", "/api/missing")).toBe(false);
  });
});

// ==================== RouterGroup 测试 ====================

describe("RouterGroup", () => {
  test("group creates nested prefix", () => {
    const router = new Router();
    const group = router.group("/api");
    group.get("/users", async () => {});

    const routes = router.routes();
    expect(routes.length).toBe(1);
    expect(routes[0].path).toBe("/api/users");
  });

  test("nested groups", () => {
    const router = new Router();
    const api = router.group("/api");
    const v1 = api.group("/v1");
    v1.get("/health", async () => {});

    const routes = router.routes();
    expect(routes.length).toBe(1);
    expect(routes[0].path).toBe("/api/v1/health");
  });

  test("group-level middleware", () => {
    const router = new Router();
    const order: string[] = [];

    const middleware: MiddlewareFunc = async (_e, next) => {
      order.push("middleware");
      await next();
    };

    const group = router.group("/api");
    group.use(middleware);
    group.get("/test", async () => {
      order.push("handler");
    });

    const routes = router.routes();
    expect(routes.length).toBe(1);
    expect(routes[0].middlewares.length).toBe(1);
  });

  test("multiple middlewares in order", () => {
    const router = new Router();

    const mw1: MiddlewareFunc = async (_e, next) => {
      await next();
    };
    const mw2: MiddlewareFunc = async (_e, next) => {
      await next();
    };

    const group = router.group("/api");
    group.use(mw1, mw2);
    group.get("/test", async () => {});

    const routes = router.routes();
    expect(routes[0].middlewares.length).toBe(2);
  });

  test("child group inherits parent middleware", () => {
    const router = new Router();

    const parentMw: MiddlewareFunc = async (_e, next) => {
      await next();
    };
    const childMw: MiddlewareFunc = async (_e, next) => {
      await next();
    };

    const parent = router.group("/api");
    parent.use(parentMw);

    const child = parent.group("/v1");
    child.use(childMw);
    child.get("/test", async () => {});

    const routes = router.routes();
    // 子组继承父组中间件
    expect(routes[0].middlewares.length).toBe(2);
  });
});

// ==================== Route 测试 ====================

describe("Route", () => {
  test("route properties", () => {
    const router = new Router();
    router.get("/api/test", async () => {});

    const routes = router.routes();
    expect(routes[0]).toEqual(
      expect.objectContaining({
        method: "GET",
        path: "/api/test",
      }),
    );
  });

  test("route-level middleware", () => {
    const router = new Router();
    const mw: MiddlewareFunc = async (_e, next) => {
      await next();
    };

    router.get("/test", async () => {}, mw);

    const routes = router.routes();
    expect(routes[0].middlewares.length).toBe(1);
  });
});

// ==================== Middleware 执行 测试 ====================

describe("Middleware execution", () => {
  test("middleware chain executes in order", async () => {
    const router = new Router();
    const order: string[] = [];

    const mw1: MiddlewareFunc = async (_e, next) => {
      order.push("mw1-before");
      await next();
      order.push("mw1-after");
    };

    const mw2: MiddlewareFunc = async (_e, next) => {
      order.push("mw2-before");
      await next();
      order.push("mw2-after");
    };

    const group = router.group("/api");
    group.use(mw1, mw2);
    group.get("/test", async () => {
      order.push("handler");
    });

    const route = router.routes()[0];
    // 模拟执行中间件链
    await router.executeMiddlewareChain(route);

    expect(order).toEqual([
      "mw1-before",
      "mw2-before",
      "handler",
      "mw2-after",
      "mw1-after",
    ]);
  });

  test("middleware can short-circuit", async () => {
    const router = new Router();
    const order: string[] = [];

    const mw: MiddlewareFunc = async (_e, _next) => {
      order.push("mw-blocked");
      // 不调用 next，短路
    };

    const group = router.group("/api");
    group.use(mw);
    group.get("/test", async () => {
      order.push("handler");
    });

    const route = router.routes()[0];
    await router.executeMiddlewareChain(route);

    expect(order).toEqual(["mw-blocked"]);
  });

  test("middleware error propagates", async () => {
    const router = new Router();

    const mw: MiddlewareFunc = async (_e, _next) => {
      throw new ApiError(401, "unauthorized", {});
    };

    const group = router.group("/api");
    group.use(mw);
    group.get("/test", async () => {});

    const route = router.routes()[0];

    try {
      await router.executeMiddlewareChain(route);
      expect(true).toBe(false); // 不应到达这里
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(401);
    }
  });
});

// ==================== buildHono 集成测试 ====================

describe("buildHono integration", () => {
  test("buildHono returns Hono app", () => {
    const router = new Router();
    router.get("/api/health", async () => {});

    const app = router.buildHono();
    expect(app).toBeDefined();
    // Hono 实例具有 fetch 方法
    expect(typeof app.fetch).toBe("function");
  });

  test("route handling via fetch", async () => {
    const router = new Router();
    router.get("/api/health", async (e) => {
      return e.json({ status: 200, message: "OK" });
    });

    const app = router.buildHono();
    const res = await app.fetch(new Request("http://localhost/api/health"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(200);
    expect(body.message).toBe("OK");
  });

  test("middleware executes via buildHono", async () => {
    const router = new Router();
    const order: string[] = [];

    const mw: MiddlewareFunc = async (_e, next) => {
      order.push("mw");
      await next();
    };

    const group = router.group("/api");
    group.use(mw);
    group.get("/test", async (e) => {
      order.push("handler");
      return e.json({ ok: true });
    });

    const app = router.buildHono();
    const res = await app.fetch(new Request("http://localhost/api/test"));

    expect(res.status).toBe(200);
    expect(order).toEqual(["mw", "handler"]);
  });

  test("404 for unmatched routes", async () => {
    const router = new Router();
    router.get("/api/health", async (e) => {
      return e.json({ ok: true });
    });

    const app = router.buildHono();
    const res = await app.fetch(new Request("http://localhost/api/missing"));

    expect(res.status).toBe(404);
  });

  test("error handling in routes", async () => {
    const router = new Router();
    router.get("/api/fail", async () => {
      throw new ApiError(422, "validation failed", { field: "name" });
    });

    const app = router.buildHono();
    const res = await app.fetch(new Request("http://localhost/api/fail"));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toBe("validation failed");
    expect(body.data).toEqual({ field: "name" });
  });

  test("group middleware + route middleware", async () => {
    const router = new Router();
    const order: string[] = [];

    const groupMw: MiddlewareFunc = async (_e, next) => {
      order.push("group-mw");
      await next();
    };

    const routeMw: MiddlewareFunc = async (_e, next) => {
      order.push("route-mw");
      await next();
    };

    const group = router.group("/api");
    group.use(groupMw);
    group.get(
      "/test",
      async (e) => {
        order.push("handler");
        return e.json({ ok: true });
      },
      routeMw,
    );

    const app = router.buildHono();
    const res = await app.fetch(new Request("http://localhost/api/test"));

    expect(res.status).toBe(200);
    // 组中间件先于路由中间件
    expect(order).toEqual(["group-mw", "route-mw", "handler"]);
  });

  test("POST with body", async () => {
    const router = new Router();
    router.post("/api/items", async (e) => {
      const body = await e.req.json();
      return e.json({ received: body.name }, 201);
    });

    const app = router.buildHono();
    const res = await app.fetch(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.received).toBe("test");
  });

  test("path parameters", async () => {
    const router = new Router();
    router.get("/api/users/:id", async (e) => {
      const id = e.req.param("id");
      return e.json({ userId: id });
    });

    const app = router.buildHono();
    const res = await app.fetch(
      new Request("http://localhost/api/users/abc123"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("abc123");
  });
});
