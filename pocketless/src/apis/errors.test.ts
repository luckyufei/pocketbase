/**
 * T171 — errors.test.ts
 * 对照 Go 版 tools/router/error.go + apis/errors_test.go
 * 测试 ApiError 类 + 6 个工厂函数 + toApiError 转换器
 */

import { describe, test, expect } from "bun:test";
import {
  ApiError,
  badRequestError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  tooManyRequestsError,
  internalError,
  toApiError,
} from "./errors";

// ============================================================
// ApiError 类
// ============================================================

describe("ApiError", () => {
  test("constructor sets status, message, data", () => {
    const err = new ApiError(418, "I'm a teapot", { key: "val" });
    expect(err.status).toBe(418);
    expect(err.message).toBe("I'm a teapot");
    expect(err.data).toEqual({ key: "val" });
    expect(err.name).toBe("ApiError");
  });

  test("extends Error", () => {
    const err = new ApiError(500, "oops");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  test("data defaults to empty object", () => {
    const err = new ApiError(400, "bad");
    expect(err.data).toEqual({});
  });

  test("toJSON returns {status, message, data}", () => {
    const err = new ApiError(403, "forbidden", { reason: "no" });
    const json = err.toJSON();
    expect(json).toEqual({
      status: 403,
      message: "forbidden",
      data: { reason: "no" },
    });
  });

  test("toJSON excludes stack and name", () => {
    const err = new ApiError(400, "bad");
    const json = err.toJSON();
    expect(json).not.toHaveProperty("stack");
    expect(json).not.toHaveProperty("name");
  });
});

// ============================================================
// 工厂函数
// ============================================================

describe("Error Factory Functions", () => {
  // badRequestError
  describe("badRequestError", () => {
    test("default message and status 400", () => {
      const err = badRequestError();
      expect(err.status).toBe(400);
      expect(err.message).toBe("Something went wrong while processing your request.");
      expect(err.data).toEqual({});
    });

    test("custom message", () => {
      const err = badRequestError("Custom error.");
      expect(err.message).toBe("Custom error.");
    });

    test("custom data", () => {
      const err = badRequestError("err", { field: { code: "invalid" } });
      expect(err.data).toEqual({ field: { code: "invalid" } });
    });

    test("returns ApiError instance", () => {
      expect(badRequestError()).toBeInstanceOf(ApiError);
    });
  });

  // unauthorizedError
  describe("unauthorizedError", () => {
    test("default message and status 401", () => {
      const err = unauthorizedError();
      expect(err.status).toBe(401);
      expect(err.message).toBe("Missing or invalid authentication.");
      expect(err.data).toEqual({});
    });

    test("custom message", () => {
      const err = unauthorizedError("Token expired.");
      expect(err.message).toBe("Token expired.");
    });
  });

  // forbiddenError
  describe("forbiddenError", () => {
    test("default message and status 403", () => {
      const err = forbiddenError();
      expect(err.status).toBe(403);
      expect(err.message).toBe("You are not allowed to perform this request.");
      expect(err.data).toEqual({});
    });

    test("custom message", () => {
      const err = forbiddenError("Access denied.");
      expect(err.message).toBe("Access denied.");
    });
  });

  // notFoundError
  describe("notFoundError", () => {
    test("default message and status 404", () => {
      const err = notFoundError();
      expect(err.status).toBe(404);
      expect(err.message).toBe("The requested resource wasn't found.");
      expect(err.data).toEqual({});
    });

    test("custom message", () => {
      const err = notFoundError("User not found.");
      expect(err.message).toBe("User not found.");
    });
  });

  // tooManyRequestsError
  describe("tooManyRequestsError", () => {
    test("default message and status 429", () => {
      const err = tooManyRequestsError();
      expect(err.status).toBe(429);
      expect(err.message).toBe("Too Many Requests.");
      expect(err.data).toEqual({});
    });

    test("custom message", () => {
      const err = tooManyRequestsError("Rate limited.");
      expect(err.message).toBe("Rate limited.");
    });
  });

  // internalError
  describe("internalError", () => {
    test("default message and status 500", () => {
      const err = internalError();
      expect(err.status).toBe(500);
      expect(err.message).toBe("Something went wrong while processing your request.");
      expect(err.data).toEqual({});
    });

    test("custom message", () => {
      const err = internalError("DB crashed.");
      expect(err.message).toBe("DB crashed.");
    });
  });
});

// ============================================================
// toApiError 转换器
// ============================================================

describe("toApiError", () => {
  test("ApiError passthrough", () => {
    const original = new ApiError(418, "teapot", { x: 1 });
    const result = toApiError(original);
    expect(result).toBe(original); // 同一实例
  });

  test("Error with 'not found' → 404 notFoundError", () => {
    const err = new Error("record not found");
    const result = toApiError(err);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(404);
    expect(result.message).toBe("The requested resource wasn't found.");
  });

  test("Error with 'no rows' → 404 notFoundError", () => {
    const err = new Error("no rows in result set");
    const result = toApiError(err);
    expect(result.status).toBe(404);
  });

  test("regular Error → 400 badRequestError with error message", () => {
    const err = new Error("validation failed");
    const result = toApiError(err);
    expect(result.status).toBe(400);
    expect(result.message).toBe("validation failed");
  });

  test("non-Error value → 400 badRequestError with default message", () => {
    const result = toApiError("some string");
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(400);
    expect(result.message).toBe("Something went wrong while processing your request.");
  });

  test("null → 400 badRequestError with default message", () => {
    const result = toApiError(null);
    expect(result.status).toBe(400);
  });

  test("undefined → 400 badRequestError with default message", () => {
    const result = toApiError(undefined);
    expect(result.status).toBe(400);
  });

  test("number → 400 badRequestError with default message", () => {
    const result = toApiError(42);
    expect(result.status).toBe(400);
  });
});
