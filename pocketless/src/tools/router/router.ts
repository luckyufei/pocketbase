/**
 * Router wrapper — 基于 Hono 的通用 HTTP 路由器
 * 与 Go 版 tools/router 对齐：支持路由组、中间件链、错误处理
 */

import { Hono, type Context } from "hono";

// ==================== ApiError ====================

/**
 * API 错误 — 可序列化为 JSON 的错误类型
 * 对齐 Go 版 router.ApiError
 */
export class ApiError extends Error {
  status: number;
  data: Record<string, any>;

  constructor(status: number, message: string, data: Record<string, any> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  toJSON(): { status: number; message: string; data: Record<string, any> } {
    return {
      status: this.status,
      message: this.message,
      data: this.data,
    };
  }
}

/** 将任意错误转为 ApiError */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    return new ApiError(500, err.message, {});
  }
  return new ApiError(500, String(err), {});
}

// 工厂函数 — 对齐 Go 版 NewXxxError
export function NewNotFoundError(message: string, data: Record<string, any> = {}): ApiError {
  return new ApiError(404, message || "The requested resource wasn't found.", data);
}

export function NewBadRequestError(message: string, data: Record<string, any> = {}): ApiError {
  return new ApiError(400, message || "Something went wrong while processing your request.", data);
}

export function NewForbiddenError(message: string, data: Record<string, any> = {}): ApiError {
  return new ApiError(403, message || "You are not allowed to perform this request.", data);
}

export function NewUnauthorizedError(message: string, data: Record<string, any> = {}): ApiError {
  return new ApiError(401, message || "The request requires valid record authorization token.", data);
}

export function NewInternalServerError(message: string, data: Record<string, any> = {}): ApiError {
  return new ApiError(500, message || "Something went wrong while processing your request.", data);
}

export function NewTooManyRequestsError(message: string, data: Record<string, any> = {}): ApiError {
  return new ApiError(429, message || "Too many requests.", data);
}

// ==================== Types ====================

/** 路由事件 — Hono Context 的类型别名 */
export type RouterEvent = Context;

/** 中间件函数签名 */
export type MiddlewareFunc = (event: RouterEvent, next: () => Promise<void>) => Promise<void>;

/** 路由处理函数签名 */
export type HandlerFunc = (event: RouterEvent) => Promise<Response | void>;

/** 路由定义 */
export interface Route {
  method: string;
  path: string;
  action: HandlerFunc;
  middlewares: MiddlewareFunc[];
}

/** 路由组 */
export interface RouterGroup {
  /** 注册 GET 路由 */
  get(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void;
  /** 注册 POST 路由 */
  post(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void;
  /** 注册 PUT 路由 */
  put(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void;
  /** 注册 PATCH 路由 */
  patch(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void;
  /** 注册 DELETE 路由 */
  delete(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void;
  /** 注册匹配所有方法的路由 */
  any(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void;
  /** 创建子路由组 */
  group(prefix: string): RouterGroup;
  /** 添加组级中间件 */
  use(...middlewares: MiddlewareFunc[]): void;
}

// ==================== Router 实现 ====================

/**
 * 内部路由组实现
 */
class InternalGroup implements RouterGroup {
  private _prefix: string;
  private _middlewares: MiddlewareFunc[];
  private _routes: Route[];
  private _children: InternalGroup[];

  constructor(prefix: string, parentMiddlewares: MiddlewareFunc[], routes: Route[]) {
    this._prefix = prefix;
    this._middlewares = [...parentMiddlewares];
    this._routes = routes;
    this._children = [];
  }

  get(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._addRoute("GET", path, handler, middlewares);
  }

  post(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._addRoute("POST", path, handler, middlewares);
  }

  put(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._addRoute("PUT", path, handler, middlewares);
  }

  patch(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._addRoute("PATCH", path, handler, middlewares);
  }

  delete(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._addRoute("DELETE", path, handler, middlewares);
  }

  any(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._addRoute("ANY", path, handler, middlewares);
  }

  group(prefix: string): RouterGroup {
    const child = new InternalGroup(
      this._prefix + prefix,
      this._middlewares,
      this._routes,
    );
    this._children.push(child);
    return child;
  }

  use(...middlewares: MiddlewareFunc[]): void {
    this._middlewares.push(...middlewares);
  }

  private _addRoute(method: string, path: string, handler: HandlerFunc, routeMiddlewares: MiddlewareFunc[]): void {
    this._routes.push({
      method,
      path: this._prefix + path,
      action: handler,
      middlewares: [...this._middlewares, ...routeMiddlewares],
    });
  }
}

/**
 * Router — 通用 HTTP 路由器
 * 封装 Hono，提供与 Go 版 tools/router 兼容的 API
 */
export class Router implements RouterGroup {
  private _routes: Route[] = [];
  private _root: InternalGroup;

  constructor() {
    this._root = new InternalGroup("", [], this._routes);
  }

  // ---- RouterGroup 代理 ----

  get(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._root.get(path, handler, ...middlewares);
  }

  post(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._root.post(path, handler, ...middlewares);
  }

  put(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._root.put(path, handler, ...middlewares);
  }

  patch(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._root.patch(path, handler, ...middlewares);
  }

  delete(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._root.delete(path, handler, ...middlewares);
  }

  any(path: string, handler: HandlerFunc, ...middlewares: MiddlewareFunc[]): void {
    this._root.any(path, handler, ...middlewares);
  }

  group(prefix: string): RouterGroup {
    return this._root.group(prefix);
  }

  use(...middlewares: MiddlewareFunc[]): void {
    this._root.use(...middlewares);
  }

  // ---- Router 特有方法 ----

  /** 获取所有已注册路由 */
  routes(): Route[] {
    return [...this._routes];
  }

  /** 检查路由是否存在 */
  hasRoute(method: string, path: string): boolean {
    return this._routes.some((r) => r.method === method && r.path === path);
  }

  /**
   * 执行中间件链 — 洋葱模型
   * 用于测试和内部调用
   */
  async executeMiddlewareChain(route: Route, event?: RouterEvent): Promise<void> {
    const { middlewares, action } = route;

    if (middlewares.length === 0) {
      await action(event as any);
      return;
    }

    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= middlewares.length) {
        await action(event as any);
        return;
      }
      const mw = middlewares[index++];
      await mw(event as any, next);
    };

    await next();
  }

  /**
   * 编译为 Hono 应用
   * 将所有路由和中间件注册到 Hono 实例
   */
  buildHono(): Hono {
    const app = new Hono();

    // 全局错误处理
    app.onError((err, c) => {
      const apiErr = toApiError(err);
      return c.json(apiErr.toJSON(), apiErr.status as any);
    });

    // 404 处理
    app.notFound((c) => {
      return c.json(
        { status: 404, message: "The requested resource wasn't found.", data: {} },
        404,
      );
    });

    // 注册路由
    for (const route of this._routes) {
      const honoHandler = async (c: Context) => {
        // 构建中间件链
        const { middlewares, action } = route;

        if (middlewares.length === 0) {
          const result = await action(c);
          return result ?? c.body(null, 204);
        }

        let index = 0;
        let result: Response | void;

        const next = async (): Promise<void> => {
          if (index >= middlewares.length) {
            result = await action(c);
            return;
          }
          const mw = middlewares[index++];
          await mw(c, next);
        };

        await next();
        return result ?? c.body(null, 204);
      };

      const method = route.method.toLowerCase();
      if (method === "any") {
        app.all(route.path, honoHandler);
      } else {
        (app as any)[method](route.path, honoHandler);
      }
    }

    return app;
  }
}
