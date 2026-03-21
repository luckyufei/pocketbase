/**
 * test_email.ts — 邮件测试表单
 * 与 Go 版 forms/test_email_send.go 对齐
 */

export const VALID_TEMPLATES = [
  "verification",
  "password-reset",
  "email-change",
  "otp",
  "login-alert",
] as const;

export type EmailTemplate = (typeof VALID_TEMPLATES)[number];

export interface TestEmailForm {
  email: string;
  template: EmailTemplate;
  collection?: string;
}

export function validateTestEmailForm(form: Partial<TestEmailForm>): {
  valid: boolean;
  errors?: Record<string, { code: string; message: string }>;
} {
  const errors: Record<string, { code: string; message: string }> = {};

  if (!form.email) {
    errors.email = { code: "validation_required", message: "Cannot be blank." };
  } else if (!form.email.includes("@")) {
    errors.email = { code: "validation_is_email", message: "Must be a valid email address." };
  }

  if (!form.template) {
    errors.template = { code: "validation_required", message: "Cannot be blank." };
  } else if (!VALID_TEMPLATES.includes(form.template as EmailTemplate)) {
    errors.template = { code: "validation_in_invalid", message: "Must be a valid value." };
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
