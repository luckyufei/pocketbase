/**
 * settings_forms.test.ts — T122-T124 Settings API + 表单测试
 * 对照 Go 版 apis/settings.go, forms/test_s3_filesystem.go, forms/test_email_send.go
 */
import { describe, test, expect } from "bun:test";
import { Settings, newDefaultSettings } from "../core/settings_model";
import { validateTestS3Form, type TestS3Form } from "../forms/test_s3";
import {
  validateTestEmailForm,
  VALID_TEMPLATES,
  type TestEmailForm,
} from "../forms/test_email";
import {
  validateAppleClientSecretForm,
  type AppleClientSecretForm,
} from "../forms/apple_client_secret";
import {
  validateRecordUpsertForm,
  type RecordUpsertForm,
} from "../forms/record_upsert";

// ============================================================
// T122: Settings API 端点
// ============================================================

describe("Settings API", () => {
  test("GET /api/settings — 默认值结构完整", () => {
    const settings = newDefaultSettings();
    const json = settings.toJSON();

    // 验证 9 个子配置都存在
    expect(json.meta).toBeDefined();
    expect(json.smtp).toBeDefined();
    expect(json.s3).toBeDefined();
    expect(json.backups).toBeDefined();
    expect(json.batch).toBeDefined();
    expect(json.logs).toBeDefined();
    expect(json.analytics).toBeDefined();
    expect(json.rateLimits).toBeDefined();
    expect(json.trustedProxy).toBeDefined();
  });

  test("GET /api/settings — 敏感字段被掩码", () => {
    const settings = newDefaultSettings();
    settings.smtp.password = "secret123";
    settings.s3.secret = "s3secret";
    settings.backups.s3.secret = "backupsecret";

    const json = settings.toJSON();
    expect(json.smtp.password).toBe("");
    expect(json.s3.secret).toBe("");
    expect(json.backups.s3.secret).toBe("");
  });

  test("PATCH /api/settings — 部分更新", () => {
    const settings = newDefaultSettings();
    expect(settings.meta.appName).toBe("Acme");

    // 模拟 PATCH 部分更新
    Object.assign(settings.meta, { appName: "MyApp" });
    expect(settings.meta.appName).toBe("MyApp");
    // 其他字段不变
    expect(settings.meta.appURL).toBe("http://localhost:8090");
  });

  test("PATCH /api/settings — batch 配置更新", () => {
    const settings = newDefaultSettings();
    expect(settings.batch.enabled).toBe(false);

    Object.assign(settings.batch, { enabled: true, maxRequests: 100 });
    expect(settings.batch.enabled).toBe(true);
    expect(settings.batch.maxRequests).toBe(100);
    expect(settings.batch.timeout).toBe(3); // 未改
  });

  test("Settings clone 独立性", () => {
    const s1 = newDefaultSettings();
    s1.meta.appName = "Original";
    const s2 = s1.clone();
    s2.meta.appName = "Cloned";

    expect(s1.meta.appName).toBe("Original");
    expect(s2.meta.appName).toBe("Cloned");
  });
});

// ============================================================
// T123: S3/Email 测试端点
// ============================================================

describe("TestS3Form", () => {
  test("filesystem = storage 有效", () => {
    const result = validateTestS3Form({ filesystem: "storage" });
    expect(result.valid).toBe(true);
  });

  test("filesystem = backups 有效", () => {
    const result = validateTestS3Form({ filesystem: "backups" });
    expect(result.valid).toBe(true);
  });

  test("空 filesystem 无效", () => {
    const result = validateTestS3Form({});
    expect(result.valid).toBe(false);
    expect(result.errors!.filesystem.code).toBe("validation_required");
  });

  test("无效 filesystem 值", () => {
    const result = validateTestS3Form({ filesystem: "invalid" as any });
    expect(result.valid).toBe(false);
    expect(result.errors!.filesystem.code).toBe("validation_in_invalid");
  });
});

describe("TestEmailForm", () => {
  test("VALID_TEMPLATES 包含 5 种模板", () => {
    expect(VALID_TEMPLATES).toContain("verification");
    expect(VALID_TEMPLATES).toContain("password-reset");
    expect(VALID_TEMPLATES).toContain("email-change");
    expect(VALID_TEMPLATES).toContain("otp");
    expect(VALID_TEMPLATES).toContain("login-alert");
    expect(VALID_TEMPLATES.length).toBe(5);
  });

  test("合法表单通过", () => {
    const result = validateTestEmailForm({
      email: "test@example.com",
      template: "verification",
    });
    expect(result.valid).toBe(true);
  });

  test("空 email 无效", () => {
    const result = validateTestEmailForm({ template: "verification" });
    expect(result.valid).toBe(false);
    expect(result.errors!.email.code).toBe("validation_required");
  });

  test("无效 email 格式", () => {
    const result = validateTestEmailForm({
      email: "not-an-email",
      template: "verification",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.email.code).toBe("validation_is_email");
  });

  test("空 template 无效", () => {
    const result = validateTestEmailForm({ email: "test@example.com" });
    expect(result.valid).toBe(false);
    expect(result.errors!.template.code).toBe("validation_required");
  });

  test("无效 template 值", () => {
    const result = validateTestEmailForm({
      email: "test@example.com",
      template: "invalid" as any,
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.template.code).toBe("validation_in_invalid");
  });
});

// ============================================================
// T124: 其他表单
// ============================================================

describe("AppleClientSecretForm", () => {
  test("完整表单通过", () => {
    const result = validateAppleClientSecretForm({
      clientId: "com.example.app",
      teamId: "ABCDE12345",
      keyId: "KEY12345",
      privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
    });
    expect(result.valid).toBe(true);
  });

  test("缺少 clientId", () => {
    const result = validateAppleClientSecretForm({
      teamId: "ABCDE",
      keyId: "KEY",
      privateKey: "key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.clientId.code).toBe("validation_required");
  });

  test("缺少所有字段", () => {
    const result = validateAppleClientSecretForm({});
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors!).length).toBe(4);
  });
});

describe("RecordUpsertForm", () => {
  test("密码不匹配报错", () => {
    const result = validateRecordUpsertForm({
      record: {} as any,
      password: "pass1",
      passwordConfirm: "pass2",
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.passwordConfirm.code).toBe("validation_values_mismatch");
  });

  test("密码匹配通过", () => {
    const result = validateRecordUpsertForm({
      record: {} as any,
      password: "pass1",
      passwordConfirm: "pass1",
    });
    expect(result.valid).toBe(true);
  });

  test("无密码通过", () => {
    const result = validateRecordUpsertForm({
      record: {} as any,
    });
    expect(result.valid).toBe(true);
  });
});
