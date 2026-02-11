/**
 * 邮件测试表单测试
 * 对照 Go 版 forms/test_email_send_test.go
 * T199
 */

import { describe, test, expect } from "bun:test";
import { validateTestEmailForm, VALID_TEMPLATES } from "./test_email";

describe("VALID_TEMPLATES", () => {
  test("包含 5 种模板", () => {
    expect(VALID_TEMPLATES.length).toBe(5);
  });

  test("包含所有预期模板", () => {
    expect(VALID_TEMPLATES).toContain("verification");
    expect(VALID_TEMPLATES).toContain("password-reset");
    expect(VALID_TEMPLATES).toContain("email-change");
    expect(VALID_TEMPLATES).toContain("otp");
    expect(VALID_TEMPLATES).toContain("login-alert");
  });
});

describe("validateTestEmailForm", () => {
  test("有效表单通过", () => {
    const result = validateTestEmailForm({
      email: "user@example.com",
      template: "verification",
    });
    expect(result.valid).toBe(true);
  });

  test("所有 5 种模板均通过", () => {
    for (const template of VALID_TEMPLATES) {
      const result = validateTestEmailForm({
        email: "user@example.com",
        template,
      });
      expect(result.valid).toBe(true);
    }
  });

  test("缺少 email", () => {
    const result = validateTestEmailForm({ template: "verification" });
    expect(result.valid).toBe(false);
    expect(result.errors!.email.code).toBe("validation_required");
  });

  test("无效 email（无 @）", () => {
    const result = validateTestEmailForm({
      email: "not-an-email",
      template: "verification",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.email.code).toBe("validation_is_email");
  });

  test("缺少 template", () => {
    const result = validateTestEmailForm({ email: "user@example.com" });
    expect(result.valid).toBe(false);
    expect(result.errors!.template.code).toBe("validation_required");
  });

  test("无效 template", () => {
    const result = validateTestEmailForm({
      email: "user@example.com",
      template: "invalid-template" as any,
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.template.code).toBe("validation_in_invalid");
  });

  test("所有字段缺失", () => {
    const result = validateTestEmailForm({});
    expect(result.valid).toBe(false);
    expect(result.errors!.email).toBeDefined();
    expect(result.errors!.template).toBeDefined();
  });

  test("空字符串 email", () => {
    const result = validateTestEmailForm({ email: "", template: "otp" });
    expect(result.valid).toBe(false);
    expect(result.errors!.email.code).toBe("validation_required");
  });

  test("collection 为可选字段", () => {
    const result = validateTestEmailForm({
      email: "user@example.com",
      template: "verification",
      collection: "users",
    });
    expect(result.valid).toBe(true);
  });
});
