/**
 * Mail 模板测试
 * 对照 Go 版 mails/record.go
 */

import { describe, test, expect } from "bun:test";
import {
  resolveEmailTemplate,
  buildVerificationEmail,
  buildPasswordResetEmail,
  buildEmailChangeEmail,
  buildOTPEmail,
} from "./templates";

describe("resolveEmailTemplate", () => {
  test("replaces standard placeholders", () => {
    const template = "Hello {APP_NAME}, visit {APP_URL}. User: {RECORD:email}";
    const result = resolveEmailTemplate(template, {
      APP_NAME: "MyApp",
      APP_URL: "https://myapp.com",
      "RECORD:email": "test@example.com",
    });
    expect(result).toBe("Hello MyApp, visit https://myapp.com. User: test@example.com");
  });

  test("handles missing placeholders gracefully", () => {
    const template = "Hello {UNKNOWN}";
    const result = resolveEmailTemplate(template, {});
    expect(result).toBe("Hello {UNKNOWN}");
  });
});

describe("buildVerificationEmail", () => {
  test("builds verification email with token", () => {
    const email = buildVerificationEmail({
      appName: "TestApp",
      appUrl: "https://test.com",
      token: "ver_token_123",
      record: { email: "user@test.com", name: "John" },
    });
    expect(email.subject).toContain("Verify");
    expect(email.body).toContain("ver_token_123");
    expect(email.to).toBe("user@test.com");
  });
});

describe("buildPasswordResetEmail", () => {
  test("builds password reset email with token", () => {
    const email = buildPasswordResetEmail({
      appName: "TestApp",
      appUrl: "https://test.com",
      token: "reset_token_123",
      record: { email: "user@test.com" },
    });
    expect(email.subject).toContain("Reset");
    expect(email.body).toContain("reset_token_123");
    expect(email.to).toBe("user@test.com");
  });
});

describe("buildEmailChangeEmail", () => {
  test("builds email change email with token and new email", () => {
    const email = buildEmailChangeEmail({
      appName: "TestApp",
      appUrl: "https://test.com",
      token: "change_token_123",
      newEmail: "new@test.com",
      record: { email: "old@test.com" },
    });
    expect(email.subject).toContain("email");
    expect(email.body).toContain("change_token_123");
    expect(email.to).toBe("new@test.com");
  });
});

describe("buildOTPEmail", () => {
  test("builds OTP email with otpId and password", () => {
    const email = buildOTPEmail({
      appName: "TestApp",
      appUrl: "https://test.com",
      otpId: "otp_123",
      password: "456789",
      record: { email: "user@test.com" },
    });
    expect(email.subject).toContain("OTP");
    expect(email.body).toContain("456789");
    expect(email.to).toBe("user@test.com");
  });
});
