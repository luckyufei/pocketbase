/**
 * 邮件模板
 * 与 Go 版 mails/record.go 对齐
 *
 * 提供 4 种邮件构建函数：verification, passwordReset, emailChange, OTP
 * 以及通用的模板占位符替换
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

/** 替换模板中的 {PLACEHOLDER} 占位符 */
export function resolveEmailTemplate(
  template: string,
  placeholders: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// ─── 邮件构建函数 ───

interface VerificationEmailParams {
  appName: string;
  appUrl: string;
  token: string;
  record: { email: string; name?: string };
}

export function buildVerificationEmail(params: VerificationEmailParams): EmailMessage {
  const subject = `Verify your ${params.appName} email`;
  const body = resolveEmailTemplate(
    `Hello,\n\nClick on the link below to verify your email address.\n\n{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\n\nIf you did not request this email, you can ignore it.\n\nThanks,\n{APP_NAME} team`,
    {
      APP_NAME: params.appName,
      APP_URL: params.appUrl,
      TOKEN: params.token,
    },
  );

  return {
    to: params.record.email,
    subject,
    body,
  };
}

interface PasswordResetEmailParams {
  appName: string;
  appUrl: string;
  token: string;
  record: { email: string };
}

export function buildPasswordResetEmail(params: PasswordResetEmailParams): EmailMessage {
  const subject = `Reset your ${params.appName} password`;
  const body = resolveEmailTemplate(
    `Hello,\n\nClick on the link below to reset your password.\n\n{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\n\nIf you did not request this email, you can ignore it.\n\nThanks,\n{APP_NAME} team`,
    {
      APP_NAME: params.appName,
      APP_URL: params.appUrl,
      TOKEN: params.token,
    },
  );

  return {
    to: params.record.email,
    subject,
    body,
  };
}

interface EmailChangeParams {
  appName: string;
  appUrl: string;
  token: string;
  newEmail: string;
  record: { email: string };
}

export function buildEmailChangeEmail(params: EmailChangeParams): EmailMessage {
  const subject = `Confirm your ${params.appName} new email`;
  const body = resolveEmailTemplate(
    `Hello,\n\nClick on the link below to confirm your new email address.\n\n{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\n\nIf you did not request this email, you can ignore it.\n\nThanks,\n{APP_NAME} team`,
    {
      APP_NAME: params.appName,
      APP_URL: params.appUrl,
      TOKEN: params.token,
    },
  );

  return {
    to: params.newEmail,
    subject,
    body,
  };
}

interface OTPEmailParams {
  appName: string;
  appUrl: string;
  otpId: string;
  password: string;
  record: { email: string };
}

export function buildOTPEmail(params: OTPEmailParams): EmailMessage {
  const subject = `${params.appName} OTP`;
  const body = resolveEmailTemplate(
    `Hello,\n\nYour one-time password is: {OTP}\n\nOTP ID: {OTP_ID}\n\nIf you did not request this email, you can ignore it.\n\nThanks,\n{APP_NAME} team`,
    {
      APP_NAME: params.appName,
      APP_URL: params.appUrl,
      OTP: params.password,
      OTP_ID: params.otpId,
    },
  );

  return {
    to: params.record.email,
    subject,
    body,
  };
}
