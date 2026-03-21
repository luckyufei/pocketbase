/**
 * 统一错误响应
 * 与 Go 版 tools/router/error.go 对齐
 * 格式: {status: N, message: "...", data: {...}}
 */

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }

  toJSON(): Record<string, unknown> {
    return {
      status: this.status,
      message: this.message,
      data: this.data,
    };
  }
}

/** 400 Bad Request */
export function badRequestError(
  message: string = "Something went wrong while processing your request.",
  data: Record<string, unknown> = {},
): ApiError {
  return new ApiError(400, message, data);
}

/** 401 Unauthorized */
export function unauthorizedError(
  message: string = "Missing or invalid authentication.",
): ApiError {
  return new ApiError(401, message, {});
}

/** 403 Forbidden */
export function forbiddenError(
  message: string = "You are not allowed to perform this request.",
): ApiError {
  return new ApiError(403, message, {});
}

/** 404 Not Found */
export function notFoundError(
  message: string = "The requested resource wasn't found.",
): ApiError {
  return new ApiError(404, message, {});
}

/** 429 Too Many Requests */
export function tooManyRequestsError(
  message: string = "Too Many Requests.",
): ApiError {
  return new ApiError(429, message, {});
}

/** 500 Internal Server Error */
export function internalError(
  message: string = "Something went wrong while processing your request.",
): ApiError {
  return new ApiError(500, message, {});
}

/** 将任意 Error 转为 ApiError */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    if (err.message.includes("not found") || err.message.includes("no rows")) {
      return notFoundError();
    }
    return badRequestError(err.message);
  }
  return badRequestError();
}
