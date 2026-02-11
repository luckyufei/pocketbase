/**
 * ExternalAuth 查询辅助函数测试
 * 对照 Go 版 core/external_auth_query.go
 */

import { describe, test, expect } from "bun:test";
import {
  ExternalAuth,
  findAllExternalAuthsByRecord,
  findAllExternalAuthsByCollection,
  findFirstExternalAuthByExpr,
} from "./external_auth_query";

describe("ExternalAuth model", () => {
  test("basic getters/setters", () => {
    const ea = new ExternalAuth();
    ea.id = "ea_1";
    ea.collectionRef = "col_1";
    ea.recordRef = "rec_1";
    ea.provider = "google";
    ea.providerId = "google_user_123";

    expect(ea.id).toBe("ea_1");
    expect(ea.collectionRef).toBe("col_1");
    expect(ea.recordRef).toBe("rec_1");
    expect(ea.provider).toBe("google");
    expect(ea.providerId).toBe("google_user_123");
  });
});

describe("ExternalAuth query helpers", () => {
  const store: ExternalAuth[] = [
    Object.assign(new ExternalAuth(), { id: "ea1", collectionRef: "col1", recordRef: "rec1", provider: "google", providerId: "g1", created: "2024-01-01" }),
    Object.assign(new ExternalAuth(), { id: "ea2", collectionRef: "col1", recordRef: "rec1", provider: "github", providerId: "gh1", created: "2024-01-02" }),
    Object.assign(new ExternalAuth(), { id: "ea3", collectionRef: "col1", recordRef: "rec2", provider: "google", providerId: "g2", created: "2024-01-03" }),
    Object.assign(new ExternalAuth(), { id: "ea4", collectionRef: "col2", recordRef: "rec3", provider: "google", providerId: "g3", created: "2024-01-04" }),
  ];

  test("findAllExternalAuthsByRecord", () => {
    const results = findAllExternalAuthsByRecord(store, "col1", "rec1");
    expect(results.length).toBe(2);
    expect(results[0].provider).toBe("google");
    expect(results[1].provider).toBe("github");
  });

  test("findAllExternalAuthsByCollection", () => {
    const results = findAllExternalAuthsByCollection(store, "col1");
    expect(results.length).toBe(3);
  });

  test("findFirstExternalAuthByExpr — found", () => {
    const result = findFirstExternalAuthByExpr(store, { provider: "google", providerId: "g1" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ea1");
  });

  test("findFirstExternalAuthByExpr — not found", () => {
    const result = findFirstExternalAuthByExpr(store, { provider: "google", providerId: "nonexistent" });
    expect(result).toBeNull();
  });
});
