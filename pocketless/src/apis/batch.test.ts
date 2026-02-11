/**
 * batch.test.ts — T117-T118 Batch API 测试
 * TDD: 先写测试（红灯），再实现（绿灯）
 *
 * 对照 Go 版 apis/batch_test.go
 */
import { describe, test, expect } from "bun:test";
import {
  type InternalRequest,
  type BatchRequestResult,
  validateBatchRequests,
  parseBatchAction,
  VALID_METHODS,
  MAX_URL_LENGTH,
} from "./batch";

// ============================================================
// T117: Batch API 核心
// ============================================================

describe("Batch API", () => {
  // ─── InternalRequest 验证 ───

  describe("validateBatchRequests", () => {
    test("空 requests 应该报错", () => {
      const result = validateBatchRequests([], 50);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.requests).toBeDefined();
    });

    test("超过 maxRequests 限制", () => {
      const requests: InternalRequest[] = [
        { method: "POST", url: "/api/collections/test/records" },
        { method: "POST", url: "/api/collections/test/records" },
        { method: "POST", url: "/api/collections/test/records" },
      ];
      const result = validateBatchRequests(requests, 2);
      expect(result.valid).toBe(false);
      expect(result.errors!.requests?.code).toBe("validation_length_too_long");
    });

    test("缺少 method 应报错", () => {
      const requests: InternalRequest[] = [
        { method: "", url: "/api/collections/test/records" } as InternalRequest,
      ];
      const result = validateBatchRequests(requests, 50);
      expect(result.valid).toBe(false);
      expect(result.errors!.requests).toBeDefined();
      // 具体错误在 requests.0.method
    });

    test("无效 method 应报错", () => {
      const requests: InternalRequest[] = [
        { method: "invalid", url: "/valid" },
      ];
      const result = validateBatchRequests(requests, 50);
      expect(result.valid).toBe(false);
    });

    test("URL 过长应报错", () => {
      const requests: InternalRequest[] = [
        { method: "POST", url: "a".repeat(MAX_URL_LENGTH + 1) },
      ];
      const result = validateBatchRequests(requests, 50);
      expect(result.valid).toBe(false);
    });

    test("合法请求应通过验证", () => {
      const requests: InternalRequest[] = [
        { method: "POST", url: "/api/collections/demo/records", body: { title: "test" } },
        { method: "PATCH", url: "/api/collections/demo/records/abc123", body: { title: "updated" } },
        { method: "DELETE", url: "/api/collections/demo/records/abc123" },
      ];
      const result = validateBatchRequests(requests, 50);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("VALID_METHODS 包含 GET POST PATCH PUT DELETE", () => {
      expect(VALID_METHODS).toContain("GET");
      expect(VALID_METHODS).toContain("POST");
      expect(VALID_METHODS).toContain("PATCH");
      expect(VALID_METHODS).toContain("PUT");
      expect(VALID_METHODS).toContain("DELETE");
    });
  });

  // ─── parseBatchAction ───

  describe("parseBatchAction", () => {
    test("POST /api/collections/:col/records → create", () => {
      const result = parseBatchAction("POST", "/api/collections/demo/records");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("create");
      expect(result!.params.collection).toBe("demo");
    });

    test("PATCH /api/collections/:col/records/:id → update", () => {
      const result = parseBatchAction("PATCH", "/api/collections/demo/records/abc123");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("update");
      expect(result!.params.collection).toBe("demo");
      expect(result!.params.id).toBe("abc123");
    });

    test("DELETE /api/collections/:col/records/:id → delete", () => {
      const result = parseBatchAction("DELETE", "/api/collections/demo/records/xyz789");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("delete");
      expect(result!.params.collection).toBe("demo");
      expect(result!.params.id).toBe("xyz789");
    });

    test("PUT /api/collections/:col/records → upsert", () => {
      const result = parseBatchAction("PUT", "/api/collections/demo/records");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("upsert");
      expect(result!.params.collection).toBe("demo");
    });

    test("PUT with query params", () => {
      const result = parseBatchAction("PUT", "/api/collections/demo/records?fields=*,id:excerpt(4,true)");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("upsert");
      expect(result!.params.collection).toBe("demo");
      expect(result!.params.query).toBe("?fields=*,id:excerpt(4,true)");
    });

    test("GET /api/health → 不支持的 action 返回 null", () => {
      const result = parseBatchAction("GET", "/api/health");
      expect(result).toBeNull();
    });

    test("GET /api/collections/demo/records → 不支持（GET 列表不在 batch action 中）", () => {
      const result = parseBatchAction("GET", "/api/collections/demo/records");
      expect(result).toBeNull();
    });

    test("POST /api/collections/demo/records?expand=rel_one → create with query", () => {
      const result = parseBatchAction("POST", "/api/collections/demo/records?expand=rel_one");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("create");
      expect(result!.params.query).toBe("?expand=rel_one");
    });

    test("PATCH with query params", () => {
      const result = parseBatchAction("PATCH", "/api/collections/demo/records/abc?expand=rel_many");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("update");
      expect(result!.params.query).toBe("?expand=rel_many");
    });
  });
});

// ============================================================
// T118: Batch Response 聚合
// ============================================================

describe("Batch Response", () => {
  test("BatchRequestResult 结构正确", () => {
    const result: BatchRequestResult = {
      status: 200,
      body: { id: "abc", title: "test" },
    };
    expect(result.status).toBe(200);
    expect(result.body).toBeDefined();
  });

  test("BatchRequestResult 204 with null body", () => {
    const result: BatchRequestResult = {
      status: 204,
      body: null,
    };
    expect(result.status).toBe(204);
    expect(result.body).toBeNull();
  });

  test("BatchRequestResult 数组序列化", () => {
    const results: BatchRequestResult[] = [
      { status: 200, body: { id: "1", title: "batch1" } },
      { status: 200, body: { id: "2", title: "batch2" } },
      { status: 204, body: null },
    ];
    const json = JSON.stringify(results);
    const parsed = JSON.parse(json) as BatchRequestResult[];
    expect(parsed.length).toBe(3);
    expect(parsed[0].status).toBe(200);
    expect(parsed[2].status).toBe(204);
    expect(parsed[2].body).toBeNull();
  });

  test("BatchResponseError 格式", () => {
    // 对照 Go 版 BatchResponseError
    const errorResponse = {
      requests: {
        "2": {
          code: "batch_request_failed",
          message: "Batch request failed.",
          response: {
            status: 400,
            message: "Something went wrong while processing your request.",
            data: {
              title: { code: "validation_required", message: "Cannot be blank." },
            },
          },
        },
      },
    };
    expect(errorResponse.requests["2"].code).toBe("batch_request_failed");
    expect(errorResponse.requests["2"].response.status).toBe(400);
  });
});
