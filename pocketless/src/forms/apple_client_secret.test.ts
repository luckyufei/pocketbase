/**
 * Apple Client Secret 表单测试
 * 对照 Go 版 forms/apple_client_secret_test.go
 * T197
 */

import { describe, test, expect } from "bun:test";
import { validateAppleClientSecretForm } from "./apple_client_secret";

describe("validateAppleClientSecretForm", () => {
  test("所有字段填写通过", () => {
    const result = validateAppleClientSecretForm({
      clientId: "com.example.app",
      teamId: "TEAM123",
      keyId: "KEY456",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test("缺少 clientId", () => {
    const result = validateAppleClientSecretForm({
      teamId: "TEAM123",
      keyId: "KEY456",
      privateKey: "key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.clientId.code).toBe("validation_required");
  });

  test("缺少 teamId", () => {
    const result = validateAppleClientSecretForm({
      clientId: "com.example.app",
      keyId: "KEY456",
      privateKey: "key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.teamId.code).toBe("validation_required");
  });

  test("缺少 keyId", () => {
    const result = validateAppleClientSecretForm({
      clientId: "com.example.app",
      teamId: "TEAM123",
      privateKey: "key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.keyId.code).toBe("validation_required");
  });

  test("缺少 privateKey", () => {
    const result = validateAppleClientSecretForm({
      clientId: "com.example.app",
      teamId: "TEAM123",
      keyId: "KEY456",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.privateKey.code).toBe("validation_required");
  });

  test("所有字段缺失", () => {
    const result = validateAppleClientSecretForm({});
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors!).length).toBe(4);
  });

  test("空字符串等同于缺失", () => {
    const result = validateAppleClientSecretForm({
      clientId: "",
      teamId: "",
      keyId: "",
      privateKey: "",
    });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors!).length).toBe(4);
  });

  test("duration 为可选字段", () => {
    const result = validateAppleClientSecretForm({
      clientId: "id",
      teamId: "team",
      keyId: "key",
      privateKey: "pk",
      duration: 3600,
    });
    expect(result.valid).toBe(true);
  });
});
