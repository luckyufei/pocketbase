/**
 * Batch API — POST /api/batch
 * 与 Go 版 apis/batch.go 对齐
 *
 * 功能:
 * - 接收 {requests: InternalRequest[]} 数组
 * - 在事务中按序执行 4 种合法 action (upsert/create/update/delete)
 * - 任一失败时整体回滚
 * - 支持超时控制
 * - 返回 [{status, body}] 数组
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { badRequestError, forbiddenError, toApiError, type ApiError } from "./errors";

// ============================================================
// 类型
// ============================================================

export interface InternalRequest {
  method: string;
  url: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface BatchRequestResult {
  status: number;
  body: unknown;
}

export interface BatchAction {
  action: "create" | "update" | "delete" | "upsert";
  params: {
    collection: string;
    id?: string;
    query?: string;
  };
}

// ============================================================
// 常量
// ============================================================

export const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const MAX_URL_LENGTH = 2000;

// ============================================================
// ValidBatchActions — 对照 Go 版 4 种正则
// ============================================================

const BATCH_ACTION_PATTERNS: Array<{
  method: string;
  regex: RegExp;
  action: BatchAction["action"];
}> = [
  {
    method: "PUT",
    regex: /^\/api\/collections\/([^\/\?]+)\/records(\?.*)?$/,
    action: "upsert",
  },
  {
    method: "POST",
    regex: /^\/api\/collections\/([^\/\?]+)\/records(\?.*)?$/,
    action: "create",
  },
  {
    method: "PATCH",
    regex: /^\/api\/collections\/([^\/\?]+)\/records\/([^\/\?]+)(\?.*)?$/,
    action: "update",
  },
  {
    method: "DELETE",
    regex: /^\/api\/collections\/([^\/\?]+)\/records\/([^\/\?]+)(\?.*)?$/,
    action: "delete",
  },
];

// ============================================================
// parseBatchAction — 解析请求对应的 batch action
// ============================================================

export function parseBatchAction(method: string, url: string): BatchAction | null {
  const upperMethod = method.toUpperCase();

  for (const pattern of BATCH_ACTION_PATTERNS) {
    if (upperMethod !== pattern.method) continue;
    const match = url.match(pattern.regex);
    if (!match) continue;

    const params: BatchAction["params"] = { collection: match[1] };

    if (pattern.action === "update" || pattern.action === "delete") {
      params.id = match[2];
      if (match[3]) params.query = match[3];
    } else {
      // create / upsert
      if (match[2]) params.query = match[2];
    }

    return { action: pattern.action, params };
  }

  return null;
}

// ============================================================
// validateBatchRequests — 批量请求验证
// ============================================================

interface ValidationResult {
  valid: boolean;
  errors?: Record<string, unknown>;
}

export function validateBatchRequests(requests: InternalRequest[], maxRequests: number): ValidationResult {
  // 空请求
  if (!requests || requests.length === 0) {
    return {
      valid: false,
      errors: {
        requests: {
          code: "validation_required",
          message: "Cannot be blank.",
        },
      },
    };
  }

  // 超过最大限制
  if (requests.length > maxRequests) {
    return {
      valid: false,
      errors: {
        requests: {
          code: "validation_length_too_long",
          message: `The length must be no more than ${maxRequests}.`,
        },
      },
    };
  }

  // 逐条验证
  const perRequestErrors: Record<string, Record<string, { code: string; message: string }>> = {};
  let hasErrors = false;

  for (let i = 0; i < requests.length; i++) {
    const ir = requests[i];
    const fieldErrors: Record<string, { code: string; message: string }> = {};

    // method 必填
    if (!ir.method) {
      fieldErrors.method = {
        code: "validation_required",
        message: "Cannot be blank.",
      };
    } else if (!VALID_METHODS.includes(ir.method.toUpperCase() as (typeof VALID_METHODS)[number])) {
      fieldErrors.method = {
        code: "validation_in_invalid",
        message: `Must be a valid value.`,
      };
    }

    // url 长度
    if (ir.url && ir.url.length > MAX_URL_LENGTH) {
      fieldErrors.url = {
        code: "validation_length_too_long",
        message: `The length must be no more than ${MAX_URL_LENGTH}.`,
      };
    }

    if (Object.keys(fieldErrors).length > 0) {
      perRequestErrors[String(i)] = fieldErrors;
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return {
      valid: false,
      errors: { requests: perRequestErrors },
    };
  }

  return { valid: true };
}

// ============================================================
// BatchResponseError — 与 Go 版 BatchResponseError 对齐
// ============================================================

export interface BatchResponseError {
  code: string;
  message: string;
  response: {
    status: number;
    message: string;
    data: Record<string, unknown>;
  };
}

// ============================================================
// registerBatchRoutes — 注册 POST /api/batch 路由
// ============================================================

export function registerBatchRoutes(app: Hono, baseApp: BaseApp): void {
  app.post("/api/batch", async (c) => {
    // 读取 Settings.batch 配置
    const settings = baseApp.settings() as Record<string, unknown>;
    const batchConfig = (settings.batch || {}) as {
      enabled?: boolean;
      maxRequests?: number;
      timeout?: number;
      maxBodySize?: number;
    };

    if (!batchConfig.enabled || !batchConfig.maxRequests || batchConfig.maxRequests <= 0) {
      throw forbiddenError("Batch requests are not allowed.");
    }

    const maxRequests = batchConfig.maxRequests;
    const txTimeout = (batchConfig.timeout && batchConfig.timeout > 0)
      ? batchConfig.timeout * 1000
      : 3000; // 默认 3 秒

    // 解析请求体
    let body: { requests?: InternalRequest[] };
    try {
      body = await c.req.json();
    } catch {
      throw badRequestError("Failed to read the submitted batch data.");
    }

    const requests = body.requests || [];

    // 验证
    const validation = validateBatchRequests(requests, maxRequests);
    if (!validation.valid) {
      throw badRequestError("Invalid batch request data.", validation.errors as Record<string, unknown>);
    }

    // 触发 onBatchRequest hook
    await baseApp.onBatchRequest().trigger({
      app: baseApp,
      httpContext: c,
      batch: requests,
      next: async () => {},
    });

    // 在事务中执行
    const results: BatchRequestResult[] = [];
    let failedIndex = -1;
    let batchError: Error | null = null;

    try {
      await Promise.race([
        baseApp.runInTransaction(async (_tx) => {
          for (let i = 0; i < requests.length; i++) {
            const ir = requests[i];
            const action = parseBatchAction(ir.method, ir.url);

            if (!action) {
              failedIndex = i;
              batchError = new Error("unknown batch request action");
              throw batchError;
            }

            try {
              const result = await executeBatchAction(baseApp, action, ir);
              results.push(result);
            } catch (err) {
              failedIndex = i;
              batchError = err instanceof Error ? err : new Error(String(err));
              throw batchError;
            }
          }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("batch transaction timeout")), txTimeout)
        ),
      ]);
    } catch (err) {
      if (batchError || (err instanceof Error && err.message === "batch transaction timeout")) {
        const apiErr = toApiError(batchError || err);
        if (failedIndex >= 0) {
          throw badRequestError("Batch transaction failed.", {
            requests: {
              [String(failedIndex)]: {
                code: "batch_request_failed",
                message: "Batch request failed.",
                response: apiErr.toJSON(),
              },
            },
          });
        }
        throw badRequestError("Batch transaction failed.", {});
      }
      throw err;
    }

    return c.json(results, 200);
  });
}

// ============================================================
// executeBatchAction — 根据 action 类型执行对应操作
// ============================================================

async function executeBatchAction(
  baseApp: BaseApp,
  action: BatchAction,
  ir: InternalRequest,
): Promise<BatchRequestResult> {
  const { RecordModel } = await import("../core/record_model");
  const col = await baseApp.findCollectionByNameOrId(action.params.collection);
  if (!col) throw new Error(`Collection "${action.params.collection}" not found.`);

  switch (action.action) {
    case "create": {
      const record = new RecordModel(col);
      const body = ir.body || {};
      if (body.id) record.id = body.id as string;
      for (const [key, value] of Object.entries(body)) {
        if (key === "id") continue;
        if (key.endsWith("+") || key.startsWith("+") || key.endsWith("-")) {
          record.applyModifier(key, value);
        } else {
          record.set(key, value);
        }
      }
      await baseApp.save(record);
      return { status: 200, body: record.toJSON() };
    }

    case "update": {
      const id = action.params.id;
      if (!id) throw new Error("Record ID is required for update.");
      const existing = await baseApp.findRecordById(action.params.collection, id);
      if (!existing) throw new Error(`Record "${id}" not found.`);
      const body = ir.body || {};
      for (const [key, value] of Object.entries(body)) {
        if (key === "id") continue;
        if (key.endsWith("+") || key.startsWith("+") || key.endsWith("-")) {
          existing.applyModifier(key, value);
        } else {
          existing.set(key, value);
        }
      }
      await baseApp.save(existing);
      return { status: 200, body: existing.toJSON() };
    }

    case "delete": {
      const id = action.params.id;
      if (!id) throw new Error("Record ID is required for delete.");
      const existing = await baseApp.findRecordById(action.params.collection, id);
      if (!existing) throw new Error(`Record "${id}" not found.`);
      await baseApp.delete(existing);
      return { status: 204, body: null };
    }

    case "upsert": {
      const body = ir.body || {};
      const id = body.id as string | undefined;
      if (id) {
        const existing = await baseApp.findRecordById(action.params.collection, id);
        if (existing) {
          // update
          for (const [key, value] of Object.entries(body)) {
            if (key === "id") continue;
            if (key.endsWith("+") || key.startsWith("+") || key.endsWith("-")) {
              existing.applyModifier(key, value);
            } else {
              existing.set(key, value);
            }
          }
          await baseApp.save(existing);
          return { status: 200, body: existing.toJSON() };
        }
      }
      // create
      const record = new RecordModel(col);
      if (id) record.id = id;
      for (const [key, value] of Object.entries(body)) {
        if (key === "id") continue;
        if (key.endsWith("+") || key.startsWith("+") || key.endsWith("-")) {
          record.applyModifier(key, value);
        } else {
          record.set(key, value);
        }
      }
      await baseApp.save(record);
      return { status: 200, body: record.toJSON() };
    }

    default:
      throw new Error(`Unknown batch action: ${action.action}`);
  }
}
