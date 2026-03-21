/**
 * Record Upsert 表单测试
 * 对照 Go 版 forms/record_upsert_test.go
 * T198
 */

import { describe, test, expect } from "bun:test";
import { validateRecordUpsertForm } from "./record_upsert";

const mockRecord = { id: "test123" } as any;

describe("validateRecordUpsertForm", () => {
  test("无密码时通过", () => {
    const result = validateRecordUpsertForm({ record: mockRecord });
    expect(result.valid).toBe(true);
  });

  test("密码匹配通过", () => {
    const result = validateRecordUpsertForm({
      record: mockRecord,
      password: "123456",
      passwordConfirm: "123456",
    });
    expect(result.valid).toBe(true);
  });

  test("密码不匹配失败", () => {
    const result = validateRecordUpsertForm({
      record: mockRecord,
      password: "123456",
      passwordConfirm: "654321",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.passwordConfirm.code).toBe("validation_values_mismatch");
    expect(result.errors!.passwordConfirm.message).toBe("Values don't match.");
  });

  test("有密码无确认失败", () => {
    const result = validateRecordUpsertForm({
      record: mockRecord,
      password: "123456",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.passwordConfirm).toBeDefined();
  });

  test("无密码有确认通过（password 为空/falsy 不触发检查）", () => {
    const result = validateRecordUpsertForm({
      record: mockRecord,
      passwordConfirm: "123456",
    });
    expect(result.valid).toBe(true);
  });

  test("空字符串密码不触发检查", () => {
    const result = validateRecordUpsertForm({
      record: mockRecord,
      password: "",
      passwordConfirm: "something",
    });
    expect(result.valid).toBe(true);
  });

  test("oldPassword 字段不影响验证", () => {
    const result = validateRecordUpsertForm({
      record: mockRecord,
      password: "new123",
      passwordConfirm: "new123",
      oldPassword: "old456",
    });
    expect(result.valid).toBe(true);
  });
});
