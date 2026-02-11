/**
 * AuthOrigins 查询辅助函数测试
 * 对照 Go 版 core/auth_origin_query.go
 */

import { describe, test, expect } from "bun:test";
import {
  AuthOrigin,
  findAllAuthOriginsByRecord,
  findAllAuthOriginsByCollection,
  findAuthOriginById,
  findAuthOriginByRecordAndFingerprint,
  deleteAllAuthOriginsByRecord,
} from "./auth_origins_query";

describe("AuthOrigin model", () => {
  test("basic getters/setters", () => {
    const ao = new AuthOrigin();
    ao.id = "ao_1";
    ao.collectionRef = "col_1";
    ao.recordRef = "rec_1";
    ao.fingerprint = "fp_abc123";

    expect(ao.id).toBe("ao_1");
    expect(ao.collectionRef).toBe("col_1");
    expect(ao.recordRef).toBe("rec_1");
    expect(ao.fingerprint).toBe("fp_abc123");
  });
});

describe("AuthOrigins query helpers", () => {
  function createStore(): AuthOrigin[] {
    return [
      Object.assign(new AuthOrigin(), { id: "ao1", collectionRef: "col1", recordRef: "rec1", fingerprint: "fp1", created: "2024-01-01" }),
      Object.assign(new AuthOrigin(), { id: "ao2", collectionRef: "col1", recordRef: "rec1", fingerprint: "fp2", created: "2024-01-02" }),
      Object.assign(new AuthOrigin(), { id: "ao3", collectionRef: "col1", recordRef: "rec2", fingerprint: "fp3", created: "2024-01-03" }),
      Object.assign(new AuthOrigin(), { id: "ao4", collectionRef: "col2", recordRef: "rec3", fingerprint: "fp4", created: "2024-01-04" }),
    ];
  }

  test("findAllAuthOriginsByRecord", () => {
    const results = findAllAuthOriginsByRecord(createStore(), "col1", "rec1");
    expect(results.length).toBe(2);
  });

  test("findAllAuthOriginsByCollection", () => {
    const results = findAllAuthOriginsByCollection(createStore(), "col1");
    expect(results.length).toBe(3);
  });

  test("findAuthOriginById — found", () => {
    const result = findAuthOriginById(createStore(), "ao1");
    expect(result).not.toBeNull();
    expect(result!.fingerprint).toBe("fp1");
  });

  test("findAuthOriginById — not found", () => {
    const result = findAuthOriginById(createStore(), "nonexistent");
    expect(result).toBeNull();
  });

  test("findAuthOriginByRecordAndFingerprint", () => {
    const result = findAuthOriginByRecordAndFingerprint(createStore(), "col1", "rec1", "fp2");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ao2");
  });

  test("deleteAllAuthOriginsByRecord", () => {
    const store = createStore();
    const deleted = deleteAllAuthOriginsByRecord(store, "col1", "rec1");
    expect(deleted).toBe(2);
    expect(store.length).toBe(2);
    expect(store.every((ao) => ao.recordRef !== "rec1" || ao.collectionRef !== "col1")).toBe(true);
  });
});
